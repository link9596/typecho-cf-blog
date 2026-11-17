import type { PluginInitContext } from 'typecho/plugin-sdk';
import { loadPluginConfig } from 'typecho/plugin-sdk';
import { addCspSource, type CspDirectives } from '@/lib/security-headers';

export default function init({ addHook, pluginId }: PluginInitContext): void {
  // ──  CSP 限制 ──
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

  // ── 2. 后台底部注入压缩脚本 ──
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

  // 多 CDN 回退加载（你之前网页验证过的那套）
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
        } catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('所有 CDN 均加载失败');
    })();
    return enginePromise;
  }

  function isImageFile(file) {
    return file.type && file.type.indexOf('image/') === 0
      && file.type !== 'image/gif'
      && file.type !== 'image/svg+xml'
      && file.type !== 'image/bmp';
  }

  async function compressFile(file) {
    if (!isImageFile(file)) return file;
    var engine;
    try { engine = await loadEngine(); }
    catch (e) { console.warn('[imgcompress] 引擎加载失败，使用原图:', e); return file; }

    try {
      var options = { quality: CONFIG.quality, preserveMetadata: false };
      if (CONFIG.maxDimension) options.maxDimension = CONFIG.maxDimension;
      if (CONFIG.outputFormat !== 'original') options.outputFormat = CONFIG.outputFormat;

      var result = await engine.compressImage(file, options);
      if (result.blob.size >= file.size) return file;

      var ext = result.output.format === 'jpeg' ? 'jpg' : result.output.format;
      var name = file.name.replace(/\\.[^.]+$/, '') + '.' + ext;
      console.log('[imgcompress]', file.name, '→', name,
        (file.size/1024).toFixed(0) + 'KB →', (result.blob.size/1024).toFixed(0) + 'KB');
      return new File([result.blob], name, { type: result.blob.type });
    } catch (e) {
      console.warn('[imgcompress] 压缩失败，使用原图:', e);
      return file;
    }
  }

  // 拦截 file input（capture 阶段先于原 handler）
  function patchFileInput() {
    var input = document.getElementById('file-input');
    if (!input || input.__icPatched) return;
    input.__icPatched = true;

    input.addEventListener('change', async function(e) {
      if (input.__icRelease) return;
      e.stopImmediatePropagation();
      var files = Array.prototype.slice.call(input.files || []);
      var done = [];
      for (var i = 0; i < files.length; i++) done.push(await compressFile(files[i]));
      var dt = new DataTransfer();
      done.forEach(function(f) { dt.items.add(f); });
      input.files = dt.files;
      input.__icRelease = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.__icRelease = false;
    }, true);
  }

  // 拦截拖放
  function patchDrop() {
    var area = document.querySelector('.upload-area');
    if (!area || area.__icPatched) return;
    area.__icPatched = true;
    area.addEventListener('drop', async function(e) {
      if (e.__icHandled) return;
      e.stopImmediatePropagation();
      var files = Array.prototype.slice.call(e.dataTransfer.files || []);
      var done = [];
      for (var i = 0; i < files.length; i++) done.push(await compressFile(files[i]));
      var dt = new DataTransfer();
      done.forEach(function(f) { dt.items.add(f); });
      var ev = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
      ev.__icHandled = true;
      area.dispatchEvent(ev);
    }, true);
  }

  function init() { patchFileInput(); patchDrop(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
  document.addEventListener('page:view', init);

  // 提前预热引擎（用户选文件前就开始加载，不拦也不阻塞）
  loadEngine().catch(function(){});
})();
<\/script>
`;
    return html + script;
  });
}
