/*!
 * LivePhoto + Lightbox (v14-fixed4 + iOS prime)
 * - 修复移动端 touchstart + 模拟 mouseenter 重复触发导致首次长按后视频卡一下从头播放
 * - 进度圈 = 视频网络加载进度（buffered / fake schedule），不是播放进度
 * - suspend() 不动 fake progress / progressMode / 进度圈，badge 进度自然继承
 * - 灯箱内进度圈继续由原实例的 progress 事件与 fake schedule 驱动
 * - play 失败重试，避免一次失败后无法播放
 * - 灯箱长按支持 touchmove 取消
 * - 圆角回归旧版：12px -> 10px
 * - ★ iOS 预热：touchstart 同步 play() 拿播放授权，touchend 撤销，首次长按即可播放
 * - ★ 内置基础样式：视频只在 is-playing 时可见，避免预热露帧
 */
(function (global) {
    'use strict';

    const STYLE_ID = 'livephoto-lightbox-style';
    /* ★ 内置样式：避免用户忘记写视频显隐规则导致预热时露帧 */
    const BASE_STYLE_ID = 'livephoto-base-style';
    const BASE_STYLE_CSS =
        '.live-photo .live-photo-video{opacity:0}' +
        '.live-photo.is-playing .live-photo-video{opacity:1}';

    const STYLE_CSS = `
.lightbox-overlay.lightbox-overlay{position:fixed!important;inset:0!important;margin:0!important;padding:0!important;z-index:10000!important;-webkit-tap-highlight-color:transparent!important;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important;overflow:hidden!important;box-sizing:border-box!important;background:transparent!important;border:0!important;outline:0!important}
.lightbox-overlay.lightbox-overlay *,.lightbox-overlay.lightbox-overlay *::before,.lightbox-overlay.lightbox-overlay *::after{box-sizing:border-box!important}
.lightbox-overlay.lightbox-overlay .lightbox-blur{position:absolute!important;inset:0!important;-webkit-backdrop-filter:blur(12px)!important;backdrop-filter:blur(12px)!important;opacity:0;transition:opacity .35s ease;pointer-events:none!important;will-change:opacity;z-index:1}
.lightbox-overlay.lightbox-overlay .lightbox-dim{position:absolute!important;inset:0!important;background:rgba(0,0,0,.78)!important;opacity:0;transition:opacity .35s ease;pointer-events:none!important;will-change:opacity;z-index:2}
.lightbox-overlay.lightbox-overlay.is-open .lightbox-blur,.lightbox-overlay.lightbox-overlay.is-open .lightbox-dim{opacity:1}
.lightbox-overlay.lightbox-overlay .lightbox-clone{position:fixed!important;margin:0!important;padding:0!important;z-index:10001!important;opacity:1;overflow:hidden!important;background:#1a1a1c!important;cursor:pointer;border:0!important;outline:0!important;border-radius:12px}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-img,.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-video{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;border:0!important;border-radius:inherit;object-fit:cover!important;display:block!important;pointer-events:none!important;transform-origin:center center;user-select:none!important;-webkit-user-select:none!important}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-img{z-index:2!important;opacity:1;transition:opacity .3s linear,transform .3s linear}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-video{z-index:1!important;background-color:#000!important;transition:transform .3s linear}
.lightbox-overlay.lightbox-overlay .lightbox-clone.is-playing .live-photo-img{opacity:0;transform:scale(1.08)}
.lightbox-overlay.lightbox-overlay .lightbox-clone.is-playing .live-photo-video{transform:scale(1.08)}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge{position:absolute!important;top:12px!important;left:12px!important;z-index:20!important;display:flex!important;align-items:center!important;gap:6px!important;background:rgba(255,255,255,.5)!important;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);padding:2px 8px 2px 2px!important;border-radius:5px!important;margin:0!important;pointer-events:none!important;box-shadow:none!important;border:0!important}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge .live-photo-icon{position:relative!important;width:20px!important;height:20px!important;margin:0!important;padding:0!important;flex:0 0 auto}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge .live-photo-icon-svg:not(.live-photo-disabled-icon){display:block;width:100%!important;height:100%!important}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge .live-photo-disabled-icon{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;display:none}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge .live-photo-text{margin-top:1px!important;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif!important;font-size:12px!important;font-weight:500!important;line-height:1!important;letter-spacing:.5px!important;color:#000!important;text-transform:none!important}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge .live-photo-progress-ring{transition:stroke-dashoffset .2s linear}
.lightbox-overlay.lightbox-overlay .lightbox-close-btn{position:fixed!important;top:20px!important;right:20px!important;z-index:10002!important;width:40px!important;height:40px!important;border-radius:50%!important;background:rgba(0,0,0,.5)!important;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1)!important;color:#fff!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer;opacity:0;transition:opacity .25s ease,transform .2s ease;padding:0!important;margin:0!important;-webkit-tap-highlight-color:transparent!important;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.lightbox-overlay.lightbox-overlay.is-open .lightbox-close-btn{opacity:1}
.lightbox-overlay.lightbox-overlay .lightbox-close-btn:hover{transform:scale(1.08)}
.lightbox-overlay.lightbox-overlay .lightbox-close-btn:active{transform:scale(.96)}
.lightbox-overlay.lightbox-overlay .lightbox-close-btn svg{width:18px!important;height:18px!important;display:block!important;fill:none!important;stroke:currentColor!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important}
`;

    const GEOM_DURATION = 400;
    const GEOM_EASING = 'cubic-bezier(0.2, 0.9, 0.4, 1)';
    const GEOM_TRANSITION =
        `left ${GEOM_DURATION}ms ${GEOM_EASING}, ` +
        `top ${GEOM_DURATION}ms ${GEOM_EASING}, ` +
        `width ${GEOM_DURATION}ms ${GEOM_EASING}, ` +
        `height ${GEOM_DURATION}ms ${GEOM_EASING}, ` +
        `border-radius ${GEOM_DURATION}ms ${GEOM_EASING}`;
    const GEOM_FALLBACK_TIMEOUT = GEOM_DURATION + 120;

    const CLONE_RADIUS_START = '12px';
    const CLONE_RADIUS_END = '10px';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const head = document.head || document.documentElement;
        if (!head) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.type = 'text/css';
        style.textContent = STYLE_CSS;
        head.appendChild(style);
    }
    /* ★ 内置样式注入 */
    function injectBaseStyles() {
        if (document.getElementById(BASE_STYLE_ID)) return;
        const head = document.head || document.documentElement;
        if (!head) return;
        const style = document.createElement('style');
        style.id = BASE_STYLE_ID;
        style.type = 'text/css';
        style.textContent = BASE_STYLE_CSS;
        head.appendChild(style);
    }
    if (document.head) { injectStyles(); injectBaseStyles(); }
    else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            injectStyles();
            injectBaseStyles();
        }, { once: true });
    } else { injectStyles(); injectBaseStyles(); }

    function addPaddingTopFallback() {
        var cs = document.querySelectorAll('.live-photo');
        for (var i = 0; i < cs.length; i++) {
            var c = cs[i];
            if (c._paddingFallbackAdded) continue;
            var s = c.getAttribute('style') || '';
            var m = s.match(/aspect-ratio:\s*([\d\.]+\s*\/\s*[\d\.]+)/i);
            if (m) {
                var p = m[1].split('/'), w = parseFloat(p[0]), h = parseFloat(p[1]);
                if (!isNaN(w) && !isNaN(h) && w > 0 && s.indexOf('padding-top') === -1) {
                    var ns = s.trim();
                    if (ns && !ns.endsWith(';')) ns += ';';
                    ns += ' padding-top: ' + ((h / w) * 100) + '%;';
                    c.setAttribute('style', ns);
                }
            }
            c._paddingFallbackAdded = true;
        }
    }

    /* ★ iOS 预热：模块级多实例互斥，避免手指滑过列表时多个视频同时后台播放 */
    let activePrimeInstance = null;

    class LivePhotoInstance {
        constructor(container, options = {}) {
            this.container = container;
            this.imgEl = container.querySelector('.live-photo-img');
            this.videoEl = container.querySelector('.live-photo-video');
            if (!this.imgEl || !this.videoEl) throw new Error('LivePhoto Error: missing img/video');

            this.options = Object.assign({
                longPressDelay: 150, endThreshold: 0.6, moveCancelThreshold: 10,
                fakeSchedule: [
                    { delay: 200, target: 0.1 }, { delay: 500, target: 0.2 },
                    { delay: 600, target: 0.25 }, { delay: 800, target: 0.3 },
                    { delay: 1000, target: 0.4 }, { delay: 2100, target: 0.55 },
                    { delay: 3500, target: 0.65 }, { delay: 8800, target: 0.8 }
                ],
                progressStrokeWidth: 4, timeoutMs: 20000
            }, options);

            this._resetOnTransitionEnd = null;
            this._resetFallbackTimer = null;
            this._onResetDone = null;
            this._playingHandler = null;
            this._playingTimeout = null;
            this.isPlaying = false;
            this.longPressTimer = null;
            this.isEndingGracefully = false;
            this.touchStartX = 0; this.touchStartY = 0;
            this.progressMode = false;
            this.fakeSteps = null;
            this.loadFailed = false;
            this.loadTimeout = null;
            this._pendingCanPlay = false;
            this._primePending = false;            /* ★ iOS 预热标记 */
            this._videoHandlers = {};
            this._containerHandlers = {};

            this._initBadge();
            this._initVideo();
            this._bindEvents();
        }

        _detectMobile() {
            return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        }

        /* ★ iOS 预热：判定是否为 iOS 设备（含 iPadOS 桌面模式） */
        _isIOSSafari() {
            const ua = navigator.userAgent;
            return /iPad|iPhone|iPod/.test(ua) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        }

        _initBadge() {
            const isMobile = this._detectMobile();
            this.isMobile = isMobile;
            const badge = document.createElement('div');
            badge.className = 'live-photo-badge';
            badge.innerHTML =
                '<div class="live-photo-icon">' +
                    '<svg class="live-photo-icon-svg normal-icon" viewBox="0 0 64 64" fill="none">' +
                        '<circle cx="32" cy="32" r="16" stroke="rgba(0,0,0,0.6)" fill="none"/>' +
                        '<polygon points="39,32 28,24 28,40" fill="#000000"/>' +
                        '<g transform="rotate(-90 32 32)">' +
                            '<circle class="live-photo-progress-ring" cx="32" cy="32" r="26" stroke="rgba(0,0,0,0.7)" fill="none" stroke-linecap="round"/>' +
                        '</g>' +
                    '</svg>' +
                    '<svg class="live-photo-icon-svg live-photo-disabled-icon" viewBox="0 0 64 64" fill="none">' +
                        '<circle cx="32" cy="32" r="26" stroke="rgba(0,0,0,0.8)" stroke-width="4" fill="none"/>' +
                        '<line x1="15" y1="15" x2="49" y2="49" stroke="rgba(0,0,0,0.8)" stroke-width="4" stroke-linecap="round"/>' +
                    '</svg>' +
                '</div>' +
                '<span class="live-photo-text">实况</span>';
            this.container.appendChild(badge);

            this.progressCircle = badge.querySelector('.live-photo-progress-ring');
            this.middleCircle = badge.querySelector('.normal-icon circle');
            this.normalIcon = badge.querySelector('.normal-icon');
            this.disabledIcon = badge.querySelector('.live-photo-disabled-icon');

            if (isMobile) {
                if (this.middleCircle) this.middleCircle.setAttribute('stroke-width', '3');
                this.normalStrokeWidth = 4;
                this.dotCount = 26;
            } else {
                if (this.middleCircle) this.middleCircle.setAttribute('stroke-width', '5');
                this.normalStrokeWidth = 8;
                this.dotCount = 16;
            }
            this.circumference = 2 * Math.PI * 26;
            this.dotSpacing = this.circumference / this.dotCount;
            this._setDotPattern();
        }

        _initVideo() {
            const v = this.videoEl;
            v.setAttribute('playsinline', '');
            v.setAttribute('webkit-playsinline', '');
            v.setAttribute('x5-playsinline', '');
            v.muted = true;
            v.playsInline = true;
            if (!v.hasAttribute('preload')) v.preload = 'auto';
            v.loop = false;

            this._videoHandlers.error = (e) => { console.warn('LivePhoto: video error', e); this._markAsFailed(); };
            this._videoHandlers.success = () => {
                if (this.loadTimeout) { clearTimeout(this.loadTimeout); this.loadTimeout = null; }
                if (this.progressMode && !this.loadFailed) {
                    this._stopAllFakeProgress();
                    this.progressMode = false;
                    this._setDotPattern();
                }
            };
            this._videoHandlers.progress = () => this._onRealProgress();
            this._videoHandlers.timeupdate = () => {
                if (!this.isPlaying || this.isEndingGracefully || this.loadFailed) return;
                const d = v.duration;
                if (isNaN(d)) return;
                if (d - v.currentTime <= this.options.endThreshold) this._endGracefully();
            };
            this._videoHandlers.ended = () => {
                if (this.isPlaying && !this.isEndingGracefully && !this.loadFailed) this._endGracefully();
            };

            v.addEventListener('error', this._videoHandlers.error);
            v.addEventListener('canplay', this._videoHandlers.success);
            v.addEventListener('loadeddata', this._videoHandlers.success);
            v.addEventListener('loadedmetadata', this._videoHandlers.success);
            v.addEventListener('progress', this._videoHandlers.progress);
            v.addEventListener('timeupdate', this._videoHandlers.timeupdate);
            v.addEventListener('ended', this._videoHandlers.ended);
        }

        _markAsFailed() {
            if (this.loadFailed) return;
            this.loadFailed = true;
            if (this.normalIcon) this.normalIcon.style.display = 'none';
            if (this.disabledIcon) this.disabledIcon.style.display = 'block';
            this._stopAllFakeProgress();
            if (this.loadTimeout) { clearTimeout(this.loadTimeout); this.loadTimeout = null; }
            this.progressMode = false;
            if (this.isPlaying) this.stop();
            this.container.classList.remove('live-photo--loading', 'is-playing');
        }

        _startLoadTimeout() {
            if (this.options.timeoutMs <= 0) return;
            if (this.loadTimeout) clearTimeout(this.loadTimeout);
            this.loadTimeout = setTimeout(() => {
                if (!this.loadFailed && this.videoEl.readyState < 2) {
                    console.warn('LivePhoto: video loading timeout');
                    this._markAsFailed();
                }
            }, this.options.timeoutMs);
        }

        _getRealBufferedPercent() {
            const v = this.videoEl;
            if (!v.duration || isNaN(v.duration)) return 0;
            const b = v.buffered;
            if (b.length === 0) return 0;
            return Math.min(1, Math.max(0, b.end(b.length - 1) / v.duration));
        }
        _setProgress(p) {
            if (!this.progressCircle || this.loadFailed) return;
            this.progressCircle.style.strokeDashoffset = this.circumference * (1 - p);
        }
        _setDotPattern() {
            if (!this.progressCircle || this.loadFailed) return;
            this.progressCircle.setAttribute('stroke-dasharray', `0 ${this.dotSpacing}`);
            this.progressCircle.style.strokeDashoffset = '';
            this.progressCircle.setAttribute('stroke', 'rgba(0,0,0,0.7)');
            this.progressCircle.setAttribute('stroke-width', this.normalStrokeWidth);
        }
        _enableProgressMode() {
            if (!this.progressCircle || this.loadFailed) return;
            this.progressCircle.setAttribute('stroke-dasharray', `${this.circumference}`);
            this.progressCircle.setAttribute('stroke', '#000000');
            this.progressCircle.setAttribute('stroke-width', this.options.progressStrokeWidth);
        }
        _onRealProgress() {
            if (!this.progressMode || this.loadFailed) return;
            const real = this._getRealBufferedPercent();
            if (this.fakeSteps && this.fakeSteps.length > 0) {
                let cur = parseFloat(this.progressCircle.style.strokeDashoffset);
                if (isNaN(cur)) cur = this.circumference;
                if (real > (this.circumference - cur) / this.circumference) {
                    this._stopAllFakeProgress();
                    this._setProgress(real);
                }
            } else this._setProgress(real);
        }
        _startFakeProgress() {
            if (this.fakeSteps && this.fakeSteps.length > 0) return;
            if (this.loadFailed) return;
            this._enableProgressMode();
            this._setProgress(0);
            const s = this.options.fakeSchedule;
            this.fakeSteps = [];
            for (let i = 0; i < s.length; i++) {
                const step = s[i];
                const timer = setTimeout(() => {
                    if (this.loadFailed) return;
                    const real = this._getRealBufferedPercent();
                    if (real >= step.target) {
                        this._stopAllFakeProgress();
                        this._setProgress(real);
                        return;
                    }
                    this._setProgress(step.target);
                    if (step.target === 0.8) this.fakeSteps = null;
                }, step.delay);
                this.fakeSteps.push(timer);
            }
        }
        _stopAllFakeProgress() {
            if (this.fakeSteps) {
                for (const t of this.fakeSteps) clearTimeout(t);
                this.fakeSteps = null;
            }
        }
        _preloadVideo() {
            if (this.loadFailed) return;
            if (this.videoEl.readyState >= 2) return;
            if (!this.progressMode) { this.progressMode = true; this._startFakeProgress(); }
            if (this.videoEl.readyState === 0) { this.videoEl.load(); this._startLoadTimeout(); }
        }

        /* ★ iOS 预热：在 touchstart 同步栈内 play()，拿 iOS 播放授权 */
        _primeVideo() {
            if (!this._isIOSSafari()) return;                       // 非 iOS 完全跳过
            if (this.loadFailed || this.isPlaying || this.isEndingGracefully) return;
            if (this._primePending) return;
            // 防御：灯箱克隆下不干扰灯箱自身的播放逻辑
            if (this.videoEl.closest && this.videoEl.closest('.lightbox-clone')) return;

            if (activePrimeInstance && activePrimeInstance !== this) {
                activePrimeInstance._abortPrime();                  // 前一个实例的预热让位
            }
            activePrimeInstance = this;
            this._primePending = true;

            // ★ 关键：必须在用户手势的同步调用栈里调用 play()
            const p = this.videoEl.play();
            if (p !== undefined) {
                p.catch(() => {                                     // 低电量等场景被拒，静默降级
                    this._primePending = false;
                    if (activePrimeInstance === this) activePrimeInstance = null;
                });
            }
        }

        /* ★ iOS 预热：撤销预热（长按未成立时调用） */
        _abortPrime() {
            if (!this._primePending) return;
            this._primePending = false;
            if (activePrimeInstance === this) activePrimeInstance = null;
            if (this.isPlaying) return;                             // 长按已成立，交给 stop()

            if (!this.videoEl.paused) this.videoEl.pause();
            try {
                if (this.videoEl.currentTime > 0) this.videoEl.currentTime = 0;
            } catch (_) {}
            // 不动 fake progress / progressMode / 进度圈，保持"轻点后进度条继续"的原有行为
        }

        _scheduleVideoReset() {
            this._cancelScheduledReset();
            if (!this.imgEl) return;
            const st = getComputedStyle(this.imgEl);
            const hasT = st.transitionDuration !== '0s' && parseFloat(st.transitionDuration) > 0;
            const doReset = () => {
                if (!this.isPlaying) { try { this.videoEl.currentTime = 0; } catch (_) {} }
                this._cancelScheduledReset();
                if (this._onResetDone) { this._onResetDone(); this._onResetDone = null; }
            };
            if (!hasT) { doReset(); return; }
            const onEnd = (e) => { if (e.target === this.imgEl) doReset(); };
            this.imgEl.addEventListener('transitionend', onEnd, { once: true });
            this._resetOnTransitionEnd = () => {
                this.imgEl.removeEventListener('transitionend', onEnd);
                this._resetOnTransitionEnd = null;
            };
            this._resetFallbackTimer = setTimeout(doReset, 500);
        }
        _cancelScheduledReset() {
            if (this._resetOnTransitionEnd) { this._resetOnTransitionEnd(); this._resetOnTransitionEnd = null; }
            if (this._resetFallbackTimer) { clearTimeout(this._resetFallbackTimer); this._resetFallbackTimer = null; }
            this._onResetDone = null;
        }
        _cleanupPlayingWaiter() {
            if (this._playingHandler) {
                this.videoEl.removeEventListener('playing', this._playingHandler);
                this._playingHandler = null;
            }
            if (this._playingTimeout) { clearTimeout(this._playingTimeout); this._playingTimeout = null; }
        }

        start() {
            if (this.isPlaying || this.loadFailed) return;
            this.isEndingGracefully = false;
            this._cancelScheduledReset();
            this._cleanupPlayingWaiter();
            if (this.videoEl.readyState < 2) {
                this._preloadVideo();
                this._pendingCanPlay = true;
                this.videoEl.addEventListener('canplay', this._onCanPlayStart, { once: true });
                return;
            }
            this._doStart();
        }
        _onCanPlayStart = () => { this._pendingCanPlay = false; this._doStart(); };

        _doStart() {
            if (this.loadFailed) return;
            const wasPrimed = this._primePending;
            this.isPlaying = true;
            this._primePending = false;
            if (activePrimeInstance === this) activePrimeInstance = null;

            const v = this.videoEl;

            /* ★ iOS 预热接管：视频已由 touchstart 同步 play() 启动 → 直接切 UI，不重复 play */
            if (wasPrimed || !v.paused) {
                if (v.currentTime !== 0) { try { v.currentTime = 0; } catch (_) {} }
                if (v.paused) {
                    // prime 的 play() 还在 pending / 被系统短暂暂停，再补一次
                    const p2 = v.play();
                    if (p2 !== undefined) p2.catch((e) => { console.warn('LivePhoto: prime play failed', e); this.stop(); });
                }
                this.container.classList.add('is-playing');
                return;
            }

            // ↓↓↓ 原有逻辑：桌面端 hover / prime 被拒的兜底路径 ↓↓↓
            if (v.currentTime !== 0) v.currentTime = 0;
            const p = v.play();
            if (p !== undefined) p.catch((e) => { console.warn('LivePhoto: play failed', e); this.stop(); });
            const onPlaying = () => {
                this._cleanupPlayingWaiter();
                if (!this.isPlaying) return;
                this.container.classList.add('is-playing');
            };
            v.addEventListener('playing', onPlaying, { once: true });
            this._playingHandler = onPlaying;
            this._playingTimeout = setTimeout(() => {
                this._cleanupPlayingWaiter();
                if (this.isPlaying) this.container.classList.add('is-playing');
            }, 500);
        }
        stop() {
            if ((!this.isPlaying && !this.isEndingGracefully) || this.loadFailed) return;
            const wasEnding = this.isEndingGracefully;
            this.isEndingGracefully = false;
            this.isPlaying = false;
            this.container.classList.remove('is-playing');
            this._cleanupPlayingWaiter();
            if (!this.videoEl.paused) this.videoEl.pause();
            if (!wasEnding) this._scheduleVideoReset();
        }

        /* 只清理 pending 状态，不动 fake progress / progressMode / 进度圈，badge 进度自然继承 */
        suspend() {
            this._abortPrime();                       /* ★ iOS 预热：清理预热状态 */
            this._clearLongPressTimer();
            this._cancelScheduledReset();
            this._cleanupPlayingWaiter();

            if (this._pendingCanPlay) {
                this.videoEl.removeEventListener('canplay', this._onCanPlayStart);
                this._pendingCanPlay = false;
            }
            if (this.loadTimeout) {
                clearTimeout(this.loadTimeout);
                this.loadTimeout = null;
            }

            this.isEndingGracefully = false;
            this.isPlaying = false;
            this.container.classList.remove('is-playing');

            try {
                this.videoEl.pause();
                this.videoEl.currentTime = 0;
            } catch (_) {}
        }

        _endGracefully() {
            if (this.isEndingGracefully || this.loadFailed) return;
            this.isEndingGracefully = true;
            this.isPlaying = false;
            this.container.classList.remove('is-playing');
            this.videoEl.pause();
            this._cleanupPlayingWaiter();
            this._scheduleVideoReset();
            this._onResetDone = () => { this.isEndingGracefully = false; };
        }

        _onTouchStart(e) {
            if (this.loadFailed) return;
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this._preloadVideo();
            if (this.videoEl.currentTime !== 0 && !this.isPlaying && !this.isEndingGracefully) {
                this.videoEl.currentTime = 0;
            }
            this._primeVideo();                        /* ★ iOS 预热：同步栈内 play() */
            this._startLongPressTimer();
        }
        _onTouchMove(e) {
            if (this.longPressTimer && this._isTouchMoved(e)) {
                this._clearLongPressTimer();
                this._abortPrime();                    /* ★ iOS 预热：滑动取消 */
            }
        }
        _onTouchEnd() {
            if (this.loadFailed) return;
            this._clearLongPressTimer();
            if (this.isPlaying) this.stop();
            else this._abortPrime();                   /* ★ iOS 预热：长按未成立，撤销预热 */
        }
        _onTouchCancel() {
            if (this.loadFailed) return;
            this._clearLongPressTimer();
            if (this.isPlaying) this.stop();
            else this._abortPrime();                   /* ★ iOS 预热：撤销预热 */
        }
        _isTouchMoved(e) {
            const dx = Math.abs(e.touches[0].clientX - this.touchStartX);
            const dy = Math.abs(e.touches[0].clientY - this.touchStartY);
            return dx > this.options.moveCancelThreshold || dy > this.options.moveCancelThreshold;
        }
        _startLongPressTimer() {
            this._clearLongPressTimer();
            this.longPressTimer = setTimeout(() => this.start(), this.options.longPressDelay);
        }
        _clearLongPressTimer() {
            if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
        }

        _bindEvents() {
            const c = this.container;
            this._containerHandlers.mouseenter = () => this.start();
            this._containerHandlers.mouseleave = () => this.stop();
            this._containerHandlers.touchstart = (e) => this._onTouchStart(e);
            this._containerHandlers.touchmove = (e) => this._onTouchMove(e);
            this._containerHandlers.touchend = () => this._onTouchEnd();
            this._containerHandlers.touchcancel = () => this._onTouchCancel();
            c.addEventListener('mouseenter', this._containerHandlers.mouseenter);
            c.addEventListener('mouseleave', this._containerHandlers.mouseleave);
            c.addEventListener('touchstart', this._containerHandlers.touchstart, { passive: true });
            c.addEventListener('touchmove', this._containerHandlers.touchmove, { passive: true });
            c.addEventListener('touchend', this._containerHandlers.touchend);
            c.addEventListener('touchcancel', this._containerHandlers.touchcancel);
        }

        destroy() {
            this._abortPrime();                        /* ★ iOS 预热：清理预热状态 */
            this._clearLongPressTimer();
            this._stopAllFakeProgress();
            if (this.loadTimeout) { clearTimeout(this.loadTimeout); this.loadTimeout = null; }
            this._cancelScheduledReset();
            this._cleanupPlayingWaiter();
            if (this._pendingCanPlay) {
                this.videoEl.removeEventListener('canplay', this._onCanPlayStart);
                this._pendingCanPlay = false;
            }
            const v = this.videoEl;
            v.removeEventListener('error', this._videoHandlers.error);
            v.removeEventListener('canplay', this._videoHandlers.success);
            v.removeEventListener('loadeddata', this._videoHandlers.success);
            v.removeEventListener('loadedmetadata', this._videoHandlers.success);
            v.removeEventListener('progress', this._videoHandlers.progress);
            v.removeEventListener('timeupdate', this._videoHandlers.timeupdate);
            v.removeEventListener('ended', this._videoHandlers.ended);
            const c = this.container;
            c.removeEventListener('mouseenter', this._containerHandlers.mouseenter);
            c.removeEventListener('mouseleave', this._containerHandlers.mouseleave);
            c.removeEventListener('touchstart', this._containerHandlers.touchstart);
            c.removeEventListener('touchmove', this._containerHandlers.touchmove);
            c.removeEventListener('touchend', this._containerHandlers.touchend);
            c.removeEventListener('touchcancel', this._containerHandlers.touchcancel);
            const badge = c.querySelector('.live-photo-badge');
            if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
            c.classList.remove('is-playing');
            if (c._livePhotoInstance === this) c._livePhotoInstance = null;
        }
    }

    class LivePhoto {
        static init(selector = '.live-photo', options = {}) {
            let containers;
            if (typeof selector === 'string') containers = document.querySelectorAll(selector);
            else if (selector instanceof HTMLElement) containers = [selector];
            else if (selector instanceof NodeList || Array.isArray(selector)) containers = Array.from(selector);
            else throw new Error('LivePhoto.init: invalid selector');
            const out = [];
            for (const c of containers) {
                if (c.querySelector('.live-photo-badge')) {
                    console.warn('LivePhoto: already initialized', c);
                    continue;
                }
                try {
                    const inst = new LivePhotoInstance(c, options);
                    c._livePhotoInstance = inst;
                    out.push(inst);
                } catch (err) { console.error('LivePhoto initialize failed:', err); }
            }
            return out;
        }
    }

    /* ========== Lightbox ========== */
    const MIN_SCALE = 1, MAX_SCALE = 5;
    let lbState = null;

    function getRect(el) {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
    }
    function getFinalSize(nw, nh, vw, vh) {
        const mw = vw * 0.85, mh = vh * 0.85;
        let w = nw, h = nh;
        if (w > mw) { const r = mw / w; w = mw; h *= r; }
        if (h > mh) { const r = mh / h; h = mh; w *= r; }
        return { width: w, height: h };
    }
    function isLivePhotoImage(img) {
        return img.classList.contains('live-photo-img') ||
            img.dataset.livePhoto === 'true' ||
            (img.parentElement && img.parentElement.classList.contains('live-photo'));
    }

    function applyTransform() {
        if (!lbState || !lbState.cloneEl) return;
        lbState.cloneEl.style.transform =
            `translate3d(${lbState.translate.x}px,${lbState.translate.y}px,0) scale(${lbState.scale})`;
    }
    function clampTranslate() {
        if (!lbState || !lbState.baseRect) return;
        const vw = window.innerWidth, vh = window.innerHeight;
        const { width, height } = lbState.baseRect;
        const s = lbState.scale;
        const mx = Math.max(0, (width * s - vw) / 2);
        const my = Math.max(0, (height * s - vh) / 2);
        lbState.translate.x = Math.min(mx, Math.max(-mx, lbState.translate.x));
        lbState.translate.y = Math.min(my, Math.max(-my, lbState.translate.y));
    }
    function zoomAtPoint(ns, cx, cy) {
        if (!lbState) return;
        ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, ns));
        if (ns === lbState.scale) return;
        const k = ns / lbState.scale;
        const br = lbState.baseRect;
        const ox = br.left + br.width / 2, oy = br.top + br.height / 2;
        lbState.translate.x = (cx - ox) * (1 - k) + k * lbState.translate.x;
        lbState.translate.y = (cy - oy) * (1 - k) + k * lbState.translate.y;
        lbState.scale = ns;
        clampTranslate();
        applyTransform();
        lbState.cloneEl.classList.toggle('zoomed', lbState.scale > 1);
    }
    function animateZoomToPoint(ts, cx, cy) {
        if (!lbState || lbState.isZoomAnimating || lbState.isResetting) return;
        ts = Math.min(MAX_SCALE, Math.max(MIN_SCALE, ts));
        if (ts === lbState.scale) return;
        const k = ts / lbState.scale;
        const br = lbState.baseRect;
        const ox = br.left + br.width / 2, oy = br.top + br.height / 2;
        const tx = (cx - ox) * (1 - k) + k * lbState.translate.x;
        const ty = (cy - oy) * (1 - k) + k * lbState.translate.y;
        lbState.isZoomAnimating = true;
        const clone = lbState.cloneEl;
        clone.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1)';
        lbState.scale = ts;
        lbState.translate.x = tx;
        lbState.translate.y = ty;
        clampTranslate();
        applyTransform();
        const done = () => {
            clone.removeEventListener('transitionend', done);
            clone.style.transition = '';
            if (!lbState) return;
            lbState.isZoomAnimating = false;
            clone.classList.toggle('zoomed', lbState.scale > 1);
        };
        clone.addEventListener('transitionend', done);
        setTimeout(() => { if (lbState && lbState.isZoomAnimating) done(); }, 350);
    }
    function resetTransform() {
        if (!lbState || lbState.isResetting || lbState.isZoomAnimating) return;
        if (lbState.isDragging) {
            lbState.isDragging = false;
            lbState.cloneEl.classList.remove('dragging');
        }
        if (lbState.scale === 1 && lbState.translate.x === 0 && lbState.translate.y === 0) return;
        lbState.isResetting = true;
        const clone = lbState.cloneEl;
        clone.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1)';
        lbState.scale = 1;
        lbState.translate.x = 0;
        lbState.translate.y = 0;
        applyTransform();
        const done = () => {
            clone.removeEventListener('transitionend', done);
            clone.style.transition = '';
            if (!lbState) return;
            lbState.isResetting = false;
            clone.classList.remove('zoomed');
        };
        clone.addEventListener('transitionend', done);
        setTimeout(() => { if (lbState && lbState.isResetting) done(); }, 350);
    }

    function onWheel(e) {
        if (!lbState || lbState.isAnimating || lbState.isLivePhoto) return;
        e.preventDefault();
        zoomAtPoint(lbState.scale * (e.deltaY > 0 ? 0.9 : 1.1), e.clientX, e.clientY);
    }
    function onPointerDown(e) {
        if (!lbState || lbState.isLivePhoto || lbState.scale === 1) return;
        if (lbState.isAnimating || lbState.isResetting || lbState.isZoomAnimating) return;
        e.preventDefault();
        lbState.isDragging = true;
        const p = e.touches ? e.touches[0] : e;
        lbState.dragStart.x = p.clientX - lbState.translate.x;
        lbState.dragStart.y = p.clientY - lbState.translate.y;
        lbState.cloneEl.classList.add('dragging');
    }
    function onPointerMove(e) {
        if (!lbState || !lbState.isDragging) return;
        e.preventDefault();
        const p = e.touches ? e.touches[0] : e;
        lbState.translate.x = p.clientX - lbState.dragStart.x;
        lbState.translate.y = p.clientY - lbState.dragStart.y;
        clampTranslate();
        applyTransform();
    }
    function onPointerUp() {
        if (!lbState) return;
        lbState.isDragging = false;
        lbState.cloneEl.classList.remove('dragging');
    }
    function onTouchStart(e) {
        if (!lbState || lbState.isResetting || lbState.isZoomAnimating) return;
        if (e.touches.length === 2 && !lbState.isLivePhoto) {
            if (lbState.tapTimer) { clearTimeout(lbState.tapTimer); lbState.tapTimer = null; }
            lbState.lastTap = 0;
            e.preventDefault();
            const t1 = e.touches[0], t2 = e.touches[1];
            lbState.initialDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            lbState.initialScale = lbState.scale;
        } else if (e.touches.length === 1) onPointerDown(e);
    }
    function onTouchMove(e) {
        if (!lbState) return;
        if (e.touches.length === 2 && lbState.initialDistance > 0 && !lbState.isLivePhoto) {
            e.preventDefault();
            const t1 = e.touches[0], t2 = e.touches[1];
            const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            let ns = lbState.initialScale * (d / lbState.initialDistance);
            ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, ns));
            if (ns !== lbState.scale) {
                zoomAtPoint(ns, (t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
            }
        } else if (e.touches.length === 1) onPointerMove(e);
    }
    function onTouchEnd(e) {
        if (!lbState) return;
        if (e.touches.length < 2) lbState.initialDistance = 0;
        if (e.touches.length === 0) onPointerUp();
    }
    function onDoubleClick(e) {
        if (!lbState || lbState.isLivePhoto) return;
        e.preventDefault(); e.stopPropagation();
        if (lbState.isResetting || lbState.isZoomAnimating) return;
        if (lbState.scale === 1) animateZoomToPoint(Math.min(MAX_SCALE, 2.5), e.clientX, e.clientY);
        else resetTransform();
    }
    function onTouchStartForDoubleTap(e) {
        if (!lbState || lbState.isLivePhoto) return;
        if (e.touches.length !== 1) return;
        if (lbState.isResetting || lbState.isZoomAnimating) return;
        const now = Date.now();
        const dt = now - lbState.lastTap;
        if (dt < 300 && dt > 0) {
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            e.preventDefault();
            if (lbState.isDragging) {
                lbState.isDragging = false;
                lbState.cloneEl.classList.remove('dragging');
            }
            const t = e.touches[0];
            if (t) {
                if (lbState.scale === 1) animateZoomToPoint(Math.min(MAX_SCALE, 2), t.clientX, t.clientY);
                else resetTransform();
            }
            lbState.lastTap = 0;
            if (lbState.tapTimer) { clearTimeout(lbState.tapTimer); lbState.tapTimer = null; }
        } else {
            lbState.lastTap = now;
            if (lbState.tapTimer) clearTimeout(lbState.tapTimer);
            lbState.tapTimer = setTimeout(() => { if (lbState) lbState.lastTap = 0; }, 300);
        }
    }
    function bindZoomEvents() {
        if (!lbState || lbState.isLivePhoto) return;
        const c = lbState.cloneEl;
        c.addEventListener('wheel', onWheel, { passive: false });
        c.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
        c.addEventListener('touchstart', onTouchStartForDoubleTap, { passive: false });
        c.addEventListener('touchstart', onTouchStart, { passive: false });
        c.addEventListener('touchmove', onTouchMove, { passive: false });
        c.addEventListener('touchend', onTouchEnd);
        c.addEventListener('touchcancel', onTouchEnd);
        c.addEventListener('dblclick', onDoubleClick);
        c.style.cursor = 'pointer';
    }
    function unbindZoomEvents() {
        if (!lbState || !lbState.cloneEl) return;
        const c = lbState.cloneEl;
        c.removeEventListener('wheel', onWheel);
        c.removeEventListener('mousedown', onPointerDown);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        c.removeEventListener('touchstart', onTouchStartForDoubleTap);
        c.removeEventListener('touchstart', onTouchStart);
        c.removeEventListener('touchmove', onTouchMove);
        c.removeEventListener('touchend', onTouchEnd);
        c.removeEventListener('touchcancel', onTouchEnd);
        c.removeEventListener('dblclick', onDoubleClick);
        if (lbState.tapTimer) { clearTimeout(lbState.tapTimer); lbState.tapTimer = null; }
    }

    function createOverlayDOM() {
        const o = document.createElement('div');
        o.className = 'lightbox-overlay';
        o.innerHTML =
            '<div class="lightbox-blur"></div>' +
            '<div class="lightbox-dim"></div>' +
            '<div class="lightbox-close-btn" role="button" aria-label="关闭">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
                    '<path d="M6 6l12 12M18 6L6 18"/>' +
                '</svg>' +
            '</div>';
        return o;
    }

    function destroyOverlay() {
        if (!lbState) return;

        if (lbState._originalBadge) {
            const badge = lbState._originalBadge;
            const parent = lbState._badgeParent;
            if (parent && parent.isConnected) {
                try {
                    if (lbState._badgeNext && lbState._badgeNext.parentNode === parent) {
                        parent.insertBefore(badge, lbState._badgeNext);
                    } else {
                        parent.appendChild(badge);
                    }
                } catch (_) {
                    try { parent.appendChild(badge); } catch (__) {}
                }
            } else {
                try { if (badge.parentNode) badge.parentNode.removeChild(badge); } catch (_) {}
            }
        }

        if (lbState._originalVideo) {
            const v = lbState._originalVideo;
            try { v.pause(); v.currentTime = 0; } catch (_) {}
            const parent = lbState._videoParent;
            if (parent && parent.isConnected) {
                try {
                    if (lbState._videoNext && lbState._videoNext.parentNode === parent) {
                        parent.insertBefore(v, lbState._videoNext);
                    } else {
                        parent.appendChild(v);
                    }
                } catch (_) {
                    try { parent.appendChild(v); } catch (__) {}
                }
            } else {
                try { if (v.parentNode) v.parentNode.removeChild(v); } catch (_) {}
            }
        }

        if (lbState.resizeHandler) window.removeEventListener('resize', lbState.resizeHandler);
        if (lbState.escHandler) window.removeEventListener('keydown', lbState.escHandler);
        unbindZoomEvents();
        if (lbState._cleanupVideo) {
            lbState._cleanupVideo();
            lbState._cleanupVideo = null;
        }

        document.body.style.overflow = lbState._bodyOverflow || '';
        document.body.style.paddingRight = lbState._bodyPaddingRight || '';
        if (lbState.overlayEl && lbState.overlayEl.parentNode) {
            lbState.overlayEl.parentNode.removeChild(lbState.overlayEl);
        }
        lbState = null;
    }

    /* 灯箱内只控制播放/暂停与错误重试；进度圈由原实例的 progress/fake schedule 驱动
       iOS 上原实例的 touchstart 预热已让 video 元素"解锁"，此处的异步 play() 可正常成功 */
    function bindCloneVideo(clone, video) {
        if (!lbState) return;
        const END_THRESHOLD = 0.6;
        const LONG_PRESS_DELAY = 150;
        const RESET_DELAY = 500;
        const MOVE_CANCEL_THRESHOLD = 10;
        const RETRY_DELAY = 300;

        let longPressTimer = null;
        let resetTimer = null;
        let retryTimer = null;
        let playingTimer = null;
        let playingHandler = null;
        let waitingCanPlay = false;
        let wantPlay = false;
        let isPlaying = false;
        let hovering = false;
        let touchStartX = 0;
        let touchStartY = 0;

        const clearReset = () => { if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; } };
        const clearRetry = () => { if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; } };

        const cleanupPlaying = () => {
            if (playingTimer) { clearTimeout(playingTimer); playingTimer = null; }
            if (playingHandler) {
                video.removeEventListener('playing', playingHandler);
                playingHandler = null;
            }
        };

        const cancelPlay = () => {
            isPlaying = false;
            cleanupPlaying();
            clone.classList.remove('is-playing');
            try { video.pause(); } catch (_) {}
        };

        const tryPlay = () => {
            if (!wantPlay) return;
            clearReset();
            clearRetry();
            if (!video.paused && isPlaying) {
                clone.classList.add('is-playing');
                return;
            }
            if (video.paused && video.currentTime !== 0) {
                try { video.currentTime = 0; } catch (_) {}
            }
            const p = video.play();
            isPlaying = true;
            if (p && p.catch) {
                p.catch(() => {
                    cancelPlay();
                    if (hovering && wantPlay) {
                        clearRetry();
                        retryTimer = setTimeout(() => {
                            retryTimer = null;
                            if (hovering && wantPlay && video.paused) tryPlay();
                        }, RETRY_DELAY);
                    }
                });
            }
            cleanupPlaying();
            playingHandler = () => {
                if (wantPlay) {
                    cleanupPlaying();
                    clone.classList.add('is-playing');
                }
            };
            video.addEventListener('playing', playingHandler, { once: true });
            playingTimer = setTimeout(() => {
                playingTimer = null;
                if (wantPlay && isPlaying && !video.paused) clone.classList.add('is-playing');
            }, 500);
        };

        const onCanPlay = () => {
            waitingCanPlay = false;
            tryPlay();
        };

        const doPlay = () => {
            longPressTimer = null;
            if (isPlaying && !video.paused) return;
            wantPlay = true;
            clearReset();
            if (video.readyState < 2) {
                if (video.readyState === 0) {
                    try { video.load(); } catch (_) {}
                }
                if (!waitingCanPlay) {
                    waitingCanPlay = true;
                    video.addEventListener('canplay', onCanPlay, { once: true });
                }
                return;
            }
            tryPlay();
        };

        const doStop = () => {
            wantPlay = false;
            isPlaying = false;
            clearReset();
            clearRetry();
            if (waitingCanPlay) {
                video.removeEventListener('canplay', onCanPlay);
                waitingCanPlay = false;
            }
            cleanupPlaying();
            if (!video.paused) {
                try { video.pause(); } catch (_) {}
            }
            clone.classList.remove('is-playing');
            resetTimer = setTimeout(() => {
                resetTimer = null;
                if (!wantPlay) {
                    try { video.currentTime = 0; } catch (_) {}
                }
            }, RESET_DELAY);
        };

        const onEnter = () => { hovering = true; doPlay(); };
        const onLeave = () => { hovering = false; doStop(); };

        const onTouchStart = (e) => {
            if (e.touches && e.touches[0]) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
            clearTimeout(longPressTimer);
            longPressTimer = setTimeout(doPlay, LONG_PRESS_DELAY);
        };
        const onTouchMove = (e) => {
            if (!longPressTimer) return;
            if (!e.touches || !e.touches[0]) return;
            const dx = Math.abs(e.touches[0].clientX - touchStartX);
            const dy = Math.abs(e.touches[0].clientY - touchStartY);
            if (dx > MOVE_CANCEL_THRESHOLD || dy > MOVE_CANCEL_THRESHOLD) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };
        const onTouchEnd = () => {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            doStop();
        };
        const onTouchCancel = () => {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            doStop();
        };

        const onTimeUpdate = () => {
            if (!isPlaying) return;
            const d = video.duration;
            if (isNaN(d)) return;
            if (d - video.currentTime <= END_THRESHOLD) doStop();
        };
        const onEnded = () => doStop();

        clone.addEventListener('mouseenter', onEnter);
        clone.addEventListener('mouseleave', onLeave);
        clone.addEventListener('touchstart', onTouchStart, { passive: true });
        clone.addEventListener('touchmove', onTouchMove, { passive: true });
        clone.addEventListener('touchend', onTouchEnd);
        clone.addEventListener('touchcancel', onTouchCancel);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('ended', onEnded);

        lbState._cleanupVideo = () => {
            clearTimeout(longPressTimer);
            clearReset();
            clearRetry();
            cleanupPlaying();
            if (waitingCanPlay) {
                video.removeEventListener('canplay', onCanPlay);
                waitingCanPlay = false;
            }
            clone.removeEventListener('mouseenter', onEnter);
            clone.removeEventListener('mouseleave', onLeave);
            clone.removeEventListener('touchstart', onTouchStart);
            clone.removeEventListener('touchmove', onTouchMove);
            clone.removeEventListener('touchend', onTouchEnd);
            clone.removeEventListener('touchcancel', onTouchCancel);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('ended', onEnded);
        };
    }

    function openLightbox(imgElement) {
        if (lbState) return;
        if (!imgElement || !imgElement.src) return;

        const natW = imgElement.naturalWidth, natH = imgElement.naturalHeight;
        if (!natW || !natH) {
            const onLoad = () => {
                imgElement.removeEventListener('load', onLoad);
                openLightbox(imgElement);
            };
            imgElement.addEventListener('load', onLoad);
            return;
        }

        const originalContainer = imgElement.closest('.live-photo');
        const isLivePhoto = isLivePhotoImage(imgElement) && !!originalContainer;
        const startRect = getRect(imgElement);
        if (!startRect.width || !startRect.height) return;

        const vw = window.innerWidth, vh = window.innerHeight;
        const { width: finalW, height: finalH } = getFinalSize(natW, natH, vw, vh);
        const finalLeft = (vw - finalW) / 2;
        const finalTop = (vh - finalH) / 2;

        const originalInstance = originalContainer ? originalContainer._livePhotoInstance : null;
        if (originalInstance) originalInstance.suspend();

        const overlay = createOverlayDOM();
        const clone = document.createElement('div');
        clone.className = 'lightbox-clone lightbox-clone-img';

        const img = document.createElement('img');
        img.className = 'live-photo-img';
        img.src = imgElement.src;
        img.alt = imgElement.alt || '';
        img.draggable = false;
        clone.appendChild(img);

        let originalVideo = null;
        let videoParent = null;
        let videoNext = null;
        let originalBadge = null;
        let badgeParent = null;
        let badgeNext = null;

        if (isLivePhoto) {
            originalVideo = originalContainer.querySelector('.live-photo-video');
            if (originalVideo) {
                videoParent = originalVideo.parentNode;
                videoNext = originalVideo.nextSibling;
                try { originalVideo.pause(); originalVideo.currentTime = 0; } catch (_) {}
                clone.appendChild(originalVideo);
            }

            originalBadge = originalContainer.querySelector('.live-photo-badge');
            if (originalBadge) {
                badgeParent = originalBadge.parentNode;
                badgeNext = originalBadge.nextSibling;
                clone.appendChild(originalBadge);
            }
        }

        clone.style.borderRadius = CLONE_RADIUS_START;
        clone.style.left = startRect.left + 'px';
        clone.style.top = startRect.top + 'px';
        clone.style.width = startRect.width + 'px';
        clone.style.height = startRect.height + 'px';
        clone.style.opacity = '1';

        overlay.appendChild(clone);
        document.body.appendChild(overlay);

        const bodyOverflow = document.body.style.overflow;
        const bodyPaddingRight = document.body.style.paddingRight;
        const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        if (scrollbarW > 0) {
            document.body.style.paddingRight =
                (parseFloat(getComputedStyle(document.body).paddingRight) || 0) + scrollbarW + 'px';
        }

        lbState = {
            overlayEl: overlay, cloneEl: clone, imgEl: img,
            isLivePhoto, originalContainer, originalImg: imgElement, originalInstance,
            baseRect: { left: finalLeft, top: finalTop, width: finalW, height: finalH },
            scale: 1, translate: { x: 0, y: 0 },
            dragStart: { x: 0, y: 0 },
            isDragging: false, isResetting: false, isZoomAnimating: false,
            isAnimating: true,
            initialDistance: 0, initialScale: 1, lastTap: 0, tapTimer: null,
            resizeHandler: null, escHandler: null,
            _originalVideo: originalVideo,
            _videoParent: videoParent,
            _videoNext: videoNext,
            _originalBadge: originalBadge,
            _badgeParent: badgeParent,
            _badgeNext: badgeNext,
            _cleanupVideo: null,
            _bodyOverflow: bodyOverflow, _bodyPaddingRight: bodyPaddingRight
        };

        void clone.offsetWidth;

        clone.style.transition = GEOM_TRANSITION;

        requestAnimationFrame(() => {
            if (!lbState) return;
            overlay.classList.add('is-open');
            clone.style.left = finalLeft + 'px';
            clone.style.top = finalTop + 'px';
            clone.style.width = finalW + 'px';
            clone.style.height = finalH + 'px';
            clone.style.borderRadius = CLONE_RADIUS_END;
        });

        const finishOpen = () => {
            if (!lbState || !lbState.isAnimating) return;
            lbState.isAnimating = false;
            if (!lbState.isLivePhoto) {
                bindZoomEvents();
            } else if (originalVideo) {
                if (originalInstance && originalInstance.loadFailed) return;
                bindCloneVideo(clone, originalVideo);
            }
        };

        const onTE = (e) => {
            if (e.target !== clone) return;
            if (e.propertyName !== 'left') return;
            clone.removeEventListener('transitionend', onTE);
            finishOpen();
        };
        clone.addEventListener('transitionend', onTE);
        setTimeout(() => {
            if (lbState && lbState.isAnimating) {
                clone.removeEventListener('transitionend', onTE);
                finishOpen();
            }
        }, GEOM_FALLBACK_TIMEOUT);

        overlay.addEventListener('click', (e) => {
            if (!lbState || lbState.isAnimating) return;
            if (e.target === overlay) { e.stopPropagation(); closeLightbox(false); }
        });
        const closeBtn = overlay.querySelector('.lightbox-close-btn');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!lbState || lbState.isAnimating) return;
            closeLightbox(false);
        });

        lbState.escHandler = (e) => {
            if (e.key === 'Escape' && lbState && !lbState.isAnimating) {
                e.preventDefault();
                closeLightbox(false);
            }
        };
        window.addEventListener('keydown', lbState.escHandler);

        lbState.resizeHandler = () => {
            if (lbState && !lbState.isAnimating) closeLightbox(true);
        };
        window.addEventListener('resize', lbState.resizeHandler);
    }

    function closeLightbox(skipAnimation) {
        if (!lbState) return;
        if (lbState.isAnimating && !skipAnimation) return;

        const { overlayEl, cloneEl, originalImg } = lbState;

        if (lbState.resizeHandler) { window.removeEventListener('resize', lbState.resizeHandler); lbState.resizeHandler = null; }
        if (lbState.escHandler) { window.removeEventListener('keydown', lbState.escHandler); lbState.escHandler = null; }
        unbindZoomEvents();

        if (lbState._cleanupVideo) {
            lbState._cleanupVideo();
            lbState._cleanupVideo = null;
        }
        if (lbState._originalVideo) {
            try { lbState._originalVideo.pause(); lbState._originalVideo.currentTime = 0; } catch (_) {}
        }
        if (lbState.originalInstance) {
            lbState.originalInstance.isPlaying = false;
            lbState.originalInstance.isEndingGracefully = false;
            try { lbState.originalInstance.container.classList.remove('is-playing'); } catch (_) {}
        }

        if (skipAnimation || !overlayEl || !cloneEl || !originalImg) {
            destroyOverlay();
            return;
        }

        const startRect = getRect(originalImg);
        if (!startRect.width || !startRect.height) { destroyOverlay(); return; }

        lbState.isAnimating = true;
        overlayEl.classList.remove('is-open');
        cloneEl.classList.remove('is-playing', 'zoomed', 'dragging');

        cloneEl.style.transition = 'none';
        cloneEl.style.transform = '';
        void cloneEl.offsetWidth;

        cloneEl.style.transition = GEOM_TRANSITION;

        cloneEl.style.left = startRect.left + 'px';
        cloneEl.style.top = startRect.top + 'px';
        cloneEl.style.width = startRect.width + 'px';
        cloneEl.style.height = startRect.height + 'px';
        cloneEl.style.borderRadius = CLONE_RADIUS_START;

        const onEnd = (e) => {
            if (e.target !== cloneEl) return;
            if (e.propertyName !== 'left') return;
            cloneEl.removeEventListener('transitionend', onEnd);
            destroyOverlay();
        };
        cloneEl.addEventListener('transitionend', onEnd);
        setTimeout(() => { if (lbState) destroyOverlay(); }, GEOM_FALLBACK_TIMEOUT);
    }

    function initLightbox(selector = '.lightbox-img') {
        const handle = (e) => {
            if (lbState) return;
            const lp = e.target.closest('.live-photo');
            if (lp) {
                const img = lp.querySelector('.live-photo-img');
                if (img) { e.preventDefault(); openLightbox(img); return; }
            }
            const img = e.target.closest(selector);
            if (img && img.tagName === 'IMG') { e.preventDefault(); openLightbox(img); }
        };
        document.body.addEventListener('click', handle);
        return function destroy() { document.body.removeEventListener('click', handle); };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addPaddingTopFallback);
    } else {
        addPaddingTopFallback();
    }

    global.LivePhoto = LivePhoto;
    global.Lightbox = { init: initLightbox, open: openLightbox, close: closeLightbox };

})(window);
