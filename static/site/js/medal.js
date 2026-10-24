/* Achievement medal (Nirvana): an inline SVG coin.
   Rim: silver for common/rare, gold for epic/legendary, stone while locked.
   Rim ornament grows with the tier (plain, knurl + rivets, bevel + amethyst
   studs, engraved wave + beading + crest finials). A thin gold inner rim on
   every coin; a near-black disc; the tier's glow only behind the icon.
   A found secret hangs in a laurel with a clasp and a solid gold groove.
   The legendary orbit glow and the name colours live in theme.css (.ds-medal).
   Usage: DLMedal.svg(a) -> markup string; a = {tier, unlocked, secret, group,
   icon, progress:{have, need}}. DLMedal.defs() is called once by svg(). */
(function () {
    var TINT = { common: '#2fa36b', rare: '#4a74d4', epic: '#9159c8', legendary: '#e6cd86' };

    // Stand-in glyphs (24x24 strokes) for an achievement without its icon yet.
    var GLYPH = {
        quests: 'M7 4h10a2 2 0 0 1 2 2v11a3 3 0 0 0 3 3H9a2 2 0 0 1-2-2zM7 4a2 2 0 0 0-2 2v2h2M10 9h6M10 12h6M10 15h4',
        combat: 'M4 4l11 11M4 4h3l10 10M20 4L9 15M20 4h-3L7 14M6 16l2 2M3 21l3-3M18 16l-2 2M21 21l-3-3',
        life: 'M6 3h12M6 21h12M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9M10 18h4',
        craft: 'M3 20h14M5 20v-2h10v2M8 18v-3h4v3M12 3l6 6-3 3-6-6zM10.5 7.5L3 15',
        world: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM15.5 8.5l-2 5-5 2 2-5z',
        clans: 'M6 3v18M6 4h12l-3 4 3 4H6',
        classes: 'M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 8v8M9 11h6',
        titles: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5zM5 19h14',
        collection: 'M7 4h10l4 5-9 11L3 9zM3 9h18M10 4l2 16 2-16',
        secrets: 'M12 6a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4zM10.6 12L9 19h6l-1.6-7'
    };

    var DEFS = '<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute"><defs>' +
        grad('dlm-gold', ['#f6e3ab', '#e6cd86', '#c6a24e', '#7e6127', '#33250b'], [0, .22, .5, .78, 1]) +
        grad('dlm-silver', ['#f7f8fa', '#d3d7de', '#9aa1ac', '#5b616c', '#22252b'], [0, .22, .5, .78, 1]) +
        grad('dlm-dead', ['#4d4459', '#2b2338', '#131019'], [0, .5, 1]) +
        '<linearGradient id="dlm-leaf-gold" x1="0" y1="0" x2="1" y2="1">' + stops(['#fff2c4', '#e6cd86', '#b8973f', '#55411d'], [0, .35, .7, 1]) + '</linearGradient>' +
        '<linearGradient id="dlm-leaf-antique" x1="0" y1="0" x2="1" y2="1">' + stops(['#e6cd86', '#b8973f', '#7e6127', '#40300f'], [0, .4, .8, 1]) + '</linearGradient>' +
        '<linearGradient id="dlm-leaf-silver" x1="0" y1="0" x2="1" y2="1">' + stops(['#ffffff', '#d3d7de', '#8a919c', '#2a2e35'], [0, .35, .7, 1]) + '</linearGradient>' +
        '<radialGradient id="dlm-rivet" cx=".35" cy=".3" r=".8">' + stops(['#ffffff', '#9aa1ac', '#2a2e35'], [0, .6, 1]) + '</radialGradient>' +
        '<radialGradient id="dlm-berry" cx=".35" cy=".3" r=".8">' + stops(['#fff6d8', '#e6cd86', '#7e6127'], [0, .5, 1]) + '</radialGradient>' +
        '<radialGradient id="dlm-disc" cx=".5" cy=".4" r=".7">' + stops(['#0d0b12', '#050408', '#000'], [0, .75, 1]) + '</radialGradient>' +
        '<radialGradient id="dlm-vignette" cx=".5" cy=".5" r=".5"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>' +
        '<clipPath id="dlm-clip"><circle cx="50" cy="50" r="34.5"/></clipPath>' +
        '<filter id="dlm-bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>' +
        '<filter id="dlm-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
        '</defs></svg>';

    function stops(c, o) {
        return c.map(function (x, i) { return '<stop offset="' + o[i] + '" stop-color="' + x + '"/>'; }).join('');
    }
    function grad(id, c, o) {
        return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' + stops(c, o) + '</linearGradient>';
    }

    var injected = false;
    function defs() {
        if (injected) return;
        injected = true;
        var box = document.createElement('div');
        box.innerHTML = DEFS;
        document.body.insertBefore(box.firstChild, document.body.firstChild);
    }

    // Polar point: theta in degrees clockwise from the top, around the centre.
    function pt(th, r) { var a = th * Math.PI / 180; return [50 + r * Math.sin(a), 50 - r * Math.cos(a)]; }
    function f1(n) { return Math.round(n * 10) / 10; }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    // One almond leaf with a midrib, base at the origin, pointing up.
    function leaf(x, y, rot, len, fill) {
        var w = len * 0.36;
        return '<g transform="translate(' + f1(x) + ' ' + f1(y) + ') rotate(' + f1(rot) + ')">' +
            '<path d="M0 0C' + f1(w) + ' ' + f1(-len * .25) + ' ' + f1(w * .8) + ' ' + f1(-len * .75) + ' 0 ' + f1(-len) +
            'C' + f1(-w * .8) + ' ' + f1(-len * .75) + ' ' + f1(-w) + ' ' + f1(-len * .25) + ' 0 0Z" fill="url(#' + fill + ')" stroke="#241a08" stroke-width=".45"/>' +
            '<path d="M0 -.6L0 ' + f1(-len * .85) + '" stroke="#33250b" stroke-opacity=".55" stroke-width=".5"/></g>';
    }

    // A laurel branch hugging the rim from the bottom up one side (dir +1 left,
    // -1 right); leaves taper toward the tip, legendary ones carry berries.
    function branch(dir, n, span, len0, fill, berries) {
        var R = 48.5, th0 = 180 + dir * 7, th1 = th0 + dir * span, s = '', i;
        var a = pt(th0, R), b = pt(th1, R);
        s += '<path d="M' + f1(a[0]) + ' ' + f1(a[1]) + 'A' + R + ' ' + R + ' 0 0 ' + (dir > 0 ? 1 : 0) + ' ' + f1(b[0]) + ' ' + f1(b[1]) +
            '" fill="none" stroke="url(#' + fill + ')" stroke-width="1.3" stroke-linecap="round"/>';
        for (i = 0; i < n; i++) {
            var k = i / (n - 1), th = th0 + dir * span * k, p = pt(th, R), len = len0 * (1 - k * .5);
            s += leaf(p[0], p[1], th + dir * 52, len, fill);
            if (i < n - 1) s += leaf(p[0], p[1], th + dir * 128, len * .82, fill);
            if (berries && i % 2 === 1 && i < n - 1) {
                var q = pt(th + dir * 4, R + 6.5);
                s += '<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="1.7" fill="url(#dlm-berry)" stroke="#241a08" stroke-width=".35"/>';
            }
        }
        return s + leaf(b[0], b[1], th1 + dir * 90, len0 * .55, fill);
    }

    // The clasp under the jewel where both branches end: two volutes and a
    // pointed drop set with a small arcane stone.
    function clasp(fill) {
        var vol = 'M0-1C-4-1.5-9.5 0-10.5 4.5C-11.3 8.5-7.2 10.2-5.6 7.6C-4.6 5.8-6.6 4.4-7.6 5.8';
        return '<g transform="translate(50 103)" fill="none" stroke="url(#' + fill + ')" stroke-width="1.7" stroke-linecap="round">' +
            '<path d="' + vol + '"/><path d="' + vol + '" transform="scale(-1 1)"/><path d="M-5-1.5Q0 1 5-1.5" stroke-width="1.2"/></g>' +
            '<g transform="translate(50 103)"><path d="M0-3L3.4 2.5L0 13L-3.4 2.5Z" fill="url(#' + fill + ')" stroke="#241a08" stroke-width=".5"/>' +
            '<path d="M0-2.4L0 12" stroke="#fff6d8" stroke-opacity=".35" stroke-width=".5"/>' +
            '<circle cy="2.6" r="1.9" fill="#bb86fc" stroke="#241a08" stroke-width=".4"/><circle cx="-.6" cy="2" r=".6" fill="#fff" opacity=".7"/>' +
            '<path d="M0 13L0 17" stroke="url(#' + fill + ')" stroke-width="1" stroke-linecap="round"/></g>';
    }

    function rimDetail(tier, won, secret) {
        var gold = tier === 'epic' || tier === 'legendary';
        var dark = won ? (gold ? '#33250b' : '#2a2e35') : '#131019';
        var hi = won ? '#fff6d8' : '#4d4459', s = '', i, p;
        if (secret) s += '<circle cx="50" cy="50" r="41" fill="none" stroke="url(#dlm-gold)" stroke-width="2.6"/>';
        else if (tier !== 'common') s += '<circle cx="50" cy="50" r="41.2" fill="none" stroke="' + dark + '" stroke-width="1.6" stroke-dasharray=".9 1.9"/>';
        if (tier === 'rare') {
            for (i = 0; i < 8; i++) {
                p = pt(i * 45 + 22.5, 42.6);
                s += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="1.25" fill="url(#' + (won ? 'dlm-rivet' : 'dlm-dead') + ')" stroke="' + dark + '" stroke-width=".3"/>';
            }
        }
        if (gold) {
            s += '<circle cx="50" cy="50" r="43.3" fill="none" stroke="' + hi + '" stroke-opacity=".4" stroke-width=".5"/>';
            s += '<circle cx="50" cy="50" r="39.7" fill="none" stroke="' + dark + '" stroke-width=".7"/>';
        }
        if (tier === 'epic') {
            for (i = 0; i < 12; i++) {
                if (i === 6) continue;
                p = pt(i * 30, 42.4);
                s += '<rect x="-1.9" y="-1.9" width="3.8" height="3.8" transform="translate(' + f1(p[0]) + ' ' + f1(p[1]) + ') rotate(' + (i * 30 + 45) + ')" fill="' + (won ? '#b48ae6' : '#2b2338') + '" stroke="' + dark + '" stroke-width=".5"/>';
            }
        }
        if (tier === 'legendary') {
            var d = '';
            for (i = 0; i <= 180; i++) {
                p = pt(i * 2, 41.4 + 1.1 * Math.sin(i * 2 * Math.PI / 7.5));
                d += (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1]);
            }
            s += '<path d="' + d + 'Z" fill="none" stroke="' + dark + '" stroke-width=".7"/>';
            for (i = 0; i < 60; i++) {
                p = pt(i * 6 + 3, 43.6);
                s += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r=".55" fill="' + hi + '" opacity=".75"/>';
            }
            [0, 90, 270].forEach(function (th) {
                s += '<g transform="rotate(' + th + ' 50 50)">' +
                    '<path d="M50 -4.5C52.2 -1 54.5 1.5 57 3.5C54.5 4.5 52.5 5 50 7C47.5 5 45.5 4.5 43 3.5C45.5 1.5 47.8 -1 50 -4.5Z" fill="url(#' + (won ? 'dlm-gold' : 'dlm-dead') + ')" stroke="' + dark + '" stroke-width=".6"/>' +
                    '<path d="M45.5 3.3Q50 1.2 54.5 3.3" fill="none" stroke="' + dark + '" stroke-width=".5"/>' +
                    '<circle cx="50" cy="1" r="1.5" fill="' + (won ? '#bb86fc' : '#2b2338') + '" stroke="' + dark + '" stroke-width=".4"/></g>';
            });
        }
        return s;
    }

    function svg(a) {
        defs();
        var tier = TINT[a.tier] ? a.tier : 'common', t = TINT[tier], won = !!a.unlocked;
        var gold = tier === 'epic' || tier === 'legendary', secret = won && !!a.secret, s = '';
        s += '<svg class="ds-medal__coin" viewBox="-14 -14 128 136" aria-hidden="true" focusable="false">';
        if (secret) {
            var lf = gold ? (tier === 'legendary' ? 'dlm-leaf-gold' : 'dlm-leaf-antique') : 'dlm-leaf-silver', big = tier === 'legendary';
            s += branch(1, big ? 11 : 8, big ? 128 : 100, big ? 10 : 9, lf, big);
            s += branch(-1, big ? 11 : 8, big ? 128 : 100, big ? 10 : 9, lf, big);
        }
        s += '<circle cx="50" cy="50" r="44" fill="url(#' + (won ? (gold ? 'dlm-gold' : 'dlm-silver') : 'dlm-dead') + ')" stroke="#0d0b12" stroke-width=".8"/>';
        s += rimDetail(tier, won, secret);
        s += '<circle cx="50" cy="50" r="37.6" fill="none" stroke="url(#' + (won ? 'dlm-gold' : 'dlm-dead') + ')" stroke-width="' + (secret ? 3.6 : 2.6) + '"/>';
        s += '<circle cx="50" cy="50" r="36.2" fill="url(#dlm-disc)"/>';
        s += '<circle cx="50" cy="50" r="17" fill="' + (won ? t : '#3a3049') + '" opacity="' + (won ? .42 : .15) + '" filter="url(#dlm-bloom)"/>';
        if (a.icon) {
            s += '<image href="' + esc(a.icon) + '" x="16" y="16" width="68" height="68" clip-path="url(#dlm-clip)" style="mix-blend-mode:screen' +
                (won ? '' : ';filter:grayscale(1) brightness(.55)') + '"/>';
        } else {
            s += '<g transform="translate(32 32) scale(1.5)" fill="none" stroke="' + (won ? '#e6cd86' : '#6f6857') + '" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" filter="url(#dlm-soft)">' +
                '<path d="' + (GLYPH[a.group] || GLYPH.collection) + '"/></g>';
        }
        s += '<circle cx="50" cy="50" r="36.2" fill="url(#dlm-vignette)"/>';
        s += '<use href="#dl-gem" x="42" y="85" width="16" height="16" style="color:' + (won ? t : '#3a3049') + '"/>';
        if (secret) s += clasp(gold ? 'dlm-leaf-gold' : 'dlm-leaf-silver');
        if (!won && a.progress && a.progress.need > 0) {
            var c = 2 * Math.PI * 47.5, f = Math.min(1, a.progress.have / a.progress.need);
            s += '<circle cx="50" cy="50" r="47.5" fill="none" stroke="#201a2b" stroke-width="3"/>';
            s += '<circle cx="50" cy="50" r="47.5" fill="none" stroke="#c6a24e" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + f1(c * f) + ' ' + f1(c) + '" transform="rotate(-90 50 50)"/>';
        }
        return s + '</svg>';
    }

    window.DLMedal = { svg: svg, defs: defs };
})();
