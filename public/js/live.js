/*!
 * LivePhoto + Lightbox (v3)
 * - 几何属性过渡：容器从卡片边界"揭开"到最终位置，图片 object-fit 始终不变形
 * - badge display 冲突修复（disabled icon 不再强制显示）
 * - 灯箱内视频 ended 后自动回到图片
 * - Lightbox CSS 全内置，不依赖用户 CSS
 */
(function (global) {
    'use strict';

    /* =========================================================
       Style Injection
       ========================================================= */
    const STYLE_ID = 'livephoto-lightbox-style';
    const STYLE_CSS = `
.lightbox-overlay.lightbox-overlay {
    position: fixed !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    z-index: 10000 !important;
    -webkit-tap-highlight-color: transparent !important;
    touch-action: none !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    background: transparent !important;
    border: 0 !important;
    outline: 0 !important;
}
.lightbox-overlay.lightbox-overlay *,
.lightbox-overlay.lightbox-overlay *::before,
.lightbox-overlay.lightbox-overlay *::after {
    box-sizing: border-box !important;
}

.lightbox-overlay.lightbox-overlay .lightbox-blur {
    position: absolute !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    -webkit-backdrop-filter: blur(12px) !important;
    backdrop-filter: blur(12px) !important;
    opacity: 0;
    transition: opacity 0.35s ease;
    pointer-events: none !important;
    will-change: opacity;
    z-index: 1;
    background: transparent !important;
}
.lightbox-overlay.lightbox-overlay .lightbox-dim {
    position: absolute !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: rgba(0, 0, 0, 0.78) !important;
    opacity: 0;
    transition: opacity 0.35s ease;
    pointer-events: none !important;
    will-change: opacity;
    z-index: 2;
}
.lightbox-overlay.lightbox-overlay.is-open .lightbox-blur,
.lightbox-overlay.lightbox-overlay.is-open .lightbox-dim {
    opacity: 1;
}

/* Clone：几何属性由 JS 内联设置，CSS 只做基础样式 */
.lightbox-overlay.lightbox-overlay .lightbox-clone {
    position: fixed !important;
    margin: 0 !important;
    padding: 0 !important;
    z-index: 10001 !important;
    opacity: 0;
    overflow: hidden !important;
    border-radius: 12px;
    background: #1a1a1c !important;
    cursor: pointer;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.55);
    border: 0 !important;
    outline: 0 !important;
    will-change: left, top, width, height, opacity;
    transform: translate3d(0,0,0) scale(1);
    transform-origin: center center;
}

.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-img,
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-video {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    max-width: none !important;
    max-height: none !important;
    min-width: 0 !important;
    min-height: 0 !important;
    border: 0 !important;
    border-radius: inherit;
    object-fit: cover !important;
    display: block !important;
    pointer-events: none !important;
    transform-origin: center center;
    user-select: none !important;
    -webkit-user-select: none !important;
}

.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-img {
    z-index: 2 !important;
    opacity: 1;
    transform: scale(1);
    transition: opacity 0.3s linear, transform 0.3s linear;
}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-video {
    z-index: 1 !important;
    transform: scale(1);
    background-color: #000 !important;
    transition: transform 0.3s linear;
}
.lightbox-overlay.lightbox-overlay .lightbox-clone.is-playing .live-photo-img {
    opacity: 0;
    transform: scale(1.08);
}
.lightbox-overlay.lightbox-overlay .lightbox-clone.is-playing .live-photo-video {
    transform: scale(1.08);
}
.lightbox-overlay.lightbox-overlay .lightbox-clone.zoomed { cursor: grab; }
.lightbox-overlay.lightbox-overlay .lightbox-clone.dragging { cursor: grabbing; }

/* ===== Badge ===== */
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge {
    position: absolute !important;
    top: 12px !important;
    left: 12px !important;
    z-index: 20 !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    background: rgba(255, 255, 255, 0.5) !important;
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
    padding: 2px 8px 2px 2px !important;
    border-radius: 5px !important;
    margin: 0 !important;
    pointer-events: none !important;
    box-shadow: none !important;
    border: 0 !important;
}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge .live-photo-icon {
    position: relative !important;
    width: 20px !important;
    height: 20px !important;
    margin: 0 !important;
    padding: 0 !important;
    flex: 0 0 auto;
}
/* ★ 只对 normal 图标强制 block；disabled 图标不强制，让内联样式/原 CSS 决定 */
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge .live-photo-icon-svg:not(.live-photo-disabled-icon) {
    display: block;
    width: 100% !important;
    height: 100% !important;
}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge .live-photo-disabled-icon {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    display: none;
}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge .live-photo-text {
    margin-top: 1px !important;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    line-height: 1 !important;
    letter-spacing: 0.5px !important;
    color: #000 !important;
    text-transform: none !important;
}
.lightbox-overlay.lightbox-overlay .lightbox-clone .live-photo-badge .live-photo-progress-ring {
    transition: stroke-dashoffset 0.2s linear;
}

.lightbox-overlay.lightbox-overlay .lightbox-close-btn {
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 10002 !important;
    width: 40px !important;
    height: 40px !important;
    border-radius: 50% !important;
    background: rgba(0, 0, 0, 0.5) !important;
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    color: #fff !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.2s ease;
    padding: 0 !important;
    margin: 0 !important;
    -webkit-tap-highlight-color: transparent !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.lightbox-overlay.lightbox-overlay.is-open .lightbox-close-btn { opacity: 1; }
.lightbox-overlay.lightbox-overlay .lightbox-close-btn:hover { transform: scale(1.08); }
.lightbox-overlay.lightbox-overlay .lightbox-close-btn:active { transform: scale(0.96); }
.lightbox-overlay.lightbox-overlay .lightbox-close-btn svg {
    width: 18px !important;
    height: 18px !important;
    display: block !important;
    fill: none !important;
    stroke: currentColor !important;
    stroke-width: 2 !important;
    stroke-linecap: round !important;
    stroke-linejoin: round !important;
}
`;

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

    if (document.head) injectStyles();
    else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles, { once: true });
    } else injectStyles();

    /* =========================================================
       0. aspect-ratio → padding-top fallback
       ========================================================= */
    function addPaddingTopFallback() {
        var containers = document.querySelectorAll('.live-photo');
        for (var i = 0; i < containers.length; i++) {
            var c = containers[i];
            if (c._paddingFallbackAdded) continue;
            var style = c.getAttribute('style') || '';
            var m = style.match(/aspect-ratio:\s*([\d\.]+\s*\/\s*[\d\.]+)/i);
            if (m) {
                var parts = m[1].split('/');
                var w = parseFloat(parts[0]), h = parseFloat(parts[1]);
                if (!isNaN(w) && !isNaN(h) && w > 0 && style.indexOf('padding-top') === -1) {
                    var ns = style.trim();
                    if (ns && !ns.endsWith(';')) ns += ';';
                    ns += ' padding-top: ' + ((h / w) * 100) + '%;';
                    c.setAttribute('style', ns);
                }
            }
            c._paddingFallbackAdded = true;
        }
    }

    /* =========================================================
       1. LivePhotoInstance
       ========================================================= */
    class LivePhotoInstance {
        constructor(container, options = {}) {
            this.container = container;
            this.imgEl = container.querySelector('.live-photo-img');
            this.videoEl = container.querySelector('.live-photo-video');
            if (!this.imgEl || !this.videoEl) {
                throw new Error('LivePhoto Error: .live-photo-img or .live-photo-video not found');
            }
            this.options = Object.assign({
                longPressDelay: 150,
                endThreshold: 0.6,
                moveCancelThreshold: 10,
                fakeSchedule: [
                    { delay: 200, target: 0.1 }, { delay: 500, target: 0.2 },
                    { delay: 600, target: 0.25 }, { delay: 800, target: 0.3 },
                    { delay: 1000, target: 0.4 }, { delay: 2100, target: 0.55 },
                    { delay: 3500, target: 0.65 }, { delay: 8800, target: 0.8 }
                ],
                progressStrokeWidth: 4,
                timeoutMs: 20000
            }, options);

            this._resetOnTransitionEnd = null;
            this._resetFallbackTimer = null;
            this._onResetDone = null;
            this._playingHandler = null;
            this._playingTimeout = null;

            this.isPlaying = false;
            this.longPressTimer = null;
            this.isEndingGracefully = false;
            this.touchStartX = 0;
            this.touchStartY = 0;
            this.progressMode = false;
            this.fakeSteps = null;
            this.loadFailed = false;
            this.loadTimeout = null;
            this._pendingCanPlay = false;
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

        _initBadge() {
            const isMobile = this._detectMobile();
            this.isMobile = isMobile;

            const badge = document.createElement('div');
            badge.className = 'live-photo-badge';
            badge.innerHTML =
                '<div class="live-photo-icon">' +
                    '<svg class="live-photo-icon-svg normal-icon" viewBox="0 0 64 64" fill="none">' +
                        '<circle id="middleCircle" cx="32" cy="32" r="16" stroke="rgba(0,0,0,0.6)" fill="none"/>' +
                        '<polygon points="39,32 28,24 28,40" fill="#000000"/>' +
                        '<g transform="rotate(-90 32 32)">' +
                            '<circle id="progressCircle" class="live-photo-progress-ring" cx="32" cy="32" r="26" stroke="rgba(0,0,0,0.7)" fill="none" stroke-linecap="round"/>' +
                        '</g>' +
                    '</svg>' +
                    '<svg class="live-photo-icon-svg live-photo-disabled-icon" viewBox="0 0 64 64" fill="none">' +
                        '<circle cx="32" cy="32" r="26" stroke="rgba(0,0,0,0.8)" stroke-width="4" fill="none"/>' +
                        '<line x1="15" y1="15" x2="49" y2="49" stroke="rgba(0,0,0,0.8)" stroke-width="4" stroke-linecap="round"/>' +
                    '</svg>' +
                '</div>' +
                '<span class="live-photo-text">实况</span>';
            this.container.appendChild(badge);

            this.progressCircle = badge.querySelector('#progressCircle');
            this.middleCircle = badge.querySelector('#middleCircle');
            this.normalIcon = badge.querySelector('.normal-icon');
            this.disabledIcon = badge.querySelector('.live-photo-disabled-icon');

            if (this.isMobile) {
                this.middleCircle.setAttribute('stroke-width', '3');
                this.normalStrokeWidth = 4;
                this.dotCount = 26;
            } else {
                this.middleCircle.setAttribute('stroke-width', '5');
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
            v.preload = 'auto';
            v.loop = false;

            this._videoHandlers.error = (e) => {
                console.warn('LivePhoto: video error', e);
                this._markAsFailed();
            };
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

        _setProgress(percent) {
            if (!this.progressCircle || this.loadFailed) return;
            this.progressCircle.style.strokeDashoffset = this.circumference * (1 - percent);
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
                let cp = (this.circumference - cur) / this.circumference;
                if (real > cp) { this._stopAllFakeProgress(); this._setProgress(real); }
            } else this._setProgress(real);
        }

        _startFakeProgress() {
            if (this.fakeSteps && this.fakeSteps.length > 0) return;
            if (this.loadFailed) return;
            this._enableProgressMode();
            this._setProgress(0);
            const schedule = this.options.fakeSchedule;
            this.fakeSteps = [];
            for (let i = 0; i < schedule.length; i++) {
                const step = schedule[i];
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
            if (!this.progressMode) {
                this.progressMode = true;
                this._startFakeProgress();
            }
            if (this.videoEl.readyState === 0) {
                this.videoEl.load();
                this._startLoadTimeout();
            }
        }

        _scheduleVideoReset() {
            this._cancelScheduledReset();
            if (!this.imgEl) return;
            const style = getComputedStyle(this.imgEl);
            const hasT = style.transitionDuration !== '0s' && parseFloat(style.transitionDuration) > 0;
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

        _onCanPlayStart = () => {
            this._pendingCanPlay = false;
            this._doStart();
        };

        _doStart() {
            if (this.loadFailed) return;
            this.isPlaying = true;
            const v = this.videoEl;
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

        suspend() {
            this._clearLongPressTimer();
            if (this.isPlaying || this.isEndingGracefully) this.stop();
            try { this.videoEl.pause(); this.videoEl.currentTime = 0; } catch (_) {}
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
            this._startLongPressTimer();
        }
        _onTouchMove(e) { if (this.longPressTimer && this._isTouchMoved(e)) this._clearLongPressTimer(); }
        _onTouchEnd() { if (this.loadFailed) return; this._clearLongPressTimer(); if (this.isPlaying) this.stop(); }
        _onTouchCancel() { if (this.loadFailed) return; this._clearLongPressTimer(); if (this.isPlaying) this.stop(); }
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
            if (badge) badge.remove();
            c.classList.remove('is-playing');
            if (c._livePhotoInstance === this) c._livePhotoInstance = null;
        }
    }

    /* =========================================================
       2. LivePhoto 入口
       ========================================================= */
    class LivePhoto {
        static init(selector = '.live-photo', options = {}) {
            let containers;
            if (typeof selector === 'string') containers = document.querySelectorAll(selector);
            else if (selector instanceof HTMLElement) containers = [selector];
            else if (selector instanceof NodeList || Array.isArray(selector)) containers = Array.from(selector);
            else throw new Error('LivePhoto.init: invalid selector');

            const instances = [];
            for (const c of containers) {
                if (c.querySelector('.live-photo-badge')) {
                    console.warn('LivePhoto: already initialized on this container', c);
                    continue;
                }
                try {
                    const inst = new LivePhotoInstance(c, options);
                    c._livePhotoInstance = inst;
                    instances.push(inst);
                } catch (err) {
                    console.error('LivePhoto initialize failed:', err);
                }
            }
            return instances;
        }
    }

    /* =========================================================
       3. Lightbox
       ========================================================= */
    const MIN_SCALE = 1;
    const MAX_SCALE = 5;
    let lbState = null;

    function getRect(el) {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
    }

    function getFinalSize(natW, natH, vw, vh) {
        const maxW = vw * 0.85, maxH = vh * 0.85;
        let w = natW, h = natH;
        if (w > maxW) { const r = maxW / w; w = maxW; h *= r; }
        if (h > maxH) { const r = maxH / h; h = maxH; w *= r; }
        return { width: w, height: h };
    }

    function isLivePhotoImage(img) {
        return img.classList.contains('live-photo-img') ||
            img.dataset.livePhoto === 'true' ||
            (img.parentElement && img.parentElement.classList.contains('live-photo'));
    }

    function applyTransform() {
        if (!lbState || !lbState.cloneEl) return;
        const { x, y } = lbState.translate;
        lbState.cloneEl.style.transform = `translate3d(${x}px,${y}px,0) scale(${lbState.scale})`;
    }

    function clampTranslate() {
        if (!lbState || !lbState.baseRect) return;
        const vw = window.innerWidth, vh = window.innerHeight;
        const { width, height } = lbState.baseRect;
        const s = lbState.scale;
        const maxX = Math.max(0, (width * s - vw) / 2);
        const maxY = Math.max(0, (height * s - vh) / 2);
        lbState.translate.x = Math.min(maxX, Math.max(-maxX, lbState.translate.x));
        lbState.translate.y = Math.min(maxY, Math.max(-maxY, lbState.translate.y));
    }

    function zoomAtPoint(newScale, clientX, clientY) {
        if (!lbState) return;
        newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
        if (newScale === lbState.scale) return;
        const k = newScale / lbState.scale;
        const br = lbState.baseRect;
        const cx = br.left + br.width / 2;
        const cy = br.top + br.height / 2;
        lbState.translate.x = (clientX - cx) * (1 - k) + k * lbState.translate.x;
        lbState.translate.y = (clientY - cy) * (1 - k) + k * lbState.translate.y;
        lbState.scale = newScale;
        clampTranslate();
        applyTransform();
        lbState.cloneEl.classList.toggle('zoomed', lbState.scale > 1);
    }

    function animateZoomToPoint(targetScale, clientX, clientY) {
        if (!lbState || lbState.isZoomAnimating || lbState.isResetting) return;
        targetScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
        if (targetScale === lbState.scale) return;
        const k = targetScale / lbState.scale;
        const br = lbState.baseRect;
        const cx = br.left + br.width / 2;
        const cy = br.top + br.height / 2;
        const tx = (clientX - cx) * (1 - k) + k * lbState.translate.x;
        const ty = (clientY - cy) * (1 - k) + k * lbState.translate.y;

        lbState.isZoomAnimating = true;
        const clone = lbState.cloneEl;
        clone.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1)';
        lbState.scale = targetScale;
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
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoomAtPoint(lbState.scale * delta, e.clientX, e.clientY);
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
            const distance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            let ns = lbState.initialScale * (distance / lbState.initialDistance);
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
        const clone = lbState.cloneEl;
        clone.addEventListener('wheel', onWheel, { passive: false });
        clone.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
        clone.addEventListener('touchstart', onTouchStartForDoubleTap, { passive: false });
        clone.addEventListener('touchstart', onTouchStart, { passive: false });
        clone.addEventListener('touchmove', onTouchMove, { passive: false });
        clone.addEventListener('touchend', onTouchEnd);
        clone.addEventListener('touchcancel', onTouchEnd);
        clone.addEventListener('dblclick', onDoubleClick);
        clone.style.cursor = 'pointer';
    }
    function unbindZoomEvents() {
        if (!lbState || !lbState.cloneEl) return;
        const clone = lbState.cloneEl;
        clone.removeEventListener('wheel', onWheel);
        clone.removeEventListener('mousedown', onPointerDown);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        clone.removeEventListener('touchstart', onTouchStartForDoubleTap);
        clone.removeEventListener('touchstart', onTouchStart);
        clone.removeEventListener('touchmove', onTouchMove);
        clone.removeEventListener('touchend', onTouchEnd);
        clone.removeEventListener('touchcancel', onTouchEnd);
        clone.removeEventListener('dblclick', onDoubleClick);
        if (lbState.tapTimer) { clearTimeout(lbState.tapTimer); lbState.tapTimer = null; }
    }

    function createOverlayDOM() {
        const overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML =
            '<div class="lightbox-blur"></div>' +
            '<div class="lightbox-dim"></div>' +
            '<div class="lightbox-close-btn" role="button" aria-label="关闭">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
                    '<path d="M6 6l12 12M18 6L6 18"/>' +
                '</svg>' +
            '</div>';
        return overlay;
    }

    function destroyOverlay() {
        if (!lbState) return;
        unbindZoomEvents();
        if (lbState.resizeHandler) window.removeEventListener('resize', lbState.resizeHandler);
        if (lbState.escHandler) window.removeEventListener('keydown', lbState.escHandler);

        // 清理灯箱内 video 播放相关监听
        if (lbState._videoListeners) {
            const vl = lbState._videoListeners;
            const c = lbState.cloneEl;
            if (c) {
                c.removeEventListener('mouseenter', vl.play);
                c.removeEventListener('mouseleave', vl.pause);
                c.removeEventListener('touchstart', vl.play);
                c.removeEventListener('touchend', vl.pause);
                c.removeEventListener('touchcancel', vl.pause);
            }
            if (lbState.videoEl) {
                lbState.videoEl.removeEventListener('ended', vl.onEnded);
            }
            lbState._videoListeners = null;
        }

        if (lbState.videoMoved && lbState.originalVideoParent && lbState.originalVideoParent.isConnected) {
            const v = lbState.cloneEl.querySelector('.live-photo-video');
            if (v && v.parentNode === lbState.cloneEl) {
                try { v.pause(); v.currentTime = 0; } catch (_) {}
                v.style.cssText = ''; // 清掉注入的内联样式
                try { lbState.originalVideoParent.insertBefore(v, lbState.originalVideoNext); }
                catch (_) { lbState.originalVideoParent.appendChild(v); }
            }
        }

        document.body.style.overflow = lbState._bodyOverflow || '';
        document.body.style.paddingRight = lbState._bodyPaddingRight || '';
        if (lbState.overlayEl && lbState.overlayEl.parentNode) {
            lbState.overlayEl.parentNode.removeChild(lbState.overlayEl);
        }
        lbState = null;
    }

    function openLightbox(imgElement) {
        if (lbState) return;
        if (!imgElement || !imgElement.src) return;

        const natW = imgElement.naturalWidth;
        const natH = imgElement.naturalHeight;
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

        if (originalContainer && originalContainer._livePhotoInstance) {
            originalContainer._livePhotoInstance.suspend();
        }

        const overlay = createOverlayDOM();
        const clone = document.createElement('div');
        clone.className = 'lightbox-clone lightbox-clone-img';

        const img = document.createElement('img');
        img.className = 'live-photo-img';
        img.src = imgElement.src;
        img.alt = imgElement.alt || '';
        img.draggable = false;
        clone.appendChild(img);

        let video = null;
        let videoMoved = false;
        let originalVideoParent = null;
        let originalVideoNext = null;

        if (isLivePhoto) {
            const originalBadge = originalContainer.querySelector('.live-photo-badge');
            if (originalBadge) {
                const badgeClone = originalBadge.cloneNode(true);
                const idNodes = badgeClone.querySelectorAll('[id]');
                for (let i = 0; i < idNodes.length; i++) idNodes[i].removeAttribute('id');
                clone.appendChild(badgeClone);
            }

            const originalVideo = originalContainer.querySelector('.live-photo-video');
            if (originalVideo) {
                originalVideoParent = originalVideo.parentNode;
                originalVideoNext = originalVideo.nextSibling;
                try { originalVideo.pause(); } catch (_) {}
                clone.appendChild(originalVideo);
                video = originalVideo;
                videoMoved = true;
            } else {
                video = document.createElement('video');
                video.className = 'live-photo-video';
                video.muted = true;
                video.playsInline = true;
                video.setAttribute('playsinline', '');
                const src = imgElement.dataset.videoSrc ||
                    (originalContainer.querySelector('.live-photo-video source') || {}).src;
                if (src) {
                    const source = document.createElement('source');
                    source.src = src;
                    source.type = 'video/mp4';
                    video.appendChild(source);
                }
                clone.appendChild(video);
            }
        }

        // ★ 初始几何 = startRect（与卡片一致），后面过渡到 finalRect
        clone.style.left = startRect.left + 'px';
        clone.style.top = startRect.top + 'px';
        clone.style.width = startRect.width + 'px';
        clone.style.height = startRect.height + 'px';
        clone.style.borderRadius = '12px';
        clone.style.opacity = '0';
        clone.style.transform = 'translate3d(0,0,0) scale(1)';

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
            overlayEl: overlay,
            cloneEl: clone,
            imgEl: img,
            videoEl: video,
            isLivePhoto,
            originalContainer,
            originalImg: imgElement,
            originalVideoParent,
            originalVideoNext,
            videoMoved,
            baseRect: { left: finalLeft, top: finalTop, width: finalW, height: finalH },
            scale: 1,
            translate: { x: 0, y: 0 },
            dragStart: { x: 0, y: 0 },
            isDragging: false,
            isResetting: false,
            isZoomAnimating: false,
            isAnimating: true,
            initialDistance: 0,
            initialScale: 1,
            lastTap: 0,
            tapTimer: null,
            resizeHandler: null,
            escHandler: null,
            _videoListeners: null,
            _bodyOverflow: bodyOverflow,
            _bodyPaddingRight: bodyPaddingRight
        };

        void clone.offsetWidth;

        // ★ 打开：几何过渡 + opacity 快速淡入
        clone.style.transition =
            'left 0.42s cubic-bezier(0.2, 0.9, 0.4, 1), ' +
            'top 0.42s cubic-bezier(0.2, 0.9, 0.4, 1), ' +
            'width 0.42s cubic-bezier(0.2, 0.9, 0.4, 1), ' +
            'height 0.42s cubic-bezier(0.2, 0.9, 0.4, 1), ' +
            'opacity 0.15s ease';

        requestAnimationFrame(() => {
            if (!lbState) return;
            overlay.classList.add('is-open');
            clone.style.left = finalLeft + 'px';
            clone.style.top = finalTop + 'px';
            clone.style.width = finalW + 'px';
            clone.style.height = finalH + 'px';
            clone.style.opacity = '1';
        });

        const finishOpen = () => {
            if (!lbState || !lbState.isAnimating) return;
            lbState.isAnimating = false;

            if (!lbState.isLivePhoto) {
                bindZoomEvents();
            } else if (lbState.videoEl) {
                const v = lbState.videoEl;
                const play = () => {
                    if (v.currentTime >= (v.duration || 0) - 0.1) {
                        try { v.currentTime = 0; } catch (_) {}
                    }
                    const p = v.play();
                    if (p && p.catch) p.catch(() => {});
                    clone.classList.add('is-playing');
                };
                const pause = () => {
                    try { v.pause(); v.currentTime = 0; } catch (_) {}
                    clone.classList.remove('is-playing');
                };
                // ★ 视频播完立即回到图片，不再卡最后一帧
                const onEnded = () => {
                    try { v.currentTime = 0; } catch (_) {}
                    clone.classList.remove('is-playing');
                };
                clone.addEventListener('mouseenter', play);
                clone.addEventListener('mouseleave', pause);
                clone.addEventListener('touchstart', play, { passive: true });
                clone.addEventListener('touchend', pause);
                clone.addEventListener('touchcancel', pause);
                v.addEventListener('ended', onEnded);

                lbState._videoListeners = { play, pause, onEnded };
            }
        };

        const onTransitionEnd = (e) => {
            if (e.target !== clone) return;
            // left 最先开始，动画一结束就触发，足够
            if (e.propertyName !== 'left') return;
            clone.removeEventListener('transitionend', onTransitionEnd);
            finishOpen();
        };
        clone.addEventListener('transitionend', onTransitionEnd);
        setTimeout(() => {
            if (lbState && lbState.isAnimating) {
                clone.removeEventListener('transitionend', onTransitionEnd);
                finishOpen();
            }
        }, 520);

        overlay.addEventListener('click', (e) => {
            if (!lbState || lbState.isAnimating) return;
            if (e.target === overlay) {
                e.stopPropagation();
                closeLightbox(false);
            }
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

        if (lbState.videoEl) {
            try { lbState.videoEl.pause(); lbState.videoEl.currentTime = 0; } catch (_) {}
        }

        if (skipAnimation || !overlayEl || !cloneEl || !originalImg) {
            destroyOverlay();
            return;
        }

        const startRect = getRect(originalImg);
        if (!startRect.width || !startRect.height) {
            destroyOverlay();
            return;
        }

        lbState.isAnimating = true;

        overlayEl.classList.remove('is-open');
        cloneEl.classList.remove('is-playing', 'zoomed', 'dragging');

        // ★ 先无过渡归零 transform（如果之前缩放/拖拽过）
        cloneEl.style.transition = 'none';
        cloneEl.style.transform = 'translate3d(0,0,0) scale(1)';
        void cloneEl.offsetWidth;

        // ★ 关闭：几何过渡 + opacity 延迟淡出
        cloneEl.style.transition =
            'left 0.38s cubic-bezier(0.2, 0.9, 0.4, 1), ' +
            'top 0.38s cubic-bezier(0.2, 0.9, 0.4, 1), ' +
            'width 0.38s cubic-bezier(0.2, 0.9, 0.4, 1), ' +
            'height 0.38s cubic-bezier(0.2, 0.9, 0.4, 1), ' +
            'opacity 0.15s ease 0.25s';

        cloneEl.style.left = startRect.left + 'px';
        cloneEl.style.top = startRect.top + 'px';
        cloneEl.style.width = startRect.width + 'px';
        cloneEl.style.height = startRect.height + 'px';
        cloneEl.style.opacity = '0';

        const onEnd = (e) => {
            if (e.target !== cloneEl) return;
            // opacity 最后结束（0.25 + 0.15 = 0.4s）
            if (e.propertyName !== 'opacity') return;
            cloneEl.removeEventListener('transitionend', onEnd);
            destroyOverlay();
        };
        cloneEl.addEventListener('transitionend', onEnd);
        setTimeout(() => { if (lbState) destroyOverlay(); }, 500);
    }

    function initLightbox(selector = '.lightbox-img') {
        const handleClick = (e) => {
            if (lbState) return;
            const lp = e.target.closest('.live-photo');
            if (lp) {
                const img = lp.querySelector('.live-photo-img');
                if (img) {
                    e.preventDefault();
                    openLightbox(img);
                    return;
                }
            }
            const img = e.target.closest(selector);
            if (img && img.tagName === 'IMG') {
                e.preventDefault();
                openLightbox(img);
            }
        };
        document.body.addEventListener('click', handleClick);
        return function destroy() {
            document.body.removeEventListener('click', handleClick);
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addPaddingTopFallback);
    } else {
        addPaddingTopFallback();
    }

    global.LivePhoto = LivePhoto;
    global.Lightbox = { init: initLightbox, open: openLightbox, close: closeLightbox };

})(window);