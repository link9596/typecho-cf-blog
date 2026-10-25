import type { PluginInitContext } from 'typecho/plugin-sdk';
import { loadPluginConfig } from 'typecho/plugin-sdk';

const NETEASE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">' +
  '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ' +
  'd="M9 4c-2.93 1.346-5 5.046-5 8.492C4 17 8 20 12 20s8-3 8-7c0-3.513-3.5-5.513-6-5.513S9 9 9 12c0 2 1.5 3 3 3s3-1 3-3c0-3.513-2-4.508-2-6.515c0-3.504 3.5-2.603 4-1.502"></path>' +
  '</svg>';

export default function init({ addHook, pluginId }: PluginInitContext): void {
  // ========== 前台注入：自动转换网易云链接 =====
  addHook(
    'archive:footer',
    pluginId,
    (html: string, extra?: { options?: Record<string, unknown> }) => {
      const config = loadPluginConfig(extra?.options ?? {}, pluginId);

      const apiBase = String(config.apiBase || 'https://api.qijieya.cn/meting');
      const pathType = String(config.pathType || '?type=');
      const pathId = String(config.pathId || '&id=');
      const playerSize = String(config.playerSize || 'small');
      const contentSelector = String(config.contentSelector || '');
      const playerScriptUrl = String(config.playerScriptUrl || '');
      const enableFrontend = config.enableFrontend !== '0';

      if (!enableFrontend) return html;

      const parts: string[] = [];

      if (playerScriptUrl) {
        parts.push(`<script is:inline src="${playerScriptUrl}"><\/script>`);
      }

      parts.push(`
<script>
(function() {
  var API_BASE = ${JSON.stringify(apiBase)};
  var PATH_TYPE = ${JSON.stringify(pathType)};
  var PATH_ID = ${JSON.stringify(pathId)};
  var SIZE = ${JSON.stringify(playerSize)};
  var CONTENT_SELECTOR = ${JSON.stringify(contentSelector)};

  var URL_RE_SOURCE = 'https?:\\\\/\\\\/(?:y\\\\.)?music\\\\.163\\\\.com\\\\/[^\\\\s，。；、）)】\\\\]"\\'<>]+';

  function buildTag(type, id) {
    var api = API_BASE + PATH_TYPE + type + PATH_ID + id;
    return '<mood-player size="' + SIZE + '" api="' + api.replace(/&/g, '&amp;') + '"></mood-player>';
  }

  function extractFromUrl(url) {
    var idMatch = url.match(/[?&]id=(\\d+)/);
    if (!idMatch) return null;
    var type = null;
    if (/\\/song\\b/.test(url)) type = 'song';
    else if (/\\/playlist\\b/.test(url)) type = 'playlist';
    if (!type) return null;
    return { type: type, id: idMatch[1] };
  }

  function convertUrl(url) {
    var info = extractFromUrl(url);
    return info ? buildTag(info.type, info.id) : null;
  }

  function makeEl(tagHtml) {
    var wrapper = document.createElement('span');
    wrapper.innerHTML = tagHtml;
    return wrapper.firstElementChild;
  }

  function findRoots() {
    if (CONTENT_SELECTOR) {
      try { return Array.prototype.slice.call(document.querySelectorAll(CONTENT_SELECTOR)); }
      catch (e) { return []; }
    }
    var sels = ['.post-content', '.entry-content', '.article-content', '.markdown-body', '.content', 'article'];
    for (var i = 0; i < sels.length; i++) {
      var els = document.querySelectorAll(sels[i]);
      if (els.length) return Array.prototype.slice.call(els);
    }
    return [];
  }

  function processRoot(root) {
    if (!root || root.getAttribute('data-ne-processed') === '1') return;
    root.setAttribute('data-ne-processed', '1');

    var links = root.querySelectorAll('a[href*="music.163.com"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var tag = convertUrl(a.getAttribute('href') || '');
      if (tag) {
        var el = makeEl(tag);
        if (el) a.parentNode.replaceChild(el, a);
      }
    }

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        if (!node.nodeValue || node.nodeValue.indexOf('music.163.com') === -1) {
          return NodeFilter.FILTER_REJECT;
        }
        var p = node.parentNode;
        while (p && p !== root) {
          if (p.tagName) {
            var tn = p.tagName.toLowerCase();
            if (tn === 'mood-player' || tn === 'script' || tn === 'style') {
              return NodeFilter.FILTER_REJECT;
            }
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    var urlRe = new RegExp(URL_RE_SOURCE, 'g');

    textNodes.forEach(function(node) {
      var text = node.nodeValue;
      urlRe.lastIndex = 0;
      var m, lastIndex = 0, frag = null, hasMatch = false;

      while ((m = urlRe.exec(text)) !== null) {
        var tag = convertUrl(m[0]);
        if (!tag) continue;
        if (!frag) frag = document.createDocumentFragment();
        hasMatch = true;
        if (m.index > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
        }
        var el = makeEl(tag);
        if (el) frag.appendChild(el);
        lastIndex = m.index + m[0].length;
      }

      if (hasMatch && frag) {
        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        node.parentNode.replaceChild(frag, node);
      }
    });
  }

  function run() {
    var roots = findRoots();
    for (var i = 0; i < roots.length; i++) processRoot(roots[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  function onSwupPageView() { requestAnimationFrame(run); }
  document.addEventListener('page:view', onSwupPageView);
  document.addEventListener('swup:page:view', onSwupPageView);
})();
<\/script>`);

      return html + '\n' + parts.join('\n');
    }
  );

  // ========== 后台编辑器注入：按钮 + 对话框 ===
  addHook(
    'admin:writePost:bottom',
    pluginId,
    (html: string, extra?: { options?: Record<string, unknown> }) => {
      const config = loadPluginConfig(extra?.options ?? {}, pluginId);
      if (config.enableEditor === '0') return html;

      const apiBase = String(config.apiBase || 'https://api.qijieya.cn/meting');
      const pathType = String(config.pathType || '?type=');
      const pathId = String(config.pathId || '&id=');
      const playerSize = String(config.playerSize || 'small');

      const ui = `
<div id="netease-dialog" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:10000; background:#fff; border:1px solid #ccc; border-radius:6px; box-shadow:0 4px 20px rgba(0,0,0,0.18); padding:20px; width:520px; max-width:92vw; box-sizing:border-box;">
  <p style="margin:0 0 12px; font-weight:600; font-size:14px;">插入网易云音乐</p>
  <p style="margin:0 0 6px; font-size:13px; color:#555;">粘贴分享文本或链接：</p>
  <textarea id="ne-dialog-input" style="width:100%; height:90px; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box; font-family:inherit; font-size:13px; resize:vertical; outline:none;" placeholder="例如：分享陈绮贞的单曲《天天想你》: https://y.music.163.com/m/song?id=26348068&userid=..."></textarea>
  <div id="ne-dialog-preview" style="margin:10px 0; padding:8px 10px; background:#f6f8fa; border-radius:4px; font-size:12px; color:#555; min-height:18px; word-break:break-all;"></div>
  <div style="text-align:right;">
    <button type="button" class="btn btn-s primary" id="ne-dialog-ok">插入</button>
    <button type="button" class="btn btn-s" id="ne-dialog-cancel" style="margin-left:8px;">取消</button>
  </div>
</div>
<div id="netease-fallback-container" style="margin-bottom:8px;"></div>

<script is:inline>
(function() {
  var API_BASE = ${JSON.stringify(apiBase)};
  var PATH_TYPE = ${JSON.stringify(pathType)};
  var PATH_ID = ${JSON.stringify(pathId)};
  var SIZE = ${JSON.stringify(playerSize)};

  function parseNetease(text) {
    var m = text.match(/music\\.163\\.com\\/[^\\s，。；、）)】\\]"\\'<>]+/);
    if (!m) return null;
    var url = m[0];
    var idMatch = url.match(/[?&]id=(\\d+)/);
    if (!idMatch) return null;
    var type = null;
    if (/\\/song\\b/.test(url)) type = 'song';
    else if (/\\/playlist\\b/.test(url)) type = 'playlist';
    if (!type) return null;
    return { type: type, id: idMatch[1] };
  }

  function buildTag(type, id) {
    var api = API_BASE + PATH_TYPE + type + PATH_ID + id;
    return '<mood-player size="' + SIZE + '" api="' + api.replace(/&/g, '&amp;') + '"></mood-player>';
  }

  function initDialog() {
    var dialog = document.getElementById('netease-dialog');
    if (!dialog) return;
    var input = document.getElementById('ne-dialog-input');
    var preview = document.getElementById('ne-dialog-preview');
    var okBtn = document.getElementById('ne-dialog-ok');
    var cancelBtn = document.getElementById('ne-dialog-cancel');
    var currentInfo = null;

    function updatePreview() {
      var text = input.value.trim();
      if (!text) { preview.textContent = ''; currentInfo = null; return; }
      var info = parseNetease(text);
      if (!info) {
        preview.textContent = '未识别到网易云歌曲 / 歌单链接';
        currentInfo = null;
        return;
      }
      currentInfo = info;
      preview.textContent = '已识别：' + (info.type === 'song' ? '单曲' : '歌单') +
        ' ID = ' + info.id + '   ->   ' + buildTag(info.type, info.id);
    }

    input.addEventListener('input', updatePreview);

    okBtn.addEventListener('click', function() {
      if (!currentInfo) {
        updatePreview();
        if (!currentInfo) { alert('请先粘贴有效的网易云歌曲 / 歌单链接'); return; }
      }
      var tag = buildTag(currentInfo.type, currentInfo.id);
      var editor = document.getElementById('text');
      if (editor && editor.tagName === 'TEXTAREA') {
        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        var text = editor.value;
        editor.value = text.substring(0, start) + tag + text.substring(end);
        editor.selectionStart = editor.selectionEnd = start + tag.length;
        editor.focus();
      } else {
        alert('未找到可用的编辑器，请确保光标在内容区域');
        return;
      }
      dialog.style.display = 'none';
      input.value = '';
      preview.textContent = '';
      currentInfo = null;
    });

    cancelBtn.addEventListener('click', function() { dialog.style.display = 'none'; });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && dialog.style.display !== 'none') {
        dialog.style.display = 'none';
      }
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        okBtn.click();
      }
    });
  }

  function findWmdButtonRow() {
    var row = document.getElementById('wmd-button-row');
    if (row) return row;
    row = document.querySelector('ul.wmd-button-row');
    if (row) return row;
    var bar = document.getElementById('wmd-button-bar');
    if (bar) {
      row = bar.querySelector('ul.wmd-button-row');
      if (row) return row;
    }
    var uls = document.querySelectorAll('ul');
    for (var i = 0; i < uls.length; i++) {
      if (uls[i].className && uls[i].className.indexOf('wmd-button') !== -1) return uls[i];
    }
    return null;
  }

  var svgIcon = '${NETEASE_ICON.replace(/'/g, "\\'")}';

  function openDialog() {
    var dialog = document.getElementById('netease-dialog');
    if (!dialog) return;
    dialog.style.display = 'block';
    var input = document.getElementById('ne-dialog-input');
    if (input) setTimeout(function() { input.focus(); }, 50);
  }

  function addButton() {
    var row = findWmdButtonRow();
    if (!row) return false;
    if (document.getElementById('wmd-netease-button')) return true;

    var spacer = document.createElement('li');
    spacer.className = 'wmd-spacer';
    row.appendChild(spacer);

    var item = document.createElement('li');
    item.id = 'wmd-netease-button';
    item.className = 'wmd-button';
    item.title = '插入网易云音乐';
    item.setAttribute('aria-label', '插入网易云音乐');
    item.style.cursor = 'pointer';
    item.style.padding = '4px 4px 0px 4px';
    item.style.display = 'inline';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'center';
    item.innerHTML = svgIcon;
    item.addEventListener('click', openDialog);

    row.appendChild(item);
    return true;
  }

  function initButton() {
    if (addButton()) return;
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      if (addButton()) {
        clearInterval(timer);
      } else if (attempts >= 100) {
        clearInterval(timer);
        var container = document.getElementById('netease-fallback-container');
        if (container && !container.querySelector('.netease-fallback-btn')) {
          var fb = document.createElement('button');
          fb.className = 'netease-fallback-btn';
          fb.type = 'button';
          fb.style.margin = '4px 0';
          fb.style.display = 'inline-flex';
          fb.style.alignItems = 'center';
          fb.style.gap = '4px';
          fb.innerHTML = svgIcon + ' 网易云';
          fb.title = '插入网易云音乐';
          fb.addEventListener('click', openDialog);
          container.appendChild(fb);
        }
      }
    }, 100);
  }

  initDialog();
  initButton();
})();
<\/script>`;

      return html + ui;
    }
  );

  addHook(
    'admin:writePage:bottom',
    pluginId,
    (html: string, extra?: { options?: Record<string, unknown> }) => {
      const config = loadPluginConfig(extra?.options ?? {}, pluginId);
      if (config.enableEditor === '0') return html;

      const apiBase = String(config.apiBase || 'https://api.qijieya.cn/meting');
      const pathType = String(config.pathType || '?type=');
      const pathId = String(config.pathId || '&id=');
      const playerSize = String(config.playerSize || 'small');

      const ui = `
<div id="netease-dialog" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:10000; background:#fff; border:1px solid #ccc; border-radius:6px; box-shadow:0 4px 20px rgba(0,0,0,0.18); padding:20px; width:520px; max-width:92vw; box-sizing:border-box;">
  <p style="margin:0 0 12px; font-weight:600; font-size:14px;">插入网易云音乐</p>
  <p style="margin:0 0 6px; font-size:13px; color:#555;">粘贴分享文本或链接：</p>
  <textarea id="ne-dialog-input" style="width:100%; height:90px; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box; font-family:inherit; font-size:13px; resize:vertical; outline:none;" placeholder="例如：分享陈绮贞的单曲《天天想你》: https://y.music.163.com/m/song?id=26348068&userid=..."></textarea>
  <div id="ne-dialog-preview" style="margin:10px 0; padding:8px 10px; background:#f6f8fa; border-radius:4px; font-size:12px; color:#555; min-height:18px; word-break:break-all;"></div>
  <div style="text-align:right;">
    <button type="button" class="btn btn-s primary" id="ne-dialog-ok">插入</button>
    <button type="button" class="btn btn-s" id="ne-dialog-cancel" style="margin-left:8px;">取消</button>
  </div>
</div>
<div id="netease-fallback-container" style="margin-bottom:8px;"></div>

<script is:inline>
(function() {
  var API_BASE = ${JSON.stringify(apiBase)};
  var PATH_TYPE = ${JSON.stringify(pathType)};
  var PATH_ID = ${JSON.stringify(pathId)};
  var SIZE = ${JSON.stringify(playerSize)};

  function parseNetease(text) {
    var m = text.match(/music\\.163\\.com\\/[^\\s，。；、）)】\\]"\\'<>]+/);
    if (!m) return null;
    var url = m[0];
    var idMatch = url.match(/[?&]id=(\\d+)/);
    if (!idMatch) return null;
    var type = null;
    if (/\\/song\\b/.test(url)) type = 'song';
    else if (/\\/playlist\\b/.test(url)) type = 'playlist';
    if (!type) return null;
    return { type: type, id: idMatch[1] };
  }

  function buildTag(type, id) {
    var api = API_BASE + PATH_TYPE + type + PATH_ID + id;
    return '<mood-player size="' + SIZE + '" api="' + api.replace(/&/g, '&amp;') + '"></mood-player>';
  }

  function initDialog() {
    var dialog = document.getElementById('netease-dialog');
    if (!dialog) return;
    var input = document.getElementById('ne-dialog-input');
    var preview = document.getElementById('ne-dialog-preview');
    var okBtn = document.getElementById('ne-dialog-ok');
    var cancelBtn = document.getElementById('ne-dialog-cancel');
    var currentInfo = null;

    function updatePreview() {
      var text = input.value.trim();
      if (!text) { preview.textContent = ''; currentInfo = null; return; }
      var info = parseNetease(text);
      if (!info) {
        preview.textContent = '未识别到网易云歌曲 / 歌单链接';
        currentInfo = null;
        return;
      }
      currentInfo = info;
      preview.textContent = '已识别：' + (info.type === 'song' ? '单曲' : '歌单') +
        ' ID = ' + info.id + '   ->   ' + buildTag(info.type, info.id);
    }

    input.addEventListener('input', updatePreview);

    okBtn.addEventListener('click', function() {
      if (!currentInfo) {
        updatePreview();
        if (!currentInfo) { alert('请先粘贴有效的网易云歌曲 / 歌单链接'); return; }
      }
      var tag = buildTag(currentInfo.type, currentInfo.id);
      var editor = document.getElementById('text');
      if (editor && editor.tagName === 'TEXTAREA') {
        var start = editor.selectionStart;
        var end = editor.selectionEnd;
        var text = editor.value;
        editor.value = text.substring(0, start) + tag + text.substring(end);
        editor.selectionStart = editor.selectionEnd = start + tag.length;
        editor.focus();
      } else {
        alert('未找到可用的编辑器，请确保光标在内容区域');
        return;
      }
      dialog.style.display = 'none';
      input.value = '';
      preview.textContent = '';
      currentInfo = null;
    });

    cancelBtn.addEventListener('click', function() { dialog.style.display = 'none'; });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && dialog.style.display !== 'none') {
        dialog.style.display = 'none';
      }
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        okBtn.click();
      }
    });
  }

  function findWmdButtonRow() {
    var row = document.getElementById('wmd-button-row');
    if (row) return row;
    row = document.querySelector('ul.wmd-button-row');
    if (row) return row;
    var bar = document.getElementById('wmd-button-bar');
    if (bar) {
      row = bar.querySelector('ul.wmd-button-row');
      if (row) return row;
    }
    var uls = document.querySelectorAll('ul');
    for (var i = 0; i < uls.length; i++) {
      if (uls[i].className && uls[i].className.indexOf('wmd-button') !== -1) return uls[i];
    }
    return null;
  }

  var svgIcon = '${NETEASE_ICON.replace(/'/g, "\\'")}';

  function openDialog() {
    var dialog = document.getElementById('netease-dialog');
    if (!dialog) return;
    dialog.style.display = 'block';
    var input = document.getElementById('ne-dialog-input');
    if (input) setTimeout(function() { input.focus(); }, 50);
  }

  function addButton() {
    var row = findWmdButtonRow();
    if (!row) return false;
    if (document.getElementById('wmd-netease-button')) return true;

    var spacer = document.createElement('li');
    spacer.className = 'wmd-spacer';
    row.appendChild(spacer);

    var item = document.createElement('li');
    item.id = 'wmd-netease-button';
    item.className = 'wmd-button';
    item.title = '插入网易云音乐';
    item.setAttribute('aria-label', '插入网易云音乐');
    item.style.cursor = 'pointer';
    item.style.padding = '4px 4px 0px 4px';
    item.style.display = 'inline';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'center';
    item.innerHTML = svgIcon;
    item.addEventListener('click', openDialog);

    row.appendChild(item);
    return true;
  }

  function initButton() {
    if (addButton()) return;
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      if (addButton()) {
        clearInterval(timer);
      } else if (attempts >= 100) {
        clearInterval(timer);
        var container = document.getElementById('netease-fallback-container');
        if (container && !container.querySelector('.netease-fallback-btn')) {
          var fb = document.createElement('button');
          fb.className = 'netease-fallback-btn';
          fb.type = 'button';
          fb.style.margin = '4px 0';
          fb.style.display = 'inline-flex';
          fb.style.alignItems = 'center';
          fb.style.gap = '4px';
          fb.innerHTML = svgIcon + ' 网易云';
          fb.title = '插入网易云音乐';
          fb.addEventListener('click', openDialog);
          container.appendChild(fb);
        }
      }
    }, 100);
  }

  initDialog();
  initButton();
})();
<\/script>`;

      return html + ui;
    }
  );
}