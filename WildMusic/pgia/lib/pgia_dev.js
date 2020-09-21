(function() {

    var cid = 0;

    //Simple implementation of removed class features
    var PgClassPlugin = {
        version: "1.0.0",
        name: "pgClass",
        init: function init(target, value, tween, index, targets) {
            this.t = target;
            this.o = target.getAttribute('class') || '';
            this.has = false;
            this.v = value;
            this.cl = target.classList || null;
            this.cid = cid++;
            //console.log('init', target, value);
        },
        render: function render(ratio, data) {
            console.log(`class ${data.cid} - ${ratio}`);
            if(data.cl) {
                if (ratio === 0 && data.has) {
                    data.t.setAttribute('class', data.o);
                    data.has = false;
                } else if (ratio > 0) {
                    if (data.v.add) {
                        data.cl.add(data.v.add);
                    }
                    if (data.v.set) {
                        data.t.setAttribute('class', data.v.set);
                    }
                    if (data.v.remove) {
                        data.cl.remove(data.v.remove);
                    }
                    data.has = true;
                }
            }
        }
    }

    gsap.registerPlugin(PgClassPlugin);


    var PgDOMPlugin = {
        version: "1.0.0",
        name: "pgDom",
        init: function init(target, value, tween, index, targets) {
            this.t = target;
            this.o = target.getAttribute('class') || '';
            this.has = false;
            this.v = value;
            this.created = [];
            this.template = value.template || null;

            this.parent = target.parentNode;
            this.next = target.nextSibling;
            this.removed = false;
            this.append = true;

            if(value.clone) {
                if(target._pg_clone_time && (new Date()).getTime() - target._pg_clone_time < 200) {
                    //this element was just cloned and is now cloning others. Probably a recursive loop
                    log('This element was just cloned and is now cloning others. Probably a recursive loop!');
                    return;
                }
                var t = target.cloneNode(true);
                //t.removeAttribute('style');
                this.template = t.outerHTML;
                target.setAttribute('data-item-idx', 0);
                this.append = value.ins == 'append';

                //console.log(gsap.getTweensOf(target));
            }

            //console.log('template = ' + this.template)

            var count = pf(value.count || 1);

            if(typeof value.count_sel == 'string') {
                //a selector
                count = getTargets(target, value.count_sel).length + pf(value.count || 0)
            }
            this.count = count;
        },
        _d: function(el) {
            pgia.elementAnimationsManager.destroyAnimations(el);
            pgia.scrollSceneManager && pgia.scrollSceneManager.removeScene(el);
            el.parentNode && el.parentNode.removeChild(el);
        },
        _c: function(el) {
            pgia.elementAnimationsManager.refreshAnimations(el);
            pgia.scrollSceneManager && pgia.scrollSceneManager.updateScene(el);
        },
        render: function render(ratio, data) {
            if(data.template) {
                var c = round(data.count * ratio);

                if(c < data.created.length) {
                    while(data.created.length > c) {
                        PgDOMPlugin._d(data.created.pop());
                        //console.log('destroy 1')
                    }
                }

                while(c > data.created.length) {
                    //var el = data.copy.cloneNode(true);

                    var frag = document.createRange().createContextualFragment(data.template);
                    //console.log(frag);

                    var el = frag.firstChild;

                    var sib = (data.created.length ? data.created[data.created.length - 1] : data.t).nextSibling;

                    //console.log(el);

                    (data.append || !sib) ? data.t.parentNode.appendChild(el) : data.t.parentNode.insertBefore(el, sib);

                    el.setAttribute('data-item-idx', data.created.length + 1);
                    el.classList.add('pgia-clone');

                    data.created.push(el);

                    var changed = false;

                    var template = evaluateTemplateString(el.innerHTML, function(a) {
                        changed = true;
                        return (data.v.target || el).getAttribute(a) || '';
                    });

                    changed && (el.innerHTML = template);

                    if(data.v.pos) {
                        //window.getComputedStyle(el);

                        el._pg_position = new PgPosition(el, data.v.target,
                            evaluateParam(data.v.pos, el, data.v.target) || 'auto',
                            pf(data.v.pos_dist || 0),
                            pf(data.v.pos_width || 0),
                            pf(data.v.pos_height || 0)
                        );
                        el.style.left = el._pg_position.left + 'px';
                        el.style.top = el._pg_position.top + 'px';
                    }

                    //keep track to prevent recursive loops
                    el._pg_clone_time = (new Date()).getTime();

                    PgDOMPlugin._c(el);

                    if(data.v.play) {
                        pgia.play(el, data.v.play);
                    }
                    //console.log('create 1')
                }
            }
            if(data.v.remove) {
                if(ratio == 1 && !data.removed) {
                    PgDOMPlugin._d(data.t);
                    data.removed = true;
                } else if(ratio < 1 && data.removed) {
                    data.next ? data.parent.insertBefore(data.t, data.next) : data.parent.appendChild(data.t);
                    data.removed = false;
                    PgDOMPlugin._c(data.t);
                }
            }
        }
    }

    gsap.registerPlugin(PgDOMPlugin);

    var PgPositionManager = function() {
        var list = [];

        this.add = function(pos) {
            list.push(pos);
        }

        this.remove = function(pos) {
            var idx = list.indexOf(pos);
            idx >= 0 && list.splice(idx, 1);
        }

        var timer = null;

        var update = function(scroll) {
            //clone list because pos might be removed in the call to update
            list.slice(0).forEach(function(pos) {
                if(!scroll || pos.fixed) {
                    pos.update() && pos.move();
                }
            })
        }

        window.addEventListener('resize', function() {
            timer && clearTimeout(timer);
            timer = setTimeout(update, 250);
        });

        window.addEventListener('scroll', function() {
            update(true);
        });
    }

    var positionManager = new PgPositionManager();

    var PgPosition = function(el, target, pos, dist, size_w, size_h) {

        el._pg_position && el._pg_position.destroy();

        this.fixed = window.getComputedStyle(el).position == 'fixed';

        pos == 'auto' && (pos = 'top bottom right left');

        //console.log('new position on', target);

        var apos = pos.split(/\s+/);

        var setter = gsap.quickSetter(el, "css");

        this.update = function() {

            if(!el.ownerDocument || !target.ownerDocument || !el.parentNode) {
                //either this or target was removed
                el._pg_position = null;
                this.destroy();
                return false;
            }

            var ww = window.innerWidth;
            var wh = window.innerHeight;

            var rel = el.getBoundingClientRect();
            var rtarget = target.getBoundingClientRect();
            var rparent = el.parentNode.getBoundingClientRect();

            var top, left, w, h;

            w = size_w ? (rtarget.width * size_w / 100) : rel.width;
            h = size_h ? (rtarget.height * size_h / 100) : rel.height;

            for (var i = 0; i < apos.length; i++) {
                switch (apos[i]) {
                    case 'top':
                        left = rtarget.left + rtarget.width / 2 - w/2;
                        top = rtarget.top - dist - rel.height;
                        break;

                    case 'bottom':
                        left = rtarget.left + rtarget.width / 2 - w/2;
                        top = rtarget.top + rtarget.height + dist;
                        break;

                    case 'left':
                        top = rtarget.top + rtarget.height / 2 - h/2;
                        left = rtarget.left - rel.width - dist;
                        break;

                    case 'right':
                        top = rtarget.top + rtarget.height / 2 - h/2;
                        left = rtarget.left + rtarget.width + dist;
                        break;

                    case 'center':
                        top = rtarget.top + rtarget.height / 2 - h/2;
                        left = rtarget.left + rtarget.width / 2 - w/2;
                        break;
                }

                if ((left > 0 && top > 0 && left + rel.width < ww && top + rel.height < wh) || i == apos.length - 1) {
                    this.pos = apos[i];

                    left -= rparent.left;
                    top -= rparent.top;

                    break;
                }
            }

            this.ot = rel.top - rparent.top;
            this.ol = rel.left - rparent.left;
            this.ow = rel.width;
            this.oh = rel.height;

            this.top = top;
            this.left = left;
            this.w = w;
            this.h = h;

            el.setAttribute('data-pgia-position', this.pos);

            return true;
        }

        this.move = function(ratio) {
            var r = ratio === undefined ? 1.0 : ratio;

            var d = {
                left: this.ol + (this.left - this.ol) * ratio,
                top: this.ot + (this.top - this.ot) * ratio
            }

            size_w && (d.width = this.ow + (this.w - this.ow) * ratio);
            size_h && (d.height = this.oh + (this.h - this.oh) * ratio);

            setter(d);
        }

        this.destroy = function() {
            positionManager.remove(this);
        }

        this.update();

        positionManager.add(this);
    }


    var PgPositionPlugin = {
        version: "1.0.0",
        name: "pgPos",
        init: function init(target, value, tween, index, targets) {
            this.t = target;
            this.v = value;
            this.pos = new PgPosition(target, value.target_element,
                evaluateParam(value.pos || 'auto', target, value.target_element),
                evaluateParam(value.dist || '0', target, value.target_element),
                evaluateParam(value.width || '0', target, value.target_element),
                evaluateParam(value.height || '0', target, value.target_element)
            );
        },
        render: function render(ratio, data) {
            data.pos.move(ratio);
        }
    }

    gsap.registerPlugin(PgPositionPlugin);


    gsap.registerPlugin(ScrollTrigger);
    gsap.registerPlugin(ScrollToPlugin);


    var pgia = {};

    window.pgia = pgia;

    var html = document.documentElement;
    var in_pg = html.hasAttribute('data-pg-id');

    function log(e, ui) {
        if(in_pg) {
            console.error(e);
            //ui && pgAnimationInfo.message(e, true);
        }
    }

    if(typeof gasp !== 'undefined') {
        gsap.defaults({overwrite:"auto"});
    }

    function mobileCheck() {
        return in_pg ? html.hasAttribute('data-pg-mobile') : (screen.width < 1000 && screen.height < 1000);
    }

    var is_mobile = mobileCheck();

    var enabled = true;

    //Some polyfills for IE
    if(Element.prototype.matches) {
        Element.prototype.matches = Element.prototype.msMatchesSelector ||
            Element.prototype.webkitMatchesSelector;
    }

    if (!Element.prototype.closest) {
        Element.prototype.closest = function(s) {
            var el = this;

            do {
                if (el.matches(s)) return el;
                el = el.parentElement || el.parentNode;
            } while (el !== null && el.nodeType === 1);
            return null;
        };
    }
    //End polyfills

    if(!screen || !Element.prototype.matches || typeof Array.isArray === 'undefined' || !('innerHeight' in window) || html.hasAttribute('data-pg-ia-disabled')) enabled = false;

    // || window.matchMedia('prefers-reduced-motion:reduce').matches

    if(!enabled) return;

    var is_ff = navigator.userAgent.indexOf("Firefox") >= 0;

    function pf(num, def) {
        var r = parseFloat(num);
        return isNaN(r) ? def : r;
    }

    function pfList(a) {
        return a.map(pf);
    }

    function minMax(num, min, max) {
        return Math.min(Math.max(num, min), max);
    }

    function startsWith(s, m) {
        return ('' + s).indexOf(m) === 0;
    }

    function unescape(d) {
        return d.replace(/\&gt;/g, '>');
    }

    function evaluateTemplateString(str, func) {
        return (str + '').replace(/\$\{([^\}]*)\}/g, function(m, a) {
            return func(a);
        })
    }

    /*
    theme.colors.red
    location.hash
    this.href
    this.style.color
    target.href
    target.style.color
    target.innerWidth


     */
    function getVariableValue(name, node, target_el, def) {
        var val = window;
        var aa = name.split('.');
        var start = 0;
        if(aa[0] == 'this') {
            val = node;
            start++;
        } else if(aa[0] == 'target') {
            val = target_el;
            start++;
        }
        for(var i = start; i < aa.length; i++) {
            if(typeof val == 'object') {
                if(val instanceof HTMLElement && aa[i] == 'style' && i < aa.length - 1) {
                    val = window.getComputedStyle(val).getPropertyValue(aa[i+1]);
                    return val === null ? def : val;
                }
                if('hasAttribute' in val && val.hasAttribute(aa[i])) {
                    val = val.getAttribute(aa[i]);
                } else if(aa[i] in val) {
                    val = val[aa[i]];
                } else return def;
            } else {
                return def;
            }
        }
        return val;
    }

    function evaluateParam(template, node, target_el) {
        var r = evaluateTemplateString(template, function(a) {
            var aa = a.split('|');
            a = aa[0];

            var val;

            if(startsWith(a, '--')) {
                val = (window.getComputedStyle(node).getPropertyValue(a) || '').trim();
            } else {
                val = getVariableValue(a, node, target_el);
            }
            ((typeof val == 'undefined' || val === '') && aa.length > 1) && (val = aa[1]);
            return val;
        })
        return pf(r, r);
    }

    function parseJson(str) {
        try {
            return JSON.parse(str);
        } catch(err) {}
        return null;
    }

    function mergeAnimations(tel, attr, d, aval) {
        var data = parseJson(aval || tel.getAttribute(attr));
        if(data && data.l) {
            d.d && d.d.l && (data.l = data.l.concat(d.d.l));
        } else {
            data = d;
        }
        tel.setAttribute(attr, JSON.stringify(data));
    }

    var round = Math.round;

    function getRelativeRect(el, prect, sl, st) {
        var r = el.getBoundingClientRect();
        return {
            left: r.left - prect.left + sl,
            top: r.top - prect.top + st,
            width: r.width,
            height: r.height
        }
    }

    function getChildrenLayout(el, sel) {
        var b = document.body;
        var docel = document.documentElement;
        var win = el == window || el == b;

        var elp = win ? docel : el.parentNode;

        if(win) {
            el = b;
        }

        var r = {
            p: win ? {
                left: 0,
                top: 0,
                width: window.innerWidth,
                height: window.innerHeight
            } : el.getBoundingClientRect(),
            pswidth: win ? docel.scrollWidth : el.scrollWidth,
            psheight: win ? docel.scrollHeight: el.scrollHeight,
            spleft:  win ? (window.pageXOffset || docel.scrollLeft) : el.scrollLeft,
            sptop:  win ? (window.pageYOffset || docel.scrollTop) : el.scrollTop,
            c: []
        };

        var children = sel ? getTargets(el, sel) : el.children;

        for(var i = 0; i < children.length; i++) {
            if((children[i].getAttribute('class') || '').indexOf('gsap-marker') < 0) {
                var cr = getRelativeRect(children[i], r.p, r.spleft, r.sptop);
                r.c.push(cr);
                //if(cr.left + cr.width > r.pswidth)
            }
        }
        return r;
    }

    var isPosEqual = function(a, b) {
        //return a == b;
        return Math.abs(a-b) < 0.001;
    }

    var isPosSmaller = function(a, b) {
        return !isPosEqual(a, b) && a < b;
    }

    var isPosLarger = function(a, b) {
        return !isPosEqual(a, b) && a > b;
    }

    var roundPos = function(a) {
        return round(a * 1000) / 1000;
    }

    var getNextChild = function(layout, target, horizontal, prev, eq, sel, st, inf, progress, page, idx) {
        layout = layout || getChildrenLayout(target, sel);
        var pos = horizontal ? 'left' : 'top'
        var size = horizontal ? 'width' : 'height';
        var cdir = horizontal ? 'Left' : 'Top';
        var is_win = target == window || target == document.body;

        var len = layout.c.length;

        if(!len) return;

        //find current
        //console.log(`${st.start} ${st.end}`);
        var ss = st ? (st.end - st.start) : (layout['ps' + size] - layout.p[size]);
        var start = st ? st.start : 0;

        var cur_pos = (st ? st.progress : (layout['sp' + pos] / ss));

        if(progress !== undefined) cur_pos = progress;

        if(inf) {
            if((!prev && isPosEqual(cur_pos ,1)) || (prev && isPosEqual(cur_pos, 0))) {
                cur_pos = prev ? 1 : layout.c[0][pos] / ss;
                var scroller = is_win ? document.documentElement : target;
                is_win ? window.scrollTo(horizontal ? cur_pos * ss : layout.sptop, horizontal ? layout.spleft : cur_pos * ss) : (scroller['scroll' + cdir] = cur_pos * ss);
            }
        }

        if(idx !== undefined) {
            idx = minMax(idx, 0, inf ? (len - 2) : (len - 1));
            return {
                px: layout.c[idx][pos],
                p: layout.c[idx][pos] / ss,
                i: idx
            }
        }

        //make snap points
        var p,px, idx;

        px = -1;

        var bottomCover = (st ? st.pgBottomCover : 0) / ss;
        var topCover = (st ? st.pgTopCover : 0) / ss;

        //console.log(layout.c);

        if(prev === 'c' || eq) {
            //get current
            //find the one with max area on screen
            var cur_pos_end = cur_pos + (layout.p[size] / ss) - bottomCover;

            px = 0;
            p = 0;
            idx = 0;

            var max_on_screen = 0;
            var pag_offset = (st ? st.pgTopCover : 0) / ss;

            //cur_pos += pag_offset / ss;
            //cur_pos = minMax(cur_pos, 0, 1);

            for (var i = 0; i < len; i++) {
                var ns = (layout.c[i][pos] - start) / ss;
                var ne = (layout.c[i][pos] + layout.c[i][size] - start) / ss;

                var p_on_screen = round((minMax(ne, cur_pos + pag_offset, cur_pos_end) - minMax(ns, cur_pos + pag_offset, cur_pos_end)) / (layout.c[i][size] / ss) * 100);

                if(prev === false && roundPos(ns) > cur_pos) p_on_screen *= 5;
                if(prev === true && roundPos(ns) < cur_pos) p_on_screen *= 5;

                if(p_on_screen > max_on_screen || (p_on_screen == max_on_screen && i == len - 1 && cur_pos == 1)) {
                    max_on_screen = p_on_screen;
                    px = (ns * ss);
                    p = ns;
                    idx = i;
                }
                //console.log(`${i} on screen ${p_on_screen} pos ${layout.c[i][pos]}`)
            }
            return {
                p: p,
                px: px,
                idx: idx
            }
        }
        if(page) {
            px = minMax(cur_pos * ss + (layout.p[size] * (prev ? -1 : 1)), 0, ss);
            p = px / ss;
        } else if(prev) {
            cur_pos += topCover;

            for (var i = len - 1; i >= 0; i--) {
                var n = round(layout.c[i][pos]);
                p = roundPos((n - start) / ss);
                //console.log(`Prev ${i} n=${n} start=${start} p=${p} cp=${cur_pos}`)

                if(isPosSmaller(p, cur_pos) || (eq && isPosEqual(p, cur_pos))) {
                    px = n;
                    idx = i;
                    break;
                }
            }
            if(px < 0) {
                px = start;
                p = 0;
                idx = 0;
            }
        } else {
            cur_pos += topCover;
            //console.log(`Next`)
            for (var i = 0; i < len; i++) {
                var n = round(layout.c[i][pos]);
                p = ((n - start) / ss);

                //console.log(`Next ${i} n=${n} start=${start} p=${p} cp=${cur_pos}`)

                if(isPosLarger(p, cur_pos) || (eq && isPosEqual(p, cur_pos))) {
                    px = n;
                    idx = i;
                    break;
                }
            }
            if(px < 0) {
                px = st ? st.end : ss;
                p = 1;
                idx = layout.c.length - 1;
            }
        }

        return {
            p: p,
            px: px,
            idx: idx
        }
    }

    function getScrollTrigger(scroller_el) {
        var gc = pgia.scrollSceneManager.getScene;
        if(scroller_el == window) {
            scene = gc(document.body) || gc(document.documentElement);
        } else scene = gc(scroller_el);

        return scene && scene.st;
    }

    function noop() {}

    //This solves the audio issues in Safari
    /*
    try {
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        var audioCtx = AudioContext && new AudioContext();
    } catch(err) {}
*/

    function playMedia(n, func, v) {
        if(n[func]) {
            try {
                (v !== '') && (n.currentTime = pf(v, 0));
                if(func === 'play') {
                    n[func]().then(function () {
                        n._pgia_broken = false;

                    }).catch(function (e) {
                        n._pgia_broken = true;

                        //probably autoplay
                        if (func === 'play' && n.nodeName != 'AUDIO' && !n.muted) {
                            n.muted = true;
                            playMedia(n, func, v);
                        }
                        log(e);
                    });
                } else {
                    n[func]();
                }
            } catch(e) {log(e);}
        }
    }

    var PgAnimationInfo = function () {

        this.getAnimationId = function (element, key) {
            var r = null;
            forEachTarget(element, function (el) {
                if (r === null) {
                    r = el.getAttribute('data-pg-id') + ':' + key
                }
            })
            return r;
        }

        this.updateProgress = function (animation_id, time) {

            if (window._pg_animation_phone) {
                window._pg_animation_phone.animationProgress(animation_id, time);
            }
        }

        /*
        this.message = function (msg, error) {

            if (window._pg_animation_phone && window._pg_animation_phone.message) {
                window._pg_animation_phone.message(msg, error);
            }
        }*/
    }

    var pgAnimationInfo = new PgAnimationInfo();

    var getTime = function (tl, progress) {
        if (typeof progress === 'string') {
            if (progress.indexOf('%') >= 0 && tl) {
                return tl.duration() * parseFloat(progress.replace('%', '')) / 100.0;
            } else if (progress.indexOf('ms') >= 0) {
                return parseFloat(progress.replace(/\s?ms/, '')) / 1000.0;
            } else if (progress.indexOf('s') >= 0) {
                return parseFloat(progress.replace(/\s?s/, ''));
            } else {
                return parseFloat(progress);
            }
        }
        return progress;
    }

    var isDisabled = function(a) {
        return a ? (a.on ? (a.on === 'mobile' ? !is_mobile : is_mobile) : false) : false;
    }


    var forEachProp = function(o, func) {
        for (var key in o) {
            if(o.hasOwnProperty(key)) {
                func(key, o[key]);
            }
        }
    }
    //var ease_cfg = ['']

    var getEase = function(s) {
        var def_ease = Quad.easeOut;
        if(!s) return def_ease;
        //return s;
        switch(s) {
            case 'SteppedEase.ease':
                return SteppedEase.ease.config(12);
            case 'RoughEase.ease':
                return RoughEase.ease;
        }
        var a = s.split('.');
        return (a.length === 2 && window[a[0]]) ? (window[a[0]][a[1]] || def_ease) : def_ease;
        //return e.config ? e.config() : e;
    }

    var aid = 0;

    var getTargets = function (element, sel, doc) {
        try {
            if (!sel || sel === 'this') return [element];
            var base = element;
            if (startsWith(sel, '$')) {
                sel = sel.substr(1);
                base = doc || document;
            }
            var a;
            if(startsWith(sel, '^')) {
                var sl = sel.substr(1).split('|');
                var p = element.closest(sl[0].trim());
                return sl.length === 1 ? [p] : getTargets(p, sl[1].trim(), doc);
            } else {
                if (startsWith(sel, '>')) {
                    a = 'pgtemp_' + aid++;
                    base.setAttribute(a, '');
                    sel = '[' + a + '] ' + sel;
                }
                var r = base.querySelectorAll(sel);
                a ? base.removeAttribute(a) : 0;
                return r;
            }
        } catch (err) {
            log(err);
        }
        return [];
    }

    pgia.getTargets = getTargets;

    var getAsList = function(e) {
        return (e instanceof NodeList || Array.isArray(e)) ? e : [e];
    }

    var forEachTarget = function (list, func) {
        Array.prototype.forEach.call(getAsList(list), func);
    }

    var getScrollDuration = function (dur) {
        dur = dur || 0;
        if (typeof dur === 'string') {
            dur = dur.replace('px', '');
        }
        return dur;
    }

    var getParam = function (data, key, def) {
        if (key in data) {
            if (data[key] === '') return def;
            return (def !== undefined && typeof def === 'number' && !isNaN(data[key])) ? pf(data[key]) : data[key];
        }
        return def;
    }


    var PgCustomAnimation = function () {

        this.getTimeline = function (d, element, done) {

            var tl = gsap.timeline({
                onComplete: done
            });

            forEachTarget(element, function (target_element) {
                if (d && d.l) { //loop through elements
                    d.l.forEach(function (el) {

                        if (el.m) return; //muted

                        var list = el.l.sort(function (a, b) { //transforms
                            if (a.p === b.p) {
                                if (a.t === 'set') {
                                    return -1;
                                } else if (b.t === 'set') {
                                    return 1;
                                } else {
                                    return 0;
                                }
                            } else {
                                return a.p - b.p;
                            }
                        })

                        list.forEach(function (t) {

                            if (t.m) return;

                            var target_key = el.t || 'self';

                            var nodes = [target_element];

                            if (el.t) {
                                nodes = [];

                                Array.prototype.forEach.call(getTargets(target_element, el.t), function (node) {
                                    if (nodes.indexOf(node) < 0) {
                                        nodes.push(node);
                                    }
                                });

                                /*
                                forEachTarget(element, function (el_node) {

                                    Array.prototype.forEach.call(getTargets(el_node, el.t), function (node) {
                                        if (nodes.indexOf(node) < 0) {
                                            nodes.push(node);
                                        }
                                    });

                                })*/
                            }

                            var pos = t.p;
                            var dur = t.d || 0;

                            var on_s = [];
                            var on_c = [];
                            var on_u = [];

                            var props = {};

                            //var needs_immediate = true;

                            var map = {
                                //Play during tween
                                'media.playing': function (p, v) {
                                    var f = function () {
                                        nodes.forEach(function (n) {
                                            if (n.paused && !n._pgia_broken && (v != '' || isNaN(n.duration) || n.duration > n.currentTime)) {
                                                playMedia(n, 'play', v);
                                            }
                                        })
                                    }
                                    on_s.push(f);
                                    on_u.push(f);
                                    on_c.push(function () {
                                        nodes.forEach(function (n) {
                                            playMedia(n, 'pause', '');
                                        })
                                    });
                                    //needs_immediate = true;
                                },
                                'media.play': function (p, v) {
                                    on_s.push(function () {
                                        nodes.forEach(function (n) {
                                            playMedia(n, 'play', v);
                                        })
                                    });
                                    //needs_immediate = true;

                                    /*
                                     nodes.forEach(function(n) {
                                     if(n.nodeName == 'AUDIO' && !n._pg_played) {
                                     n._pg_played = true;
                                     n.play();
                                     n.pause();
                                     }
                                     })*/
                                },
                                'media.stop': function (p, v) {
                                    on_s.push(function () {
                                        nodes.forEach(function (n) {
                                            playMedia(n, 'pause', v);
                                        })
                                    });
                                },
                                'media.mute': function (p, v) {
                                    on_s.push(function () {
                                        nodes.forEach(function (n) {
                                            n.muted = !!v;
                                        })
                                    });
                                    //needs_immediate = true;
                                },
                                'pgia.play': function (p, v) {
                                    on_s.push(function () {
                                        nodes.forEach(function (n) {
                                            v && pgia.play(n, evaluateParam(v, n, target_element));
                                            //v && n._pg_animations && n._pg_animations.play(parseInt(v)-1);
                                        })
                                    });

                                },
                                'pgia.pause': function (p, v) {
                                    on_s.push(function () {
                                        nodes.forEach(function (n) {
                                            v && pgia.pause(n, evaluateParam(v, n, target_element), tl);
                                            //v && n._pg_animations && n._pg_animations.play(parseInt(v)-1);
                                        })
                                    });

                                },
                                'pgia.start': function (p, v) {
                                    on_s.push(function () {
                                        nodes.forEach(function (n) {
                                            v && window[v] && window[v](n, 0);
                                        })
                                    });

                                },
                                'pgia.complete': function (p, v) {
                                    on_c.push(function () {
                                        nodes.forEach(function (n) {
                                            v && window[v] && window[v](n, 1);
                                        })
                                    });

                                },
                                'pgia.update': function (p, v) {
                                    on_u.push(function () {
                                        var progress = tl.progress();
                                        nodes.forEach(function (n) {
                                            v && window[v] && window[v](n, progress);
                                        })
                                    });

                                },
                                'class.set': function (p, v) {
                                    props.pgClass = props.pgClass || {};
                                    props.pgClass.set = v;
                                },
                                'class.add': function (p, v) {
                                    props.pgClass = props.pgClass || {};
                                    props.pgClass.add = v;
                                },
                                'class.remove': function (p, v) {
                                    props.pgClass = props.pgClass || {};
                                    props.pgClass.remove = v;
                                },
                                scrollTo: function (p, v) {
                                    var d = {}
                                    var dir = getParam(v, 'dir', 'y');
                                    var dest = getParam(v, 'dest', 0) + '';
                                    var inf = getParam(v, 'inf', 0);
                                    var sel = getParam(v, 'esel', null);
                                    var offset = getParam(v, 'offset', 'st');

                                    tl._pg_req_inv = true;

                                    var f = function (i, target) {
                                        var evaluated_dest = evaluateParam(dest, target, target_element);
                                        var nc;

                                        var st = getScrollTrigger(target);

                                        if(st) {
                                            inf = st.pgInf;
                                            dir = st.pgHor ? 'x' : 'y';
                                        }

                                        switch (evaluated_dest) {
                                            case 'next':
                                            case 'prev':
                                                nc = getNextChild(null, target, dir == 'x', dest == 'prev', false, sel, st, inf);
                                                d[dir] = nc.px;
                                                break;
                                            case 'first':
                                                nc = getNextChild(null, target, dir == 'x', false, false, sel, st, inf, undefined, false, 0);
                                                d[dir] = nc.px;
                                                break;
                                            case 'last':
                                                nc = getNextChild(null, target, dir == 'x', false, false, sel, st, inf, undefined, false, 9999);
                                                d[dir] = nc.px;
                                                break;
                                            case 'next_page':
                                            case 'prev_page':
                                                nc = getNextChild(null, target, dir == 'x', startsWith(dest, 'prev'), false, sel, st, inf, undefined, true);
                                                d[dir] = nc.px;
                                                break;
                                            default:
                                                if (startsWith(evaluated_dest, 'item')) {
                                                    var idx = pf(evaluated_dest.substr(4) || target_element.getAttribute('data-item-idx'));

                                                    nc = getNextChild(null, target, dir == 'x', false, false, sel, st, inf, undefined, false, idx);
                                                    d[dir] = nc.px;
                                                    break;
                                                } else {
                                                    d[dir] = evaluated_dest.replace(/([0-9]+)\%/, function (m, val) {
                                                        var dim = dir == 'y' ? 'Height' : 'Width';
                                                        var s = target['client' + dim];
                                                        return s * pf(val) / 100.0;
                                                    })
                                                }
                                        }

                                        d['offset' + dir.toUpperCase()] = offset === 'st' ? (st ? st.pgTopCover : 0) : offset;

                                        return d;
                                    }

                                    if (nodes.length && (nodes[0].tagName == 'BODY' || nodes[0].tagName == 'HTML')) {
                                        var p = {scrollTo: f};

                                        if (t.e) {
                                            p.ease = getEase(t.e);
                                        }
                                        tl.add(gsap.to(window, dur, p), pos);
                                    } else {
                                        props.scrollTo = f;
                                    }
                                },
                                pgPos: function (p, v) {
                                    //make nodes position next to target element
                                    v.target_element = target_element;
                                    props.pgPos = v;
                                    /*
                                    nodes.forEach(function (n) {
                                        var pos = new PgPosition(n, target_element, evaluateParam(v.pos || 'auto', n, target_element), evaluateParam(v.dist || '0', n, target_element));
                                        props.left = pos.left;
                                        props.top = pos.top;
                                        n._pg_position = pos;
                                    })*/
                                },
                                pgRepos: function (p, v) {
                                    //make nodes position next to target element
                                    nodes.forEach(function (n) {
                                        if (n._pg_position) {
                                            n._pg_position.update();
                                            props.left = n._pg_position.left;
                                            props.top = n._pg_position.top;
                                        }
                                    })
                                },
                                pgDom: function (p, v) {
                                    v.target = target_element;
                                    props.pgDom = v;
                                },
                                'history.push': function (p, v) {
                                    on_s.push(function () {
                                        nodes.forEach(function (n) {
                                            v = evaluateParam(v, n, target_element);
                                            v && history.pushState({}, '', v);
                                        })
                                    });
                                }
                            }

                            forEachProp(t.l, function (p, v) {
                                //handle variables
                                if (typeof v == 'string' && !map[p] && v.indexOf('${') >= 0) {
                                    var template = v;
                                    v = function (i, node, list) {
                                        return evaluateParam(template, node, target_element);
                                    }
                                }
                                map[p] ? (map[p](p, v)) : (props[p] = isNaN(v) ? v : pf(v));
                            })


                            if (t.e) {
                                props.ease = getEase(t.e);
                            }

                            if (on_u.length) {
                                props.onUpdate = function (tween) {
                                    on_u.forEach(function (f) {
                                        f(tween)
                                    });
                                }
                                props.onUpdateParams = ["{self}"];
                            }

                            if (on_s.length) {
                                props.onStart = function () {
                                    //console.log('onStart!');
                                    on_s.forEach(function (f) {
                                        f()
                                    });
                                }
                            }
                            if (on_c.length) {
                                props.onComplete = function () {
                                    //console.log('onComplete!');
                                    on_c.forEach(function (f) {
                                        f()
                                    });
                                }
                            }

                            if (nodes.length) {
                                if (dur === 0) {
                                    /*
                                     if(needs_immediate) {
                                     on_s.forEach(function(f) {f()});
                                     on_s = [];
                                     }*/
                                    tl.set(nodes, props, pos);
                                } else {
                                    if (t.s) {
                                        tl.staggerTo(nodes, dur, props, t.s, pos);
                                    } else {
                                        tl.add(TweenLite.to(nodes, dur, props), pos);
                                    }
                                }
                            }
                        })
                    })
                }
            });

            return tl;
        }
    }

    var PGAnimationPresets = function() {

        var to;
        var tm;
        var duration = 1.0;

        var list = {
            //Parallax
            pxBckImage: function (el) {
                var tl = tm();

                tl.set(el, {backgroundPositionY: '0%'});
                tl.add(to(el, 1, {ease: 'Linear.easeNone', backgroundPositionY: '100%'}));
                return tl;
            },
            pxBckElement: function (el) {
                var tl = tm();

                tl.set(el, {scale: 1.1, y: '-5%' /*, immediateRender: false */});
                tl.add(to(el, 1, {ease: 'Linear.easeNone', y: '5%'}));
                return tl;
            },
            pxFly: function (el) {
                var tl = tm();

                tl.add(to(el, 1, {ease: 'Linear.easeNone', y: '-100vh'}));
                return tl;
            },
            // Attention Seekers
            bounce: function (el) {
                var tl = tm();

                var firstEase = 'Power3.easeOut'; // CustomEase.create("custom", "M0,0 C0.215,0.61 0.355,1 1,1");
                var secondEase = 'Expo.easeIn';   // CustomEase.create("custom", "M0,0 C0.755,0.05 0.855,0.06 1,1");

                var at20 = duration * 0.2;
                var at10 = duration * 0.1;
                var at03 = duration * 0.03;

                tl.set(el, {y: 0});
                tl.add(to(el, at20, {ease: firstEase, y: 0}));          // 20%
                tl.add(to(el, at20, {y: -30}));                         // 40%
                tl.add(to(el, at03, {y: -30}));                         // 43%
                tl.add(to(el, at10 + at03, {ease: secondEase, y: 0}));  // 53%
                tl.add(to(el, at20 - at03, {y: -15}));                  // 70%
                tl.add(to(el, at10, {y: 0}));                           // 80%
                tl.add(to(el, at10, {y: -4}));                          // 90%
                tl.add(to(el, at10, {y: 0}));         // 100%

                return tl;
            },
            flash: function (el) {
                var tl = tm();

                var at25 = duration * 0.25;

                tl.set(el, {autoAlpha: 1});
                tl.add(to(el, at25, {autoAlpha: 0}));                       // 25%
                tl.add(to(el, at25, {autoAlpha: 1}));                       // 50%
                tl.add(to(el, at25, {autoAlpha: 0}));                       // 75%
                tl.add(to(el, at25, {autoAlpha: 1}));     // 100%

                return tl;
            },
            pulse: function (el) {
                var tl = tm();

                var at50 = duration * 0.50;

                tl.set(el, {scale: 1});
                tl.add(to(el, at50, {scale: 1.05}));                      // 50%
                tl.add(to(el, at50, {scale: 1}));    // 100%

                return tl;
            },
            rubberBand: function (el) {
                var tl = tm();


                var at30 = duration * 0.30;
                var at10 = duration * 0.10;
                var at05 = duration * 0.05;

                tl.set(el, {scale: 1});
                tl.add(to(el, at30, {scaleX: 1.25, scaleY: 0.75, scaleZ: 1}));                   // 30%
                tl.add(to(el, at10, {scaleX: 0.75, scaleY: 1.25, scaleZ: 1}));                   // 40%
                tl.add(to(el, at10, {scaleX: 1.15, scaleY: 0.85, scaleZ: 1}));                   // 50%
                tl.add(to(el, at10 + at05, {scaleX: 0.95, scaleY: 1.05, scaleZ: 1}));                   // 65%
                tl.add(to(el, at10, {scaleX: 1.05, scaleY: 0.95, scaleZ: 1}));                   // 75%
                tl.add(to(el, at30 - at05, {scaleX: 1, scaleY: 1, scaleZ: 1})); // 100%

                return tl;
            },
            shake: function (el) {
                var tl = tm();


                var at10 = duration * 0.10;

                tl.set(el, {x: 0});
                tl.add(to(el, at10, {x: -10}));                     // 10%
                tl.add(to(el, at10, {x: 10}));                     // 20%
                tl.add(to(el, at10, {x: -10}));                     // 30%
                tl.add(to(el, at10, {x: 10}));                     // 40%
                tl.add(to(el, at10, {x: -10}));                     // 50%
                tl.add(to(el, at10, {x: 10}));                     // 60%
                tl.add(to(el, at10, {x: -10}));                     // 70%
                tl.add(to(el, at10, {x: 10}));                     // 80%
                tl.add(to(el, at10, {x: -10}));                     // 90%
                tl.add(to(el, at10, {x: 0}));   // 100%

                return tl;
            },
            headShake: function (el) {
                var tl = tm();


                var at10 = duration * 0.10;
                var at05 = duration * 0.05;
                var at01 = duration * 0.01;
                var at005 = duration * 0.005;

                tl.set(el, {x: 0, rotateY: 0});
                tl.add(to(el, at05 + at01 + at005, {x: -6, rotateY: -9}));                      // 6.5%
                tl.add(to(el, at10 + (2 * at01), {x: 5, rotateY: 7}));                      // 18.5%
                tl.add(to(el, at10 + (3 * at01), {x: -3, rotateY: -5}));                      // 31.5%
                tl.add(to(el, at10 + (2 * at01), {x: 2, rotateY: 3}));                      // 43.5%
                tl.add(to(el, at05 + at01 + at005, {x: 0, rotateY: 0}));                      // 50%
                tl.add(to(el, at05 + at01 + at005, {x: 0, rotateY: 0}));   // 100%

                return tl;
            },
            swing: function (el) {
                var tl = tm();


                var at20 = duration * 0.20;

                tl.set(el, {rotation: 0});
                tl.add(to(el, at20, {rotation: 15}));                      // 20%
                tl.add(to(el, at20, {rotation: -10}));                      // 40%
                tl.add(to(el, at20, {rotation: 5}));                      // 60%
                tl.add(to(el, at20, {rotation: -5}));                      // 80%
                tl.add(to(el, at20, {rotation: 0}));    // 100%

                return tl;
            },
            tada: function (el) {
                var tl = tm();


                var at10 = duration * 0.10;

                tl.set(el, {scale: 1, rotation: 0});
                tl.add(to(el, at10, {scale: 0.9, rotation: -3}));                     // 10%
                tl.add(to(el, at10, {scale: 0.9, rotation: -3}));                     // 20%
                tl.add(to(el, at10, {scale: 1.1, rotation: 3}));                     // 30%
                tl.add(to(el, at10, {scale: 1.1, rotation: -3}));                     // 40%
                tl.add(to(el, at10, {scale: 1.1, rotation: 3}));                     // 50%
                tl.add(to(el, at10, {scale: 1.1, rotation: -3}));                     // 60%
                tl.add(to(el, at10, {scale: 1.1, rotation: 3}));                     // 70%
                tl.add(to(el, at10, {scale: 1.1, rotation: -3}));                     // 80%
                tl.add(to(el, at10, {scale: 1.1, rotation: 3}));                     // 90%
                tl.add(to(el, at10, {scale: 1, rotation: 0}));   // 100%

                return tl;
            },
            wobble: function (el) {
                var tl = tm();


                var at15 = duration * 0.15;
                var at25 = duration * 0.25;

                tl.set(el, {x: 0, rotation: 0});
                tl.add(to(el, at15, {x: "-25%", rotation: -5}));                       // 15%
                tl.add(to(el, at15, {x: "20%", rotation: 3}));                       // 30%
                tl.add(to(el, at15, {x: "-15%", rotation: -3}));                       // 45%
                tl.add(to(el, at15, {x: "10%", rotation: 2}));                       // 60%
                tl.add(to(el, at15, {x: "-5%", rotation: -1}));                       // 75%
                tl.add(to(el, at25, {x: "0%", rotation: 0}));    // 100%

                return tl;
            },
            jello: function (el) {
                var tl = tm();


                var at111 = duration * 0.111;
                var at112 = duration * 0.112;

                tl.set(el, {skewX: 0, skewY: 0});
                tl.add(to(el, at111, {skewX: 0, skewY: 0}));                      // 11.10%
                tl.add(to(el, at111, {skewX: -12.5, skewY: -12.5}));                      // 22.20%
                tl.add(to(el, at111, {skewX: 6.25, skewY: 6.25}));                      // 33.30%
                tl.add(to(el, at111, {skewX: -3.125, skewY: -3.125}));                      // 44.40%
                tl.add(to(el, at111, {skewX: 1.5625, skewY: 1.5625}));                      // 55.50%
                tl.add(to(el, at111, {skewX: -0.78125, skewY: -0.78125}));                      // 66.60%
                tl.add(to(el, at111, {skewX: 0.390625, skewY: 0.390625}));                      // 77.70%
                tl.add(to(el, at111, {skewX: -0.1953125, skewY: -0.1953125}));                      // 88.80%
                tl.add(to(el, at112, {skewX: 0, skewY: 0}));    // 100%

                return tl;
            },
            heartBeat: function (el) {
                var tl = tm();

                var customEase = 'Power0.easeInOut';
                var at14 = duration * 0.14;

                tl.set(el, {scale: 1});
                tl.add(to(el, at14, {ease: customEase, scale: 1.3}));                    // 14%
                tl.add(to(el, at14, {ease: customEase, scale: 1}));                    // 28%
                tl.add(to(el, at14, {ease: customEase, scale: 1.3}));                    // 42%
                tl.add(to(el, at14 + at14, {ease: customEase, scale: 1}));  // 70%

                return tl;
            },
            // Bouncing Entrances
            bounceIn: function (el) {
                var tl = tm();


                var at100 = duration * 1;
                var at20 = duration * 0.2;

                tl.set(el, {autoAlpha: 0, scale: 0.3});
                tl.add(to(el, at20, {scale: 1.10}));  // 20%
                tl.add(to(el, at20, {scale: 0.90}));  // 40%
                tl.add(to(el, at20, {scale: 1.03}));  // 60%
                tl.add(to(el, at20, {scale: 0.97}));  // 80%
                tl.add(to(el, at20, {scale: 1.00}));  // 100%

                tl.add(to(el, at100, {autoAlpha: 1}), '-=' + duration); // 0% - 100%

                return tl;
            },
            bounceInDown: function (el) {
                var tl = tm();

                customEase = 'Power3.easeOut'; // CustomEase.create("custom", "M0,0 C0.215,0.61 0.355,1 1,1");
                var at60 = duration * 0.60;
                var at15 = duration * 0.15;
                var at10 = duration * 0.10;

                tl.set(el, {autoAlpha: 0, y: -3000});
                tl.add(to(el, at60, {ease: customEase, y: 25, autoAlpha: 1}));         // 60%
                tl.add(to(el, at15, {ease: customEase, y: -10}));                     // 75%
                tl.add(to(el, at15, {ease: customEase, y: 5}));                     // 90%
                tl.add(to(el, at10, {ease: customEase, y: 0}));   // 100%

                return tl;
            },
            bounceInLeft: function (el) {
                var tl = tm();

                customEase = 'Power3.easeOut'; // CustomEase.create("custom", "M0,0 C0.215,0.61 0.355,1 1,1");
                var at60 = duration * 0.60;
                var at15 = duration * 0.15;
                var at10 = duration * 0.10;

                tl.set(el, {autoAlpha: 0, x: -3000});
                tl.add(to(el, at60, {ease: customEase, x: 25, autoAlpha: 1}));         // 60%
                tl.add(to(el, at15, {ease: customEase, x: -10}));                     // 75%
                tl.add(to(el, at15, {ease: customEase, x: 5}));                     // 90%
                tl.add(to(el, at10, {ease: customEase, x: 0}));   // 100%

                return tl;
            },
            bounceInRight: function (el) {
                var tl = tm();

                var customEase = 'Power3.easeOut'; // CustomEase.create("custom", "M0,0 C0.215,0.61 0.355,1 1,1");
                var at60 = duration * 0.60;
                var at15 = duration * 0.15;
                var at10 = duration * 0.10;

                tl.set(el, {autoAlpha: 0, x: 3000});
                tl.add(to(el, at60, {ease: customEase, x: -25, autoAlpha: 1}));        // 60%
                tl.add(to(el, at15, {ease: customEase, x: 10}));                    // 75%
                tl.add(to(el, at15, {ease: customEase, x: -5}));                    // 90%
                tl.add(to(el, at10, {ease: customEase, x: 0}));  // 100%

                return tl;
            },
            bounceInUp: function (el) {
                var tl = tm();

                var customEase = 'Power3.easeOut'; // CustomEase.create("custom", "M0,0 C0.215,0.61 0.355,1 1,1");
                var at60 = duration * 0.60;
                var at15 = duration * 0.15;
                var at10 = duration * 0.10;

                tl.set(el, {autoAlpha: 0, y: 3000});
                tl.add(to(el, at60, {ease: customEase, y: -20, autoAlpha: 1}));        // 60%
                tl.add(to(el, at15, {ease: customEase, y: 10}));                    // 75%
                tl.add(to(el, at15, {ease: customEase, y: -5}));                    // 90%
                tl.add(to(el, at10, {ease: customEase, y: 0}));  // 100%

                return tl;
            },
            // Bouncing Exits
            bounceOut: function (el) {
                var tl = tm();


                var at20 = duration * 0.2;
                var at30 = duration * 0.3;
                var at05 = duration * 0.05;
                var at45 = duration * 0.45;

                tl.set(el, {autoAlpha: 1, scale: 1});
                tl.add(to(el, at20, {scale: 0.9}));                                 // 20%
                tl.add(to(el, at30, {scale: 1.1, autoAlpha: 1}));                     // 50%
                tl.add(to(el, at05, {scale: 1.1, autoAlpha: 1}));                     // 55%
                tl.add(to(el, at45, {scale: 0.3, autoAlpha: 0}));   // 100%

                return tl;
            },
            bounceOutDown: function (el) {
                var tl = tm();


                var at20 = duration * 0.20;
                var at05 = duration * 0.05;
                var at55 = duration * 0.55;

                tl.set(el, {autoAlpha: 1, y: 0});
                tl.add(to(el, at20, {y: 10}));                     // 20%
                tl.add(to(el, at20, {y: -20}));                     // 40%
                tl.add(to(el, at05, {y: -20}));                     // 45%
                tl.add(to(el, at55, {y: 2000}));   // 100%

                return tl;
            },
            bounceOutLeft: function (el) {
                var tl = tm();


                var at20 = duration * 0.20;
                var at80 = duration * 0.80;

                tl.set(el, {autoAlpha: 1, x: 0});
                tl.add(to(el, at20, {autoAlpha: 1, x: 20}));                      // 20%
                tl.add(to(el, at80, {autoAlpha: 0, x: -2000}));    // 80%

                return tl;
            },
            bounceOutRight: function (el) {
                var tl = tm();


                var at20 = duration * 0.20;
                var at80 = duration * 0.80;

                tl.set(el, {autoAlpha: 1, x: 0});
                tl.add(to(el, at20, {autoAlpha: 1, x: -20}));                      // 20%
                tl.add(to(el, at80, {autoAlpha: 0, x: 2000}));    // 80%

                return tl;
            },
            bounceOutUp: function (el) {
                var tl = tm();


                var at20 = duration * 0.20;
                var at05 = duration * 0.05;
                var at55 = duration * 0.55;

                tl.set(el, {autoAlpha: 1, y: 0});
                tl.add(to(el, at20, {autoAlpha: 1, y: -10}));                     // 20%
                tl.add(to(el, at20, {autoAlpha: 1, y: 20}));                     // 40%
                tl.add(to(el, at05, {autoAlpha: 1, y: 20}));                     // 45%
                tl.add(to(el, at55, {autoAlpha: 0, y: -2000}));   // 100%

                return tl;
            },
            // Fading Entrances
            fadeIn: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0});
                tl.add(to(el, at100, {autoAlpha: 1})); // 100%

                return tl;
            },
            fadeInDown: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, y: "-100%"});
                tl.add(to(el, at100, {autoAlpha: 1, y: "0%"})); // 100%

                return tl;
            },
            fadeInDownBig: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, y: -2000});
                tl.add(to(el, at100, {autoAlpha: 1, y: 0})); // 100%

                return tl;
            },
            fadeInLeft: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, x: "-100%"});
                tl.add(to(el, at100, {autoAlpha: 1, x: "0%"})); // 100%

                return tl;
            },
            fadeInLeftBig: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, x: -2000});
                tl.add(to(el, at100, {autoAlpha: 1, x: 0})); // 100%

                return tl;
            },
            fadeInRight: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, x: "100%"});
                tl.add(to(el, at100, {autoAlpha: 1, x: "0%"})); // 100%

                return tl;
            },
            fadeInRightBig: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, x: 2000});
                tl.add(to(el, at100, {autoAlpha: 1, x: 0})); // 100%

                return tl;
            },
            fadeInUp: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, y: "100%"});
                tl.add(to(el, at100, {autoAlpha: 1, y: "0%"})); // 100%

                return tl;
            },
            fadeInUpBig: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, y: 2000});
                tl.add(to(el, at100, {autoAlpha: 1, y: 0})); // 100%

                return tl;
            },
            // Fading Exits
            fadeOut: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1});
                tl.add(to(el, at100, {autoAlpha: 0})); // 100%

                return tl;
            },
            fadeOutDown: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, y: 0});
                tl.add(to(el, at100, {autoAlpha: 0, y: "100%"})); // 100%

                return tl;
            },
            fadeOutDownBig: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, y: 0});
                tl.add(to(el, at100, {autoAlpha: 0, y: 2000})); // 100%

                return tl;
            },
            fadeOutLeft: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, x: 0});
                tl.add(to(el, at100, {autoAlpha: 0, x: "-100%"})); // 100%

                return tl;
            },
            fadeOutLeftBig: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, x: 0});
                tl.add(to(el, at100, {autoAlpha: 0, x: -2000}));  // 100%

                return tl;
            },
            fadeOutRight: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1});
                tl.add(to(el, at100, {autoAlpha: 0, x: '100%'})); // 100%

                return tl;
            },
            fadeOutRightBig: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, x: 0});
                tl.add(to(el, at100, {autoAlpha: 0, x: 2000})); // 100%

                return tl;
            },
            fadeOutUp: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, y: 0});
                tl.add(to(el, at100, {autoAlpha: 0, y: "-100%"}));  // 100%

                return tl;
            },
            fadeOutUpBig: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, y: 0});
                tl.add(to(el, at100, {autoAlpha: 0, y: -2000}));  // 100%

                return tl;
            },
            // Flippers
            flip: function (el) {
                var tl = tm();

                var customEase = 'Power0.easeIn';

                var at40 = duration * 0.40;
                var at10 = duration * 0.10;
                var at30 = duration * 0.30;
                var at20 = duration * 0.20;

                tl.set(el, {transformPerspective: 400, scale: 1, z: 0, rotationY: -360});
                tl.add(to(el, at40,
                    {ease: customEase, transformPerspective: 400, scale: 1, z: 150, rotationY: -190}));                // 40%
                tl.add(to(el, at10,
                    {ease: customEase, transformPerspective: 400, scale: 1, z: 150, rotationY: -170}));                // 50%
                tl.add(to(el, at30,
                    {ease: customEase, transformPerspective: 400, scale: 0.95, z: 150, rotationY: 0}));                // 80%
                tl.add(to(el, at20,
                    {ease: customEase, transformPerspective: 400, scale: 1, z: 0, rotationY: 0}));   // 100%

                return tl;
            },
            flipInX: function (el) {
                var tl = tm();

                var customEase = 'Power0.easeIn';
                var at40 = duration * 0.40;
                var at20 = duration * 0.20;

                tl.set(el, {autoAlpha: 0, transformPerspective: 400, rotationX: 90});
                tl.add(to(el, at40, {ease: customEase, transformPerspective: 400, rotationX: -20}));    // 40%
                tl.add(to(el, at20, {transformPerspective: 400, rotationX: 10}));                      // 60%

                tl.add(to(el, at40 + at20, {autoAlpha: 1}), "-=" + (at40 + at20));                        // 0% - 60%

                tl.add(to(el, at20, {transformPerspective: 400, rotationX: -5}));                      // 80%
                tl.add(to(el, at20, {transformPerspective: 400, rotationX: 0}));    // 100%

                return tl;
            },
            flipInY: function (el) {
                var tl = tm();

                var customEase = 'Linear.easeIn';
                var at40 = duration * 0.40;
                var at20 = duration * 0.20;

                tl.set(el, {autoAlpha: 0, transformPerspective: 400, rotationY: 90});
                tl.add(to(el, at40, {ease: customEase, transformPerspective: 400, rotationY: -20}));    // 40%
                tl.add(to(el, at20, {transformPerspective: 400, rotationY: 10}));                      // 60%

                tl.add(to(el, at40 + at20, {autoAlpha: 1}), "-=" + (at40 + at20));                        // 0% - 60%

                tl.add(to(el, at20, {transformPerspective: 400, rotationY: -5}));                      // 80%
                tl.add(to(el, at20, {transformPerspective: 400, rotationY: 0}));    // 100%

                return tl;
            },
            flipOutX: function (el) {
                var tl = tm();


                var at30 = duration * 0.30;
                var at70 = duration * 0.70;

                tl.set(el, {autoAlpha: 1, transformPerspective: 400, rotationX: 0});
                tl.add(to(el, at30,
                    {autoAlpha: 1, transformPerspective: 400, rotationX: -20}));                    // 30%
                tl.add(to(el, at70,
                    {autoAlpha: 0, transformPerspective: 400, rotationX: 90}));  // 100%

                return tl;
            },
            flipOutY: function (el) {
                var tl = tm();


                var at30 = duration * 0.30;
                var at70 = duration * 0.70;

                tl.set(el, {autoAlpha: 1, transformPerspective: 400, rotationY: 0});
                tl.add(to(el, at30,
                    {autoAlpha: 1, transformPerspective: 400, rotationY: -20}));                   // 30%
                tl.add(to(el, at70,
                    {autoAlpha: 0, transformPerspective: 400, rotationY: 90})); // 100%

                return tl;
            },
            // Lightspeed
            lightSpeedIn: function (el) {
                var tl = tm();


                var at100 = duration * 1;
                var at60 = duration * 0.60;
                var at20 = duration * 0.20;

                tl.set(el, {autoAlpha: 0, x: '100%', skewX: -30});
                tl.add(to(el, at60, {autoAlpha: 1, skewX: 20}));      // 60%
                tl.add(to(el, at20, {skewX: -5}));                  // 80%
                tl.add(to(el, at20, {skewX: 0}));                  // 100%

                tl.add(to(el, at100, {x: "0%"}), "-=" + at100); // 0% - 100%

                return tl;
            },
            lightSpeedOut: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, x: 0, skewX: 0});
                tl.add(to(el, at100, {autoAlpha: 0, x: "100%", skewX: 30})); // 100%

                return tl;
            },
            // Rotating Entrances
            rotateIn: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, transformOrigin: "center", rotationZ: 200});
                tl.add(to(el, at100,
                    {autoAlpha: 1, transformOrigin: "center", rotationZ: 0})); // 100%

                return tl;
            },
            rotateInDownLeft: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, transformOrigin: "left bottom", rotationZ: -45});
                tl.add(to(el, at100,
                    {autoAlpha: 1, transformOrigin: "left bottom", rotationZ: 0})); // 100%

                return tl;
            },
            rotateInDownRight: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, transformOrigin: "right bottom", rotationZ: 45});
                tl.add(to(el, at100,
                    {autoAlpha: 1, transformOrigin: "right bottom", rotationZ: 0})); // 100%

                return tl;
            },
            rotateInUpLeft: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, transformOrigin: "left bottom", rotationZ: 45});
                tl.add(to(el, at100,
                    {autoAlpha: 1, transformOrigin: "left bottom", rotationZ: 0})); // 100%

                return tl;
            },
            rotateInUpRight: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, transformOrigin: "right bottom", rotationZ: -90});
                tl.add(to(el, at100,
                    {autoAlpha: 1, transformOrigin: "right bottom", rotationZ: 0})); // 100%

                return tl;
            },
            // Rotating Exits
            rotateOut: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, transformOrigin: "center", rotationZ: 0});
                tl.add(to(el, at100,
                    {autoAlpha: 0, transformOrigin: "center", rotationZ: 200})); // 100%

                return tl;
            },
            rotateOutDownLeft: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, transformOrigin: "left bottom", rotationZ: 0});
                tl.add(to(el, at100,
                    {autoAlpha: 0, transformOrigin: "left bottom", rotationZ: 45})); // 100%

                return tl;
            },
            rotateOutDownRight: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, transformOrigin: "right bottom", rotationZ: 0});
                tl.add(to(el, at100,
                    {autoAlpha: 0, transformOrigin: "right bottom", rotationZ: -45})); // 100%

                return tl;
            },
            rotateOutUpLeft: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, transformOrigin: "left bottom", rotationZ: 0});
                tl.add(to(el, at100,
                    {autoAlpha: 0, transformOrigin: "left bottom", rotationZ: -45})); // 100%

                return tl;
            },
            rotateOutUpRight: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, transformOrigin: "right bottom", rotationZ: 0});
                tl.add(to(el, at100,
                    {autoAlpha: 0, transformOrigin: "right bottom", rotationZ: 90}));   // 100%

                return tl;
            },
            // Sliding Entrances
            slideInUp: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {y: '100%', visibility: "visible"});
                tl.add(to(el, at100, {y: '0%'})); // 100%

                return tl;
            },
            slideInDown: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {y: '-100%', visibility: "visible"});
                tl.add(to(el, at100, {y: "0%"})); // 100%

                return tl;
            },
            slideInLeft: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {x: '-100%', visibility: "visible"});
                tl.add(to(el, at100, {x: "0%"}));   // 100%

                return tl;
            },
            slideInRight: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {x: '100%', visibility: "visible"});
                tl.add(to(el, at100, {x: "0%"}));   // 100%

                return tl;
            },
            // Sliding Exits
            slideOutUp: function (el) {
                var tl = tm();


                var at100 = duration * 1;
                var at001 = duration * 0.001;

                tl.set(el, {y: '0%'});
                tl.add(to(el, at100, {y: '-100%'}));    // 100%
                tl.add(to(el, at001, {visibility: "hidden"}));            // hide element

                return tl;
            },
            slideOutDown: function (el) {
                var tl = tm();


                var at100 = duration * 1;
                var at001 = duration * 0.001;

                tl.set(el, {y: '0%'});
                tl.add(to(el, at100, {y: "100%"}));   // 100%
                tl.add(to(el, at001, {visibility: "hidden"}));          // hide element

                return tl;
            },
            slideOutLeft: function (el) {
                var tl = tm();


                var at100 = duration * 1;
                var at001 = duration * 0.001;

                tl.set(el, {x: '0%'});
                tl.add(to(el, at100, {x: "-100%"}));    // 100%
                tl.add(to(el, at001, {visibility: "hidden"}));            // hide element

                return tl;
            },
            slideOutRight: function (el) {
                var tl = tm();


                var at100 = duration * 1;
                var at001 = duration * 0.001;

                tl.set(el, {x: '0%'});
                tl.add(to(el, at100, {x: "100%"}));   // 100%
                tl.add(to(el, at001, {visibility: "hidden"}));          // hide element

                return tl;
            },
            // Zoom Entrances
            zoomIn: function (el) {
                var tl = tm();


                var at100 = duration * 1;
                var at50 = duration * 0.5;

                tl.set(el, {autoAlpha: 0, scale: 0.3});
                tl.add(to(el, at100, {scale: 1}));    // 0% - 100%

                tl.add(to(el, at50, {autoAlpha: 1}), '-=' + duration);    // 50% - 100%

                return tl;
            },
            zoomInDown: function (el) {
                var tl = tm();

                var firstEase = 'Power2.easeIn'; // CustomEase.create("custom", "M0,0 C0.55,0.055 0.675,0.19 1,1");
                var secondEase = 'Power4.easeOut'; // CustomEase.create("custom", "M0,0 C0.175,0.885 0.32,1 1,1");
                var at60 = duration * 0.6;
                var at40 = duration * 0.4;

                tl.set(el, {autoAlpha: 0, scale: 0.1, y: -150});
                tl.add(to(el, at60, {ease: firstEase, autoAlpha: 1, scale: 0.475, y: 60}));     // 60%
                tl.add(to(el, at40, {ease: secondEase, scale: 1, y: 0}));   // 100%

                return tl;
            },
            zoomInLeft: function (el) {
                var tl = tm();

                var firstEase = 'Power2.easeIn'; // CustomEase.create("custom", "M0,0 C0.55,0.055 0.675,0.19 1,1");
                var secondEase = 'Power4.easeOut'; // CustomEase.create("custom", "M0,0 C0.175,0.885 0.32,1 1,1");

                var at60 = duration * 0.6;
                var at40 = duration * 0.4;

                tl.set(el, {autoAlpha: 0, scale: 0.1, x: -300});
                tl.add(to(el, at60, {ease: firstEase, autoAlpha: 1, scale: 0.475, x: 10}));     // 60%
                tl.add(to(el, at40, {ease: secondEase, scale: 1, x: 0}));   // 100%

                return tl;
            },
            zoomInRight: function (el) {
                var tl = tm();

                var firstEase = 'Power2.easeIn'; // CustomEase.create("custom", "M0,0 C0.55,0.055 0.675,0.19 1,1");
                var secondEase = 'Power4.easeOut'; // CustomEase.create("custom", "M0,0 C0.175,0.885 0.32,1 1,1");
                var at60 = duration * 0.6;
                var at40 = duration * 0.4;

                tl.set(el, {autoAlpha: 0, scale: 0.1, x: 100});
                tl.add(to(el, at60, {ease: firstEase, autoAlpha: 1, scale: 0.475, x: -10}));    // 60%
                tl.add(to(el, at40, {ease: secondEase, scale: 1, x: 0}));   // 100%

                return tl;
            },
            zoomInUp: function (el) {
                var tl = tm();

                var firstEase = 'Power2.easeIn'; // CustomEase.create("custom", "M0,0 C0.55,0.055 0.675,0.19 1,1");
                var secondEase = 'Power4.easeOut'; // CustomEase.create("custom", "M0,0 C0.175,0.885 0.32,1 1,1");
                var at60 = duration * 0.6;
                var at40 = duration * 0.4;

                tl.set(el, {autoAlpha: 0, scale: 0.1, y: 150});
                tl.add(to(el, at60, {ease: firstEase, autoAlpha: 1, scale: 0.475, y: -60}));    // 60%
                tl.add(to(el, at40, {ease: secondEase, scale: 1, y: 0}));   // 100%

                return tl;
            },
            // Zoom Exits
            zoomOut: function (el) {
                var tl = tm();


                var at100 = duration * 1;
                var at50 = duration * 0.5;

                tl.set(el, {autoAlpha: 1, scale: 1});
                tl.add(to(el, at50, {autoAlpha: 0, scale: 0.3}));                      // 50%
                tl.add(to(el, at100, {autoAlpha: 0, scale: 1}));    // 100%

                return tl;
            },
            zoomOutDown: function (el) {
                var tl = tm();

                var firstEase = 'Power2.easeIn'; // CustomEase.create("custom", "M0,0 C0.55,0.055 0.675,0.19 1,1");
                var secondEase = 'Power4.easeOut'; // CustomEase.create("custom", "M0,0 C1,0.35 0,0.58 1,1");

                var at40 = duration * 0.4;
                var at60 = duration * 0.6;

                tl.set(el, {autoAlpha: 1, scale: 1, y: '0px'});
                tl.add(to(el, at40,
                    {ease: firstEase, autoAlpha: 1, scale: 0.475, y: -28}));                                                     // 40%
                tl.add(to(el, at60,
                    {
                        ease: secondEase,
                        autoAlpha: 0,
                        scale: 0.1,
                        y: 500,
                        transformOrigin: "center bottom"
                    }));  // 100%

                return tl;
            },
            zoomOutLeft: function (el) {
                var tl = tm();


                var at40 = duration * 0.4;
                var at60 = duration * 0.6;

                tl.set(el, {autoAlpha: 1, scale: 1, x: 0});
                tl.add(to(el, at40, {autoAlpha: 1, scale: 0.475, x: 42}));                          // 40%
                tl.add(to(el, at60,
                    {autoAlpha: 0, scale: 0.1, x: -300, transformOrigin: "left center"}));    // 100%

                return tl;
            },
            zoomOutRight: function (el) {
                var tl = tm();


                var at40 = duration * 0.4;
                var at60 = duration * 0.6;

                tl.set(el, {autoAlpha: 1, scale: 1, x: 0});
                tl.add(to(el, at40, {autoAlpha: 1, scale: 0.475, x: -42}));                         // 40%
                tl.add(to(el, at60,
                    {autoAlpha: 0, scale: 0.1, x: 250, transformOrigin: "right center"}));    // 100%

                return tl;
            },
            zoomOutUp: function (el) {
                var tl = tm();

                var firstEase = 'Power2.easeIn'; // CustomEase.create("custom", "M0,0 C0.55,0.055 0.675,0.19 1,1");
                var secondEase = 'Power4.easeOut'; // CustomEase.create("custom", "M0,0 C1,0.35 0,0.58 1,1");

                var at40 = duration * 0.4;
                var at60 = duration * 0.6;

                tl.set(el, {autoAlpha: 1, scale: 1, y: 0});
                tl.add(to(el, at40,
                    {ease: firstEase, autoAlpha: 1, scale: 0.475, y: 28}));                                                        // 40%
                tl.add(to(el, at60,
                    {
                        ease: secondEase,
                        autoAlpha: 0,
                        scale: 0.1,
                        y: -500,
                        transformOrigin: "center bottom"
                    }));   // 100%

                return tl;
            },
            // Specials
            hinge: function (el) {
                var tl = tm();


                var at20 = duration * 0.2;

                tl.set(el, {transformOrigin: "top left"});
                tl.add(to(el, at20,
                    {rotation: 80, transformOrigin: "top left", ease: 'Linear.easeInOut'}));             // 20%
                tl.add(to(el, at20,
                    {rotation: 60, transformOrigin: "top left", ease: 'Linear.easeInOut'}));             // 40%
                tl.add(to(el, at20,
                    {rotation: 80, transformOrigin: "top left", ease: 'Linear.easeInOut'}));             // 60%
                tl.add(to(el, at20,
                    {autoAlpha: 1, rotation: 60, transformOrigin: "top left", ease: 'Linear.easeInOut'})); // 80%
                tl.add(to(el, at20,
                    {autoAlpha: 0, rotation: 0, y: '700px'}));                         // 100%

                return tl;
            },
            jackInTheBox: function (el) {
                var tl = tm();


                var at100 = duration * 1;
                var at30 = duration * 0.3;
                var at20 = duration * 0.2;
                var at50 = duration * 0.5;

                tl.set(el, {autoAlpha: 0, scale: 0.1, rotation: 30});
                tl.add(to(el, at50, {rotation: -10}));                                            // 50%
                tl.add(to(el, at20, {rotation: 3}));                                            // 70%
                tl.add(to(el, at30, {rotation: 0}));                                            // 100%

                tl.add(to(el, at100, {autoAlpha: 1, scale: 1}), "-=" + at100);    // 0% - 100%

                return tl;
            },
            rollIn: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 0, x: "-100%", rotation: -120});
                tl.add(to(el, at100, {autoAlpha: 1, x: "0%", rotation: 0})); // 100%

                return tl;
            },
            rollOut: function (el) {
                var tl = tm();


                var at100 = duration * 1;

                tl.set(el, {autoAlpha: 1, x: "0%", rotationZ: 0});
                tl.add(to(el, at100, {autoAlpha: 0, x: "100%", rotation: 120})); // 100%

                return tl;
            }
        }
        

        this.getTimeline = function(key, el) {
            if(!to) {
                to = TweenLite.to;
                tm = function() {
                    return gsap.timeline({paused: true});
                }

            }
            return list[key] ? list[key](el) : null;
        }
    }

    pgia.animationPresets = new PGAnimationPresets();

    var gtl = pgia.getAnimationTimeline = function(name, el) {
        if (typeof name === 'string') {

            return pgia.animationPresets.getTimeline(name, el) || gsap.timeline({});
        } else {
            var ca = new PgCustomAnimation();
            return ca.getTimeline(name || {}, el);
        }
    }

    var PGElementAnimation = function (el, i, a, parent) {

        var _this = this;

        this.data = a;
        this.index = i;
        this.parent = parent;
        this.event = a.trg;
        this.touchEvent = null;
        this.element = el;
        this.targets = [];
        this.timeline = null;
        this.delayTimer = null;
        this.mouseMoveMeasure = a.mm_a || 'x';
        this.restAt = 0.5;
        this.restart = a.rstr === 'true';
        this.pauseOther = a.po === 'true';
        this.reset = a.rst === 'true';
        this.reverse = a.rev === 'true';
        this.toggRev = a.trev === 'true';
        this.disabled = isDisabled(a);
        this.interval = null;

        this.name = a.name || null;

        this.trigC = 0;

        this._etce = null;

        this._playBind = this.play.bind(this);
        this._playScrollBind = this.playScroll.bind(this);
        this._playMouseMoveBind = this.playMouseMove.bind(this);
        this._restBind = this.rest.bind(this);

        var done = false;

        if (this.disabled) return;

        switch (this.event) {
            case 'now':
                //prevent running "now" animations on cloned elements
                //!el.classList.has('pgia-clone') &&
                this.play();
                done = true;
                break;

            case 'no':
                //no event
                done = true;
                break;

            case 'DOMContentLoaded':
            case 'load':
                window.addEventListener(this.event, this._playBind, false);
                done = true;
                break;

            case 'timer':
                this.interval = setInterval(this._playBind, getTime(null, a.timer || 1) * 1000);
                done = true;
                break;

            case 'mousemove':
                if (this.mouseMoveMeasure === 'run') {
                    this.touchEvent = 'touchmove';
                } else {
                    el.addEventListener(this.event, this._playMouseMoveBind, false);
                    el.addEventListener('touchmove', this._playMouseMoveBind, false);

                    if (this.data.mm_r) {
                        el.addEventListener('mouseleave', this._restBind, false);
                        el.addEventListener('touchend', this._restBind, false);

                        this.restAt = parseFloat(this.data.mm_r) + '%';
                        this.seek(this.restAt);
                    }
                    done = true;
                }
                break;

            case 'mouseenter':
            case 'mousedown':
                this.touchEvent = 'touchstart';
                break;

            case 'mouseleave':
            case 'mouseup':
                this.touchEvent = 'touchend';
                break;
/*
NOT USED
            case 'scroll-in':
            case 'scroll-out':
                //When scrolled into view
                var scroll_in = a.trg === 'scroll-in';

                this.scrollScene = new ScrollMagic.Scene({
                    triggerElement: this.element,
                    triggerHook: 'onEnter',
                    duration: getScrollDuration(a.sc_du || '100%'),
                    offset: getScrollDuration(a.sc_o || 0)
                })
                    .addTo(getScrollControler());

                if (in_pg && a.dbg) {
                    this.scrollScene.addIndicators({name: a.dbg})
                }

                var dir = a.sc_d || 'up_down';

                if (scroll_in) {
                    if (dir.indexOf('down') >= 0) {
                        this.scrollScene.on("start", function (event) {
                            //console.log(event)

                            if (event.scrollDirection === 'FORWARD') {
                                _this.play();
                            }
                        });
                    }

                    if (dir.indexOf('up') >= 0) {
                        this.scrollScene.on("end", function (event) {
                            //console.log(event)

                            if (event.scrollDirection === 'REVERSE') {
                                _this.play();
                            }
                        });
                    }
                } else {
                    this.scrollScene.on("leave", function (event) {
                        //console.log(event)

                        if ((dir.indexOf('down') >= 0 && event.scrollDirection === 'FORWARD') || (dir.indexOf('up') >= 0 && event.scrollDirection === 'REVERSE')) {
                            _this.play();
                        }
                    });
                }

                done = true;
                break;
                */

            case 'scrolling':
                window.addEventListener('scroll', this._playScrollBind, false);
                done = true;
                break;
        }

        if (!done) {
            el.addEventListener(this.event, this._playBind, false);
            this.touchEvent ? el.addEventListener(this.touchEvent, this._playBind, false) : null;
        }


    }

    PGElementAnimation.prototype._etc = function() {
        var e = this._etce;
        if(this.data.tc && e) {
            var v = this.data.tcv || null;

            switch (this.data.tc) {
                case 'class':
                    return e.classList.contains(v);
                case 'no-class':
                    return !e.classList.contains(v);
            }
        }
        return true;
    }

    PGElementAnimation.prototype.create = function () {
        var _this = this;

        this.timeline = null;

        var d = this.data;

        this.targets = d.t ? getTargets(this.element, d.t) : [this.element];

        if(!this.targets.length) {
            this.disabled = true;
        } else {
            var ts = this.targets;
            this._etce = ts[0];

            //var tl = typeof d.a === 'object' ? gtl(d.a, ts) : (d.a.match(/^[0-9]+$/) ? gtl(this.parent.getData(parseInt(d.a)-1, this).a, ts) : gtl(d.a, ts));

            var tl = gtl(d.a, ts);
            tl.pause();

            var repeat = parseInt(d.rpt || 1);

            if (repeat !== 1) {
                tl.repeat(repeat > 1 ? repeat - 1 : repeat)
            }

            if (this.data.d) {
                tl.duration(getTime(tl, d.d));
            }

            this.timeline = tl;

            if (in_pg) {
                tl._pg_animation_id = pgAnimationInfo.getAnimationId(this.element /* targets */, 'animation_' + this.index);

                tl.eventCallback("onUpdate", function () {
                    pgAnimationInfo.updateProgress(this._pg_animation_id, this.time());
                })
            }

            if (this.reset) {
                tl.eventCallback("onComplete", function () {
                    _this.seek(_this.reverse ? '100%' : 0, false, false /* dont surpress events */);
                })
            }
            return tl;
        }
    }

    PGElementAnimation.prototype.getTimeline = function () {
        return this.timeline || this.create();
    }

    PGElementAnimation.prototype.play = function (e, reverse) {
        var _this = this;

        if (this.disabled) return;

        if(_this.data.rcr && _this.timeline) {
            _this.timeline.kill();
            _this.timeline = null;
        }

        var tl = this.getTimeline();

        if(!this._etc()) return;

        _this.data.pdef && e && e.preventDefault();

        var rev = this.reverse || reverse;

        if(_this.toggRev) {
            (_this.trigC++ % 2 === 1) && (rev = !rev);
            //rev = (_this.trigC++ % 2 === (rev ? 1 : 0));
            tl.timeScale(rev ? getParam(_this.data, 'spdrev', 100)/100.0 : 1);
        }

        var zero = rev ? tl.duration() : 0;

        //invalidate on restart as well
        tl._pg_req_inv && !this.restart && tl.invalidate();

        var start = (this.restart && tl.invalidate()) ? 0 : ((rev ? (tl.progress() > 0) : (tl.progress() < 1.0)) ? null : 0);

        this.delayTimer ? clearTimeout(this.delayTimer) : null;

        if (this.pauseOther) {
            var po = getParam(_this.data, 'pol', '');
            this.parent.pauseOther(this, po ? po.split(/\s?,\s?/) : []);
            tl.invalidate();
        }

        if ((tl.time() === zero || start === zero) && this.data.dly) {

            this.delayTimer = setTimeout(function () {
                //tl.invalidate();
                rev ? tl.reverse(start) : tl.play(start);
            }, getTime(tl, this.data.dly) * 1000);

        } else {
            //tl.invalidate();
            rev ? tl.reverse(start) : tl.play(start);
        }
    }

    PGElementAnimation.prototype.playMouseMove = function (e) {
        //maybe needs to be optimised not to get dimensions in each call

        if (this.disabled) return;

        var tl = this.getTimeline();

        if(!this._etc()) return;

        var rect = this.element.getBoundingClientRect();

        var pageX, pageY;

        if (startsWith(e.type, 'touch')) {
            pageX = e.targetTouches[0].pageX;
            pageY = e.targetTouches[0].pageY;
        } else {
            pageX = e.pageX;
            pageY = e.pageY;
        }

        //get normalized position 0...1

        var pos = 0;
        var pxo = window.pageXOffset;
        var pyo = window.pageYOffset;

        switch (this.mouseMoveMeasure) {
            case 'x':
                if (rect.width > 0) {
                    pos = (pageX - pxo - rect.left) / rect.width;
                }
                break;
            case 'y':
                if (rect.height > 0) {
                    pos = (pageY - pyo - rect.top) / rect.height;
                }
                break;
            case 'd_c':
                var max_dist = Math.sqrt(Math.pow(rect.width / 2, 2) + Math.pow(rect.height / 2, 2));
                if (max_dist > 0) {
                    var x = (pageX - pxo - rect.left - rect.width / 2);
                    var y = (pageY - pyo - rect.top - rect.height / 2);
                    pos = Math.sqrt(x * x + y * y) / max_dist;
                }
                break;
        }

        this.softSeek(tl.duration() * pos);
    }

    PGElementAnimation.prototype.playScroll = function (e) {
        var _this = this;

        if (this.disabled) return;

        var tl = this.getTimeline();

        if(!this._etc()) return;

        var p = minMax(window.pageYOffset / (document.body.offsetHeight - window.innerHeight), 0, 1);

        //console.log(p, window.pageYOffset, document.body.offsetHeight, window.innerHeight);
        this.softSeek(tl.duration() * p, 0.1);
    }

    PGElementAnimation.prototype.seek = function (progress, play, events) {

        if (this.disabled) return;

        var tl = this.getTimeline();
        var time = Math.max(0, getTime(tl, progress));
        if (play && tl.progress() === 1) {
            time = 0;
        }

        this.delayTimer ? clearTimeout(this.delayTimer) : null;

        play ? tl.play(time) : tl.pause(time, events);
    }

    PGElementAnimation.prototype.pause = function () {
        if(this.delayTimer) {
            clearTimeout(this.delayTimer);
            this.delayTimer = null;
        }
        if (this.timeline) {
            this.timeline.pause();
        }
    }

    PGElementAnimation.prototype.softSeek = function (pos, delay) {
        var tl = this.getTimeline();
        if (tl._pg_seek_tween) {
            tl._pg_seek_tween.kill();
        }
        !tl.paused() && tl.pause();
        tl._pg_seek_tween = TweenMax.to(tl, delay || 0.5, {time: pos});
    }

    PGElementAnimation.prototype.rest = function (e) {
        var tl = this.getTimeline();
        if (tl._pg_seek_tween) {
            tl._pg_seek_tween.kill();
        }
        this.softSeek(getTime(tl, this.restAt));
    }

    PGElementAnimation.prototype.refresh = function (data) {
        this.data = data;

        this.delayTimer ? clearTimeout(this.delayTimer) : null;
        this.interval ? clearInterval(this.interval) : null;

        var tl = this.timeline;
        var pos = 0;

        if (tl) {
            if (tl._pg_seek_tween) {
                tl._pg_seek_tween.kill();
            }
            pos = tl.time();
            tl.seek(0);
            tl.kill();
        }
        this.create();

        if (pos > 0) {
            this.timeline.pause(pos);
        }
    }

    PGElementAnimation.prototype.destroy = function () {

        if (this.disabled) return;

        switch (this.event) {
            case 'now':
            case 'timer':
            case 'no':
                break;

            case 'load':
            case 'DOMContentLoaded':
                window.removeEventListener(this.event, this._playBind);
                break;

            case 'mousemove':
                if (this.mouseMoveMeasure === 'run') {
                    this.element.removeEventListener(this.event, this._playBind);
                } else {
                    this.element.removeEventListener(this.event, this._playMouseMoveBind);
                    this.element.removeEventListener('touchmove', this._playMouseMoveBind);

                    if (this.data.mm_r) {
                        this.element.removeEventListener('mouseleave', this._restBind);
                        this.element.removeEventListener('touchend', this._restBind);
                    }
                }
                break;

            case 'scrolling':
                window.removeEventListener('scroll', this._playScrollBind);
                break;

            default:
                this.element.removeEventListener(this.event, this._playBind);
        }

        if (this.touchEvent) {
            this.element.removeEventListener(this.touchEvent, this._playBind);
        }

        this.delayTimer ? clearTimeout(this.delayTimer) : null;
        this.interval ? clearInterval(this.interval) : null;

        if (this.timeline) {
            this.timeline.pause(0);
            if (this.timeline._pg_seek_tween) {
                this.timeline._pg_seek_tween.kill();
            }
        }
    }

    var PGElementAnimations = function (el, data, updated) {

        var _this = this;

        this.element = el;

        this.animations = [];

        if(data && data.l) {
            for (var i = 0; i < data.l.length; i++) {
                this.animations.push(new PGElementAnimation(el, i, data.l[i], this));
            }
        }
    }

    PGElementAnimations.prototype.find = function (idx_or_name, first_is_one) {
        var idx;
        if(!isNaN(idx_or_name)) {
            idx = parseInt(idx_or_name);
            first_is_one && (idx--);
        } else {
            var a = this.animations;
            for(var i = 0; i < a.length; i++) {
                if(idx_or_name == a[i].name) {
                    idx = i;
                    break;
                }
            }
        }
        return this.animations[idx] || null;
    }

    PGElementAnimations.prototype.play = function (idx_or_name, reverse) {
        var a = this.find(idx_or_name);
        a && a.play(null, reverse);
    }

    PGElementAnimations.prototype.seek = function (idx_or_name, progress, play) {
        var a = this.find(idx_or_name);
        a && a.seek(progress, play);
    }

    PGElementAnimations.prototype.refresh = function (idx_or_name, data) {
        var a = this.find(idx_or_name);
        a && a.refresh(data.l[idx_or_name]);
    }

    PGElementAnimations.prototype.getData = function (idx_or_name, pa) {
        var a = this.find(idx_or_name);
        return (a && pa !== a) ? a.data : null;
    }

    PGElementAnimations.prototype.pauseOther = function (a, list) {
        var idx = 1;
        this.animations.forEach(function (i) {
            if (i !== a && (!list.length || list.indexOf(idx+'') >= 0) || (i.name && list.indexOf(i.name) >= 0)) {
                i.pause();
            }
            idx++;
        })
    }

    PGElementAnimations.prototype.destroy = function (a) {
        this.animations.forEach(function (i) {
            i.destroy();
        })
    }


    var PGElementAnimationsManager = function () {

        var _this = this;

        var elements = [];

        function createAllAnimations() {
            document.querySelectorAll('[data-pg-ia]').forEach(function (el) {
                createAnimations(el);
            });
        }

        function createAnimations(el) {

            try {
                var s = el.getAttribute('data-pg-ia');
                if(s) {
                    var data = JSON.parse(unescape(s));
                    el._pg_animations = new PGElementAnimations(el, data);
                }
            } catch (err) {
                log(err);
            }
        }

        this.seek = function (el, idx, progress, play) {
            if (el && el._pg_animations) {
                el._pg_animations.seek(idx, progress, play);
            }
        }

        this.refreshCustomAnimation = function (el, idx) {
            if (el._pg_animations) {
                var data = JSON.parse(unescape(el.getAttribute('data-pg-ia')));
                el._pg_animations.refresh(idx, data);
            }
        }

        this.refreshAnimations = function (el) {
            this.destroyAnimations(el);
            createAnimations(el);
        }

        this.destroyAnimations = function(el) {
            if (el._pg_animations) {
                el._pg_animations.destroy();
            }
        }

        this.init = function () {
            createAllAnimations();
        }
    }

    pgia.play = function(el, idx, data) {
        data && !el._pg_animations && (el._pg_animations = new PGElementAnimations(el, data));
        if(el._pg_animations) {
            var reverse = false;
            if(typeof idx == 'string') {
                if(startsWith(idx, '-')) {
                    reverse = true;
                    idx = idx.substr(1);
                }
            } else if(idx < 0) {
                reverse = true;
                idx = -idx;
            }
            var a = el._pg_animations.find(idx, true /* 1 is the first one */);
            a && a.play(null, reverse);
        }
    }

    pgia.pause = function(el, idx, except_tl) {
        if(el._pg_animations) {
            var a = el._pg_animations.find(idx, true /* 1 is the first one */);
            a && (a.timeline !== except_tl) && a.pause();
        }
    }

    //Apply to many
    var apply_attr = 'data-pg-ia-apply';
    var apply_attrs = ['data-pg-ia', 'data-pg-ia-scene', 'data-pg-ia-hide', 'data-pg-ia-show', 'data-pg-ia-smooth-scroll'];

    document.querySelectorAll('[' + apply_attr + ']').forEach(function (el) {
        var t = el.getAttribute(apply_attr);
        if (t && t !== 'this') {
            try {
                var list = [];
                apply_attrs.forEach( function(attr) {
                    val = el.getAttribute(attr);
                    val && list.push({a: attr, v: val, d: parseJson(val)});
                });
                getTargets(el, t).forEach(function (tel) {
                    list.forEach(function(d) {
                        if(!tel.hasAttribute(d.a)) {
                            tel.setAttribute(d.a, d.v);
                        } else if(d.a == 'data-pg-ia') {
                            //merge animations
                            mergeAnimations(tel, d.a, d.d);
                        }
                    })
                })
            } catch(err) {
                log(err);
            }
        }
    });

    var added_list = [];

    pgia.add = function(sel, target_sel, actions) {
        var data = {}
        var targets = target_sel ? getTargets(document, target_sel) : [document];
        forEachTarget(targets, function(target) {
            getTargets(target, sel).forEach(function(el) {
                for (var key in actions) {
                    if (actions.hasOwnProperty(key)) {
                        data[key] = data[key] || parseJson(actions[key]);

                        var a = 'data-pg-ia';
                        if(key === 'interactions') {
                            var val = el.getAttribute(a);
                            if(val) {
                                mergeAnimations(el, a, data[key], val);
                                continue;
                            }
                        } else {
                            a += '-' + key;
                        }
                        el.setAttribute(a, actions[key]);
                    }
                }
                added_list.push(function() {
                    actions['interactions'] && pgia.elementAnimationsManager.refreshAnimations(el);
                    actions['scene'] && pgia.scrollSceneManager.createScene(el);
                    actions['smooth-scroll'] && pgia.smoothScrollManager && pgia.smoothScrollManager.create(el);
                });
            })
        })
    }

    pgia.update = function() {
        added_list.forEach(function(f) {
            f();
        })
        added_list = [];
    }

    //End apply to many

    pgia.elementAnimationsManager = new PGElementAnimationsManager();
    pgia.elementAnimationsManager.init();


    var PGScrollScene = function (el, updated) {

        var _this = this;

        var scene;
        var tl;
        var animations = [];
        var is_pinned = false;
        var prev_progress = -1;
        var disabled = false;

        this.destroy = function () {

            if(disabled) return;

            if (tl) {
                if (tl._pg_seek_tween) {
                    tl._pg_seek_tween.kill();
                }
                tl.pause(0);
                tl.kill();
            }
            animations.forEach(function (tl_info) {
                if(tl_info.tl) {
                    tl_info.tl.pause(0);
                    tl_info.tl.kill();
                }
            })
            animations = [];

            scene.kill();

            scene = null;
            /*
            if (is_pinned) {
                scene.removePin(true);
            }
            if (scene) {
                getScrollControler().removeScene(scene);
            }*/
        }

        this.create = function () {
            var sa;

            try {
                sa = JSON.parse(unescape(el.getAttribute('data-pg-ia-scene') || '{}'));
            } catch (err) {
                log(err);
                return;
            }

            disabled = isDisabled(sa);

            if(disabled) return;

            //We will create one Timeline that will contain the whole scene, backgrounds and children
            var presets = {
                onEnter: {s: 'top bottom', e: ''},
                onCenter: {s: 'top center', e: ''},
                onLeave: {s: 'top top', e: ''},
            }

            var getOffsetString = function(o) {
                o = o + '';
                if (startsWith(o, '-')) {
                    return '-=' + o.substr(1);
                } else {
                    return '+=' + o;
                }
            }

            sa.s = sa.s || (sa.pin ? 'onLeave' : 'onEnter');

            if(sa.pin && sa.s == 'onEnter') sa.s = 'onLeave';

            var start, end;
            var trigger_el = el;
            var scroller = null;

            if(sa.s === 'custom') {
                start = sa.s_t || 'top';

                start += ' ' + (sa.s_s || 'top');

                if (sa.s_o) {
                    start += getOffsetString(sa.s_o);
                }

                end = sa.e_t || 'bottom';

                end += ' ' + (sa.e_s || 'top');

                if (sa.e_o) {
                    end += getOffsetString(sa.e_o);
                }
                if(sa.s_scroller) {
                    scroller = getTargets(el, sa.s_scroller)[0];
                }

            } else if(sa.s === 'whole') {
                scroller = el;
                trigger_el = null;
                start = 0;
            } else {
                start = presets[sa.s].s;
                end = '+=' + (sa.d || '200%');
                if(sa.o) {
                    //legacy mode, invert value
                    var lo = sa.o + '';
                    if(startsWith(lo, '-')) {
                        lo = lo.substr(1);
                    } else {
                        lo = '-' + lo;
                    }
                    start += getOffsetString(lo);
                }
            }

            //get auto scroller
            if(!scroller) {
                var pe = trigger_el.parentNode;
                if(pe) {
                    if(((sa.dir == 'a' || sa.dir == 'h') && pe.scrollWidth > pe.clientWidth) || ((sa.dir == 'a' || sa.dir == 'v') && pe.scrollHeight > pe.clientHeight)) {
                        scroller = pe;
                    }
                }
            }

            if(scroller == document.body || scroller == document.documentElement) {
                scroller = null;
            }

            var scrub = getTime(null, sa.smooth, 0.5);

            if(scrub === 0) {
                scrub = true;
            } else if(scrub === undefined) {
                scrub = 0.5;
            }



            if(sa.dir == 'a') {
                if(scroller && scroller.clientWidth && scroller.clientHeight && scroller.scrollWidth / scroller.clientWidth > scroller.scrollHeight / scroller.clientHeight) {
                    sa.dir = 'h';
                } else {
                    sa.dir = 'v';
                }
            }

            var horizontal = sa.dir == 'h';

            var snap = false;

            if((sa.snap || '').length) {
                if(sa.snap == 'e') {

                    snap = {
                        snapTo: function (ppos, st) {
                            //console.log('snap', st.progress, st.getVelocity())

                            if(st.progress == 1) return 1;

                            var nc = getNextChild(null, st.scroller, horizontal, ppos < st.progress, true, sa.snap_sel || null, st, false);//, minMax(ppos, 0, 1));

                            var sr = nc.p - (st.pgTopCover / (st.end - st.start));
                            //console.log('snap return ' + sr, nc);
                            return sr;
                        }
                    }
                } else {
                    snap = {
                        snapTo: pfList(sa.snap.split(','))
                    }
                }
                var snap_dur = getTime(null, sa.snap_dur || 0);
                var snap_dur_max = getTime(null, sa.snap_durmax || 0);
                if(snap_dur) {
                    snap.duration = snap_dur_max > 0 ? {min: snap_dur, max: snap_dur_max} : snap_dur;
                }
                var snap_delay = getTime(null, sa.snap_del || (scrub !== true ? (scrub + 0.1) : 0.3));
                snap_delay && (snap.delay = snap_delay);

                if(scrub !== true && scrub > snap_delay) {
                    log('Scroll scene smoothing delay ' + scrub + ' should not be longer than snap delay ' + snap_delay + '! Adjusting...', true);
                    snap.delay = scrub + 0.1;
                }

                sa.snap_ease && (snap.ease = sa.snap_ease);

            }



//            console.log(`start = ${start}, end = ${end}`);

            var scrollOptions = {
                trigger: trigger_el,//getTargets(el, '.box'),//sa.t),
                start: function() { return start; }, //ST bug workaround
                endTrigger: getTargets(trigger_el, sa.e_target)[0],
                end: end,
                pin: sa.pin ? (getTargets(el, sa.pint)[0] || el) : false,
                scrub: scrub,
                horizontal: horizontal,
                markers: in_pg && sa.dbg,
                snap: snap,
                onRefresh: function(self) {
                    pagUpdate && (pag_layout = getChildrenLayout(el, sa.pag_t)) && pagUpdate(tl.scrollTrigger);
                },
                onToggle: function(self) {
                    if(self.isActive) {
                        prev_progress = -1;
                    } else {
                        prev_progress = 2;
                    }
                },
                onUpdate: function(self) {
                    pagUpdate && pagUpdate(self);
                }
            }

            scroller && (scrollOptions.scroller = scroller);

            if(scrollOptions.pin) {
                sa.pin_type && (scrollOptions.pinType = sa.pin_type);
                sa.pin_body && (scrollOptions.pinReparent = true);

                var pin_spc = sa.pin_spc || 'auto';

                if(pin_spc == 'auto') {
                    var pin_parent_style = window.getComputedStyle(scrollOptions.pin.parentNode);
                    if (pin_parent_style.display == 'flex' || pin_parent_style.position == 'absolute') {
                        pin_spc = 'margin';
                    }
                } else if(pin_spc == 'false') {
                    pin_spc = false;
                }
                if(pin_spc != 'auto' && pin_spc != 'padding') scrollOptions.pinSpacing = pin_spc;
            }

            /*
            sa.inf = true;

            if(sa.inf) {
                var first_el = scroller.children[0];
                var placeholder = first_el.cloneNode(true);
                first_el.parentNode.appendChild(placeholder);

                this.inf = true;

            }*/

            this.inf = sa.pag_inf || false;

            if(sa.pag) {
                var pag_items, pag_indicators, pag_layout;

                var pag_current_iel = null;
                var pag_update_timer = null;
                var pag_last_velocity = 0;

                var pag_play_d = (sa.pag_pd || '').split(/\s*,\s*/);
                var pag_play_a = (sa.pag_pa || '').split(/\s*,\s*/);

                var pagUpdate = function(st) {
                    pag_last_velocity = st.getVelocity();

                    if(!pag_update_timer) {
                        pag_update_timer = setTimeout(function() {

                            pag_update_timer = null;
                            if(!scene) return;

                            pag_items = getTargets(el, sa.pag_t);
                            pag_indicators = getTargets(el, sa.pag_i);
                            pag_layout = getChildrenLayout(el, sa.pag_t);

                            var prev = pag_last_velocity < 0;
                            var nc = getNextChild(pag_layout, null, horizontal, 'c' /*prev*/, true, null, st);

                            //console.log(`pagUpdate idx ${nc.idx} vel ${pag_last_velocity}`);

                            if (_this.inf) {
                                (nc.idx >= pag_indicators.length) && (nc.idx = 0);
                            }
                            var iel = pag_indicators[nc.idx];

                            if (pag_current_iel != iel) {
                                pag_play_d && pag_current_iel && pag_play_d.forEach(function(a) {
                                    pgia.play(pag_current_iel, a);
                                });
                                pag_play_a && iel && pag_play_a.forEach(function(a) {
                                    pgia.play(iel, a);
                                });
                                pag_current_iel = iel;
                            }

                        });
                    }
                }
            }

            //log(scrollOptions);

            var onUpdate = function() {
                //console.log("progress:", this.progress().toFixed(3), "direction:", this.scrollTrigger.direction, "velocity", this.scrollTrigger.getVelocity());
                _this.seek(this.progress(), this.scrollTrigger.direction);
                if(scene_id) {
                    pgAnimationInfo.updateProgress(scene_id, this.progress());
                }

                if(sa.inf && this.scrollTrigger.progress == 1) {
                    //this.scrollTrigger.scroll(0);
                }
            }
            //we use scrollrigger in timeline so that we get the scrub delay effect
            tl = gsap.timeline({
                scrollTrigger: scrollOptions,
                onUpdate: onUpdate,
                onStart: onUpdate
            });

            this.st = scene = tl.scrollTrigger;

            this.st.pgInf = this.inf;
            this.st.pgHor = horizontal;

            scene.pgTopCover = sa.pag ? getParam(sa, 'pag_tc', 0) : 0;
            scene.pgBottomCover = sa.pag ? getParam(sa, 'pag_bc', 0) : 0;

            //tl.pause();

            //Add empty tween to set the duration to 100
            tl.to({}, 100, {}, 0);

            //onUpdate.call(tl);

            animations = [];

            var children = sa.l;
            if (children && children.length > 0) {

                for (var i = 0; i < children.length; i++) {
                    var a = children[i];

                    if(isDisabled(a)) {
                        animations.push({disabled: true});

                    } else {

                        var el_list = getTargets(el, a.t);

                        /*
                         el_list.forEach(function(el) {
                         delete el._gsTransform;
                         })
                         */

                        var a_tl = gtl(a.a, el_list);

                        if (a_tl) {
                            var start_at = 0;
                            var reverse_at = -1;
                            var with_scroll = true;
                            var duration = 0;
                            var dir;

                            a_tl._pg_animation_id = in_pg ? pgAnimationInfo.getAnimationId([el] /* el_list */, 'scene_item_' + i) : null;

                            if (getParam(a, 'p', 'scroll') === 'scroll') {
                                start_at = parseFloat(getParam(a, 's', 0));
                                duration = parseFloat(getParam(a, 'sc_d', 100 - start_at));
                                a_tl.duration(duration);
                                tl.add(a_tl, start_at);
                                a_tl.play();
                            } else {
                                a_tl.pause();

                                var time_d = getParam(a, 't_d', null);
                                if (time_d !== null) {
                                    a_tl.duration(parseFloat(time_d));
                                }

                                start_at = parseFloat(getParam(a, 's', 0)) / 100.0;
                                dir = getParam(a, 'sc_dir', 'down');
                                reverse_at = a.rev ? (dir === 'down' ? Math.min(0.9, start_at + 0.5) : Math.max(0, start_at - 0.5)) : -1;
                                with_scroll = false;
                            }
                            animations.push({
                                start: start_at,
                                duration: duration,
                                tl: a_tl,
                                animation_idx: i,
                                scroll: with_scroll,
                                reverse_at: reverse_at,
                                elements: el_list,
                                dir: dir
                            })

                            if (in_pg) {
                                a_tl.eventCallback("onUpdate", function () {
                                    pgAnimationInfo.updateProgress(this._pg_animation_id, this.time());
                                })
                            }
                        }
                    }
                }
            }

            var seekTo = function (tl, pos) {
                if (tl._pg_seek_tween) {
                    tl._pg_seek_tween.kill();
                }
                tl._pg_seek_tween = TweenMax.to(tl, 0.5, {time: pos});
            }

            if(in_pg) {
                var scene_id = pgAnimationInfo.getAnimationId(el, 'scene');
            }

            if (sa.pin) {
                //scene.setPin(el, {pushFollowers: true});
                is_pinned = true;
            }
        }

        this.scroll = function(pos) {
            !disabled && scene.scroll(pos);
        }

        this.seek = function (progress, direction) {

            if(disabled) return;

            animations.forEach(function (d) {
                if (d.detached && !d.disabled) {
                    d.tl.duration(d.duration);
                    tl.add(d.tl, d.start);
                    d.tl.play();
                    d.detached = false;
                }
            })

            //scrollTrigger does this
            //tl.seek(Math.max(0, tl.duration() * progress), false /* do events */);

            animations.forEach(function (itl) {

                var dir = (direction === -1) ? 'up' : 'down';

                //if(itl.dir.indexOf(dir) < )

                if (!itl.scroll && !itl.disabled) {
                    if (updated) {
                        //scene was updated during editing, rerun animations
                        itl.tl.play(0);
                        updated = false;

                    } else {
                        if(itl.dir === 'down') {

                            if (dir === 'down') {

                                if ((prev_progress < itl.start && progress >= itl.start) || (progress >= itl.start && (itl.tl.progress() === 0 || itl.tl.reversed()))) {
                                    itl.tl.play();
                                    //console.log('play')
                                }

                            } else if (dir === 'up' && itl.reverse_at >= 0 ) {
                                if (itl.start < progress && !itl.tl.reversed() /* prev_progress > itl.reverse_at && progress <= itl.reverse_at */) {
                                    itl.tl.reverse();
                                    //console.log('reverse')
                                }
                            }
                        } else {

                            if (dir === 'up') {

                                if ((prev_progress > itl.start && progress <= itl.start) || (progress <= itl.start && (itl.tl.progress() === 0 || itl.tl.reversed()))) {
                                    itl.tl.play();
                                    //console.log('play')
                                }

                            } else if (dir === 'down' && itl.reverse_at >= 0 ) {
                                if (prev_progress < itl.reverse_at && progress >= itl.reverse_at) {
                                    itl.tl.reverse();
                                    //console.log('reverse')
                                }
                            }

                        }
                    }
                }
            })

            prev_progress = progress;
        }

        this.seekAnimation = function (idx, progress, play) {
            for (var i = 0; i < animations.length; i++) {
                if (animations[i].animation_idx === idx && !animations[i].disabled) {
                    var a_tl = animations[i].tl;

                    var time = Math.max(0, getTime(a_tl, progress));

                    if (animations[i].scroll && play && !animations[i].detached) {
                        tl.remove(a_tl);
                        gsap.globalTimeline.add(a_tl);
                        a_tl.timeScale(1);
                        //play && a_tl.pause();
                        animations[i].detached = true;
                    }
                    if (play && a_tl.progress() === 1) {
                        time = 0;
                    }

                    play ? a_tl.play(time) : a_tl.pause(time);

                    break;
                }
            }
        }

        this.refreshAnimation = function (idx) {
            var found = false;
            for (var i = 0; i < animations.length; i++) {
                if (animations[i].animation_idx === idx && !animations[i].disabled) {

                    try {
                        found = true;

                        var pos = animations[i].tl.time();

                        var a = JSON.parse(unescape(el.getAttribute('data-pg-ia-scene')));

                        var a = a.l[i];

                        var el_list = getTargets(el, a.t);

                        var a_tl = gtl(a.a, el_list);

                        if(getParam(a, 'p', 'scroll') === 'scroll') {
                            animations[i].detached = false;
                            a_tl.duration(animations[i].duration);
                            tl.add(a_tl, animations[i].start);
                            a_tl.play();
                        } else {
                            a_tl.pause(Math.min(pos, a_tl.duration()));
                        }

                        animations[i].tl.pause(0);
                        animations[i].tl.kill();

                        animations[i].tl = a_tl;
                        animations[i].elements = el_list;

                        if (in_pg) {
                            a_tl._pg_animation_id = pgAnimationInfo.getAnimationId([el] /* el_list */, 'scene_item_' + idx);
                            a_tl.eventCallback("onUpdate", function () {
                                pgAnimationInfo.updateProgress(this._pg_animation_id, this.time());
                            })
                        }

                    } catch (err) {
                        log(err);
                        return true;
                    }
                }
            }
            return found;
        }

        this.create();
    }

    var PGScrollSceneManager = function () {

        var _this = this;

        var elements = [];

        function createAllScenes() {
            document.querySelectorAll('[data-pg-ia-scene]').forEach(function (el) {
                createScene(el);
            });
        }

        function createScene(el, updated) {
            removeScene(el);

            if(!el.hasAttribute('data-pg-ia-scene')) return null;

            el._pg_scroll_scene = new PGScrollScene(el, updated);

            var idx = elements.indexOf(el);
            if (idx < 0) {
                elements.push(el);
            }
        }

        function removeScene(el) {
            if (el._pg_scroll_scene) {
                el._pg_scroll_scene.destroy();
            }
            el._pg_scroll_scene = null;

            var idx = elements.indexOf(el);
            if (idx >= 0) {
                elements.splice(idx, 1);
            }
        }

        this.removeScene = removeScene;
        this.createScene = createScene;

        this.updateScene = function (el) {
            createScene(el, true);
        }

        this.getScene = function(el) {
            return el._pg_scroll_scene || null;
        }

        this.scrollScene = function (el, progress) {
            if (el._pg_scroll_scene) {
                el._pg_scroll_scene.scroll(progress);
            }
        }

        this.seekAnimation = function (el, idx, progress, play) {
            if (el._pg_scroll_scene) {
                el._pg_scroll_scene.seekAnimation(idx, progress, play);
            }
        }

        this.refreshAnimation = function (el, idx) {
            if (el._pg_scroll_scene) {
                el._pg_scroll_scene.refreshAnimation(idx) || this.updateScene(el);
            }
        }

        this.init = function () {
            this.removeAll();
            createAllScenes();
        }

        this.removeAll = function () {
            elements.slice(0).forEach(function (el) {
                removeScene(el);
            })
        }

        window.addEventListener('load', function () {
            _this.init();
        });
    }

    pgia.scrollSceneManager = new PGScrollSceneManager();
/*

    var scrollController = null;

    function getScrollControler() {
        if (!scrollController) {
            scrollController = new ScrollMagic.Controller();
        }
        return scrollController;
    }
    */

// Smooth Scrolling
    var PGSmoothScroll = function(el, a) {

        function normalizeWheelDelta(e) {
            if (e.detail) {
                if (e.wheelDelta)
                    return e.wheelDelta / e.detail / 40 * (e.detail > 0 ? 1 : -1) // Opera
                else
                    return -e.detail / 3 // Firefox
            } else
                return e.wheelDelta / 120 // IE,Safari,Chrome
        }

        var getSP = (function() {
            var regex = /(auto|scroll)/;

            var parents = function (node, ps) {
                if (node.parentNode === null) { return ps; }

                return parents(node.parentNode, ps.concat([node]));
            };

            var style = function (node, prop) {
                return getComputedStyle(node, null).getPropertyValue(prop);
            };

            var overflow = function (node) {
                return style(node, "overflow") + style(node, "overflow-y") + style(node, "overflow-x");
            };

            var scroll = function (node) {
                return regex.test(overflow(node));
            };

            var scrollParent = function (node) {
                if (!(node instanceof HTMLElement || node instanceof SVGElement)) {
                    return ;
                }

                if(node._pg_scroll_parent) return node._pg_scroll_parent;

                var ps = parents(node.parentNode, []);

                for (var i = 0; i < ps.length; i += 1) {
                    if (scroll(ps[i])) {
                        node._pg_scroll_parent = ps[i];
                        return ps[i];
                    }
                }

                node._pg_scroll_parent = document.scrollingElement || document.documentElement;
                return node._pg_scroll_parent;
            };

            return scrollParent;
        })()

        var requestFrame = window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                window.oRequestAnimationFrame ||
                window.msRequestAnimationFrame;

        var speed = 50;
        var smooth = 6;

        speed = {
            slow: 10,
            normal: 30,
            fast: 60
        }[a.spd || 'normal'];


        //if ('spd' in a) speed = parseFloat(a.spd);
        //if ('sth' in a) sth = parseFloat(a.sth);

        var target = null;
        var page_scroll = true;

        if (el.nodeName === 'HTML' || el.nodeName === 'BODY') {
            target = (document.scrollingElement ||
            document.documentElement ||
            document.body.parentNode ||
            document.body) // cross browser support for document scrolling
        } else {
            target = el;
            page_scroll = false;
        }

        var moving = false;
        var pos = target.scrollTop;
        var frame = target; // safari is the new IE

        if (target === document.body && document.documentElement) {
            frame = document.documentElement;
        }

        var ignore_scroll_event = false;
        var ignore_scroll_event_timer = null;

        var update = function () {
            moving = true;

            var delta = (pos - target.scrollTop) / smooth;

            delta = delta > 0 ? Math.ceil(delta) : Math.floor(delta);

            ignore_scroll_event = true;

            if (ignore_scroll_event_timer) {
                clearTimeout(ignore_scroll_event_timer);
            }

            ignore_scroll_event_timer = setTimeout(function () {
                ignore_scroll_event = false;
            }, 500);

            //Will trigger scroll event and update pos
            target.scrollTop += delta;

            if (Math.abs(delta) > 0.5 && requestFrame) {
                requestFrame(update)
            } else {
                moving = false
            }
        }

        var seek_tween = null;
        var request_frame_id = null;

        var seekTo = function (pos) {
            if (seek_tween) {
                seek_tween.kill();
            }
            seek_tween = gsap.to(target, 1.5, {scrollTop: pos});
        }

        var scrollEvent = function (e) {
            //find el with scroll
            if(getSP(e.target) === el) {

                e.preventDefault(); // disable default scrolling

                var delta = normalizeWheelDelta(e);

                pos += -delta * speed;
                pos = Math.max(0, Math.min(pos, target.scrollHeight - frame.clientHeight)); // limit scrolling

                //seekTo(pos);
                if (!moving) update();
            }
        }

        if(requestFrame) {
            target.addEventListener('mousewheel', scrollEvent, {passive: false});
            target.addEventListener('DOMMouseScroll', scrollEvent, {passive: false});

            var onScroll = function (e) {
                if (!ignore_scroll_event) {
                    pos = target.scrollTop;
                }
            };

            (page_scroll ? window : target).addEventListener('scroll', onScroll, false);
        }

        this.destroy = function() {
            if(requestFrame) {
                requestFrame = null;
                target.removeEventListener('mousewheel', scrollEvent);
                target.removeEventListener('DOMMouseScroll', scrollEvent);

                (page_scroll ? window : target).removeEventListener('scroll', onScroll);
            }
        }
    }

    var PGSmoothScrollManager = function() {

        this.init = function() {
            document.querySelectorAll('[data-pg-ia-smooth-scroll]').forEach(function (el) {
                create(el);
            });
        }

        this.refresh = function(el) {
            if(el._pg_smooth_scroll) {
                el._pg_smooth_scroll.destroy();
                el._pg_smooth_scroll = null;
            }
            create(el);
        }

        var create = function(el) {
            try {
                if(el.hasAttribute('data-pg-ia-smooth-scroll')) {
                    var data = JSON.parse(unescape(el.getAttribute('data-pg-ia-smooth-scroll') || '{}'));
                    el._pg_smooth_scroll = new PGSmoothScroll(el, data);
                }
            } catch (err) {
                log(err);
            }
        }
    }

    if(!is_ff) {
        pgia.smoothScrollManager = new PGSmoothScrollManager();
        pgia.smoothScrollManager.init();
    }


})();