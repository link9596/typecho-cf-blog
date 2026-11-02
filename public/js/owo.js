/* =====================================================================
   OwO 表情组件 —— 面板 + 渲染器（二合一）
   对外暴露：
     window.OwOEmotion  短代码渲染器
     window.OwO         表情选择面板
   依赖：owo.css
   ===================================================================== */

(function (global) {
  'use strict';
  if (global.OwO && global.OwOEmotion) return;

  /* ===================================================================
     共享工具
     =================================================================== */
  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ===================================================================
     一、OwOEmotion —— 渲染器
     =================================================================== */
  const EMOTION_DEFAULTS = {
    baseUrl: 'https://emoji.lkin.cn/emojis/',
    packages: {
      tieba: { dir: 'tieba', prefix: 'tieba_', ext: 'png', marker: '@' },
      alus:  { dir: 'alus',  prefix: 'alus_',  ext: 'png', marker: '#' }
    },
    bigPrefix: 'big_',
    fallbackPackage: 'alus',
    imageClass: 'owo-emotion',
    largeImageClass: 'owo-emotion-large',
    resolve: null,       // (marker, name, option) => url | {url,isBig,fallbackUrl}
    pattern: null,       // 显式覆盖，默认由 marker 自动生成
    hint: null,          // 文本快筛字符，默认取最长 marker
    autoInit: false,
    autoSelector: '.comment-text'
  };

  function mergeEmotionOption(option) {
    const o = Object.assign({}, EMOTION_DEFAULTS);
    if (option) {
      for (const k in option) {
        if (Object.prototype.hasOwnProperty.call(option, k)) o[k] = option[k];
      }
    }

    /* packages 深合并 */
    const userPkgs = (option && option.packages) || {};
    const merged = {};
    Object.keys(EMOTION_DEFAULTS.packages).forEach(k => {
      merged[k] = Object.assign({}, EMOTION_DEFAULTS.packages[k], userPkgs[k] || {});
    });
    Object.keys(userPkgs).forEach(k => {
      if (!merged[k]) merged[k] = Object.assign({}, userPkgs[k]);
    });
    o.packages = merged;

    /* marker → 包 映射 */
    o._markerToPkg = {};
    Object.keys(o.packages).forEach(pkgName => {
      const pkg = o.packages[pkgName];
      if (pkg.marker) o._markerToPkg[pkg.marker] = pkgName;
    });

    /* 组合正则：按 marker 长度降序，避免短前缀抢先 */
    const markers = Object.keys(o._markerToPkg);
    if (markers.length > 0) {
      const sorted = markers.slice().sort((a, b) => b.length - a.length);
      const alternation = sorted.map(m => escapeRegExp(m)).join('|');
      o.pattern = new RegExp('(' + alternation + ')\\(([a-zA-Z0-9_]+)\\)', 'g');
      o.hint = sorted;
    } else {
      o.pattern = null;
      o.hint = null;
    }

    /* 用户显式 pattern 时覆盖 */
    if (option && option.pattern) {
      if (typeof o.pattern === 'string') {
        o.pattern = new RegExp(o.pattern, 'g');
      } else if (o.pattern instanceof RegExp && !o.pattern.global) {
        o.pattern = new RegExp(o.pattern.source, o.pattern.flags + 'g');
      }
      if (!Object.prototype.hasOwnProperty.call(option, 'hint')) o.hint = null;
    }

    return o;
  }

  function buildEmotionUrl(option, pkgName, realName) {
    const pkg = option.packages[pkgName];
    if (!pkg) return '';
    let base = pkg.baseUrl || option.baseUrl || '';
    if (base && base.charAt(base.length - 1) !== '/') base += '/';
    const dir = pkg.dir ? pkg.dir.replace(/\/+$/, '') + '/' : '';
    const prefix = pkg.prefix || '';
    const ext = pkg.ext ? (pkg.ext.charAt(0) === '.' ? pkg.ext : '.' + pkg.ext) : '';
    return base + dir + prefix + realName + ext;
  }

  class OwOEmotion {
    constructor(option) {
      this.option = mergeEmotionOption(option);
      if (this.option.autoInit) {
        const self = this;
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => self.scan());
        } else {
          self.scan();
        }
      }
    }

    scan(selector) {
      const sel = selector || this.option.autoSelector;
      if (!sel) return;
      document.querySelectorAll(sel).forEach(el => this.parse(el));
    }

    parse(container) {
      if (!container) return container;
      const o = this.option;
      if (!o.pattern) return container;

      const walker = document.createTreeWalker(
        container, NodeFilter.SHOW_TEXT, null, false
      );
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        const v = node.nodeValue;
        if (!v) continue;
        if (o.hint) {
          const hints = Array.isArray(o.hint) ? o.hint : [o.hint];
          if (!hints.some(h => v.indexOf(h) !== -1)) continue;
        }
        textNodes.push(node);
      }

      textNodes.forEach(textNode => {
        const text = textNode.nodeValue;
        const pattern = o.pattern;
        pattern.lastIndex = 0;

        const fragment = document.createDocumentFragment();
        let match, lastIndex = 0, changed = false;

        while ((match = pattern.exec(text)) !== null) {
          if (match.index > lastIndex) {
            fragment.appendChild(
              document.createTextNode(text.slice(lastIndex, match.index))
            );
          }

          const marker = match[1];
          const name = match[2];
          const raw = match[0];
          const resolved = this._resolve(marker, name);

          if (resolved && resolved.url) {
            fragment.appendChild(this._createImage(name, raw, resolved));
            changed = true;
          } else {
            fragment.appendChild(document.createTextNode(raw));
          }

          lastIndex = pattern.lastIndex;
        }

        if (!changed) return;

        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        if (textNode.parentNode) {
          textNode.parentNode.replaceChild(fragment, textNode);
        }
      });

      return container;
    }

    render(text) {
      const wrap = document.createElement('div');
      wrap.textContent = text == null ? '' : String(text);
      this.parse(wrap);
      return wrap.innerHTML;
    }

    renderTo(element, text) {
      if (!element) return element;
      element.innerHTML = this.render(text);
      return element;
    }

    _resolve(marker, name) {
      const o = this.option;

      if (typeof o.resolve === 'function') {
        const r = o.resolve(marker, name, o);
        if (!r) return null;
        if (typeof r === 'string') return { url: r, isBig: false };
        if (r.url) {
          return { url: r.url, isBig: !!r.isBig, fallbackUrl: r.fallbackUrl || null };
        }
        return null;
      }

      const pkgName = o._markerToPkg[marker];
      if (!pkgName) return null;

      const isBig = !!(o.bigPrefix && name.indexOf(o.bigPrefix) === 0);
      const realName = isBig ? name.slice(o.bigPrefix.length) : name;

      const url = buildEmotionUrl(o, pkgName, realName);
      if (!url) return null;

      let fallbackUrl = null;
      if (!isBig && o.fallbackPackage && o.fallbackPackage !== pkgName) {
        const fb = buildEmotionUrl(o, o.fallbackPackage, realName);
        if (fb) fallbackUrl = fb;
      }
      return { url, isBig, fallbackUrl };
    }

    _createImage(name, raw, resolved) {
      const o = this.option;
      const img = document.createElement('img');
      img.src = resolved.url;
      img.alt = name;
      img.title = name;
      img.className = resolved.isBig
        ? [o.imageClass, o.largeImageClass].filter(Boolean).join(' ')
        : o.imageClass;

      const fallbackUrl = resolved.fallbackUrl;
      const restore = function () {
        if (this.parentNode) this.parentNode.replaceChild(document.createTextNode(raw), this);
      };

      if (fallbackUrl) {
        img.onerror = function () {
          if (!this.dataset.owoFallback) {
            this.dataset.owoFallback = '1';
            this.src = fallbackUrl;
          } else restore.call(this);
        };
      } else {
        img.onerror = restore;
      }
      return img;
    }

    /* ---------- 静态便捷方法 ---------- */
    static parse(container, option) {
      new OwOEmotion(option).parse(container);
      return container;
    }
    static render(text, option) {
      return new OwOEmotion(option).render(text);
    }
    static buildUrl(pkgName, realName, option) {
      return buildEmotionUrl(mergeEmotionOption(option), pkgName, realName);
    }
  }
  OwOEmotion.DEFAULTS = EMOTION_DEFAULTS;

  /* ===================================================================
     二、OwO —— 表情选择面板
     =================================================================== */
  class OwO {
    constructor(option) {
      const defaultOption = {
        logo: '😀 表情',
        container: document.getElementsByClassName('OwO')[0],
        target: document.getElementsByTagName('textarea')[0],
        position: 'down',
        width: '100%',
        maxHeight: '250px',
        api: ''
      };
      for (let key in defaultOption) {
        if (defaultOption.hasOwnProperty(key) && !option.hasOwnProperty(key)) {
          option[key] = defaultOption[key];
        }
      }
      this.container = option.container;
      this.target = option.target;
      this.container.classList.add(option.position === 'up' ? 'OwO-up' : 'OwO-down');
      if (typeof option.api === 'object') {
        this.odata = option.api;
        this.init(option);
      }
    }

    init(option) {
      this.area = option.target;
      this.packages = Object.keys(this.odata);

      let html = `<div class="OwO-logo"><span>${option.logo}</span></div><div class="OwO-body" style="width: ${option.width}">`;

      html += `<div class="OwO-items-wrap">`;
      for (let i = 0; i < this.packages.length; i++) {
        let pkg = this.odata[this.packages[i]];
        let type = pkg.type;
        let extraClass = pkg.className ? ` ${pkg.className}` : '';
        html += `<ul class="OwO-items OwO-items-${type}${extraClass}" style="max-height: ${parseInt(option.maxHeight) - 53 + 'px'};">`;
        let opackage = pkg.container;
        for (let j = 0; j < opackage.length; j++) {
          html += `<li class="OwO-item" title="${opackage[j].title}" data-text="${opackage[j].text}" data-type="${type}" data-pkg="${this.packages[i]}">${opackage[j].icon}</li>`;
        }
        html += `</ul>`;
      }
      html += `</div>`;

      html += `<div class="OwO-bar"><ul class="OwO-packages">`;
      for (let i = 0; i < this.packages.length; i++) {
        let pkg = this.odata[this.packages[i]];
        let tabContent = this.packages[i];
        if (pkg.type === 'image' && pkg.container && pkg.container.length > 0) {
          tabContent = pkg.container[0].icon;
        } else if (pkg.icon) {
          tabContent = pkg.icon;
        }
        html += `<li title="${this.packages[i]}">${tabContent}</li>`;
      }
      html += `</ul></div></div>`;
      this.container.innerHTML = html;

      this.body = this.container.getElementsByClassName('OwO-body')[0];
      this.itemsWrap = this.container.getElementsByClassName('OwO-items-wrap')[0];

      this.logo = this.container.getElementsByClassName('OwO-logo')[0];
      this.logo.addEventListener('click', () => this.toggle());

      /* 点击表情 → 插入 */
      this.body.addEventListener('click', (e) => {
        let target = null;
        if (e.target.classList.contains('OwO-item')) target = e.target;
        else if (e.target.parentNode.classList.contains('OwO-item')) target = e.target.parentNode;
        if (!target) return;

        const cursorPos = this.area.selectionEnd;
        const areaValue = this.area.value;
        let insertText = target.innerHTML;

        const itemType = target.getAttribute('data-type');
        const itemText = target.getAttribute('data-text');
        const pkgName = target.getAttribute('data-pkg');
        const pkg = pkgName ? this.odata[pkgName] : null;

        if (itemType === 'image') {
          if (pkg && pkg.marker) {
            insertText = pkg.marker + '(' + itemText + ')';
          } else {
            const imgEl = target.querySelector('img');
            const src = imgEl ? imgEl.getAttribute('src') : '';
            const cls = itemText.indexOf('big_') === 0
              ? 'owo-emotion owo-emotion-large'
              : 'owo-emotion';
            insertText = `<img class="${cls}" src="${src}" alt="${itemText}">`;
          }
        }

        this.area.value = areaValue.slice(0, cursorPos) + insertText + areaValue.slice(cursorPos);
        this.area.focus();
        this.toggle();
      });

      this.packagesEle = this.container.getElementsByClassName('OwO-packages')[0];
      for (let i = 0; i < this.packagesEle.children.length; i++) {
        ((index) => {
          this.packagesEle.children[index].addEventListener('click', () => this.tab(index));
        })(i);
      }
      this.tab(0);
    }

    toggle() {
      this.container.classList.toggle('OwO-open');
    }

    /* 完整掉落 → 同步换列表 + 高度过渡 → 新表情波浪入场 */
    tab(index) {
      const allItems = this.container.getElementsByClassName('OwO-items');
      const currentShow = this.container.getElementsByClassName('OwO-items-show')[0];
      const newList = allItems[index];

      const packageActive = this.container.getElementsByClassName('OwO-package-active')[0];
      if (packageActive) packageActive.classList.remove('OwO-package-active');
      this.packagesEle.getElementsByTagName('li')[index].classList.add('OwO-package-active');

      if (currentShow === newList) return;
      if (this.isAnimating) return;

      if (!currentShow) {
        newList.classList.add('OwO-items-show');
        return;
      }

      this.isAnimating = true;
      const wrap = this.itemsWrap;
      const startHeight = wrap.offsetHeight;

      const oldItems = Array.from(currentShow.querySelectorAll('.OwO-item'));
      oldItems.forEach(item => {
        const rx = (Math.random() - 0.5) * 60;
        const rr = (Math.random() - 0.5) * 90;
        item.style.setProperty('--drop-x', `${rx}px`);
        item.style.setProperty('--drop-rotate', `${rr}deg`);
        item.style.animationDelay = '';
        item.classList.add('owo-anim-out');
      });

      const waitForFall = new Promise(resolve => {
        if (oldItems.length === 0) return resolve();
        let remaining = oldItems.length;
        const onEnd = (e) => {
          if (e.animationName !== 'owoDropOut') return;
          remaining--;
          if (remaining <= 0) resolve();
        };
        oldItems.forEach(item => item.addEventListener('animationend', onEnd));
        setTimeout(resolve, 500);
      });

      waitForFall.then(() => {
        oldItems.forEach(item => {
          item.classList.remove('owo-anim-out');
          item.style.removeProperty('--drop-x');
          item.style.removeProperty('--drop-rotate');
        });

        currentShow.classList.remove('OwO-items-show');
        newList.classList.add('OwO-items-show');
        const endHeight = wrap.offsetHeight;

        if (Math.abs(startHeight - endHeight) > 1 && typeof wrap.animate === 'function') {
          wrap.animate(
            [{ height: startHeight + 'px' }, { height: endHeight + 'px' }],
            { duration: 420, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }
          );
        }

        const newItems = newList.querySelectorAll('.OwO-item');
        newItems.forEach((item, i) => {
          const rx = (Math.random() - 0.5) * 50;
          const rr = (Math.random() - 0.5) * 70;
          item.style.setProperty('--drop-x', `${rx}px`);
          item.style.setProperty('--drop-rotate', `${rr}deg`);
          item.style.animationDelay = `${(i % 10) * 0.018}s`;
          item.classList.add('owo-anim-in');
          setTimeout(() => {
            item.classList.remove('owo-anim-in');
            item.style.animationDelay = '';
            item.style.removeProperty('--drop-x');
            item.style.removeProperty('--drop-rotate');
          }, 800);
        });

        setTimeout(() => { this.isAnimating = false; }, 500);
      });
    }
  }

  /* ===================================================================
     暴露
     =================================================================== */
  global.OwOEmotion = OwOEmotion;
  global.OwO = OwO;

})(window);