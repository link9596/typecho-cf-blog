import type { PluginInitContext } from 'typecho/plugin-sdk';
import { loadPluginConfig } from 'typecho/plugin-sdk';

type CspDirectives = Record<string, string[]>;

function addCspSource(directives: CspDirectives, key: string, sources: string[]): void {
  const existing = new Set(directives[key] || []);
  for (const src of sources) existing.add(src);
  directives[key] = Array.from(existing);
}

export default function init({ addHook, pluginId }: PluginInitContext): void {
  // ── 1. 放开 CDN / Worker 的 CSP 限制 ──
  addHook('csp:directives', pluginId, (directives: CspDirectives) => {
    const cdns = [
      'https://fastly.jsdelivr.net',
      'https://cdn.jsdelivr.net',
      'https://unpkg.com',
      'https://esm.sh',
    ];
    addCspSource(directives, 'script-src', cdns);
    addCspSource(directives, 'connect-src', cdns);
    addCspSource(directives, 'worker-src', [...cdns, 'blob:']);
    return directives;
  });

  // ── 2. 后台底部注入压缩脚本（含 iOS 三层降级） ──
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
  var CONFIG = ${JSON.stringify(cfg)};
  var enginePromise = null;

  /* ============ 能力预检 ============ */
  function envCapable() {
    // 没有 WebAssembly 就不加载 WASM 编码器，直接走 Canvas 兜底
    if (typeof WebAssembly === 'undefined') return false;
    // 缺 canvas 2d 上下文时引擎和兜底都没意义
    var testCanvas = document.createElement('canvas');
    if (!testCanvas.getContext('2d')) return false;
    return true;
  }

  /* ============ 引擎加载（多 CDN 回退 + 缓存） ============ */
  function loadEngine() {
    if (enginePromise) return enginePromise;
    var CDN_LIST = [
      'https://fastly.jsdelivr.net/npm/@imgcompress/engine@1.0.0/+esm',
      'https://cdn.jsdelivr.net/npm/@imgcompress/engine@1.0.0/+esm',
      'https://unpkg.com/@imgcompress/engine@1.0.0/+esm',
      'https://esm.sh/@imgcompress/engine@1.0.0'
    ];
    enginePromise = (async function() {
      var lastErr = null;
      for (var i = 0; i < CDN_LIST.length; i++) {
        try {
          var mod = await import(CDN_LIST[i]);
          console.log('[imgcompress] 引擎已加载:', CDN_LIST[i]);
          return mod;
        } catch (e) { lastErr = e; console.warn('[imgcompress] CDN 失败:', CDN_LIST[i], e && e.message); }
      }
      throw lastErr || new Error('all CDN failed');
    })();
    return enginePromise;
  }

  // 带超时的引擎压缩：worker 卡死 / WASM 加载慢时不无限等待
  function compressWithEngine(file, options) {
    var timeoutMs = 25000;
    return Promise.race([
      loadEngine().then(function(engine) { return engine.compressImage(file, options); }),
      new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('engine timeout ' + timeoutMs + 'ms')); }, timeoutMs);
      })
    ]);
  }

  /* ============ 第二层：Canvas 原生兜底（不依赖 Worker/WASM/createImageBitmap） ============ */
  function decodeViaImage(file) {
    return new Promise(function(resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function() { resolve(img); };
      img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('image decode failed')); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise(function(resolve, reject) {
      // Safari 对 webp 编码不可靠；toBlob 不支持时会回退默认格式，这里做检测
      canvas.toBlob(function(blob) {
        if (blob) resolve(blob); else reject(new Error('toBlob failed'));
      }, mime, quality);
    });
  }

  async function compressViaCanvas(file) {
    var img = await decodeViaImage(file);
    var srcW = img.naturalWidth, srcH = img.naturalHeight;
    if (!srcW || !srcH) throw new Error('zero dimensions');

    var scale = 1;
    if (CONFIG.maxDimension) {
      var longest = Math.max(srcW, srcH);
      if (longest > CONFIG.maxDimension) scale = CONFIG.maxDimension / longest;
    }
    var dstW = Math.max(1, Math.round(srcW * scale));
    var dstH = Math.max(1, Math.round(srcH * scale));

    var canvas = document.createElement('canvas');
    canvas.width = dstW; canvas.height = dstH;
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');

    // JPEG 不支持透明，先铺白底
    var isPng = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/avif';
    var outMime = isPng ? 'image/png' : 'image/jpeg';
    if (outMime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dstW, dstH);
    }
    ctx.drawImage(img, 0, 0, dstW, dstH);
    URL.revokeObjectURL(img.src);

    var blob = await canvasToBlob(canvas, outMime, isPng ? undefined : CONFIG.quality);

    // 兜底压完反而更大 → 返回 null，调用方用原图
    if (blob.size >= file.size) return null;

    var ext = outMime === 'image/jpeg' ? 'jpg' : 'png';
    var name = file.name.replace(/\\.[^.]+$/, '') + '.' + ext;
    try {
      return new File([blob], name, { type: outMime });
    } catch (e) {
      // 极老 iOS 没有 File 构造器，FormData 仍可接受 Blob
      return new Blob([blob], { type: outMime });
    }
  }

  /* ============ 文件判定 ============ */
  function isImageFile(file) {
    return file.type && file.type.indexOf('image/') === 0
      && file.type !== 'image/gif'
      && file.type !== 'image/svg+xml'
      && file.type !== 'image/bmp';
  }

  /* ============ 三层降级 ============ */
  async function compressFile(file) {
    if (!isImageFile(file)) return file;

    // 第一层：WASM 引擎（环境不支持就直接跳过）
    if (envCapable()) {
      try {
        var options = { quality: CONFIG.quality, preserveMetadata: false };
        if (CONFIG.maxDimension) options.maxDimension = CONFIG.maxDimension;
        // 兜底路径不强行 webp；引擎路径按配置，但 iOS 上 webp 编码依赖 WASM，失败会进兜底
        if (CONFIG.outputFormat !== 'original') options.outputFormat = CONFIG.outputFormat;

        var result = await compressWithEngine(file, options);
        if (result && result.blob && result.blob.size < file.size) {
          var ext = result.output.format === 'jpeg' ? 'jpg' : result.output.format;
          var name = file.name.replace(/\\.[^.]+$/, '') + '.' + ext;
          console.log('[imgcompress][engine]', file.name, '→', name,
            (file.size / 1024).toFixed(0) + 'KB →', (result.blob.size / 1024).toFixed(0) + 'KB');
          try { return new File([result.blob], name, { type: result.blob.type }); }
          catch (e) { return new Blob([result.blob], { type: result.blob.type }); }
        }
      } catch (e) {
        console.warn('[imgcompress][engine] 失败，转 Canvas 兜底:', e && (e.message || e.code || e));
      }
    } else {
      console.warn('[imgcompress] 环境不支持 WASM，直接走 Canvas 兜底');
    }

    // 第二层：Canvas 原生压缩
    try {
      var fallback = await compressViaCanvas(file);
      if (fallback) {
        console.log('[imgcompress][canvas]', file.name, '→', (fallback.size / 1024).toFixed(0) + 'KB');
        return fallback;
      }
    } catch (e) {
      console.warn('[imgcompress][canvas] 兜底也失败:', e && e.message);
    }

    // 第三层：原图
    return file;
  }

  /* ============ 拦截上传入口 ============ */
  var dataTransferSupported = typeof DataTransfer !== 'undefined';

  function buildDataTransfer(files) {
    var dt = new DataTransfer();
    files.forEach(function(f) { dt.items.add(f); });
    return dt;
  }

  function patchFileInput() {
    var input = document.getElementById('file-input');
    if (!input || input.__icPatched) return;
    // 低版本 Safari 没有 DataTransfer，无法改写 files，直接放行原图
    if (!dataTransferSupported) {
      console.warn('[imgcompress] 当前浏览器不支持 DataTransfer，跳过文件拦截');
      return;
    }
    input.__icPatched = true;

    input.addEventListener('change', async function(e) {
      if (input.__icRelease) return;
      e.stopImmediatePropagation();
      var files = Array.prototype.slice.call(input.files || []);
      var done;
      try {
        done = [];
        for (var i = 0; i < files.length; i++) done.push(await compressFile(files[i]));
        var dt = buildDataTransfer(done);
        input.files = dt.files;
      } catch (err) {
        console.warn('[imgcompress] 文件替换失败，放行原图:', err && err.message);
        input.files = files;
      }
      input.__icRelease = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.__icRelease = false;
    }, true);
  }

  function patchDrop() {
    var area = document.querySelector('.upload-area');
    if (!area || area.__icPatched) return;
    if (!dataTransferSupported) return;
    area.__icPatched = true;
    area.addEventListener('drop', async function(e) {
      if (e.__icHandled) return;
      e.stopImmediatePropagation();
      var files = Array.prototype.slice.call(e.dataTransfer.files || []);
      var done;
      try {
        done = [];
        for (var i = 0; i < files.length; i++) done.push(await compressFile(files[i]));
        var dt = buildDataTransfer(done);
        var ev = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
        ev.__icHandled = true;
        area.dispatchEvent(ev);
      } catch (err) {
        console.warn('[imgcompress] 拖放替换失败，放行原图:', err && err.message);
        e.__icHandled = true;
        area.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: e.dataTransfer }));
      }
    }, true);
  }

  function init() { patchFileInput(); patchDrop(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
  document.addEventListener('page:view', init);

  // 预热引擎（不阻塞上传）；iOS 低价值，也照做
  if (envCapable()) loadEngine().catch(function(){});
})();
<\/script>
`;
    return html + script;
  });
}
