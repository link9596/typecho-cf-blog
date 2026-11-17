import type { PluginInitContext } from 'typecho/plugin-sdk';
import { loadPluginConfig } from 'typecho/plugin-sdk';

export default function init({ addHook, pluginId }: PluginInitContext): void {
  addHook('admin:footer', pluginId, (html: string, extra?: { options?: Record<string, unknown> }) => {
    const config = loadPluginConfig(extra?.options ?? {}, pluginId);

    // 把配置序列化进前端脚本
    const configJson = JSON.stringify({
      quality: parseFloat(String(config.quality ?? '0.8')),
      maxDimension: parseInt(String(config.maxDimension ?? '1920'), 10),
      outputFormat: config.outputFormat ?? 'webp',
      maxFileSize: config.maxFileSize ? String(config.maxFileSize) : undefined,
    });

    const script = `
<script is:inline src="/js/imgcompress-bundle.js"></script>
<script is:inline>
(function() {
  var CONFIG = ${configJson};

  // 判断是不是图片
  function isImageFile(file) {
    return file.type && file.type.startsWith('image/')
      && !file.type.includes('gif')      // GIF 不动
      && !file.type.includes('svg');     // SVG 不动
  }

  // 压缩单个文件
  async function compressFile(file) {
    if (!isImageFile(file)) return file;
    if (typeof window.ImgCompressEngine === 'undefined') return file;

    try {
      var result = await window.ImgCompressEngine.compressImage(file, {
        quality: CONFIG.quality,
        maxDimension: CONFIG.maxDimension,
        outputFormat: CONFIG.outputFormat === 'original' ? undefined : CONFIG.outputFormat,
        maxFileSize: CONFIG.maxFileSize,
        preserveMetadata: false,
      });

      // 压缩后反而更大就用原图
      if (result.blob.size >= file.size) return file;

      // 构造新的 File 对象
      var ext = result.output.format === 'jpeg' ? 'jpg' : result.output.format;
      var name = file.name.replace(/\\.[^.]+$/, '') + '.' + ext;
      return new File([result.blob], name, { type: result.blob.type });
    } catch (e) {
      console.warn('[imgcompress] 压缩失败，使用原图:', e);
      return file;
    }
  }

  // 核心：劫持 file input 的 change 事件（capture 阶段先于原 handler）
  function patchFileInput() {
    var input = document.getElementById('file-input');
    if (!input || input.__imgcompressPatched) return;
    input.__imgcompressPatched = true;

    input.addEventListener('change', async function(e) {
      var files = Array.from(e.target.files || []);
      if (!files.length) return;

      // 先阻止原 handler 执行
      e.stopImmediatePropagation();

      var compressed = [];
      for (var i = 0; i < files.length; i++) {
        compressed.push(await compressFile(files[i]));
      }

      // 用压缩后的文件重建 FileList，再触发原逻辑
      var dt = new DataTransfer();
      compressed.forEach(function(f) { dt.items.add(f); });
      input.files = dt.files;

      // 手动触发 change，让原 handler 拿到压缩后的文件
      input.__imgcompressRelease = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.__imgcompressRelease = false;
    }, true);
  }

  // 同理 patch 拖放
  function patchDrop() {
    var area = document.querySelector('.upload-area');
    if (!area || area.__imgcompressPatched) return;
    area.__imgcompressPatched = true;

    area.addEventListener('drop', async function(e) {
      if (e.__imgcompressHandled) return;
      e.stopImmediatePropagation();

      var files = Array.from(e.dataTransfer.files || []);
      var compressed = [];
      for (var i = 0; i < files.length; i++) {
        compressed.push(await compressFile(files[i]));
      }

      // 重新构造 dataTransfer 事件
      var dt = new DataTransfer();
      compressed.forEach(function(f) { dt.items.add(f); });

      var newEvent = new DragEvent('drop', {
        bubbles: true, cancelable: true,
        dataTransfer: dt
      });
      newEvent.__imgcompressHandled = true;
      area.dispatchEvent(newEvent);
    }, true);
  }

  function init() {
    patchFileInput();
    patchDrop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // Swup 页面切换后重新 patch
  document.addEventListener('page:view', init);
})();
</script>
`;

    return html + script;
  });
}
