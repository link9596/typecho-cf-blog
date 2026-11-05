/* InstantClick 3.1.0 (enhanced) | (C) 2014 Alexandre Dieulot | http://instantclick.io/license */
var InstantClick = function (d, e) {

    var CONFIG = {
        animation: true,
        theme: 'fade',
        duration: 250,
        easing: 'ease',
        scroll: 'smooth',
        respectReducedMotion: true,
        cacheMax: 30,
        fallbackToNative: false,
        containers: [
            { selector: '#main',      animation: 'auto' },
            { selector: '#header',    animation: 'none' },
            { selector: '#secondary', animation: 'auto' },
            { selector: '#footer',    animation: 'none' }
        ]
    };

    var prm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var an = false;

    function w(a) { var b = a.indexOf("#"); return 0 > b ? a : a.substr(0, b) }
    function z(a) { for (; a && "A" != a.nodeName;) a = a.parentNode; return a }

    function nc(list) {
        return list.map(function (it) {
            if (typeof it === 'string') return { selector: it, animation: 'auto' };
            if (it && it.selector) return { selector: it.selector, animation: it.animation || 'auto' };
            return null;
        }).filter(Boolean);
    }

    function htc(el) { return /(^|\s)transition-/.test(el.className || ''); }

    function md(el) {
        try {
            var cs = getComputedStyle(el), mx = 0;
            [{ dur: cs.transitionDuration, delay: cs.transitionDelay },
             { dur: cs.animationDuration,  delay: cs.animationDelay }].forEach(function (g) {
                var durs = (g.dur || '0s').split(','), dels = (g.delay || '0s').split(',');
                for (var i = 0; i < durs.length; i++) {
                    var t = (parseFloat(durs[i]) || 0) + (parseFloat(dels[i] || dels[0] || '0s') || 0);
                    if (t * 1000 > mx) mx = t * 1000;
                }
            });
            return mx;
        } catch (_) { return 0; }
    }

    function wa(el) {
        return new Promise(function (resolve) {
            var done = false;
            var fin = function () {
                if (done) return;
                done = true;
                el.removeEventListener('transitionend', onEnd);
                el.removeEventListener('animationend', onEnd);
                resolve();
            };
            var onEnd = function (ev) { if (ev.target === el) fin(); };
            el.addEventListener('transitionend', onEnd);
            el.addEventListener('animationend', onEnd);
        });
    }

    function st(p, cb) {
        return p.then(function () {
            try { cb(); } catch (err) {
                d.documentElement.classList.remove('is-changing', 'is-animating', 'is-leaving');
                an = false;
                if (typeof console !== 'undefined') console.error('[InstantClick] transition callback error:', err);
            }
        });
    }

    function rwt(ps, ms) {
        return new Promise(function (resolve) {
            var done = false;
            var fin = function () { if (!done) { done = true; resolve(); } };
            Promise.all(ps).then(fin, fin);
            setTimeout(fin, ms);
        });
    }

    function tc() {
        var ks = Object.keys(h);
        if (ks.length <= CONFIG.cacheMax) return;
        ks.sort(function (a, b) { return (h[a].lastUsed || 0) - (h[b].lastUsed || 0); });
        var del = ks.length - CONFIG.cacheMax;
        for (var i = 0; i < ks.length && del > 0; i++) {
            if (ks[i] === k) continue;
            delete h[ks[i]];
            del--;
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
        for (var d2 = !1, i = 0; i < B[a].length; i++)
            if ("receive" == a) {
                var f = B[a][i](b, c, g);
                f && ("body" in f && (c = f.body), "title" in f && (g = f.title), d2 = f)
            } else B[a][i](b, c, g);
        return d2
    }

    function ds(top, behavior) {
        if (behavior === 'smooth') {
            try { window.scrollTo({ top: top, left: 0, behavior: 'smooth' }); }
            catch (_) { window.scrollTo(0, top); }
            return;
        }
        if (behavior === 'keep') return;
        var html = d.documentElement, prev = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        window.scrollTo(0, top);
        html.style.scrollBehavior = prev;
    }
    function se(el, behavior) {
        var top = 0, cur = el;
        while (cur.offsetParent) { top += cur.offsetTop; cur = cur.offsetParent; }
        ds(top, behavior);
    }

    function bbl() {
        d.body.addEventListener("touchstart", U, !0);
        D ? d.body.addEventListener("mousedown", M, !0) : d.body.addEventListener("mouseover", N, !0);
        d.body.addEventListener("click", V, !0);
    }
    function rs(scope) {
        var ss = scope.getElementsByTagName("script"), b, c, g, nx;
        for (var i = 0, j = ss.length; i < j; i++) {
            b = ss[i];
            if (b.hasAttribute("data-no-instant")) continue;
            c = d.createElement("script");
            if (b.src) c.src = b.src;
            if (b.innerHTML) c.innerHTML = b.innerHTML;
            g = b.parentNode;
            nx = b.nextSibling;
            g.removeChild(b);
            g.insertBefore(c, nx);
        }
    }

    function pr(nb, title, url, sy, isPop) {
        var html = d.documentElement;
        var anim = CONFIG.animation && !(CONFIG.respectReducedMotion && prm);
        var isBody = CONFIG.containers.length === 1 && CONFIG.containers[0].selector === 'body';
        var rps = [];

        if (isBody) {
            rps.push({ oldEl: d.body, newEl: nb, isBody: true, animation: CONFIG.containers[0].animation, addedClass: false });
        } else {
            var found = false;
            CONFIG.containers.forEach(function (cfg) {
                var o = d.body.querySelector(cfg.selector), n = nb.querySelector(cfg.selector);
                if (!o || !n) return;
                found = true;
                if (o.innerHTML === n.innerHTML) return;
                rps.push({ oldEl: o, newEl: n, isBody: false, animation: cfg.animation, addedClass: false });
            });
            if (!found) {
                rps.push({ oldEl: d.body, newEl: nb, isBody: true, animation: 'auto', addedClass: false });
                isBody = true;
            }
        }

        var upMeta = function () {
            if (!isPop && url) { history.pushState(null, null, url); k = w(url); }
            d.title = S && d.title == title ? title + String.fromCharCode(160) : title;
        };
        var applyScroll = function () {
            var hash = null;
            if (url) { var hi = url.indexOf("#"); if (hi > -1) hash = url.substr(hi + 1); }
            if (hash) {
                var el = d.getElementById(hash);
                if (el) se(el, anim ? 'smooth' : CONFIG.scroll);
                else ds(0, CONFIG.scroll);
            } else if (isPop) {
                ds(sy || 0, 'instant');
            } else {
                ds(0, CONFIG.scroll);
            }
        };
        var fire = function () {
            C.done();
            t("change", false);
            var ev = d.createEvent("HTMLEvents");
            ev.initEvent("instantclick:newpage", !0, !0);
            dispatchEvent(ev);
            try { document.dispatchEvent(new Event('page:view')); } catch (_) {}
            try { document.dispatchEvent(new Event('swup:page:view')); } catch (_) {}
            try { document.dispatchEvent(new Event('astro:page-load')); } catch (_) {}
            try { document.dispatchEvent(new Event('astro:after-swap')); } catch (_) {}
        };

        if (rps.length === 0) {
            upMeta(); applyScroll(); fire();
            an = false;
            return;
        }

        if (anim && CONFIG.theme === 'fade') {
            rps.forEach(function (r) {
                if (r.animation === 'none') return;
                if (htc(r.oldEl)) return;
                r.oldEl.classList.add('transition-fade');
                r.addedClass = true;
            });
        }

        var maxLeave = 0;
        if (anim) {
            rps.forEach(function (r) {
                if (r.animation === 'none') return;
                var du = md(r.oldEl);
                if (du > maxLeave) maxLeave = du;
            });
        }

        var doReplace = function () {
            try { document.dispatchEvent(new Event('astro:before-swap')); } catch (_) {}

            rps.forEach(function (r) {
                if (r.addedClass && r.newEl) r.newEl.classList.add('transition-fade');
            });

            rps.forEach(function (r) {
                if (r.isBody) {
                    var bar = d.getElementById('instantclick');
                    if (bar && bar.parentNode === r.oldEl) bar.parentNode.removeChild(bar);
                    d.documentElement.replaceChild(r.newEl, r.oldEl);
                    if (bar) r.newEl.appendChild(bar);
                } else {
                    r.oldEl.parentNode.replaceChild(r.newEl, r.oldEl);
                }
            });

            html.classList.remove('is-leaving');
            upMeta();
            applyScroll();

            if (isBody) { bbl(); rs(d.body); }
            else rps.forEach(function (r) { rs(r.newEl); });

            fire();

            if (anim) {
                void d.body.offsetWidth;
                html.classList.remove('is-animating');

                var maxEnter = 0, waits = [];
                rps.forEach(function (r) {
                    if (r.animation === 'none') return;
                    if (!r.newEl || !r.newEl.isConnected) return;
                    var du = md(r.newEl);
                    if (du > maxEnter) maxEnter = du;
                    if (du > 0) waits.push(wa(r.newEl));
                });

                var fin = function () {
                    html.classList.remove('is-changing');
                    rps.forEach(function (r) {
                        if (r.addedClass && r.newEl) r.newEl.classList.remove('transition-fade');
                    });
                    an = false;
                };

                if (maxEnter > 0) st(rwt(waits, maxEnter + 120), fin);
                else fin();
            } else {
                html.classList.remove('is-changing');
                an = false;
            }
        };

        if (anim) {
            an = true;
            html.classList.add('is-changing');
            html.classList.add('is-animating');
            html.classList.add('is-leaving');
            void d.body.offsetWidth;

            if (maxLeave > 0) {
                var leaves = [];
                rps.forEach(function (r) {
                    if (r.animation === 'none') return;
                    if (md(r.oldEl) > 0) leaves.push(wa(r.oldEl));
                });
                st(rwt(leaves, maxLeave + 120), doReplace);
            } else doReplace();
        } else doReplace();
    }

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
        if (an) return;
        P(b.href);
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
                var ov = t("receive", r, u, y);
                ov && ("body" in ov && (u = ov.body), "title" in ov && (y = ov.title));

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
                        for (var x2 = E.length - 1; 0 <= x2; x2--) E[x2] == c && cnt++
                    }
                if (cnt != E.length) {
                    F = true;
                    if (key in h) h[key].invalid = true;
                }
                tc();
            } else F = true;

            m && (m = !1, P(r, true))
        }
    }

    function x(a) {
        !D && "display" in q && 100 > +new Date - (q.start + q.display) ||
        (l && (clearTimeout(l), l = !1), a || (a = O), v && (a == r || m)) ||
        (v = !0, m = !1, r = a, F = u = !1, q = { start: +new Date }, t("fetch"), p.open("GET", a), p.send())
    }

    function P(a, fromFetch) {
        if (an) return;
        "display" in q || (q.display = +new Date - q.start);

        var _w = w(a);
        var fb = CONFIG.fallbackToNative;

        // ① 缓存命中
        if (_w in h && h[_w].body) {
            if (h[_w].invalid) { e.href = _w; return; }
            if (v && p) { try { p.abort(); } catch (_) {} }
            if (k in h) h[k].scrollY = pageYOffset;
            if (l) { clearTimeout(l); l = false; }
            m = v = false;
            u = false;
            h[_w].lastUsed = +new Date();

            if (!fromFetch) { C.start(0, true); t("wait"); }

            pr(h[_w].body.cloneNode(true), h[_w].title, a, 0, false);
            return;
        }

        if (u && w(r) !== _w) u = false;

        l || !v
            ? l && r && r != a && fb
                ? e.href = a
                : (x(a), C.start(0, true), t("wait"), m = true)
            : m
                ? fb
                    ? e.href = a
                    : (w(r) === _w
                        ? 0
                        : (p.abort(), v = m = false,
                           x(a), C.start(0, true), t("wait"), m = true))
                : F
                    ? e.href = a
                    : u
                        ? (h[k].scrollY = pageYOffset,
                           m = v = false,
                           pr(u.cloneNode(true), y, r, (w(r) in h ? h[w(r)].scrollY : 0), false))
                        : (C.start(0, true), t("wait"), m = true);
    }

    var I = navigator.userAgent,
        S = -1 < I.indexOf(" CriOS/"),
        Q = "createTouch" in d,
        k, O, l, G, h = {}, p,
        r = false, y = false, F = false, u = false,
        q = {}, v = false, m = false, E = [],
        J, D, H,
        B = { fetch: [], receive: [], wait: [], change: [] },
        C = function () {
            var f, hb, kt, n, l2, rid, st0, s0;

            var rAF = typeof requestAnimationFrame !== 'undefined'
                ? function (cb) { return requestAnimationFrame(cb); }
                : function (cb) { return setTimeout(cb, 16); };
            var cAF = typeof cancelAnimationFrame !== 'undefined'
                ? function (id) { cancelAnimationFrame(id); }
                : function (id) { clearTimeout(id); };

            // 前 6 秒平滑推进阶段
            var SMOOTH_MS = 6000;   // 平滑时长
            var SMOOTH_END = 75;    // 平滑终点百分比

            function ca() {
                var olds = d.querySelectorAll('#instantclick');
                for (var i = 0; i < olds.length; i++) {
                    if (olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]);
                }
            }

            function a(a2, e2) {
                s0 = a2;
                n = a2;
                ca();
                f.style.opacity = "1";
                clearTimeout(l2);
                if (rid) { cAF(rid); rid = null; }
                g();
                st0 = +new Date;
                rid = rAF(smooth);
            }

            // 6 秒内：easeOutQuad 缓动从起点推进到 75%
            function smooth() {
                var el = +new Date - st0;
                if (el >= SMOOTH_MS) {
                    n = SMOOTH_END;
                    g();
                    rid = null;
                    trickle();
                    return;
                }
                var t2 = el / SMOOTH_MS;
                var eased = 1 - (1 - t2) * (1 - t2);
                n = s0 + (SMOOTH_END - s0) * eased;
                g();
                rid = rAF(smooth);
            }

            // 6 秒后：原版节奏，每 500ms 随机 +1~3% 直到 98%
            function trickle() {
                if (n >= 98) { n = 98; g(); return; }
                n += 1 + 2 * Math.random();
                if (n > 98) n = 98;
                g();
                if (n < 98) l2 = setTimeout(trickle, 500);
            }

            function g() {
                hb.style[kt] = "translate(" + n + "%)";
                if (!d.getElementById(f.id)) d.body.appendChild(f);
            }

            // 找不到元素直接结束，不复活
            function e3() {
                if (!d.getElementById(f.id)) return;
                clearTimeout(l2);
                if (rid) { cAF(rid); rid = null; }
                n = 100;
                g();
                f.style.opacity = "0";
            }

            function m2() {
                f.style.left = pageXOffset + "px";
                f.style.width = innerWidth + "px";
                f.style.top = pageYOffset + "px";
                var or = "orientation" in window && 90 == Math.abs(orientation);
                f.style[kt] = "scaleY(" + innerWidth / screen[or ? "height" : "width"] * 2 + ")"
            }

            return {
                init: function () {
                    ca();
                    clearTimeout(l2);
                    if (rid) { cAF(rid); rid = null; }
                    f = d.createElement("div");
                    f.id = "instantclick";
                    hb = d.createElement("div");
                    hb.id = "instantclick-bar";
                    hb.className = "instantclick-bar";
                    f.appendChild(hb);
                    var vs = ["Webkit", "Moz", "O"];
                    kt = "transform";
                    if (!(kt in hb.style))
                        for (var i = 0; 3 > i; i++) vs[i] + "Transform" in hb.style && (kt = vs[i] + "Transform");
                    var tr = "transition";
                    if (!(tr in hb.style))
                        for (i = 0; 3 > i; i++) vs[i] + "Transition" in hb.style && (tr = "-" + vs[i].toLowerCase() + "-" + tr);
                    var stl = d.createElement("style");
                    stl.innerHTML = "#instantclick{position:" + (Q ? "absolute" : "fixed") + ";top:0;left:0;width:100%;pointer-events:none;z-index:2147483647;" + tr + ":opacity .25s .1s}.instantclick-bar{background:#29d;width:100%;margin-left:-100%;height:2px;" + tr + ":all .25s}";
                    d.head.appendChild(stl);
                    Q && (m2(), addEventListener("resize", m2), addEventListener("scroll", m2))
                },
                start: a,
                done: e3
            }
        }(),
        R = "pushState" in history && (!I.match("Android") || I.match("Chrome/")) && "file:" != e.protocol;

    function iac() {
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

    function mergeCfg(obj) {
        if (!obj) return;
        if ('animation' in obj) CONFIG.animation = !!obj.animation;
        if ('theme' in obj) CONFIG.theme = obj.theme;
        if ('duration' in obj) CONFIG.duration = +obj.duration;
        if ('easing' in obj) CONFIG.easing = String(obj.easing);
        if ('scroll' in obj) CONFIG.scroll = String(obj.scroll);
        if ('respectReducedMotion' in obj) CONFIG.respectReducedMotion = !!obj.respectReducedMotion;
        if ('cacheMax' in obj) CONFIG.cacheMax = +obj.cacheMax;
        if ('fallbackToNative' in obj) CONFIG.fallbackToNative = !!obj.fallbackToNative;
        if ('containers' in obj && Array.isArray(obj.containers) && obj.containers.length > 0) {
            CONFIG.containers = nc(obj.containers);
        }
    }

    return {
        supported: R,
        init: function () {
            for (var i = 0; i < arguments.length; i++) {
                var arg = arguments[i];
                if (arg && typeof arg === 'object' && !(arg instanceof Array)) mergeCfg(arg);
                else if (arg === true) J = true;
                else if (arg === 'mousedown') D = true;
                else if (typeof arg === 'number') H = arg;
            }

            if (k) return;
            if (!R) { t("change", true); return; }

            var olds = d.querySelectorAll('#instantclick');
            for (var i = 0; i < olds.length; i++) {
                if (olds[i].parentNode) olds[i].parentNode.removeChild(olds[i]);
            }
            var oldStyle = d.getElementById('ic-anim-style');
            if (oldStyle && oldStyle.parentNode) oldStyle.parentNode.removeChild(oldStyle);

            iac();
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
                    E.push(c.getAttribute("href") || c.getAttribute("src") || c.innerHTML);
                }
            }

            p = new XMLHttpRequest;
            p.addEventListener("readystatechange", W);
            bbl();
            C.init();
            t("change", true);

            addEventListener("popstate", function () {
                if (an) return;
                var a = w(e.href);
                if (a == k) return;
                if (a in h) {
                    h[k].scrollY = pageYOffset;
                    k = a;
                    h[a].lastUsed = +new Date();
                    pr(h[a].body.cloneNode(true), h[a].title, false, h[a].scrollY, true);
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
            mergeCfg(obj);
            return CONFIG;
        }
    }
}(document, location);