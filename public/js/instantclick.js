/* InstantClick 3.1.0 (enhanced) | (C) 2014 Alexandre Dieulot | http://instantclick.io/license
 * 改造1：持久内存缓存复用
 * 改造2：容器级局部替换 + CSS transition 驱动动画（对齐 Swup 3.x）
 * 改造3：Swup 兼容类名 is-changing / is-animating / is-leaving / transition-fade
 * 改造4：切换后滚动策略（instant / smooth / keep）
 * 改造5：可配置 API + prefers-reduced-motion 支持
 */
var InstantClick = function (d, e) {

    // ================= 配置 =================
    var CONFIG = {
        animation: true,
        theme: 'fade',
        duration: 250,
        easing: 'ease',
        scroll: 'smooth',
        respectReducedMotion: true,
        cacheMax: 30,
        containers: [{ selector: 'body', animation: 'auto' }]
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

    // 读取元素的计算过渡/动画时长（Swup 用 transition，兼容 animation）
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

    function raceWithTimeout(promises, ms) {
        return new Promise(function (resolve) {
            var done = false;
            var finish = function () { if (!done) { done = true; resolve(); } };
            Promise.all(promises).then(finish);
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
            var ev = d.createEvent("HTMLEvents");
            ev.initEvent("instantclick:newpage", !0, !0);
            dispatchEvent(ev);
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

        // ---- 6. 执行替换（离场结束 / 无动画时调用）----
        var doReplace = function () {
            // 给 newEl 补 transition-fade
            replacements.forEach(function (r) {
                if (r.addedClass && r.newEl) r.newEl.classList.add('transition-fade');
            });

            // DOM 替换
            replacements.forEach(function (r) {
                if (r.isBody) d.documentElement.replaceChild(r.newEl, r.oldEl);
                else r.oldEl.parentNode.replaceChild(r.newEl, r.oldEl);
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
                void d.body.offsetWidth;                // 强制重排，确保 transition 触发
                html.classList.remove('is-animating');  // 反向过渡开始

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
                    raceWithTimeout(enterWaiters, maxEnter + 120).then(finishEnter);
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
                raceWithTimeout(leaveWaiters, maxLeave + 120).then(doReplace);
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
            m && (m = !1, P(r))
        }
    }

    // ================= 预取 =================
    function x(a) {
        !D && "display" in q && 100 > +new Date - (q.start + q.display) ||
        (l && (clearTimeout(l), l = !1), a || (a = O), v && (a == r || m)) ||
        (v = !0, m = !1, r = a, F = u = !1, q = { start: +new Date }, t("fetch"), p.open("GET", a), p.send())
    }

    // ================= 导航入口 =================
    function P(a) {
        if (animating) return;
        "display" in q || (q.display = +new Date - q.start);

        var _w = w(a);
        if (_w in h && h[_w].body) {
            if (h[_w].invalid) { e.href = _w; return; }
            if (v && p) { try { p.abort(); } catch (_) {} }
            if (k in h) h[k].scrollY = pageYOffset;
            if (l) { clearTimeout(l); l = false; }
            m = v = false; u = false;
            h[_w].lastUsed = +new Date();
            C.start(0, true);
            t("wait");
            performReplace(h[_w].body.cloneNode(true), h[_w].title, a, 0, false);
            return;
        }

        l || !v
            ? l && r && r != a
                ? e.href = a
                : (x(a), C.start(0, true), t("wait"), m = true)
            : m
                ? e.href = a
                : F
                    ? e.href = r
                    : u
                        ? (h[k].scrollY = pageYOffset,
                           m = v = false,
                           performReplace(u.cloneNode(true), y, r,
                               (w(r) in h ? h[w(r)].scrollY : 0), false))
                        : (C.start(0, true), t("wait"), m = true);
    }

    // ================= 进度条 =================
    var I = navigator.userAgent,
        S = -1 < I.indexOf(" CriOS/"),
        Q = "createTouch" in d,
        k, O, l, G, h = {}, p,
        r = false, y = false, F = false, u = false,
        q = {}, v = false, m = false, E = [],
        J, D, H,
        B = { fetch: [], receive: [], wait: [], change: [] },
        C = function () {
            function a(a, e) {
                n = a;
                d.getElementById(f.id) && d.body.removeChild(f);
                f.style.opacity = "1";
                d.getElementById(f.id) && d.body.removeChild(f);
                g();
                e && setTimeout(b, 0);
                clearTimeout(l);
                l = setTimeout(c, 500)
            }
            function b() { n = 10; g() }
            function c() { n += 1 + 2 * Math.random(); 98 <= n ? n = 98 : l = setTimeout(c, 500); g() }
            function g() { h.style[k] = "translate(" + n + "%)"; d.getElementById(f.id) || d.body.appendChild(f) }
            function e() { d.getElementById(f.id) ? (clearTimeout(l), n = 100, g(), f.style.opacity = "0") : (a(100 == n ? 0 : n), setTimeout(e, 0)) }
            function m() {
                f.style.left = pageXOffset + "px";
                f.style.width = innerWidth + "px";
                f.style.top = pageYOffset + "px";
                var a = "orientation" in window && 90 == Math.abs(orientation);
                f.style[k] = "scaleY(" + innerWidth / screen[a ? "height" : "width"] * 2 + ")"
            }
            var f, h, k, n, l;
            return {
                init: function () {
                    f = d.createElement("div"); f.id = "instantclick";
                    h = d.createElement("div"); h.id = "instantclick-bar"; h.className = "instantclick-bar"; f.appendChild(h);
                    var a = ["Webkit", "Moz", "O"]; k = "transform";
                    if (!(k in h.style)) for (var b = 0; 3 > b; b++) a[b] + "Transform" in h.style && (k = a[b] + "Transform");
                    var c = "transition";
                    if (!(c in h.style)) for (b = 0; 3 > b; b++) a[b] + "Transition" in h.style && (c = "-" + a[b].toLowerCase() + "-" + c);
                    var st = d.createElement("style");
                    st.innerHTML = "#instantclick{position:" + (Q ? "absolute" : "fixed") + ";top:0;left:0;width:100%;pointer-events:none;z-index:2147483647;" + c + ":opacity .25s .1s}.instantclick-bar{background:#29d;width:100%;margin-left:-100%;height:2px;" + c + ":all .25s}";
                    d.head.appendChild(st);
                    Q && (m(), addEventListener("resize", m), addEventListener("scroll", m))
                },
                start: a, done: e
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

            injectAnimCSS();

            // 清理残留状态类（应对热重载）
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