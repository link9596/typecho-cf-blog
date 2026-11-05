/* InstantClick 3.1.0 (enhanced) | (C) 2014 Alexandre Dieulot | http://instantclick.io/license
 * 改造1：持久内存缓存复用
 * 改造2：容器级局部替换 + CSS transition 驱动动画（对齐 Swup 3.x）
 * 改造3：Swup 兼容类名 is-changing / is-animating / is-leaving / transition-fade
 * 改造4：切换后滚动策略（instant / smooth / keep）
 * 改造5：可配置 API + prefers-reduced-motion 支持
 *
 * 修复记录：
 *  A. safeThen 兜底：动画回调抛异常不再卡死 animating 锁
 *  B. 进度条：done() 找不到元素不复活；start()/init() 清理所有残留；body 替换时迁移进度条
 *  C. 点击漂移：P() 里检测 stale u（目标不一致时丢弃），F 分支用 a 而非 r
 *  D. 兼容事件：fireEvents 同时触发 page:view / swup:page:view / astro:page-load / astro:after-swap
 *  E. 进度条回退重启：fetch 完成回调进入 P() 命中缓存分支时不再 C.start()，
 *     避免"进度条走到一半被拉回 0 再重走一遍"的现象（P 增加 fromFetch 参数）
 */
var InstantClick = function (d, e) {

    // ================= 配置 =================
    // 注意：直接改 CONFIG 时，containers 必须是对象格式（不走 normalizeContainers）
    // 想用字符串格式，请在 InstantClick.init({ containers: [...] }) 里传
    var CONFIG = {
        animation: true,
        theme: 'fade',
        duration: 250,
        easing: 'ease',
        scroll: 'smooth',
        respectReducedMotion: true,
        cacheMax: 30,
        containers: [
        { selector: '#main',      animation: 'auto' },
        { selector: '#header',    animation: 'none' },
        { selector: '#secondary', animation: 'auto' },
        { selector: '#footer',    animation: 'auto' }
    ]
    };

    var prefersReducedMotion =
        typeof matchMedia !== 'undefined' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches;

    var animating = false;

    // ================= 工具 =================
    function w(a) { var b = a.indexOf("#"); return 0 > b ? a : a.substr(0, b) }
    function z(a) { for (; a && "A" != a.nodeName;) a = a.parentNode; return a }

    function normalizeContainers(list) {
        return list.map(function (item) {
            if (typeof item === 'string') return { selector: item, animation: 'auto' };
            if (item && item.selector) return { selector: item.selector, animation: item.animation || 'auto' };
            return null;
        }).filter(Boolean);
    }

    function hasTransitionClass(el) {
        return /(^|\s)transition-/.test(el.className || '');
    }

    function measureDuration(el) {
        try {
            var cs = getComputedStyle(el);
            var max = 0;
            var groups = [
                { dur: cs.transitionDuration, delay: cs.transitionDelay },
                { dur: cs.animationDuration, delay: cs.animationDelay }
            ];
            groups.forEach(function (g) {
                var durs = (g.dur || '0s').split(',');
                var dels = (g.delay || '0s').split(',');
                for (var i = 0; i < durs.length; i++) {
                    var d = (parseFloat(durs[i]) || 0) + (parseFloat(dels[i] || dels[0] || '0s') || 0);
                    if (d * 1000 > max) max = d * 1000;
                }
            });
            return max;
        } catch (_) { return 0; }
    }

    function waitForAnim(el) {
        return new Promise(function (resolve) {
            var done = false;
            var finish = function () {
                if (done) return;
                done = true;
                el.removeEventListener('transitionend', onEnd);
                el.removeEventListener('animationend', onEnd);
                resolve();
            };
            var onEnd = function (ev) { if (ev.target === el) finish(); };
            el.addEventListener('transitionend', onEnd);
            el.addEventListener('animationend', onEnd);
        });
    }

    // 兜底：即使回调内部抛异常，也释放状态锁
    function safeThen(promise, cb) {
        return promise.then(function () {
            try { cb(); } catch (err) {
                d.documentElement.classList.remove('is-changing', 'is-animating', 'is-leaving');
                animating = false;
                if (typeof console !== 'undefined') console.error('[InstantClick] transition callback error:', err);
            }
        });
    }

    function raceWithTimeout(promises, ms) {
        return new Promise(function (resolve) {
            var done = false;
            var finish = function () { if (!done) { done = true; resolve(); } };
            Promise.all(promises).then(finish, finish);
            setTimeout(finish, ms);
        });
    }

    function _trimCache() {
        var ks = Object.keys(h);
        if (ks.length <= CONFIG.cacheMax) return;
        ks.sort(function (a, b) { return (h[a].lastUsed || 0) - (h[b].lastUsed || 0); });
        var toDel = ks.length - CONFIG.cacheMax;
        for (var i = 0; i < ks.length && toDel > 0; i++) {
            if (ks[i] === k) continue;
            delete h[ks[i]];
            toDel--;
        }
    }

    function A(a) {
        var b = e.protocol + "//" + e.host;
        if (!(b = a.target || a.hasAttribute("download") || 0 != a.href.indexOf(b + "/") || -1 < a.href.indexOf("#") && w(a.href) == k)) {
            if (J) {
                a: {
                    do {
                        if (!a.hasAttribute) break;
                        if (a.hasAttribute("data-no-instant")) break;
                        if (a.hasAttribute("data-instant")) { a = !0; break a }
                    } while (a = a.parentNode);
                    a = !1
                }
                a = !a
            } else a: {
                do {
                    if (!a.hasAttribute) break;
                    if (a.hasAttribute("data-instant")) break;
                    if (a.hasAttribute("data-no-instant")) { a = !0; break a }
                } while (a = a.parentNode);
                a = !1
            }
            b = a
        }
        return b ? !1 : !0
    }

    function t(a, b, c, g) {
        for (var d = !1, e = 0; e < B[a].length; e++)
            if ("receive" == a) {
                var f = B[a][e](b, c, g);
                f && ("body" in f && (c = f.body), "title" in f && (g = f.title), d = f)
            } else B[a][e](b, c, g);
        return d
    }

    // ================= 滚动 =================
    function doScroll(top, behavior) {
        if (behavior === 'smooth') {
            try { window.scrollTo({ top: top, left: 0, behavior: 'smooth' }); }
            catch (_) { window.scrollTo(0, top); }
            return;
        }
        if (behavior === 'keep') return;
        var html = d.documentElement;
        var prev = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        window.scrollTo(0, top);
        html.style.scrollBehavior = prev;
    }
    function scrollToElement(el, behavior) {
        var top = 0, cur = el;
        while (cur.offsetParent) { top += cur.offsetTop; cur = cur.offsetParent; }
        doScroll(top, behavior);
    }

    // ================= 监听器 / 脚本 =================
    function bindBodyListeners() {
        d.body.addEventListener("touchstart", U, !0);
        D ? d.body.addEventListener("mousedown", M, !0) : d.body.addEventListener("mouseover", N, !0);
        d.body.addEventListener("click", V, !0);
    }
    function rebuildScripts(scope) {
        var scripts = scope.getElementsByTagName("script");
        var b, c, g, e2;
        var i = 0, j = scripts.length;
        for (; i < j; i++) {
            b = scripts[i];
            if (b.hasAttribute("data-no-instant")) continue;
            c = d.createElement("script");
            if (b.src) c.src = b.src;
            if (b.innerHTML) c.innerHTML = b.innerHTML;
            g = b.parentNode;
            e2 = b.nextSibling;
            g.removeChild(b);
            g.insertBefore(c, e2);
        }
    }

    // ================= 核心：容器级替换 + Swup 状态类 =================
    function performReplace(newBody, title, url, scrollY, isPopstate) {
        var html = d.documentElement;
        var useAnim = CONFIG.animation && !(CONFIG.respectReducedMotion && prefersReducedMotion);
        var isFullBody = CONFIG.containers.length === 1 && CONFIG.containers[0].selector === 'body';

        // ---- 1. 收集需要替换的容器 ----
        var replacements = [];
        if (isFullBody) {
            replacements.push({
                oldEl: d.body, newEl: newBody, isBody: true,
                animation: CONFIG.containers[0].animation, addedClass: false
            });
        } else {
            var foundAny = false;
            CONFIG.containers.forEach(function (cfg) {
                var oldEl = d.body.querySelector(cfg.selector);
                var newEl = newBody.querySelector(cfg.selector);
                if (!oldEl || !newEl) return;
                foundAny = true;
                if (oldEl.innerHTML === newEl.innerHTML) return;
                replacements.push({
                    oldEl: oldEl, newEl: newEl, isBody: false,
                    animation: cfg.animation, addedClass: false
                });
            });
            if (!foundAny) {
                replacements.push({
                    oldEl: d.body, newEl: newBody, isBody: true,
                    animation: 'auto', addedClass: false
                });
                isFullBody = true;
            }
        }

        // ---- 2. 公共回调 ----
        var updateMeta = function () {
            if (!isPopstate && url) {
                history.pushState(null, null, url);
                k = w(url);
            }
            d.title = S && d.title == title ? title + String.fromCharCode(160) : title;
        };
        var applyScroll = function () {
            var hash = null;
            if (url) {
                var hi = url.indexOf("#");
                if (hi > -1) hash = url.substr(hi + 1);
            }
            if (hash) {
                var el = d.getElementById(hash);
                if (el) scrollToElement(el, useAnim ? 'smooth' : CONFIG.scroll);
                else doScroll(0, CONFIG.scroll);
            } else if (isPopstate) {
                doScroll(scrollY || 0, 'instant');
            } else {
                doScroll(0, CONFIG.scroll);
            }
        };
        var fireEvents = function () {
            C.done();
            t("change", false);

            // InstantClick 原生事件
            var ev = d.createEvent("HTMLEvents");
            ev.initEvent("instantclick:newpage", !0, !0);
            dispatchEvent(ev);

            // 兼容 Swup / Astro 监听
            try { document.dispatchEvent(new Event('page:view')); } catch (_) {}
            try { document.dispatchEvent(new Event('swup:page:view')); } catch (_) {}
            try { document.dispatchEvent(new Event('astro:page-load')); } catch (_) {}
            try { document.dispatchEvent(new Event('astro:after-swap')); } catch (_) {}
        };

        // ---- 3. 无替换 → 只更新 meta ----
        if (replacements.length === 0) {
            updateMeta(); applyScroll(); fireEvents();
            animating = false;
            return;
        }

        // ---- 4. theme: fade 时给变化容器补 transition-fade ----
        if (useAnim && CONFIG.theme === 'fade') {
            replacements.forEach(function (r) {
                if (r.animation === 'none') return;
                if (hasTransitionClass(r.oldEl)) return;
                r.oldEl.classList.add('transition-fade');
                r.addedClass = true;
            });
        }

        // ---- 5. 测离场时长 ----
        var maxLeave = 0;
        if (useAnim) {
            replacements.forEach(function (r) {
                if (r.animation === 'none') return;
                var dur = measureDuration(r.oldEl);
                if (dur > maxLeave) maxLeave = dur;
            });
        }

        // ---- 6. 执行替换 ----
        var doReplace = function () {
            // 兼容 Astro：替换前触发
            try { document.dispatchEvent(new Event('astro:before-swap')); } catch (_) {}

            replacements.forEach(function (r) {
                if (r.addedClass && r.newEl) r.newEl.classList.add('transition-fade');
            });

            // body 替换时迁移进度条，避免 done() 兜底复活
            replacements.forEach(function (r) {
                if (r.isBody) {
                    var bar = d.getElementById('instantclick');
                    if (bar && bar.parentNode === r.oldEl) {
                        bar.parentNode.removeChild(bar);
                    }
                    d.documentElement.replaceChild(r.newEl, r.oldEl);
                    if (bar) r.newEl.appendChild(bar);
                } else {
                    r.oldEl.parentNode.replaceChild(r.newEl, r.oldEl);
                }
            });

            html.classList.remove('is-leaving');

            updateMeta();
            applyScroll();

            if (isFullBody) {
                bindBodyListeners();
                rebuildScripts(d.body);
            } else {
                replacements.forEach(function (r) { rebuildScripts(r.newEl); });
            }

            fireEvents();

            // ---- 入场 ----
            if (useAnim) {
                void d.body.offsetWidth;
                html.classList.remove('is-animating');

                var maxEnter = 0;
                var enterWaiters = [];
                replacements.forEach(function (r) {
                    if (r.animation === 'none') return;
                    if (!r.newEl || !r.newEl.isConnected) return;
                    var dur = measureDuration(r.newEl);
                    if (dur > maxEnter) maxEnter = dur;
                    if (dur > 0) enterWaiters.push(waitForAnim(r.newEl));
                });

                var finishEnter = function () {
                    html.classList.remove('is-changing');
                    replacements.forEach(function (r) {
                        if (r.addedClass && r.newEl) r.newEl.classList.remove('transition-fade');
                    });
                    animating = false;
                };

                if (maxEnter > 0) {
                    safeThen(raceWithTimeout(enterWaiters, maxEnter + 120), finishEnter);
                } else {
                    finishEnter();
                }
            } else {
                html.classList.remove('is-changing');
                animating = false;
            }
        };

        // ---- 7. 编排 ----
        if (useAnim) {
            animating = true;
            html.classList.add('is-changing');
            html.classList.add('is-animating');
            html.classList.add('is-leaving');
            void d.body.offsetWidth;

            if (maxLeave > 0) {
                var leaveWaiters = [];
                replacements.forEach(function (r) {
                    if (r.animation === 'none') return;
                    if (measureDuration(r.oldEl) > 0) leaveWaiters.push(waitForAnim(r.oldEl));
                });
                safeThen(raceWithTimeout(leaveWaiters, maxLeave + 120), doReplace);
            } else {
                doReplace();
            }
        } else {
            doReplace();
        }
    }

    // ================= 事件绑定 =================
    function M(a) { G > +new Date - 500 || (a = z(a.target)) && A(a) && x(a.href) }
    function N(a) {
        G > +new Date - 500 || (a = z(a.target)) && A(a) &&
            (a.addEventListener("mouseout", T), H ? (O = a.href, l = setTimeout(x, H)) : x(a.href))
    }
    function U(a) {
        G = +new Date;
        (a = z(a.target)) && A(a) && (D ? a.removeEventListener("mousedown", M) : a.removeEventListener("mouseover", N), x(a.href))
    }
    function V(a) {
        var b = z(a.target);
        if (!b || !A(b) || 1 < a.which || a.metaKey || a.ctrlKey) return;
        a.preventDefault();
        if (animating) return;
        P(b.href);
    }
    function T() {
        l ? (clearTimeout(l), l = !1) : v && !m && (p.abort(), m = v = !1)
    }

    // ================= fetch 回调 =================
    function W() {
        if (!(4 > p.readyState) && 0 != p.status) {
            q.ready = +new Date - q.start;
            if (p.getResponseHeader("Content-Type").match(/\/(x|ht|xht)ml/)) {
                var doc = d.implementation.createHTMLDocument("");
                doc.documentElement.innerHTML = p.responseText.replace(/<noscript[\s\S]+<\/noscript>/gi, "");
                y = doc.title;
                u = doc.body;
                var override = t("receive", r, u, y);
                override && ("body" in override && (u = override.body), "title" in override && (y = override.title));

                var key = w(r);
                h[key] = {
                    body: u, title: y,
                    scrollY: key in h ? h[key].scrollY : 0,
                    lastUsed: +new Date(), invalid: false
                };

                var head = doc.head.children, cnt = 0, c;
                for (var g = head.length - 1; 0 <= g; g--)
                    if (c = head[g], c.hasAttribute("data-instant-track")) {
                        c = c.getAttribute("href") || c.getAttribute("src") || c.innerHTML;
                        for (var e2 = E.length - 1; 0 <= e2; e2--) E[e2] == c && cnt++
                    }
                if (cnt != E.length) {
                    F = true;
                    if (key in h) h[key].invalid = true;
                }
                _trimCache();
            } else F = true;

            // 【修复 E】fetch 完成后进入 P 时标记 fromFetch=true，
            // 让 P 的缓存命中分支不再 C.start()/t("wait")，避免进度条重启。
            m && (m = !1, P(r, true))
        }
    }

    // ================= 预取 =================
    function x(a) {
        !D && "display" in q && 100 > +new Date - (q.start + q.display) ||
        (l && (clearTimeout(l), l = !1), a || (a = O), v && (a == r || m)) ||
        (v = !0, m = !1, r = a, F = u = !1, q = { start: +new Date }, t("fetch"), p.open("GET", a), p.send())
    }

    // ================= 导航入口（修复点击漂移 + 修复进度条重启）=================
    function P(a, fromFetch) {
        if (animating) return;
        "display" in q || (q.display = +new Date - q.start);

        var _w = w(a);

        // ① 缓存命中优先（缓存里的 body / title / url 都和 a 对应）
        if (_w in h && h[_w].body) {
            if (h[_w].invalid) { e.href = _w; return; }
            if (v && p) { try { p.abort(); } catch (_) {} }
            if (k in h) h[k].scrollY = pageYOffset;
            if (l) { clearTimeout(l); l = false; }
            m = v = false;
            u = false;
            h[_w].lastUsed = +new Date();

            // 【修复 E】只有"用户真实点击/预取后点击"这条路径才启动进度条；
            // fetch 完成回调这条路径进度条已经在第 1 次 start 里跑着了，不再重启。
            if (!fromFetch) {
                C.start(0, true);
                t("wait");
            }

            performReplace(h[_w].body.cloneNode(true), h[_w].title, a, 0, false);
            return;
        }

        // ② 关键修复：stale u（上次预取留下的 body，但目标 URL 和点击的不一致）
        //    直接丢弃，防止后面 u 分支用错 body 导致"点击 A 跑到 B"
        if (u && w(r) !== _w) {
            u = false;
        }

        l || !v
            ? l && r && r != a
                ? e.href = a
                : (x(a), C.start(0, true), t("wait"), m = true)
            : m
                ? e.href = a
                : F
                    ? e.href = a   // ③ 修复：用 a，而非 r
                    : u
                        ? (h[k].scrollY = pageYOffset,
                           m = v = false,
                           performReplace(u.cloneNode(true), y, r,
                               (w(r) in h ? h[w(r)].scrollY : 0), false))
                        : (C.start(0, true), t("wait"), m = true);
    }

    // ================= 进度条（修复版）=================
    var I = navigator.userAgent,
        S = -1 < I.indexOf(" CriOS/"),
        Q = "createTouch" in d,
        k, O, l, G, h = {}, p,
        r = false, y = false, F = false, u = false,
        q = {}, v = false, m = false, E = [],
        J, D, H,
        B = { fetch: [], receive: [], wait: [], change: [] },
        C = function () {
            var f, h, k, n, l;

            function clearAll() {
                var olds = d.querySelectorAll('#instantclick');
                for (var i = 0; i < olds.length; i++) {
                    if (olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]);
                }
            }

            function a(a, e) {
                n = a;
                clearAll();
                f.style.opacity = "1";
                g();
                e && setTimeout(b, 0);
                clearTimeout(l);
                l = setTimeout(c, 500)
            }
            function b() { n = 10; g() }
            function c() { n += 1 + 2 * Math.random(); 98 <= n ? n = 98 : l = setTimeout(c, 500); g() }
            function g() {
                h.style[k] = "translate(" + n + "%)";
                if (!d.getElementById(f.id)) d.body.appendChild(f);
            }
            // 找不到元素直接结束，不复活
            function e() {
                if (!d.getElementById(f.id)) return;
                clearTimeout(l);
                n = 100;
                g();
                f.style.opacity = "0";
            }
            function m() {
                f.style.left = pageXOffset + "px";
                f.style.width = innerWidth + "px";
                f.style.top = pageYOffset + "px";
                var a = "orientation" in window && 90 == Math.abs(orientation);
                f.style[k] = "scaleY(" + innerWidth / screen[a ? "height" : "width"] * 2 + ")"
            }
            return {
                init: function () {
                    clearAll();
                    f = d.createElement("div");
                    f.id = "instantclick";
                    h = d.createElement("div");
                    h.id = "instantclick-bar";
                    h.className = "instantclick-bar";
                    f.appendChild(h);
                    var a = ["Webkit", "Moz", "O"];
                    k = "transform";
                    if (!(k in h.style))
                        for (var b = 0; 3 > b; b++) a[b] + "Transform" in h.style && (k = a[b] + "Transform");
                    var c = "transition";
                    if (!(c in h.style))
                        for (b = 0; 3 > b; b++) a[b] + "Transition" in h.style && (c = "-" + a[b].toLowerCase() + "-" + c);
                    var st = d.createElement("style");
                    st.innerHTML = "#instantclick{position:" + (Q ? "absolute" : "fixed") + ";top:0;left:0;width:100%;pointer-events:none;z-index:2147483647;" + c + ":opacity .25s .1s}.instantclick-bar{background:#29d;width:100%;margin-left:-100%;height:2px;" + c + ":all .25s}";
                    d.head.appendChild(st);
                    Q && (m(), addEventListener("resize", m), addEventListener("scroll", m))
                },
                start: a,
                done: e
            }
        }(),
        R = "pushState" in history && (!I.match("Android") || I.match("Chrome/")) && "file:" != e.protocol;

    // ================= 默认 Swup 风格主题 CSS =================
    function injectAnimCSS() {
        if (CONFIG.theme !== 'fade') return;
        if (d.getElementById('ic-anim-style')) return;
        var style = d.createElement('style');
        style.id = 'ic-anim-style';
        style.textContent = [
            ':root{--ic-anim-duration:' + CONFIG.duration + 'ms;--ic-anim-easing:' + CONFIG.easing + '}',
            '.transition-fade{transition:opacity var(--ic-anim-duration) var(--ic-anim-easing);opacity:1}',
            'html.is-animating .transition-fade{opacity:0}'
        ].join('');
        d.head.appendChild(style);
    }

    // ================= 对外 API =================
    return {
        supported: R,
        init: function () {
            for (var i = 0; i < arguments.length; i++) {
                var arg = arguments[i];
                if (arg && typeof arg === 'object' && !(arg instanceof Array)) {
                    if ('animation' in arg) CONFIG.animation = !!arg.animation;
                    if ('theme' in arg) CONFIG.theme = arg.theme;
                    if ('duration' in arg) CONFIG.duration = +arg.duration;
                    if ('easing' in arg) CONFIG.easing = String(arg.easing);
                    if ('scroll' in arg) CONFIG.scroll = String(arg.scroll);
                    if ('respectReducedMotion' in arg) CONFIG.respectReducedMotion = !!arg.respectReducedMotion;
                    if ('cacheMax' in arg) CONFIG.cacheMax = +arg.cacheMax;
                    if ('containers' in arg && Array.isArray(arg.containers) && arg.containers.length > 0) {
                        CONFIG.containers = normalizeContainers(arg.containers);
                    }
                } else if (arg === true) J = true;
                else if (arg === 'mousedown') D = true;
                else if (typeof arg === 'number') H = arg;
            }

            if (k) return;
            if (!R) { t("change", true); return; }

            // 清理残留（热重载 / 重复 init）
            var olds = d.querySelectorAll('#instantclick');
            for (var i = 0; i < olds.length; i++) {
                if (olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]);
            }
            var oldStyle = d.getElementById('ic-anim-style');
            if (oldStyle && oldStyle.parentNode) oldStyle.parentNode.removeChild(oldStyle);

            injectAnimCSS();

            d.documentElement.classList.remove('is-changing', 'is-animating', 'is-leaving');

            k = w(e.href);
            h[k] = {
                body: d.body.cloneNode(true),
                title: d.title,
                scrollY: pageYOffset,
                lastUsed: +new Date(),
                invalid: false
            };

            var head = d.head.children, c;
            for (var i = head.length - 1; 0 <= i; i--) {
                c = head[i];
                if (c.hasAttribute("data-instant-track")) {
                    c = c.getAttribute("href") || c.getAttribute("src") || c.innerHTML;
                    E.push(c);
                }
            }

            p = new XMLHttpRequest;
            p.addEventListener("readystatechange", W);
            bindBodyListeners();
            C.init();
            t("change", true);

            addEventListener("popstate", function () {
                if (animating) return;
                var a = w(e.href);
                if (a == k) return;
                if (a in h) {
                    h[k].scrollY = pageYOffset;
                    k = a;
                    h[a].lastUsed = +new Date();
                    performReplace(h[a].body.cloneNode(true), h[a].title, false, h[a].scrollY, true);
                } else {
                    e.href = e.href;
                }
            });
        },
        on: function (a, b) { B[a].push(b); },
        clearCache: function () {
            h = {};
            k = w(e.href);
            h[k] = {
                body: d.body.cloneNode(true),
                title: d.title,
                scrollY: pageYOffset,
                lastUsed: +new Date(),
                invalid: false
            };
        },
        configure: function (obj) {
            if (!obj) return CONFIG;
            if ('animation' in obj) CONFIG.animation = !!obj.animation;
            if ('theme' in obj) CONFIG.theme = obj.theme;
            if ('duration' in obj) CONFIG.duration = +obj.duration;
            if ('easing' in obj) CONFIG.easing = String(obj.easing);
            if ('scroll' in obj) CONFIG.scroll = String(obj.scroll);
            if ('respectReducedMotion' in obj) CONFIG.respectReducedMotion = !!obj.respectReducedMotion;
            if ('cacheMax' in obj) CONFIG.cacheMax = +obj.cacheMax;
            if ('containers' in obj && Array.isArray(obj.containers) && obj.containers.length > 0) {
                CONFIG.containers = normalizeContainers(obj.containers);
            }
            return CONFIG;
        }
    }
}(document, location);