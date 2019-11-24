(function() {

    var pgia = {};

    window.pgia = pgia;

    var html = document.documentElement;
    var in_pg = html.hasAttribute('data-pg-id');

    function log(e) {
        in_pg && console.error(e);
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

    var pf = parseFloat;

    function startsWith(s, m) {
        return s.indexOf(m) === 0;
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
    }

    var pgAnimationInfo = new PgAnimationInfo();

    var getTime = function (tl, progress) {
        if (typeof progress === 'string') {
            if (progress.indexOf('%') >= 0) {
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
        return a.on ? (a.on === 'mobile' ? !is_mobile : is_mobile) : false;
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
            return (def !== undefined && typeof def === 'number') ? parseFloat(data[key]) : data[key];
        }
        return def;
    }


    var PgCustomAnimation = function () {

        this.getTimeline = function (d, element, done) {

            var tl = new TimelineMax({
                onComplete: done
            });

            if (d && d.l) { //loop through elements
                d.l.forEach(function (el) {

                    if(el.m) return; //muted

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

                        if(t.m) return;

                        var target_key = el.t || 'self';

                        var nodes = getAsList(element);

                        if (el.t) {
                            nodes = [];
                            forEachTarget(element, function (el_node) {

                                Array.prototype.forEach.call(getTargets(el_node, el.t), function (node) {
                                    if (nodes.indexOf(node) < 0) {
                                        nodes.push(node);
                                    }
                                });

                            })
                        }

                        var on_s = [];
                        var on_c = [];

                        var props = {
                            onStart: function() {
                                //console.log('onStart!');
                                on_s.forEach(function(f) {f()});
                            },
                            onComplete: function() {
                                //console.log('onComplete!');
                                on_c.forEach(function(f) {f()});
                            }
                        }

                        var map = {
                            'media.play': function(p, v) {
                                on_s.push(function() {
                                    nodes.forEach(function(n) {
                                        n.play && n.play();
                                        (v !== '') && (n.currentTime = pf(v));
                                    })
                                });
                            },
                            'media.stop': function(p, v) {
                                on_s.push(function() {
                                    nodes.forEach(function(n) {
                                        n.pause && n.pause();
                                        (v !== '') && (n.currentTime = pf(v));
                                    })
                                });
                            },
                            'pgia.play': function(p, v) {
                                on_s.push(function() {
                                    nodes.forEach(function(n) {
                                        v && n._pg_animations && n._pg_animations.play(parseInt(v)-1);
                                    })
                                });
                            },
                            'class.set': function(p, v) {
                                props['className'] = v;
                            },
                            'class.add': function(p, v) {
                                props['className'] = '+=' + v;
                            },
                            'class.remove': function(p, v) {
                                props['className'] = '-=' + v;
                            }
                        }

                        forEachProp(t.l, function(p, v) {
                            map[p] ? (map[p](p, v)) : (props[p] = v);
                        })


                        if(t.e) {
                            props.ease = getEase(t.e);
                        }

                        var pos = t.p;
                        var dur = t.d || 0;

                        if (dur === 0) {
                            tl.set(nodes, props, pos);
                        } else {
                            if (t.s) {
                                tl.staggerTo(nodes, dur, props, t.s, pos);
                            } else {
                                tl.add(TweenLite.to(nodes, dur, props), pos);
                            }
                        }
                    })
                })
            }

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
                        transformOrigin: "center bottom",
                        onComplete: done
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
                        transformOrigin: "center bottom",
                        onComplete: done
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
                    return new TimelineMax({paused: true});
                }

            }
            return list[key] ? list[key](el) : null;
        }
    }

    pgia.animationPresets = new PGAnimationPresets();

    var gtl = pgia.getAnimationTimeline = function(name, el) {
        if (typeof name === 'string') {

            return pgia.animationPresets.getTimeline(name, el) || new TimelineMax();
        } else {
            var ca = new PgCustomAnimation();
            return ca.getTimeline(name, el);
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
        this.restart = this.data.rstr === 'true';
        this.pauseOther = this.data.po === 'true';
        this.scrollScene = null;
        this.reset = this.data.rst === 'true';
        this.reverse = this.data.rev === 'true';
        this.toggRev = this.data.trev === 'true';
        this.disabled = isDisabled(a);

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
                this.play();
                done = true;
                break;

            case 'DOMContentLoaded':
            case 'load':
                window.addEventListener(this.event, this._playBind, false);
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

    PGElementAnimation.prototype.play = function (e) {
        var _this = this;

        if (this.disabled) return;

        var tl = this.getTimeline();

        if(!this._etc()) return;

        var rev = this.reverse;

        if(_this.toggRev) {
            rev = _this.trigC++ % 2;
            tl.timeScale(rev ? getParam(_this.data, 'spdrev', 100)/100.0 : 1);
        }

        var zero = rev ? tl.duration() : 0;

        var start = this.restart ? 0 : ((rev ? (tl.progress() > 0) : (tl.progress() < 1.0)) ? null : 0);

        this.delayTimer ? clearTimeout(this.delayTimer) : null;

        if (this.pauseOther) {
            this.parent.pauseOther(this, getParam(_this.data, 'pol', '').split(/\s?,\s?/));
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

        var p = window.pageYOffset / (document.body.offsetHeight - window.innerHeight);
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
        if (this.timeline) {
            this.timeline.pause();
        }
    }

    PGElementAnimation.prototype.softSeek = function (pos, delay) {
        var tl = this.getTimeline();
        if (tl._pg_seek_tween) {
            tl._pg_seek_tween.kill();
        }
        tl._pg_seek_tween = TweenMax.to(tl, delay || 0.5, {time: pos});
    }

    PGElementAnimation.prototype.rest = function (e) {
        var tl = this.getTimeline();
        if (tl._pg_seek_tween) {
            tl._pg_seek_tween.kill();
        }
        this.softSeek(getTime(tl, this.restAt));
    }

//Refresh custom animation only
    PGElementAnimation.prototype.refresh = function (data) {
        this.data = data;

        this.delayTimer ? clearTimeout(this.delayTimer) : null;

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
                if (!this.scrollScene) {
                    this.element.removeEventListener(this.event, this._playBind);
                }
        }

        if (this.touchEvent) {
            this.element.removeEventListener(this.touchEvent, this._playBind);
        }

        if (this.scrollScene) {
            getScrollControler().removeScene(this.scrollScene);
        }

        this.delayTimer ? clearTimeout(this.delayTimer) : null;

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

    PGElementAnimations.prototype.play = function (idx) {
        this.animations[idx] && this.animations[idx].play();
    }

    PGElementAnimations.prototype.seek = function (idx, progress, play) {
        this.animations[idx] && this.animations[idx].seek(progress, play);
    }

    PGElementAnimations.prototype.refresh = function (idx, data) {
        this.animations[idx] && this.animations[idx].refresh(data.l[idx]);
    }

    PGElementAnimations.prototype.getData = function (idx, a) {
        return (this.animations[idx] && this.animations[idx] !== a) ? this.animations[idx].data : null;
    }

    PGElementAnimations.prototype.pauseOther = function (a, list) {
        var idx = 1;
        this.animations.forEach(function (i) {
            if (i !== a && (!list.length || list.indexOf(idx+'') >= 0)) {
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
                var data = JSON.parse(el.getAttribute('data-pg-ia'));
                el._pg_animations = new PGElementAnimations(el, data);

            } catch (err) {
                log(err);
            }
        }

        this.seek = function (el, idx, progress, play) {
            if (el._pg_animations) {
                el._pg_animations.seek(idx, progress, play);
            }
        }

        this.refreshCustomAnimation = function (el, idx) {
            if (el._pg_animations) {
                var data = JSON.parse(el.getAttribute('data-pg-ia'));
                el._pg_animations.refresh(idx, data);
            }
        }

        this.refreshAnimations = function (el) {
            if (el._pg_animations) {
                el._pg_animations.destroy();
            }
            createAnimations(el);
        }

        this.init = function () {
            createAllAnimations();
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
                    el.hasAttribute(attr) && list.push({a: attr, v: el.getAttribute(attr)});
                });
                getTargets(el, t).forEach(function (tel) {
                    list.forEach(function(d) {
                        if(!tel.hasAttribute(d.a)) {
                            tel.setAttribute(d.a, d.v);
                        }
                    })
                })
            } catch(err) {
                log(err);
            }
        }
    });
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

            if (is_pinned) {
                scene.removePin(true);
            }
            if (scene) {
                getScrollControler().removeScene(scene);
            }
        }

        this.create = function () {
            var sa;

            try {
                sa = JSON.parse(el.getAttribute('data-pg-ia-scene'));
            } catch (err) {
                log(err);
                return;
            }

            disabled = isDisabled(sa);

            if(disabled) return;

            //We will create one Timeline that will contain the whole scene, backgrounds and children
            tl = new TimelineMax();

            tl.pause();

            /*
             if (a.bck_target && !a.pin) {
             getTargets(el, a.bck_target).forEach(function (bck_el) {
             var move_span = parseFloat(getParam(a, 'bck_move', 10));

             tl.add(TweenLite.set(bck_el, {
             height: (100 * (Math.pow((100 + move_span) / 100.0, 3))) + '%',
             y: -move_span + '%'
             }), 0);

             tl.add(TweenLite.to(bck_el, 100, {
             y: move_span + '%',
             ease: Power0.easeNone
             }), 0);
             })
             }

             if (a['animate_background'] === "true") {
             el.anAttrs = a;
             var bgPosY = 0;

             var speed = a['speed'];

             var bck_start = getParam(a, 'bck_start', null);

             if (bck_start !== null) {
             tl.add(TweenLite.set(el, {
             backgroundPositionY: bck_start + '%',
             }), 0);
             }

             tl.add(TweenLite.to(el, 100, {
             backgroundPositionY: getParam(a, 'bck_end', '100') + '%',
             ease: Power0.easeNone
             }), 0);

             }
             */

            animations = [];

            var children = sa.l;
            if (children && children.length > 0) {

                for (var i = 0; i < children.length; i++) {
                    var a = children[i];

                    if(!a.a || isDisabled(a)) {
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

            //Create scroll scene with this timeline
            scene = new ScrollMagic.Scene({
                triggerElement: el,
                triggerHook: sa.pin ? 'onLeave' : (sa.s || 'onEnter'),
                duration: getScrollDuration(sa.d || '200%'),
                offset: getScrollDuration(sa.o || 0)
            })

            if(in_pg) {
                var scene_id = pgAnimationInfo.getAnimationId(el, 'scene');
                sa.dbg ? scene.addIndicators({name: sa.dbg}) : null;
            }

            if (sa.pin) {
                scene.setPin(el, {pushFollowers: true});
                is_pinned = true;
            }
            scene.addTo(getScrollControler());

            scene.on("progress", function (event) {
                //console.log(event.progress);
                _this.seek(event.progress, event.scrollDirection);
                if(scene_id) {
                    pgAnimationInfo.updateProgress(scene_id, event.progress);
                }
            });


            scene.on("leave", function (event) {
                prev_progress = 2;
            });

            scene.on("enter", function (event) {
                prev_progress = -1;
            });

            //force update
            tl.seek(0.1);
            tl.seek(0);
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

            tl.seek(Math.max(0, tl.duration() * progress), !in_pg /* events in pg */);

            animations.forEach(function (itl) {

                var dir = (direction === 'REVERSE') ? 'up' : 'down';

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
                                if (prev_progress > itl.reverse_at && progress <= itl.reverse_at) {
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
                        //gsap.globalTimeline.add(a_tl);
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
            for (var i = 0; i < animations.length; i++) {
                if (animations[i].animation_idx === idx && !animations[i].disabled) {

                    try {
                        var pos = animations[i].tl.time();

                        var a = JSON.parse(el.getAttribute('data-pg-ia-scene'));

                        var a = a.l[i];

                        var el_list = getTargets(el, a.t);

                        var a_tl = gtl(a.a, el_list);

                        if(getParam(a, 'p', 'scroll') === 'scroll') {
                            animations[i].detached = false;
                            a_tl.duration(animations[i].duration);
                            tl.add(a_tl, animations[i].start_at);
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

                        a_tl.pause(Math.min(pos, a_tl.duration()));

                    } catch (err) {
                        log(err);
                        return;
                    }
                }
            }
        }

        this.create();
    }

// Parallax
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

        this.updateScene = function (el) {
            createScene(el, true);
        }

        this.seekScene = function (el, progress, direction) {
            if (el._pg_scroll_scene) {
                el._pg_scroll_scene.seek(progress, direction || 'FORWARD');
            }
        }

        this.seekAnimation = function (el, idx, progress, play) {
            if (el._pg_scroll_scene) {
                el._pg_scroll_scene.seekAnimation(idx, progress, play);
            }
        }

        this.refreshAnimation = function (el, idx) {
            if (el._pg_scroll_scene) {
                el._pg_scroll_scene.refreshAnimation(idx);
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


    var scrollController = null;

    function getScrollControler() {
        if (!scrollController) {
            scrollController = new ScrollMagic.Controller();
        }
        return scrollController;
    }

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
            seek_tween = new TweenLite(target, 1.5, {scrollTop: pos});
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
                    var data = JSON.parse(el.getAttribute('data-pg-ia-smooth-scroll') || '{}');
                    el._pg_smooth_scroll = new PGSmoothScroll(el, data);
                }
            } catch (err) {
                log(err);
            }
        }
    }

    pgia.smoothScrollManager = new PGSmoothScrollManager();
    pgia.smoothScrollManager.init();


})();