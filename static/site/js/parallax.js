/* Hero parallax — velocity model.
   The further the cursor sits from centre, the faster the map keeps
   drifting in that direction (it doesn't stop until you recentre).
   Scroll adds a vertical pan. Position is clamped inside the overscan
   so the image edges never show. Honors prefers-reduced-motion. */
(function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var layer = document.getElementById('heroLayer');
    var mist  = document.getElementById('heroMist');
    var topbar = document.getElementById('topbar');

    function onScrollBar() {
        if (window.scrollY > 40) topbar.classList.add('scrolled');
        else topbar.classList.remove('scrolled');
    }
    window.addEventListener('scroll', onScrollBar, { passive: true });
    onScrollBar();

    if (reduce || !layer) return;

    var mx = 0, my = 0;      // cursor offset from centre, -1..1
    var cmx = 0, cmy = 0;    // eased offset
    var posX = 0, posY = 0;  // accumulated drift position (px)
    var sy = 0, csy = 0;     // scroll progress 0..1

    var SPEED_X = 4.6;    // px/frame at full horizontal deflection
    var SPEED_Y = 2.8;    // px/frame at full vertical deflection
    var SCROLL_Y = 280;   // px of vertical pan at full scroll progress
    var SCROLL_SPAN = .5; // full pan is reached after half a viewport of scrolling
    var SCROLL_EASE = .24;// less lag than the mouse drift, so it tracks the wheel
    var DEADZONE = 0.06;  // near-centre: treat as still
    /* SCROLL_Y + limY must stay inside the layer's overscan (see .hero__layer
       inset in theme.css) or the map's edge slides into view at full scroll. */

    window.addEventListener('mousemove', function (e) {
        mx = (e.clientX / window.innerWidth) * 2 - 1;
        my = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    window.addEventListener('deviceorientation', function (e) {
        if (e.gamma == null) return;
        mx = Math.max(-1, Math.min(1, e.gamma / 25));
        my = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
    }, { passive: true });

    function onScroll() {
        sy = Math.max(0, Math.min(1, window.scrollY / (window.innerHeight * SCROLL_SPAN)));
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    function clamp(v, lim) { return v < -lim ? -lim : v > lim ? lim : v; }
    function shape(v) {
        // dead zone near centre, then ramp up (quadratic → speeds up off-centre)
        var a = Math.abs(v);
        if (a < DEADZONE) return 0;
        var t = (a - DEADZONE) / (1 - DEADZONE);
        return (v < 0 ? -1 : 1) * t * t;
    }

    function tick() {
        cmx += (mx - cmx) * 0.12;
        cmy += (my - cmy) * 0.12;
        csy += (sy - csy) * SCROLL_EASE;

        var limX = window.innerWidth * 0.19;
        var limY = window.innerHeight * 0.08;

        posX = clamp(posX + shape(cmx) * SPEED_X, limX);
        posY = clamp(posY + shape(cmy) * SPEED_Y, limY);

        var y = posY + csy * SCROLL_Y;
        layer.style.transform =
            'translate3d(' + (-posX).toFixed(2) + 'px,' + (-y).toFixed(2) + 'px,0) scale(1.12)';
        if (mist) {
            mist.style.transform =
                'translate3d(' + (-posX * 0.6).toFixed(2) + 'px,' + (csy * 200).toFixed(2) + 'px,0)';
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();
