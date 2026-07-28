/* Zone maps, drawn as SVG from the mapper's own graph data.
 *
 * The graphs already carry final layout coordinates, so nothing here solves a
 * layout -- it only draws. The geometry (tile pitch, ports, Manhattan routing,
 * warp arcs, z-shift) and the sector palette are ported from dreamland_mapper
 * so a zone looks the same here as it does in the in-game map panel. The one
 * deliberate difference: no React, no d3 -- this page has no build step.
 *
 * Rooms are drawn box-less, as mudjs does: the label IS the tile, coloured by
 * terrain. A map made of words suits a game made of words.
 */
(function () {
    'use strict';

    var L = function () { return document.documentElement.getAttribute('data-lang') === 'uk' ? 'ua' : 'en'; };

    // ---- geometry (dreamland_mapper: Map.tsx / render-svg.mjs) -------------
    var TILE_W = 124, TILE_H = 72, GAP_X = 74, GAP_Y = 70;
    var STEP_X = TILE_W + GAP_X, STEP_Y = TILE_H + GAP_Y;
    var EDGE_GAP = 7;
    var Z_SHIFT_X = STEP_X * 0.65, Z_SHIFT_Y = STEP_Y * 0.65;
    var REVERSE = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' };
    var DIR_DELTA = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0] };

    // ---- palette (dreamland_mapper/src/sectors.ts) -------------------------
    var SECTOR = {
        inside:       { text: '#d9b94a', en: 'Inside',        ua: 'Приміщення' },
        city:         { text: '#ffffff', en: 'City',          ua: 'Місто' },
        field:        { text: '#8ee34f', en: 'Field',         ua: 'Поле' },
        forest:       { text: '#6cba2e', en: 'Forest',        ua: 'Ліс' },
        hills:        { text: '#c4a000', en: 'Hills',         ua: 'Пагорби' },
        mountain:     { text: '#a7aaa3', en: 'Mountain',      ua: 'Гори' },
        water_swim:   { text: '#55a3f2', en: 'Water (swim)',  ua: 'Вода (вплав)' },
        water_noswim: { text: '#4a86d8', en: 'Water (deep)',  ua: 'Вода (глибоко)' },
        underwater:   { text: '#5a90d0', en: 'Underwater',    ua: 'Під водою' },
        air:          { text: '#7fc0ff', en: 'Air',           ua: 'Повітря' },
        desert:       { text: '#fdea56', en: 'Desert',        ua: 'Пустеля' },
        cave:         { text: '#a7aaa3', en: 'Cave',          ua: 'Печера' },
        jungle:       { text: '#45c9b0', en: 'Jungle',        ua: 'Джунглі' },
        tundra:       { text: '#e6e9e1', en: 'Tundra',        ua: 'Тундра' },
        unknown:      { text: '#a7aaa3', en: 'Unknown',       ua: 'Невідомо' }
    };
    var COLOR = { edge: '#888888', warp: '#d384cb', rust: '#cc0000', pick: '#ed2330',
                  crossArea: '#06989a', accent: '#bb86fc', ink: '#121212' };
    var EXIT_COLOR = { open: COLOR.edge, door_closed: COLOR.edge, door_locked: COLOR.rust,
                       door_pickproof: COLOR.pick, warp: COLOR.warp, random: COLOR.edge,
                       cross_area: COLOR.crossArea };
    var EXIT_DASH = { open: '', door_closed: '6 5', door_locked: '10 6', door_pickproof: '2 4',
                      warp: '3 5', random: '2 6', cross_area: '10 5' };

    var DIRNAME = {
        north: { en: 'north', ua: 'північ' }, south: { en: 'south', ua: 'південь' },
        east:  { en: 'east',  ua: 'схід' },   west:  { en: 'west',  ua: 'захід' },
        up:    { en: 'up',    ua: 'вгору' },  down:  { en: 'down',  ua: 'вниз' }
    };

    var UI = {
        locations:{ en: 'locations',    ua: 'локацій' },
        levels:   { en: 'levels',       ua: 'рівні' },
        layer:    { en: 'Level',        ua: 'Рівень' },
        ground:   { en: 'Ground',       ua: 'Земля' },
        exits:    { en: 'Exits',        ua: 'Виходи' },
        noExits:  { en: 'no exits',     ua: 'виходів немає' },
        toZone:   { en: 'to another zone', ua: 'в іншу зону' },
        nothing:  { en: 'Nothing found', ua: 'Нічого не знайдено' },
        bandPick: { en: 'Level range',  ua: 'Діапазон рівнів' },
        allZones: { en: 'zones',        ua: 'зон' },
        unnamed:  { en: 'unnamed room', ua: 'кімната без назви' },
        walk:     { en: 'How to get there', ua: 'Як дістатися' },
        searchHint:{ en: 'Search by zone name', ua: 'Пошук за назвою зони' },
        fullHelp: { en: 'Open in Help',  ua: 'Відкрити в довідці' },
        loading:  { en: 'Loading…',      ua: 'Вантажимо…' }
    };
    function t(k) { return UI[k][L()]; }

    var idxEl = document.getElementById('zoneList');
    var searchEl = document.getElementById('zoneSearch');
    var stageEl = document.getElementById('mapStage');
    var hintEl = document.getElementById('mapHint');
    var toolsEl = document.getElementById('maptools');
    var nameEl = document.getElementById('zoneName');
    var metaEl = document.getElementById('zoneMeta');
    var layersEl = document.getElementById('layers');
    var textEl = document.getElementById('mapText');
    var cardEl = document.getElementById('roomCard');
    var viewBtn = document.getElementById('viewToggle');
    var helpEl = document.getElementById('zoneHelp');

    var INDEX = [];
    var area = null;      // the loaded zone
    var zLayer = 0;
    var textMode = false;
    var selected = null;
    var view = { scale: 0.35, x: 0, y: 0 };   // mudjs opens at ~35%
    var extent = { w: 0, h: 0 };              // drawn size of the current layer, in px

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }
    function zoneName(z) { var l = L(); return (l === 'ua' ? z.nameUa : z.nameEn) || z.name; }
    function roomName(r) {
        if (!r) return '';
        var l = L();
        return (l === 'ua' ? r.nu : r.ne) || r.n || '';
    }
    function sectorOf(r) {
        if (!r) return SECTOR.unknown;
        var s = (r.f && r.f.indexOf('indoors') >= 0) ? 'inside' : r.s;
        return SECTOR[s] || SECTOR.unknown;
    }
    function sectorLabel(r) { var s = sectorOf(r); return s[L()]; }

    // ---- zone list --------------------------------------------------------
    // Bands are cut on the level a zone TOPS OUT at, so the list has to be
    // sorted by band first -- sorting by levelLow alone interleaves them and
    // the same heading reappears a dozen times down the rail.
    var BANDS = [
        { key: 0, max: 15,       en: 'Levels 1–15',  ua: 'Рівні 1–15' },
        { key: 1, max: 40,       en: 'Levels 16–40', ua: 'Рівні 16–40' },
        { key: 2, max: 70,       en: 'Levels 41–70', ua: 'Рівні 41–70' },
        { key: 3, max: Infinity, en: 'Levels 71+',   ua: 'Рівні 71+' }
    ];
    var SPECIAL = { key: 4, en: 'Special', ua: 'Особливі' };
    function levelBand(z) {
        if (!z.levelHigh) return SPECIAL;
        for (var i = 0; i < BANDS.length; i++) if (z.levelHigh <= BANDS[i].max) return BANDS[i];
        return SPECIAL;
    }
    // inside a band, plain alphabetical: you look a zone up by its name
    function bandSort(a, b) {
        var d = levelBand(a).key - levelBand(b).key;
        if (d) return d;
        return zoneName(a).localeCompare(zoneName(b), L() === 'ua' ? 'uk' : 'en');
    }
    function sortedZones(filter) {
        var q = (filter || '').trim().toLowerCase();
        return INDEX.filter(function (z) {
            if (!q) return true;
            return (z.name + ' ' + z.nameEn + ' ' + z.nameUa + ' ' + z.file).toLowerCase().indexOf(q) >= 0;
        }).sort(bandSort);
    }

    /* Under 900px the rail turns into one native <select>, the same device the
       help and news pages use: stacked, even five collapsed headings plus the
       open one pushed the map about 1700px down the page, so you scrolled past
       the whole rail to reach the thing you came for. Native on purpose -- a
       screen reader drives it unaided, and roughly a third of players are blind.
       The summary is hidden at that width, so nothing can toggle the details
       open and setBand has to do it. */
    var mqNarrow = window.matchMedia('(max-width: 900px)');
    var curBand = null;

    function setBand(key) {
        var bands = idxEl.querySelectorAll('details.zband');
        if (!bands.length) return;
        var hit = false, i;
        for (i = 0; i < bands.length; i++)
            if (bands[i].getAttribute('data-band') === key) hit = true;
        if (!hit) key = bands[0].getAttribute('data-band');
        for (i = 0; i < bands.length; i++) {
            var on = bands[i].getAttribute('data-band') === key;
            bands[i].classList.toggle('zband--active', on);
            if (mqNarrow.matches) bands[i].open = on;
        }
        curBand = key;
        var pick = document.getElementById('zoneBandPick');
        if (pick && pick.value !== key) pick.value = key;
    }

    mqNarrow.addEventListener('change', function () {
        // Leaving narrow hands the bands back to the desktop rule: shut, except
        // the one holding the zone on screen.
        if (mqNarrow.matches) setBand(curBand);
        else drawZoneList(searchEl ? searchEl.value : '');
    });

    /* Bands are collapsed on arrival except the one holding the current zone --
       156 zones is a rail nobody reads, five headings is a menu. A search opens
       every band it matched, since a hit inside a shut band reads as no hit. */
    function drawZoneList(filter) {
        var rows = sortedZones(filter);
        if (!rows.length) { idxEl.innerHTML = '<p class="zones__none">' + esc(t('nothing')) + '</p>'; return; }
        var searching = !!(filter || '').trim();
        var here = area ? area.meta.file : null;

        var groups = [], byKey = {};
        rows.forEach(function (z) {
            var b = levelBand(z);
            if (!byKey[b.key]) { byKey[b.key] = { band: b, items: [] }; groups.push(byKey[b.key]); }
            byKey[b.key].items.push(z);
        });

        var opts = '', wanted = null;
        var html = groups.map(function (g) {
            var key = String(g.band.key);
            var holdsCurrent = g.items.some(function (z) { return z.file === here; });
            if (holdsCurrent && wanted === null) wanted = key;
            opts += '<option value="' + key + '">' + esc(g.band[L()]) +
                ' (' + g.items.length + ')</option>';
            return '<details class="zband" data-band="' + key + '"' +
                (searching || holdsCurrent ? ' open' : '') + '><summary>' +
                '<span class="zband__name">' + esc(g.band[L()]) + '</span>' +
                '<span class="zband__n">' + g.items.length + '</span></summary>' +
                g.items.map(function (z) {
                    var lv = z.levelHigh ? z.levelLow + '–' + z.levelHigh : '';
                    return '<button type="button" class="zone' + (z.file === here ? ' zone--on' : '') +
                        '" data-zone="' + esc(z.file) + '">' +
                        '<span class="zone__name">' + esc(zoneName(z)) + '</span>' +
                        '<span class="zone__lv">' + esc(lv) + '</span></button>';
                }).join('') + '</details>';
        }).join('');

        idxEl.innerHTML = '<select class="catpick" id="zoneBandPick" aria-label="' +
            esc(t('bandPick')) + '">' + opts + '</select>' + html;
        var pick = document.getElementById('zoneBandPick');
        if (pick) pick.addEventListener('change', function () { setBand(pick.value); });
        // A search re-groups everything, so the band held before may be gone;
        // setBand falls back to the first one that survived.
        setBand(wanted !== null ? wanted : curBand);
    }

    // ---- geometry helpers -------------------------------------------------
    function screenOf(p, b) {
        return { sx: (p.x - b.minX) * STEP_X + p.z * Z_SHIFT_X,
                 sy: (b.maxY - p.y) * STEP_Y - p.z * Z_SHIFT_Y };
    }
    function port(cx, cy, hw, hh, dir) {
        if (dir === 'north') return [cx, cy - hh];
        if (dir === 'south') return [cx, cy + hh];
        if (dir === 'east') return [cx + hw, cy];
        if (dir === 'west') return [cx - hw, cy];
        return [cx, cy];
    }
    function facingDir(scx, scy, dcx, dcy) {
        var dx = scx - dcx, dy = scy - dcy;
        if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'east' : 'west';
        return dy > 0 ? 'south' : 'north';
    }
    function manhattan(scx, scy, shw, shh, dcx, dcy, dhw, dhh, dir, detour) {
        var LEAVE = 28, DETOUR = 78;
        var s = port(scx, scy, shw, shh, dir);
        var tdir = facingDir(scx, scy, dcx, dcy);
        var e = port(dcx, dcy, dhw, dhh, tdir);
        var dirX = dir === 'east' ? 1 : dir === 'west' ? -1 : 0;
        var dirY = dir === 'south' ? 1 : dir === 'north' ? -1 : 0;
        var p2x = s[0] + dirX * LEAVE, p2y = s[1] + dirY * LEAVE;
        var tX = tdir === 'east' ? 1 : tdir === 'west' ? -1 : 0;
        var tY = tdir === 'south' ? 1 : tdir === 'north' ? -1 : 0;
        var p3x = e[0] + tX * LEAVE, p3y = e[1] + tY * LEAVE;
        if (detour) {
            var lax = dirX !== 0 ? 0 : 1, lay = dirX !== 0 ? -1 : 0;
            return 'M' + s[0] + ',' + s[1] + ' L' + p2x + ',' + p2y +
                   ' L' + (p2x + lax * DETOUR) + ',' + (p2y + lay * DETOUR) +
                   ' L' + (p3x + lax * DETOUR) + ',' + (p3y + lay * DETOUR) +
                   ' L' + p3x + ',' + p3y + ' L' + e[0] + ',' + e[1];
        }
        var cx, cy;
        if (dirY !== 0) { cx = p3x; cy = p2y; } else { cx = p2x; cy = p3y; }
        return 'M' + s[0] + ',' + s[1] + ' L' + p2x + ',' + p2y + ' L' + cx + ',' + cy +
               ' L' + p3x + ',' + p3y + ' L' + e[0] + ',' + e[1];
    }
    function arc(cx1, cy1, hw, hh, cx2, cy2, dir) {
        var s = port(cx1, cy1, hw, hh, dir);
        var e = port(cx2, cy2, hw, hh, REVERSE[dir]);
        var ddx = e[0] - s[0], ddy = e[1] - s[1];
        var len = Math.hypot(ddx, ddy) || 1;
        var bow = Math.min(64, len * 0.3);
        return 'M' + s[0] + ',' + s[1] +
               ' Q' + ((s[0] + e[0]) / 2 + (-ddy / len) * bow) + ',' +
                      ((s[1] + e[1]) / 2 + (ddx / len) * bow) +
               ' ' + e[0] + ',' + e[1];
    }

    // an aligned edge with a tile sitting on the line has to route around it
    function obstructed(e, placedArr, placed) {
        var f = placed[e.from], tt = placed[e.to];
        if (!f || !tt || f.z !== tt.z) return false;
        var i, p;
        if (f.y === tt.y) {
            var lo = Math.min(f.x, tt.x), hi = Math.max(f.x, tt.x);
            for (i = 0; i < placedArr.length; i++) {
                p = placedArr[i];
                if (p.vnum !== e.from && p.vnum !== e.to && p.z === f.z && p.y === f.y && p.x > lo && p.x < hi) return true;
            }
        } else if (f.x === tt.x) {
            var lo2 = Math.min(f.y, tt.y), hi2 = Math.max(f.y, tt.y);
            for (i = 0; i < placedArr.length; i++) {
                p = placedArr[i];
                if (p.vnum !== e.from && p.vnum !== e.to && p.z === f.z && p.x === f.x && p.y > lo2 && p.y < hi2) return true;
            }
        }
        return false;
    }
    function aligned(e, placed) {
        var a = placed[e.from], b = placed[e.to];
        if (!a || !b || a.z !== b.z) return false;
        return (e.dir === 'east' || e.dir === 'west') ? a.y === b.y : a.x === b.x;
    }

    // ---- label fitting ----------------------------------------------------
    // Monospace, so width is countable: ~0.6em per char. Wrap to the tile, three
    // lines at most, and shrink a notch before giving up and clipping.
    function fitLabel(name) {
        var sizes = [14, 13, 12, 11];
        for (var i = 0; i < sizes.length; i++) {
            var fs = sizes[i];
            var per = Math.floor(TILE_W / (fs * 0.6));
            var lines = wrap(name, per);
            if (lines.length <= 3 && lines.every(function (l) { return l.length <= per; }))
                return { size: fs, lines: lines };
        }
        var per2 = Math.floor(TILE_W / (11 * 0.6));
        var l2 = wrap(name, per2).slice(0, 3);
        if (l2.length === 3) l2[2] = l2[2].slice(0, per2 - 1) + '…';
        return { size: 11, lines: l2 };
    }
    function wrap(s, per) {
        var words = String(s || '').split(/\s+/).filter(Boolean), out = [], cur = '';
        words.forEach(function (w) {
            if (!cur) { cur = w; return; }
            if ((cur + ' ' + w).length <= per) cur += ' ' + w;
            else { out.push(cur); cur = w; }
        });
        if (cur) out.push(cur);
        return out.length ? out : [''];
    }

    // ---- render -----------------------------------------------------------
    function render() {
        if (!area) return;
        if (textMode) { renderText(); return; }

        var b = area.bounds;
        var placed = area.placed;
        var onLayer = [];
        Object.keys(placed).forEach(function (v) {
            var p = placed[v];
            if (p.z === zLayer) onLayer.push({ vnum: +v, x: p.x, y: p.y, z: p.z, v: p.v });
        });

        if (!onLayer.length) { stageEl.innerHTML = '<p class="mapstage__hint">' + esc(t('nothing')) + '</p>'; return; }

        var minSX = Infinity, minSY = Infinity, maxSX = -Infinity, maxSY = -Infinity;
        onLayer.forEach(function (p) {
            var s = screenOf(p, b);
            minSX = Math.min(minSX, s.sx); minSY = Math.min(minSY, s.sy);
            maxSX = Math.max(maxSX, s.sx + TILE_W); maxSY = Math.max(maxSY, s.sy + TILE_H);
        });
        var PAD = 90;
        var W = maxSX - minSX + PAD * 2, H = maxSY - minSY + PAD * 2;
        var ox = PAD - minSX, oy = PAD - minSY;

        var placedArr = Object.keys(placed).map(function (v) {
            var p = placed[v]; return { vnum: +v, x: p.x, y: p.y, z: p.z };
        });

        var svg = [];
        // No viewBox on purpose. With one, the browser scales the whole zone to
        // the stage, and a 73-column zone like Midgaard becomes unreadable specks.
        // Without it, SVG units ARE CSS pixels and the pan/zoom transform is the
        // only scale -- so 0.35 means 0.35, exactly as the in-game map behaves.
        // centroid of the rooms, not the middle of the bounding box: a handful
        // of far-flung rooms stretch a zone's bounds across empty space, and
        // centring on that opens the map on nothing
        var cxs = 0, cys = 0;   // -> anchored to a real room just below
        onLayer.forEach(function (p) {
            var sc = screenOf(p, b);
            cxs += sc.sx + TILE_W / 2 + ox; cys += sc.sy + TILE_H / 2 + oy;
        });
        /* The opening view centres on the room NEAREST the centroid, not on the
           centroid itself. A zone strung out in a line -- Galeon is a ship, one
           room after another -- has its centroid in the gap between two rooms,
           and at reading zoom that gap fills the stage: a black rectangle with
           the map just off both edges. Anchoring on a real room cannot do that.
           cw/ch = the drawing without its breathing space: what Fit fits to. */
        var ccx = cxs / onLayer.length, ccy = cys / onLayer.length;
        var ax = ccx, ay = ccy, best = Infinity;
        onLayer.forEach(function (p) {
            var sc = screenOf(p, b);
            var rx = sc.sx + TILE_W / 2 + ox, ry = sc.sy + TILE_H / 2 + oy;
            var d = (rx - ccx) * (rx - ccx) + (ry - ccy) * (ry - ccy);
            if (d < best) { best = d; ax = rx; ay = ry; }
        });
        extent = { w: W, h: H, cw: W - PAD * 2, ch: H - PAD * 2, cx: ax, cy: ay };
        svg.push('<svg id="mapSvg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
                 esc(zoneName(area.meta)) + '">');
        svg.push('<g id="mapPan">');
        svg.push('<g transform="translate(' + ox + ',' + oy + ')">');

        var hw = TILE_W / 2 + EDGE_GAP, hh = TILE_H / 2 + EDGE_GAP;
        var edges = [];

        area.exits.forEach(function (e) {
            var fp = placed[e.from];
            if (!fp || fp.z !== zLayer) return;
            var fs = screenOf(fp, b);
            var cx1 = fs.sx + TILE_W / 2, cy1 = fs.sy + TILE_H / 2;

            if (e.style === 'cross_area') {
                var d = DIR_DELTA[e.dir];
                if (!d) return;
                edges.push('<line x1="' + cx1 + '" y1="' + cy1 + '" x2="' + (cx1 + d[0] * 62) +
                    '" y2="' + (cy1 - d[1] * 62) + '" stroke="' + COLOR.crossArea +
                    '" stroke-width="1.8" stroke-dasharray="' + EXIT_DASH.cross_area + '"/>');
                return;
            }
            var tp = placed[e.to];
            if (!tp || tp.z !== zLayer) {
                // a stair leaving this layer: stub it so the room does not look sealed
                if (e.dir === 'up' || e.dir === 'down') {
                    var vy = e.dir === 'up' ? -1 : 1;
                    edges.push('<line x1="' + cx1 + '" y1="' + (cy1 + vy * hh) + '" x2="' + cx1 +
                        '" y2="' + (cy1 + vy * (hh + 26)) + '" stroke="' +
                        (area.rooms[e.to] ? sectorOf(area.rooms[e.to]).text : COLOR.edge) +
                        '" stroke-width="2" stroke-dasharray="4 3" opacity=".85"/>');
                }
                return;
            }
            var ts = screenOf(tp, b);
            var cx2 = ts.sx + TILE_W / 2, cy2 = ts.sy + TILE_H / 2;

            if (e.dir === 'up' || e.dir === 'down') {
                edges.push('<line x1="' + cx1 + '" y1="' + cy1 + '" x2="' + cx2 + '" y2="' + cy2 +
                    '" stroke="' + sectorOf(area.rooms[e.to]).text +
                    '" stroke-width="2" stroke-dasharray="6 4" opacity=".85"/>');
                return;
            }
            if (e.style === 'warp') {
                edges.push('<path d="' + arc(cx1, cy1, hw, hh, cx2, cy2, e.dir) +
                    '" fill="none" stroke="' + COLOR.warp + '" stroke-width="1.6" stroke-dasharray="' +
                    EXIT_DASH.warp + '"/>');
                return;
            }
            var detour = obstructed(e, placedArr, placed);
            var col = e.hasSwim ? '#3465a4' : e.hasFly ? '#8ec5ff' : (EXIT_COLOR[e.style] || COLOR.edge);
            edges.push('<path d="' + manhattan(cx1, cy1, hw, hh, cx2, cy2, hw, hh, e.dir, detour) +
                '" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-linejoin="round"' +
                (EXIT_DASH[e.style] ? ' stroke-dasharray="' + EXIT_DASH[e.style] + '"' : '') + '/>');
        });
        svg.push('<g class="edges">' + edges.join('') + '</g>');

        onLayer.forEach(function (p) {
            var s = screenOf(p, b);
            var room = area.rooms[p.vnum];
            var cx = s.sx + TILE_W / 2, cy = s.sy + TILE_H / 2;
            var nm = roomName(room) || t('unnamed');
            var fit = fitLabel(nm);
            var lineH = fit.size * 1.15;
            var y0 = cy - (fit.lines.length - 1) * lineH / 2 + fit.size * 0.34;
            var col = p.v ? COLOR.rust : sectorOf(room).text;

            svg.push('<g class="room' + (selected === p.vnum ? ' room--on' : '') +
                '" data-vnum="' + p.vnum + '" tabindex="0" role="button" aria-label="' +
                esc(nm + ', ' + sectorLabel(room)) + '">');
            svg.push('<title>' + esc(nm) + ' -- ' + esc(sectorLabel(room)) + '</title>');
            // zoomed-out stand-in: the room as a terrain-coloured block, so the
            // shape of a zone reads even when its names cannot
            svg.push('<rect class="dot" x="' + s.sx + '" y="' + s.sy + '" width="' + TILE_W +
                '" height="' + TILE_H + '" rx="8" fill="' + col + '" opacity=".85"/>');
            if (selected === p.vnum)
                svg.push('<rect x="' + s.sx + '" y="' + s.sy + '" width="' + TILE_W + '" height="' +
                    TILE_H + '" rx="8" fill="' + COLOR.accent + '"/>');
            svg.push('<rect x="' + s.sx + '" y="' + s.sy + '" width="' + TILE_W + '" height="' +
                TILE_H + '" fill="transparent"/>');
            svg.push('<text class="lbl" x="' + cx + '" y="' + y0 + '" font-size="' + fit.size +
                '" text-anchor="middle" fill="' + (selected === p.vnum ? COLOR.ink : col) + '">' +
                fit.lines.map(function (ln, i) {
                    return '<tspan x="' + cx + '"' + (i ? ' dy="' + lineH + '"' : '') + '>' + esc(ln) + '</tspan>';
                }).join('') + '</text>');
            svg.push('</g>');
        });

        svg.push('</g></g></svg>');
        stageEl.innerHTML = svg.join('');
        applyView();
    }

    // ---- the accessible view ---------------------------------------------
    // ~30% of DreamLand's players use a screen reader, and a picture of a maze
    // is nothing to them. Same data, read as prose: every room and where its
    // exits go.
    function renderText() {
        var rows = [];
        var placed = area.placed;
        var vnums = Object.keys(placed).filter(function (v) { return placed[v].z === zLayer; })
            .map(Number).sort(function (a, b) { return a - b; });

        var byFrom = {};
        area.exits.forEach(function (e) {
            (byFrom[e.from] = byFrom[e.from] || []).push(e);
        });

        vnums.forEach(function (v) {
            var room = area.rooms[v];
            var ex = (byFrom[v] || []).map(function (e) {
                var d = DIRNAME[e.dir] ? DIRNAME[e.dir][L()] : e.dir;
                if (e.style === 'cross_area') return d + ' → ' + t('toZone');
                var tgt = area.rooms[e.to];
                return d + ' → ' + (roomName(tgt) || ('#' + e.to));
            });
            rows.push('<div class="trow"><h4>' + esc(roomName(room) || t('unnamed')) +
                ' <span class="trow__sec">' + esc(sectorLabel(room)) + '</span></h4>' +
                '<p>' + (ex.length ? esc(ex.join(' · ')) : '<em>' + esc(t('noExits')) + '</em>') + '</p></div>');
        });
        textEl.innerHTML = rows.join('');
    }

    // ---- pan / zoom -------------------------------------------------------
    var DETAIL_AT = 0.3;   // below this a 12px label renders under 4px -- a smudge
    function applyView() {
        var g = document.getElementById('mapPan');
        if (g) g.setAttribute('transform',
            'translate(' + view.x + ',' + view.y + ') scale(' + view.scale + ')');
        var svg = document.getElementById('mapSvg');
        if (svg) svg.classList.toggle('far', view.scale < DETAIL_AT);
    }
    /* The floor has to clear the widest zone's true fit scale (Midgaard needs
       0.05), or zooming out can no longer reach the whole of it -- and since Fit
       now stops at a legible scale, zooming out is the only way there. */
    /* Zoom about a point in stage coordinates, so whatever sits under the
       cursor or between two fingers stays put. The pan group is
       translate(view.x,view.y) scale(view.scale), so a stage point a maps from
       model point m as a = view.x + m*scale; holding a fixed across a scale
       change of f gives view.x' = a - (a - view.x)*f. */
    function zoomAt(f, ax, ay) {
        var s = Math.min(2.2, Math.max(0.04, view.scale * f));
        f = s / view.scale;              // the clamp changes the effective factor
        view.x = ax - (ax - view.x) * f;
        view.y = ay - (ay - view.y) * f;
        view.scale = s;
        applyView();
    }
    // The zoom buttons have no pointer to aim at, so they work off the middle.
    function zoomBy(f) {
        zoomAt(f, stageEl.clientWidth / 2, stageEl.clientHeight / 2);
    }
    /* Fit measures the drawing itself, not the 90px of padding around it, and
       then pushes a notch past that -- exact fit leaves the room names a hair
       too small to read, and reading them is the point.
       FIT_MIN is where that stops being a nudge and becomes a decision: a room
       label is 11-14px, so below ~0.5 it renders under 7px and the map turns to
       grit (which is why the renderer swaps in terrain blocks there at all).
       A zone too big to fit legibly therefore opens legible and partial rather
       than complete and unreadable -- zoom out is one click away, and the shape
       is what the blocks are for. FIT_MAX keeps a one-room zone from filling
       the stage with a single enormous tile. */
    var FIT_ZOOM = 1.08, FIT_MAX = 1.2, FIT_MIN = 0.5;
    function fitScale() {
        var box = stageEl.getBoundingClientRect();
        var w = extent.cw || extent.w, h = extent.ch || extent.h;
        if (!w || !h) return 1;
        var raw = Math.min((box.width - 16) / w, (box.height - 16) / h) * FIT_ZOOM;
        return Math.max(FIT_MIN, Math.min(raw, FIT_MAX));
    }
    function centre(scale, onCentroid) {
        var box = stageEl.getBoundingClientRect();
        view.scale = scale;
        if (onCentroid && extent.cx != null) {
            view.x = box.width / 2 - extent.cx * scale;
            view.y = box.height / 2 - extent.cy * scale;
        } else {
            view.x = (box.width - extent.w * scale) / 2;
            view.y = (box.height - extent.h * scale) / 2;
        }
    }
    // centred on the anchor room, not the bounding box -- see render()
    function fit() { centre(fitScale(), true); applyView(); }
    /* Opening view: Fit, every time. In the game you open the map AT a location,
       so mudjs starts zoomed in; a visitor here has no location, and starting at
       35% on a zone 70 tiles wide lands on an empty patch of it.
       A caveat that is data, not code: on the biggest zones Fit lands below the
       detail threshold, so the tiles render as terrain blocks and the names come
       back on the first zoom-in. A 12px label at 10% is not a label. */
    function openView() { fit(); }

    /* Pointer events rather than mouse ones: a single code path covers a mouse,
       a finger and a pen, and two live pointers give pinch-zoom. The stage also
       needs touch-action:none in the CSS -- without it the browser claims the
       gesture for page scrolling and the map never moves under a finger at all,
       which is exactly how this shipped. */
    var pointers = {};
    var drag = null;     // one pointer down: pan
    var pinch = null;    // two pointers down: pinch-zoom
    var moved = false;   // outlives pointerup so the click handler can see it

    function livePointers() {
        var out = [], id;
        for (id in pointers) out.push(pointers[id]);
        return out;
    }
    function stageXY(clientX, clientY) {
        var r = stageEl.getBoundingClientRect();
        return { x: clientX - r.left, y: clientY - r.top };
    }
    function pinchFrom(a, b) {
        var mid = stageXY((a.x + b.x) / 2, (a.y + b.y) / 2);
        return {
            dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
            mx: mid.x, my: mid.y
        };
    }

    stageEl.addEventListener('pointerdown', function (ev) {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        if (stageEl.setPointerCapture) stageEl.setPointerCapture(ev.pointerId);
        moved = false;
        var p = livePointers();
        if (p.length === 1) {
            drag = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
            pinch = null;
            stageEl.classList.add('mapstage--drag');
        } else if (p.length === 2) {
            drag = null;
            pinch = pinchFrom(p[0], p[1]);
        }
    });
    window.addEventListener('pointermove', function (ev) {
        if (!(ev.pointerId in pointers)) return;
        pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
        var p = livePointers();
        if (pinch && p.length >= 2) {
            // Two fingers both zoom and pan: the map should follow the hand.
            var now = pinchFrom(p[0], p[1]);
            view.x += now.mx - pinch.mx;
            view.y += now.my - pinch.my;
            zoomAt(now.dist / pinch.dist, now.mx, now.my);
            pinch = now;
            moved = true;
        } else if (drag) {
            var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
            view.x = drag.vx + dx; view.y = drag.vy + dy;
            applyView();
        }
    });
    function endPointer(ev) {
        if (!(ev.pointerId in pointers)) return;
        delete pointers[ev.pointerId];
        var p = livePointers();
        if (p.length < 2) pinch = null;
        if (p.length === 1) {
            // Lifting one of two fingers hands the gesture back to the other,
            // rebased on where the map is now -- otherwise it jumps.
            drag = { x: p[0].x, y: p[0].y, vx: view.x, vy: view.y };
        } else if (p.length === 0) {
            drag = null;
            stageEl.classList.remove('mapstage--drag');
        }
    }
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    /* Zoom follows the SIZE of the gesture, not the number of events. A wheel
       click sends one event of ~100px and a trackpad sends a stream of small
       ones; a fixed 12% per event made two fingers rocket through the whole
       zoom range. Same exponent for both, so a wheel notch still moves ~9%. */
    stageEl.addEventListener('wheel', function (ev) {
        if (!document.getElementById('mapSvg')) return;
        ev.preventDefault();
        var d = Math.max(-120, Math.min(120, ev.deltaY));
        var at = stageXY(ev.clientX, ev.clientY);
        zoomAt(Math.exp(-d * 0.00075), at.x, at.y);
    }, { passive: false });

    // ---- room selection ---------------------------------------------------
    function selectRoom(v) {
        selected = v;
        var room = area.rooms[v];
        if (!room) return;
        var ex = area.exits.filter(function (e) { return e.from === v; }).map(function (e) {
            var d = DIRNAME[e.dir] ? DIRNAME[e.dir][L()] : e.dir;
            if (e.style === 'cross_area') return '<li>' + esc(d) + ' <span>' + esc(t('toZone')) + '</span></li>';
            var tgt = area.rooms[e.to];
            return '<li>' + esc(d) + ' <span>' + esc(roomName(tgt) || ('#' + e.to)) + '</span></li>';
        });
        cardEl.innerHTML =
            '<button type="button" class="roomcard__x" id="roomClose" aria-label="Close">&times;</button>' +
            '<h3>' + esc(roomName(room) || t('unnamed')) + '</h3>' +
            '<p class="roomcard__sec">' + esc(sectorLabel(room)) + '</p>' +
            '<h5>' + esc(t('exits')) + '</h5>' +
            (ex.length ? '<ul class="roomcard__ex">' + ex.join('') + '</ul>'
                       : '<p class="roomcard__none">' + esc(t('noExits')) + '</p>');
        cardEl.hidden = false;
        render();
    }
    cardEl.addEventListener('click', function (ev) {
        if (ev.target.id === 'roomClose') { cardEl.hidden = true; selected = null; render(); }
    });
    stageEl.addEventListener('click', function (ev) {
        if (moved) return;   // a drag that ends over a room must not select it
        var g = ev.target.closest ? ev.target.closest('.room') : null;
        if (g) selectRoom(+g.getAttribute('data-vnum'));
    });
    stageEl.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        var g = ev.target.closest ? ev.target.closest('.room') : null;
        if (g) { ev.preventDefault(); selectRoom(+g.getAttribute('data-vnum')); }
    });

    // ---- layers + zone loading -------------------------------------------
    function drawLayers() {
        var zs = area.zLayers.slice().sort(function (a, b) { return b - a; });
        if (zs.length < 2) { layersEl.innerHTML = ''; return; }
        layersEl.innerHTML = zs.map(function (z) {
            var lbl = z === 0 ? t('ground') : (z > 0 ? '+' + z : String(z));
            return '<button type="button" class="layer' + (z === zLayer ? ' layer--on' : '') +
                '" data-z="' + z + '">' + esc(lbl) + '</button>';
        }).join('');
    }
    layersEl.addEventListener('click', function (ev) {
        var b = ev.target.closest('.layer');
        if (!b) return;
        zLayer = +b.getAttribute('data-z');
        selected = null; cardEl.hidden = true;
        drawLayers(); render(); openView();
    });

    function loadZone(file) {
        stageEl.innerHTML = '<p class="mapstage__hint">' + esc(t('loading')) + '</p>';
        return fetch('data/maps/' + file + '.json')
            .then(function (r) { return r.json(); })
            .then(function (a) {
                area = a;
                selected = null; cardEl.hidden = true;
                // open on the layer that holds the most rooms -- usually the ground
                var count = {};
                Object.keys(a.placed).forEach(function (v) {
                    var z = a.placed[v].z; count[z] = (count[z] || 0) + 1;
                });
                zLayer = +Object.keys(count).sort(function (x, y) { return count[y] - count[x]; })[0];
                toolsEl.hidden = false;
                if (hintEl) hintEl.remove();
                paintHeader();
                drawLayers();
                drawZoneList(searchEl.value);
                render();
                openView();
                loadZoneHelp(file);
                try { history.replaceState(null, '', '#' + file); } catch (e) {}
            });
    }

    function paintHeader() {
        var m = area.meta;
        nameEl.textContent = zoneName(m);
        var bits = [m.rooms + ' ' + t('locations')];
        if (m.levelHigh) bits.push(t('levels') + ' ' + m.levelLow + '–' + m.levelHigh);
        // the speedwalk is a compass path from Midgaard's Market Square; a few
        // zones carry prose there instead ("through a wandering portal")
        if (m.speedwalk) bits.push(t('walk') + ': ' + m.speedwalk);
        metaEl.textContent = bits.join(' · ');

        var ascii = document.getElementById('asciiLink');
        if (ascii) {
            ascii.hidden = !m.ascii;
            if (m.ascii) ascii.href = '/maps/' + m.file + '.html';
        }
    }

    // ---- the zone's own help article -------------------------------------
    // Same articles as the help browser, same renderer; 148 of 156 zones have
    // one. Cross-links inside it leave for help.html, since this is a sidebar.
    var zoneArticle = null;
    function loadZoneHelp(file) {
        if (!helpEl) return;
        fetch('data/zonehelp/' + file + '.json')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (a) {
                // a second click while this was in flight: don't paint the loser
                if (!area || area.meta.file !== file) return;
                /* The previous zone's article stays up until this one lands --
                   blanking it first would flash the column away and back, and
                   every such flip resizes the stage under the drawing. */
                var was = stageEl.getBoundingClientRect().width;
                zoneArticle = a || null;
                paintZoneHelp();
                if (Math.abs(stageEl.getBoundingClientRect().width - was) > 1) openView();
            })
            .catch(function () {});
    }
    function paintZoneHelp() {
        if (!helpEl) return;
        var a = zoneArticle;
        // an empty aside would still hold its 340px grid track open, so the
        // whole column is dropped for the 8 zones that have no article
        var wrap = document.getElementById('maps');
        if (wrap) wrap.classList.toggle('maps--noart', !a);
        if (!a) { helpEl.innerHTML = ''; return; }
        var l = L();
        var title = a.toc[l] || a.toc.ru || '';
        var body = a.text[l] || a.text.ru || '';
        helpEl.innerHTML =
            '<article class="hart">' +
                '<h1>' + esc(title) + '</h1>' +
                '<div class="hart__body">' + DLMarkup.render(body, { hrefBase: 'help.html' }) + '</div>' +
                '<a class="zonehelp__more" href="help.html#h' + a.id + '">' + esc(t('fullHelp')) + '</a>' +
            '</article>';
    }

    idxEl.addEventListener('click', function (ev) {
        var b = ev.target.closest('.zone');
        if (b) loadZone(b.getAttribute('data-zone'));
    });
    searchEl.addEventListener('input', function () { drawZoneList(searchEl.value); });

    document.getElementById('zoomIn').addEventListener('click', function () { zoomBy(1.25); });
    document.getElementById('zoomOut').addEventListener('click', function () { zoomBy(1 / 1.25); });
    document.getElementById('zoomFit').addEventListener('click', fit);

    viewBtn.addEventListener('click', function () {
        textMode = !textMode;
        viewBtn.setAttribute('aria-pressed', String(textMode));
        stageEl.hidden = textMode;
        textEl.hidden = !textMode;
        if (area) render();
    });

    // the placeholder is an attribute, so the dual-DOM trick can't carry it
    function paintChrome() { searchEl.setAttribute('placeholder', t('searchHint')); }

    // language flip: names, labels and the whole drawing are language-dependent
    document.querySelectorAll('[data-setlang]').forEach(function (b) {
        b.addEventListener('click', function () {
            setTimeout(function () {
                paintChrome();
                drawZoneList(searchEl.value);
                if (area) { paintHeader(); drawLayers(); render(); if (selected) selectRoom(selected); }
                paintZoneHelp();
            }, 0);
        });
    });

    paintChrome();
    fetch('data/maps-index.json')
        .then(function (r) { return r.json(); })
        .then(function (list) {
            INDEX = list;
            drawZoneList('');
            var want = (location.hash || '').replace('#', '');
            if (want && INDEX.some(function (z) { return z.file === want; })) loadZone(want);
            // nobody arrives wanting an empty stage: open the first zone listed
            else { var first = sortedZones('')[0]; if (first) loadZone(first.file); }
        });
})();
