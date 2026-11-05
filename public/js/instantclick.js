/* InstantClick 3.1.0 (enhanced) | (C) 2014 Alexandre Dieulot | http://instantclick.io/license
 * 改造：加入持久内存缓存复用（Swup 风格）
 * 改动点：_trimCache / W() 存元信息 / P() 缓存命中分支 / init 存 clone 快照
 *         popstate 用 clone 渲染 / u 分支用 clone / 新增 clearCache API
 */
var InstantClick = function (d, e) {

    // ===== 新增：缓存条数上限（超出按 LRU 淘汰）=====
    var CACHE_MAX = 30;

    // ===== 新增：LRU 修剪 =====
    function _trimCache() {
        var ks = Object.keys(h);
        if (ks.length <= CACHE_MAX) return;
        ks.sort(function (a, b) {
            return (h[a].lastUsed || 0) - (h[b].lastUsed || 0);
        });
        var toDel = ks.length - CACHE_MAX;
        for (var i = 0; i < ks.length && toDel > 0; i++) {
            if (ks[i] === k) continue;
            delete h[ks[i]];
            toDel--;
        }
    }

    function w(a) {
        var b = a.indexOf("#");
        return 0 > b ? a : a.substr(0, b)
    }
    function z(a) {
        for (; a && "A" != a.nodeName;) a = a.parentNode;
        return a
    }
    function A(a) {
        var b = e.protocol + "//" + e.host;
        if (!(b = a.target || a.hasAttribute("download") || 0 != a.href.indexOf(b + "/") || -1 < a.href.indexOf("#") && w(a.href) == k)) {
            if (J) {
                a: {
                    do {
                        if (!a.hasAttribute) break;
                        if (a.hasAttribute("data-no-instant")) break;
                        if (a.hasAttribute("data-instant")) {
                            a = !0;
                            break a
                        }
                    } while (a = a.parentNode);
                    a = !1
                }
                a = !a
            } else a: {
                do {
                    if (!a.hasAttribute) break;
                    if (a.hasAttribute("data-instant")) break;
                    if (a.hasAttribute("data-no-instant")) {
                        a = !0;
                        break a
                    }
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
    function K(a, b, c, g) {
        d.documentElement.replaceChild(b, d.body);
        if (c) {
            history.pushState(null, null, c);
            var idx = c.indexOf("#");
            var hashEl = -1 < idx && d.getElementById(c.substr(idx + 1));
            g = 0;
            if (hashEl) for (; hashEl.offsetParent;) g += hashEl.offsetTop, hashEl = hashEl.offsetParent;
            scrollTo(0, g);
            k = w(c)
        } else scrollTo(0, g);
        d.title = S && d.title == a ? a + String.fromCharCode(160) : a;
        L();
        C.done();
        t("change", !1);
        var ev = d.createEvent("HTMLEvents");
        ev.initEvent("instantclick:newpage", !0, !0);
        dispatchEvent(ev)
    }
    function M(a) {
        G > +new Date - 500 || (a = z(a.target)) && A(a) && x(a.href)
    }
    function N(a) {
        G > +new Date - 500 || (a = z(a.target)) && A(a) && (a.addEventListener("mouseout", T), H ? (O = a.href, l = setTimeout(x, H)) : x(a.href))
    }
    function U(a) {
        G = +new Date;
        (a = z(a.target)) && A(a) && (D ? a.removeEventListener("mousedown", M) : a.removeEventListener("mouseover", N), x(a.href))
    }
    function V(a) {
        var b = z(a.target);
        !b || !A(b) || 1 < a.which || a.metaKey || a.ctrlKey || (a.preventDefault(), P(b.href))
    }
    function T() {
        l ? (clearTimeout(l), l = !1) : v && !m && (p.abort(), m = v = !1)
    }
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

                // ===== 修改：存储时带元信息 =====
                var key = w(r);
                h[key] = {
                    body: u,
                    title: y,
                    scrollY: key in h ? h[key].scrollY : 0,
                    lastUsed: +new Date(),
                    invalid: false
                };
                // ===== 修改结束 =====

                // 检测 data-instant-track 资源是否变化（原逻辑，变量改名避免覆盖）
                var head = doc.head.children, cnt = 0, c;
                for (var g = head.length - 1; 0 <= g; g--)
                    if (c = head[g], c.hasAttribute("data-instant-track")) {
                        c = c.getAttribute("href") || c.getAttribute("src") || c.innerHTML;
                        for (var e2 = E.length - 1; 0 <= e2; e2--) E[e2] == c && cnt++
                    }
                if (cnt != E.length) {
                    F = true;
                    // ===== 修改：只标记本页失效，不再全局粗暴 F =====
                    if (key in h) h[key].invalid = true;
                }
                _trimCache();
            } else F = true;
            m && (m = !1, P(r))
        }
    }
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
    function x(a) {
        !D && "display" in q && 100 > +new Date - (q.start + q.display) || (l && (clearTimeout(l), l = !1), a || (a = O), v && (a == r || m)) || (v = !0, m = !1, r = a, F = u = !1, q = { start: +new Date }, t("fetch"), p.open("GET", a), p.send())
    }

    // ===== 修改：P() 加入持久缓存命中分支 =====
    function P(a) {
        "display" in q || (q.display = +new Date - q.start);

        var _w = w(a);
        // ---- 新增：缓存命中（这就是 Swup 的复用速度）----
        if (_w in h && h[_w].body) {
            if (h[_w].invalid) {          // 资源版本冲突 → 整页刷新
                e.href = _w;
                return;
            }
            if (v && p) { try { p.abort(); } catch (_) {} }  // 放弃进行中的请求
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
        // ---- 原逻辑（u 分支改为 clone，防止模板被污染）----
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
    // ===== 修改结束 =====

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

    return {
        supported: R,
        init: function () {
            if (!k)
                if (R) {
                    for (var a = arguments.length - 1; 0 <= a; a--) {
                        var b = arguments[a];
                        !0 === b ? J = !0 : "mousedown" == b ? D = !0 : "number" == typeof b && (H = b)
                    }
                    k = w(e.href);
                    // ===== 修改：初始页存 clone 快照（游离，不会被污染）=====
                    h[k] = {
                        body: d.body.cloneNode(true),
                        title: d.title,
                        scrollY: pageYOffset,
                        lastUsed: +new Date(),
                        invalid: false
                    };
                    // ===== 修改结束 =====
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
                    t("change", !0);
                    addEventListener("popstate", function () {
                        var a = w(e.href);
                        if (a != k) {
                            if (a in h) {
                                h[k].scrollY = pageYOffset;
                                k = a;
                                h[a].lastUsed = +new Date();
                                // ===== 修改：clone 渲染，安全复现 =====
                                K(h[a].title, h[a].body.cloneNode(true), !1, h[a].scrollY);
                            } else e.href = e.href;
                        }
                    })
                } else t("change", !0)
        },
        on: function (a, b) {
            B[a].push(b)
        },
        // ===== 新增：手动清空缓存 API =====
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
        }
    }
}(document, location);