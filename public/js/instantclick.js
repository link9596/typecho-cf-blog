/* InstantClick 3.1.0 (enhanced + animation) | (C) 2014 Alexandre Dieulot | http://instantclick.io/license
 * 改造1：持久内存缓存复用（Swup 风格）
 * 改造2：三阶段动画类 ic-out / ic-changing / ic-in，CSS 可覆盖
 * 改造3：切换后滚动策略（instant / smooth / keep）
 * 改造4：可配置 API + prefers-reduced-motion 支持
 */
var InstantClick = function (d, e) {

    // ================= 配置 =================
    var CONFIG = {
        animation: true,
        duration: 250,
        easing: 'ease',
        scroll: 'instant',            // 'instant' | 'smooth' | 'keep'
        respectReducedMotion: true,
        cacheMax: 30
    };

    var prefersReducedMotion =
        typeof matchMedia !== 'undefined' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ================= 状态 =================
    var animating = false;

    // ================= LRU 修剪 =================
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

    // ================= 基础工具 =================
    function w(a) { var b = a.indexOf("#"); return 0 > b ? a : a.substr(0, b) }
    function z(a) { for (; a && "A" != a.nodeName;) a = a.parentNode; return a }
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

    // ================= 滚动工具 =================
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

    // ================= 核心：页面切换 =================
    function K(title, newBody, url, scrollY, opts) {
        opts = opts || {};
        var isPopstate = !!opts.popstate;
        var useAnimation = CONFIG.animation && !(CONFIG.respectReducedMotion && prefersReducedMotion);
        var html = d.documentElement;

        function clearChanging() {
            html.classList.remove('ic-changing');
            animating = false;
        }

        function doReplace() {
            var hash = null;
            if (url) {
                var hi = url.indexOf("#");
                if (hi > -1) hash = url.substr(hi + 1);
            }

            // 入场类在插入前加，配合 both fill-mode 防闪烁
            if (useAnimation) newBody.classList.add('ic-in');

            d.documentElement.replaceChild(newBody, d.body);

            if (!isPopstate && url) {
                history.pushState(null, null, url);
                k = w(url);
            }

            // 滚动
            if (hash) {
                var el = d.getElementById(hash);
                if (el) scrollToElement(el, useAnimation ? 'smooth' : CONFIG.scroll);
                else doScroll(0, CONFIG.scroll);
            } else if (isPopstate) {
                doScroll(scrollY || 0, 'instant');
            } else {
                doScroll(0, CONFIG.scroll);
            }

            d.title = S && d.title == title ? title + String.fromCharCode(160) : title;

            L();
            C.done();
            t("change", false);

            var ev = d.createEvent("HTMLEvents");
            ev.initEvent("instantclick:newpage", !0, !0);
            dispatchEvent(ev);

            // 入场收尾
            if (useAnimation) {
                var finished = false;
                var finishEnter = function () {
                    if (finished) return;
                    finished = true;
                    newBody.classList.remove('ic-in');
                    newBody.removeEventListener('animationend', onEnterEnd);
                    clearChanging();
                };
                var onEnterEnd = function (ev) {
                    if (ev.target === newBody) finishEnter();
                };
                newBody.addEventListener('animationend', onEnterEnd);
                setTimeout(finishEnter, CONFIG.duration + 120);
            } else {
                clearChanging();
            }
        }

        if (useAnimation) {
            animating = true;
            html.classList.add('ic-changing');       // ← 全局切换中

            var oldBody = d.body;
            oldBody.classList.add('ic-out');         // ← 旧 body 离场

            var left = false;
            var finishLeave = function () {
                if (left) return;
                left = true;
                oldBody.removeEventListener('animationend', onLeaveEnd);
                oldBody.classList.remove('ic-out');
                doReplace();
            };
            var onLeaveEnd = function (ev) {
                if (ev.target === oldBody) finishLeave();
            };
            oldBody.addEventListener('animationend', onLeaveEnd);
            setTimeout(finishLeave, CONFIG.duration + 120);
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
                    body: u,
                    title: y,
                    scrollY: key in h ? h[key].scrollY : 0,
                    lastUsed: +new Date(),
                    invalid: false
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

    // ================= script 重建 =================
    function L(a) {
        d.body.addEventListener("touchstart", U, !0);
        D ? d.body.addEventListener("mousedown", M, !0) : d.body.addEventListener("mouseover", N, !0);
        d.body.addEventListener("click", V, !0);
        if (!a) {
            var scripts = d.body.getElementsByTagName("script");
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

        // 缓存命中
        if (_w in h && h[_w].body) {
            if (h[_w].invalid) { e.href = _w; return; }
            if (v && p) { try { p.abort(); } catch (_) {} }
            if (k in h) h[k].scrollY = pageYOffset;
            if (l) { clearTimeout(l); l = false; }
            m = v = false;
            u = false;
            h[_w].lastUsed = +new Date();
            C.start(0, true);
            t("wait");
            K(h[_w].title, h[_w].body.cloneNode(true), a, 0);
            return;
        }

        // 原逻辑
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
                           K(y, u.cloneNode(true), r, (w(r) in h ? h[w(r)].scrollY : 0)))
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
            function c() {
                n += 1 + 2 * Math.random();
                98 <= n ? n = 98 : l = setTimeout(c, 500);
                g()
            }
            function g() {
                h.style[k] = "translate(" + n + "%)";
                d.getElementById(f.id) || d.body.appendChild(f)
            }
            function e() {
                d.getElementById(f.id) ? (clearTimeout(l), n = 100, g(), f.style.opacity = "0") : (a(100 == n ? 0 : n), setTimeout(e, 0))
            }
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

    // ================= 默认动画 CSS 注入 =================
    function injectAnimCSS() {
        if (d.getElementById('ic-anim-style')) return;
        var style = d.createElement('style');
        style.id = 'ic-anim-style';
        style.textContent = [
            ':root{--ic-anim-duration:' + CONFIG.duration + 'ms;--ic-anim-easing:' + CONFIG.easing + '}',
            '@keyframes ic-out{to{opacity:0}}',
            '@keyframes ic-in{from{opacity:0}to{opacity:1}}',
            'body.ic-out{animation:ic-out var(--ic-anim-duration) var(--ic-anim-easing) forwards}',
            'body.ic-in{animation:ic-in var(--ic-anim-duration) var(--ic-anim-easing) both}',
            /* ic-changing 只做标记，默认不给样式，避免影响现有交互 */
            'html.ic-changing{}'
        ].join('');
        d.head.appendChild(style);
    }

    // ================= 对外 API =================
    return {
        supported: R,
        init: function () {
            for (var i = 0; i < arguments.length; i++) {
                var arg = arguments[i];
                if (arg && typeof arg === 'object') {
                    if ('animation' in arg) CONFIG.animation = !!arg.animation;
                    if ('duration' in arg) CONFIG.duration = +arg.duration;
                    if ('easing' in arg) CONFIG.easing = String(arg.easing);
                    if ('scroll' in arg) CONFIG.scroll = String(arg.scroll);
                    if ('respectReducedMotion' in arg) CONFIG.respectReducedMotion = !!arg.respectReducedMotion;
                    if ('cacheMax' in arg) CONFIG.cacheMax = +arg.cacheMax;
                } else if (arg === true) J = true;
                else if (arg === 'mousedown') D = true;
                else if (typeof arg === 'number') H = arg;
            }

            if (k) return;
            if (!R) { t("change", true); return; }

            injectAnimCSS();

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
            L(!0);
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
                    K(h[a].title, h[a].body.cloneNode(true), false, h[a].scrollY, { popstate: true });
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
            if ('duration' in obj) CONFIG.duration = +obj.duration;
            if ('easing' in obj) CONFIG.easing = String(obj.easing);
            if ('scroll' in obj) CONFIG.scroll = String(obj.scroll);
            if ('respectReducedMotion' in obj) CONFIG.respectReducedMotion = !!obj.respectReducedMotion;
            if ('cacheMax' in obj) CONFIG.cacheMax = +obj.cacheMax;
            return CONFIG;
        }
    }
}(document, location);