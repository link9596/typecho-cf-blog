import type { PluginInitContext } from 'typecho/plugin-sdk';
import { loadPluginConfig } from 'typecho/plugin-sdk';
import { addCspSource, type CspDirectives } from '@/lib/security-headers';

const ENGINE_CDN = 'https://fastly.jsdelivr.net/npm/@imgcompress/engine@1.0.0/+esm';
const ENGINE_TIMEOUT = 6000;

export default function init({ addHook, pluginId }: PluginInitContext): void {
  addHook('csp:directives', pluginId, (directives: CspDirectives) => {
    const cdns = ['https://fastly.jsdelivr.net', 'https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://esm.sh'];
    addCspSource(directives, 'script-src', cdns);
    addCspSource(directives, 'connect-src', cdns);
    addCspSource(directives, 'worker-src', [...cdns, 'blob:']);
    return directives;
  });

  addHook('admin:footer', pluginId, (html: string, extra?: { options?: Record<string, unknown> }) => {
    const config = loadPluginConfig(extra?.options ?? {}, pluginId);
    const cfg = {
      quality: parseFloat(String(config.quality ?? '0.8')),
      maxDimension: config.maxDimension ? parseInt(String(config.maxDimension), 10) : undefined,
      outputFormat: config.outputFormat ?? 'webp',
    };

    const script = `
<script is:inline>
(function() {
  'use strict';

  var CONFIG = ${JSON.stringify(cfg)};
  var ENGINE_URL = '${ENGINE_CDN}';
  var ENGINE_TIMEOUT = ${ENGINE_TIMEOUT};

  // ─── 引擎加载：单一源 + 超时，不用多 CDN 回退（Safari 失败重试不可靠）───
  var enginePromise = null;

  function loadEngine() {
    if (enginePromise) return enginePromise;
    enginePromise = new Promise(function(resolve, reject) {
      var settled = false;
      var timer = setTimeout(function() {
        if (!settled) { settled = true; reject(new Error('引擎加载超时')); }
      }, ENGINE_TIMEOUT);

      import(ENGINE_URL).then(function(mod) {
        if (!settled) { settled = true; clearTimeout(timer); resolve(mod); }
      }).catch(function(err) {
        if (!settled) { settled = true; clearTimeout(timer); reject(err); }
      });
    });
    // 超时失败后允许后续重试一次（避免一次网络抖动就永久锁死）
    enginePromise.catch(function() { enginePromise = null; });
    return enginePromise;
  }

  // ─── 图片判定 ───
  function isCompressibleImage(file) {
    if (!file || !file.type) return false;
    if (file.type.indexOf('image/') !== 0) return false;
    if (file.type === 'image/gif') return false;
    if (file.type === 'image/svg+xml') return false;
    if (file.type === 'image/bmp') return false;
    return true;
  }

  // ─── 压缩核心 ───
  async function compressFile(file) {
    if (!isCompressibleImage(file)) return file;

    var engine;
    try { engine = await loadEngine(); }
    catch (e) {
      console.warn('[imgcompress] 引擎不可用，跳过压缩:', e);
      return file;
    }

    try {
      var options = { quality: CONFIG.quality, preserveMetadata: false };
      if (CONFIG.maxDimension) options.maxDimension = CONFIG.maxDimension;
      if (CONFIG.outputFormat !== 'original') options.outputFormat = CONFIG.outputFormat;

      var result = await engine.compressImage(file, options);
      if (!result || !result.blob || result.blob.size >= file.size) return file;

      var format = (result.output && result.output.format) || '';
      var ext = format === 'jpeg' ? 'jpg' : format;
      var name = file.name.replace(/\\.[^.]+$/, '') + '.' + ext;

      // 构造 File 可能在某些旧 iOS 上不稳定，用 Blob + 自定义 name 更稳妥
      var out;
      try {
        out = new File([result.blob], name, { type: result.blob.type });
      } catch (e) {
        out = result.blob;
        out.__icName = name;
      }

      console.log('[imgcompress]', file.name, '→', name,
        (file.size / 1024).toFixed(0) + 'KB →', (result.blob.size / 1024).toFixed(0) + 'KB');
      return out;
    } catch (e) {
      console.warn('[imgcompress] 压缩异常，使用原图:', e);
      return file;
    }
  }

  // ─── 从 FormData 中找出图片文件，压缩后替换 ───
  async function compressFormData(formData) {
    if (!formData || typeof formData.entries !== 'function') return formData;

    var replacements = [];
    var iter = formData.entries();
    var step;
    while (!(step = iter.next()).done) {
      var entry = step.value;
      var key = entry[0];
      var val = entry[1];
      if (val instanceof File && isCompressibleImage(val)) {
        replacements.push({ key: key, file: val });
      }
    }

    if (!replacements.length) return formData;

    for (var i = 0; i < replacements.length; i++) {
      var r = replacements[i];
      var compressed = await compressFile(r.file);
      if (compressed === r.file) continue;

      // 用压缩结果替换原字段（FormData.set 会覆盖同名 key）
      var filename = compressed.__icName || compressed.name || r.file.name;
      try {
        formData.set(r.key, compressed, filename);
      } catch (e) {
        // 如果 set 不支持第三参数，先 delete 再 append
        formData.delete(r.key);
        formData.append(r.key, compressed, filename);
      }
    }
    return formData;
  }

  // ─── 判断是否是 Typecho 的上传请求 ───
  function isUploadRequest(url) {
    if (!url) return false;
    try {
      return url.indexOf('/action/upload') !== -1
        || url.indexOf('/action/multi-upload') !== -1;
    } catch (e) { return false; }
  }

  // ─── 拦截 fetch ───
  var nativeFetch = window.fetch;
  if (nativeFetch) {
    window.fetch = function(input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if (isUploadRequest(url) && init && init.body instanceof FormData) {
          var body = init.body;
          return compressFormData(body).then(function(newBody) {
            var newInit = {};
            for (var k in init) { if (Object.prototype.hasOwnProperty.call(init, k)) newInit[k] = init[k]; }
            newInit.body = newBody;
            return nativeFetch.call(window, input, newInit);
          }).catch(function(e) {
            console.warn('[imgcompress] fetch 压缩流程异常，放行原请求:', e);
            return nativeFetch.call(window, input, init);
          });
        }
      } catch (e) {
        // 任何异常都放行，不能阻断正常上传
      }
      return nativeFetch.apply(window, arguments);
    };
  }

  // ─── 拦截 XMLHttpRequest（兜底，覆盖非 fetch 的上传路径）───
  var XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype && XHR.prototype.send) {
    var nativeSend = XHR.prototype.send;
    XHR.prototype.send = function(body) {
      if (body instanceof FormData) {
        var self = this;
        var url = '';
        try { url = self.__icUrl || ''; } catch (e) {}

        if (isUploadRequest(url)) {
          var args = arguments;
          compressFormData(body).then(function(newBody) {
            nativeSend.call(self, newBody);
          }).catch(function(e) {
            console.warn('[imgcompress] XHR 压缩异常，放行原请求:', e);
            nativeSend.apply(self, args);
          });
          return;
        }
      }
      return nativeSend.apply(this, arguments);
    };

    // 记录 open 的 URL，供 send 判断
    var nativeOpen = XHR.prototype.open;
    XHR.prototype.open = function(method, url) {
      try { this.__icUrl = url; } catch (e) {}
      return nativeOpen.apply(this, arguments);
    };
  }

  // ─── 预热引擎（不阻塞、不报错）───
  loadEngine().catch(function() {});

  console.log('[imgcompress] 已就绪（fetch / XHR 请求层拦截，兼容 iOS）');
})();
<\/script>
`;
    return html + script;
  });
}