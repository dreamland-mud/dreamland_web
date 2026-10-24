/* Zone banners: the painted header art, one per area file in
   /maps/banners/<file>.are.jpg (not every zone has one). Paints it behind a
   .pagehead under the same darkening gradient, once the image has loaded, so
   a zone without art keeps what is there.

   A new banner arrives as ink on wet paper: a few blots bloom with ragged,
   bleeding edges and a darker wet rim, and the picture shows through them
   over whatever was there before. A canvas laid over the header does the
   blooming; when it is done the banner becomes the plain CSS background and
   the canvas goes. prefers-reduced-motion swaps it for an instant change. */
(function () {
    var SHADE = 'linear-gradient(180deg, rgba(13,11,18,.4), rgba(13,11,18,.92))';
    var DURATION = 3400;   // ms from the first drop to the whole picture
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function finish(el, url) {
        el.style.backgroundImage = SHADE + ', url("' + url + '")';
        el.classList.add('has-banner');
    }

    // A blot: a centre, a size it grows to, a delay, and a wobbly outline
    // (a few sine harmonics with random phases) so no two drops match.
    function makeBlots(w, h) {
        var blots = [], n = 6 + Math.floor(Math.random() * 3), i, k;
        var reach = Math.hypot(w, h);
        for (i = 0; i < n; i++) {
            var harm = [];
            for (k = 2; k <= 9; k++)
                harm.push({ k: k, a: (0.22 / k) * (0.5 + Math.random()), p: Math.random() * 6.283 });
            blots.push({
                x: w * (0.1 + 0.8 * Math.random()),
                y: h * (0.15 + 0.7 * Math.random()),
                r: reach * (0.22 + 0.22 * Math.random()),
                delay: i === 0 ? 0 : 0.08 + Math.random() * 0.5,
                harm: harm,
                // a little satellite spatter around the drop
                drops: Array.apply(null, Array(4)).map(function () {
                    return { a: Math.random() * 6.283, d: 0.6 + Math.random() * 0.7, s: 0.04 + Math.random() * 0.06 };
                })
            });
        }
        return blots;
    }

    function outline(ctx, b, R, t) {
        var steps = 72, i, j;
        ctx.moveTo(b.x + R, b.y);
        for (i = 0; i <= steps; i++) {
            var th = i / steps * 6.283, m = 1;
            // the edge keeps creeping as the wash spreads: phases drift with t
            for (j = 0; j < b.harm.length; j++)
                m += b.harm[j].a * Math.sin(b.harm[j].k * th + b.harm[j].p + t * 1.7);
            ctx.lineTo(b.x + Math.cos(th) * R * m, b.y + Math.sin(th) * R * m);
        }
        ctx.closePath();
    }

    // Soft-edged fill that works everywhere: draw the shape far off-canvas and
    // keep only its blurred shadow, shifted back into place.
    function softFill(ctx, draw, blur, colour) {
        ctx.save();
        ctx.shadowColor = colour;
        ctx.shadowBlur = blur;
        ctx.shadowOffsetX = 10000;
        // the shadow offset is in device pixels, the shift in user units
        ctx.translate(-10000 / ctx.getTransform().a, 0);
        ctx.fillStyle = colour;
        ctx.beginPath();
        draw();
        ctx.fill();
        ctx.restore();
    }

    // a drop lands, swells fast, then creeps as the paper drinks it
    function ease(x) { return 1 - Math.pow(1 - x, 2.2); }

    function bloom(el, img, url) {
        var box = el.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var w = Math.max(1, Math.round(box.width * dpr)), h = Math.max(1, Math.round(box.height * dpr));

        var cv = document.createElement('canvas');
        cv.className = 'zb-ink';
        cv.setAttribute('aria-hidden', 'true');
        cv.width = w; cv.height = h;
        var old = el.querySelector(':scope > .zb-ink');
        if (old) old.remove();
        el.insertBefore(cv, el.firstChild);
        var ctx = cv.getContext('2d');

        // the picture as the header shows it: cover, centred, 30% down
        var art = document.createElement('canvas');
        art.width = w; art.height = h;
        var a = art.getContext('2d');
        var s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        var iw = img.naturalWidth * s, ih = img.naturalHeight * s;
        a.drawImage(img, (w - iw) / 2, (h - ih) * 0.3, iw, ih);
        var g = a.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(13,11,18,.4)');
        g.addColorStop(1, 'rgba(13,11,18,.92)');
        a.fillStyle = g;
        a.fillRect(0, 0, w, h);

        // the mask runs at a third of the size: blurred fills are the costly
        // part, and scaling it up only softens the bleed further
        var q = 1 / 3, mw = Math.ceil(w * q), mh = Math.ceil(h * q);
        var mask = document.createElement('canvas');
        mask.width = mw; mask.height = mh;
        var m = mask.getContext('2d');

        var blots = makeBlots(w, h), t0 = null, edge = 18 * dpr * q;

        function frame(now) {
            if (!cv.isConnected) return;
            if (t0 === null) t0 = now;
            var t = Math.min(1, (now - t0) / DURATION);

            m.clearRect(0, 0, mw, mh);
            m.save();
            m.scale(q, q);
            blots.forEach(function (b) {
                var p = Math.max(0, (t - b.delay) / (1 - b.delay));
                if (p <= 0) return;
                var R = b.r * ease(p);
                softFill(m, function () { outline(m, b, R, t); }, edge, '#000');
                b.drops.forEach(function (d) {
                    var dr = R * d.s * 2;
                    softFill(m, function () {
                        m.arc(b.x + Math.cos(d.a) * R * d.d, b.y + Math.sin(d.a) * R * d.d, dr, 0, 6.283);
                    }, edge / 2, '#000');
                });
            });
            m.restore();

            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(art, 0, 0);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(mask, 0, 0, w, h);

            // the wet rim: pigment piles up at the edge of a spreading wash
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.45 * (1 - t);
            ctx.lineWidth = 6 * dpr;
            ctx.strokeStyle = 'rgba(48,30,12,1)';
            ctx.shadowColor = 'rgba(48,30,12,1)';
            ctx.shadowBlur = 10 * dpr;
            blots.forEach(function (b) {
                var p = Math.max(0, (t - b.delay) / (1 - b.delay));
                if (p <= 0) return;
                ctx.beginPath();
                outline(ctx, b, b.r * ease(p) * 0.97, t);
                ctx.stroke();
            });
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';

            if (t < 1) { requestAnimationFrame(frame); return; }
            finish(el, url);
            // let the CSS background settle under the canvas before it goes
            requestAnimationFrame(function () { cv.remove(); });
        }
        requestAnimationFrame(frame);
    }

    // file: an area file with or without ".are" ("midgaard" or "midgaard.are").
    // fallback: another zone's banner to show when this one has none.
    function apply(el, file, fallback) {
        if (!el) return;
        var want = file ? String(file).replace(/\.are$/, '') : '';
        el.setAttribute('data-banner', want);
        if (!want) { el.style.backgroundImage = ''; return; }
        var url = '/maps/banners/' + want + '.are.jpg';
        var img = new Image();
        img.onload = function () {
            // a later pick may have overtaken this one
            if (el.getAttribute('data-banner') !== want) return;
            if (still || !el.getBoundingClientRect().height) finish(el, url);
            else bloom(el, img, url);
        };
        img.onerror = function () {
            if (el.getAttribute('data-banner') !== want) return;
            var alt = fallback ? String(fallback).replace(/\.are$/, '') : '';
            if (alt && alt !== want) { apply(el, alt); return; }
            el.style.backgroundImage = '';
            el.classList.remove('has-banner');
        };
        img.src = url;
    }

    window.DLZoneBanner = { apply: apply };
})();
