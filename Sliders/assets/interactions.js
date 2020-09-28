console.log('Bubi');

/* Pinegrow generated Interactions Begin */

if(typeof pgia == 'undefined') {
    console && console.error('Pinegrow Interactions: pgia.js must be included before this script.');
} else {
    pgia.add('$.bubi', null, {
        'interactions': '{"l":[{"trg":"click","a":{"n":"","l":[{"t":"","l":[{"t":"tween","p":0,"d":0.5,"l":{"pgDom":{"remove":1}}}]}]}}]}'    
    });
    pgia.add('$.slider', null, {
        'interactions': '{"l":[{"name":"AutoNext","trg":"timer","timer":"5","tc":"no-class","tcv":"slider-user-active","a":{"n":"","l":[{"t":".slides","l":[{"t":"tween","p":0,"d":0.5,"l":{"scrollTo":{"dest":"next"}}}]}]}},{"name":"CloneFirstSlide","trg":"now","a":{"n":"","l":[{"t":".slides &gt; div:nth-of-type(1)","l":[{"t":"set","p":0,"d":0,"l":{"pgDom":{"clone":1,"ins":"append"}}}]}]}},{"name":"UserActive","trg":"mouseenter","a":{"n":"","l":[{"t":"","l":[{"t":"set","p":0,"d":0,"l":{"class.add":"slider-user-active"}}]}]},"rstr":"true"},{"name":"UserInactive","trg":"mouseleave","a":{"n":"","l":[{"t":"","l":[{"t":"set","p":0,"d":0,"l":{"class.remove":"slider-user-active"}}]}]},"rstr":"true"}]}'    
    });
    pgia.add('$.slides', null, {
        'scene': '{"s":"whole","snap":"e","pag":"true","pag_t":".slide","pag_i":"^.slider|.slider-pagination-item","pag_pa":"Current","pag_pd":"-Current","pag_inf":"true","dir":"a"}'    
    });
    pgia.add('$.slider-pagination', null, {
        'interactions': '{"l":[{"trg":"now","a":{"n":"","l":[{"t":".slider-pagination-item","l":[{"t":"set","p":0.01,"d":0,"l":{"pgDom":{"clone":1,"count_sel":"^.slider|.slide","count":-2}}}]}]}}]}'    
    });
    pgia.add('$.slider-pagination-item', null, {
        'interactions': '{"l":[{"trg":"click","pdef":"true","a":{"n":"","l":[{"t":"^.slider|.slides","l":[{"t":"tween","p":0,"d":0.5,"l":{"scrollTo":{"dest":"item"}}}]}]}},{"name":"Current","trg":"no","a":{"n":"","l":[{"t":"","l":[{"t":"tween","p":0,"d":0.5,"l":{"scale":1.5}}]}]}}]}'    
    });
    pgia.add('$.slider-control.first', null, {
        'interactions': '{"l":[{"trg":"click","pdef":"true","a":{"n":"","l":[{"t":"^.slider|.slides","l":[{"t":"tween","p":0,"d":0.5,"l":{"scrollTo":{"dest":"first"}}}]}]}}]}'    
    });
    pgia.add('$.slider-control.prev', null, {
        'interactions': '{"l":[{"trg":"click","pdef":"true","a":{"n":"","l":[{"t":"^.slider|.slides","l":[{"t":"tween","p":0,"d":0.5,"l":{"scrollTo":{"dest":"prev"}}}]}]}}]}'    
    });
    pgia.add('$.slider-control.next', null, {
        'interactions': '{"l":[{"trg":"click","pdef":"true","a":{"n":"","l":[{"t":"^.slider|.slides","l":[{"t":"tween","p":0,"d":0.5,"l":{"scrollTo":{"dest":"next"}}}]}]}}]}'    
    });
    pgia.add('$.slider-control.last', null, {
        'interactions': '{"l":[{"trg":"click","pdef":"true","a":{"n":"","l":[{"t":"^.slider|.slides","l":[{"t":"tween","p":0,"d":0.5,"l":{"scrollTo":{"dest":"last"}}}]}]}}]}'    
    });
    pgia.add('$.pagination button', null, {
        'interactions': '{"l":[{"trg":"no","a":{"n":"","l":[{"t":"","l":[{"t":"tween","p":0,"d":0.24,"l":{"scale":1.3}}]}]},"rstr":"true","po":"true","pol":"2"},{"trg":"no","a":{"n":"","l":[{"t":"","l":[{"t":"tween","p":0,"d":0.5,"l":{"scale":1}}]}]},"po":"true","pol":"1"},{"trg":"click","a":{"n":"","l":[{"t":"$body","l":[{"t":"tween","p":0,"d":1,"l":{"scrollTo":{"dest":"item${data-item-idx}","esel":"$.slide"}}}]}]}},{"a":"fadeInDown","rstr":"true","trg":"now"}]}'    
    });
    pgia.add('$a[href^="#"]', null, {
        'interactions': '{"l":[{"trg":"click","pdef":"true","a":{"n":"","l":[{"t":"$body","l":[{"t":"tween","p":0,"d":0.59,"l":{"scrollTo":{"dest":"${target.href}"},"history.push":"${target.href}"}}]}]}},{"trg":"no","a":{"n":"","l":[{"t":"","l":[{"t":"tween","p":0,"d":0.5,"l":{"color":"#f500db"}}]}]}},{"trg":"no","a":{"n":"","l":[{"t":"","l":[{"t":"tween","p":0,"d":0.5,"l":{"color":"#000000"}}]}]}},{"name":"MoveTile","trg":"no","a":{"n":"","l":[{"t":"$.active-tile","l":[{"t":"tween","p":0,"d":0.29,"l":{"pgPos":{"pos":"center","width":100}}}]}]},"rstr":"true"}]}'    
    });
    pgia.add('$.item', null, {
        'interactions': '{"l":[{"trg":"click","rstr":"true","a":{"n":"","l":[{"t":"","l":[]},{"t":"^.slider | .slides","l":[{"t":"tween","p":0,"d":0.5,"l":{"scrollTo":{"target":"e","dir":"x","dest":"item${data-idx}"}}}]}]}},{"trg":"no","a":{"n":"","l":[{"t":"","l":[{"t":"tween","p":0,"d":1,"l":{"scale":1.3,"backgroundColor":"#8b0092"}}]}]},"po":"true","pol":"3"},{"trg":"no","a":{"n":"","l":[{"t":"","l":[{"t":"tween","p":0,"d":0.58,"l":{"scale":1,"backgroundColor":"#fe4baf"}}]}]},"po":"true","pol":"2"}]}'    
    });
    pgia.add('$h1', null, {
        'interactions': '{"l":[{"name":"ShowTooltip","trg":"click","dly":"500ms","rcr":"true","a":{"n":"","l":[{"t":"$.tooltip:not(.pgia-clone)","l":[{"t":"tween","p":0,"d":0.33,"l":{"pgDom":{"clone":1,"pos":"auto","play":"Show","pos_dist":-18}}}]},{"t":"$.tooltip.pgia-clone","l":[{"t":"set","p":0,"d":0,"l":{"pgia.play":"Remove"}}]}]}},{"name":"HideTooltip","trg":"no","a":{"n":"","l":[{"t":"$.tooltip.pgia-clone","l":[{"t":"tween","p":0,"d":0.2,"l":{"pgia.play":2}}]}]},"rcr":"true","po":"true","pol":"ShowTooltip"}]}'    
    });
    pgia.update();
}

    /* Pinegrow generated Interactions End */

//My code
