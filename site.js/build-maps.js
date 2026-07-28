#!/usr/bin/env node
/* Slim the mapper's area graphs down to what a map actually needs to draw.
 *
 *   dreamland_mapper/public/data/area-*.json   (156 files, ~17 MB)
 *     -> data/maps/<file>.json                 (one per zone, 2-6 KB gzipped)
 *     -> data/maps-index.json                  (the zone picker)
 *
 * The graphs already carry FINAL layout coordinates (`placed`), so the site
 * never runs the 800-line layout solver -- it only draws. What it does not need
 * is the room descriptions, and those are most of the weight: dropping them
 * (all three languages) takes the set from 17 MB to ~3.6 MB.
 *
 * Room and zone names are kept in all three languages -- the mapper's own build
 * already extracts them (99% of 9744 rooms have EN and UA).
 *
 * usage: node site.js/build-maps.js [path-to-mapper-data]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../static');
const SRC = process.argv[2] ||
    path.resolve(ROOT, '../../dreamland_mapper/public/data');
const OUT = path.join(ROOT, 'data/maps');

if (!fs.existsSync(SRC)) {
    console.error('no mapper data at ' + SRC);
    console.error('pass the path as an argument, or regenerate it with');
    console.error('  cd dreamland_mapper && npm run build:graph');
    process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT, f));

/* The old site drew every zone as an ASCII map, and those pages are still up at
   /maps/<file>.html. 140 of the 156 zones have one; the map page offers the link
   only where it exists, so nobody is sent to a 404. Read the generator's own
   input directory rather than its output: sources/ is committed, while the
   rendered pages only exist after website.js has run. */
const ASCII_SRC = process.env.DL_WEB_MAPS || path.join(ROOT, 'maps/sources');
const hasAscii = fs.existsSync(ASCII_SRC)
    ? new Set(fs.readdirSync(ASCII_SRC).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5)))
    : null;
if (!hasAscii) console.error('no ASCII map sources at ' + ASCII_SRC + ' -- ASCII links skipped');

const files = fs.readdirSync(SRC).filter(f => /^area-.*\.json$/.test(f)).sort();
const index = [];
let bytesIn = 0, bytesOut = 0, roomTotal = 0;

for (const f of files) {
    const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
    bytesIn += raw.length;
    const g = JSON.parse(raw);
    const m = g.meta || {};
    const mi = m.i18n || {};

    const rooms = {};
    for (const [vnum, r] of Object.entries(g.rooms || {})) {
        const i = r.i18n || {};
        rooms[vnum] = {
            n:  r.name || '',
            ne: (i.en || {}).name || '',
            nu: (i.ua || {}).name || '',
            s:  r.sector || 'unknown',
            f:  r.flags || [],
        };
    }

    // keep only the placement fields the renderer reads
    const placed = {};
    for (const [vnum, p] of Object.entries(g.placed || {})) {
        placed[vnum] = p.isVoid ? { x: p.x, y: p.y, z: p.z, v: 1 }
                                : { x: p.x, y: p.y, z: p.z };
    }

    const meta = {
        file: m.file || f.replace(/^area-|\.json$/g, ''),
        name: m.name || '',
        nameEn: (mi.en || {}).name || '',
        nameUa: (mi.ua || {}).name || '',
        levelLow: m.levelLow, levelHigh: m.levelHigh,
        authors: m.authors || '',
        flags: m.flags || [],
        // Most speedwalks are a compass path and read the same everywhere, but
        // 30 are a sentence, so they localize like a name does.
        speedwalk: m.speedwalk || '',
        speedwalkEn: (mi.en || {}).speedwalk || '',
        speedwalkUa: (mi.ua || {}).speedwalk || '',
        rooms: Object.keys(rooms).length,
        ascii: hasAscii ? hasAscii.has(m.file || f.replace(/^area-|\.json$/g, '')) : false,
    };

    const slim = {
        meta,
        rooms,
        placed,
        exits: g.exits || [],
        zLayers: g.zLayers || [0],
        bounds: g.bounds,
    };

    const out = JSON.stringify(slim);
    bytesOut += out.length;
    roomTotal += meta.rooms;
    fs.writeFileSync(path.join(OUT, meta.file + '.json'), out);

    index.push({
        file: meta.file, name: meta.name, nameEn: meta.nameEn, nameUa: meta.nameUa,
        levelLow: meta.levelLow, levelHigh: meta.levelHigh,
        rooms: meta.rooms, flags: meta.flags, speedwalk: meta.speedwalk,
        speedwalkEn: meta.speedwalkEn, speedwalkUa: meta.speedwalkUa,
        ascii: meta.ascii, layers: slim.zLayers.length,
    });
}

// sort by the level a player meets the zone at, then by name -- the picker
// groups by level band and that is the order players think in
index.sort((a, b) => (a.levelLow - b.levelLow) || a.name.localeCompare(b.name, 'ru'));
fs.writeFileSync(path.join(ROOT, 'data/maps-index.json'), JSON.stringify(index));

const mb = n => (n / 1e6).toFixed(1) + ' MB';
console.log(`${files.length} zones · ${roomTotal} rooms`);
console.log(`${mb(bytesIn)} -> ${mb(bytesOut)}  (${(100 - bytesOut / bytesIn * 100).toFixed(0)}% smaller)`);
console.log('index         ' + (fs.statSync(path.join(ROOT, 'data/maps-index.json')).size / 1024).toFixed(0) + ' KB');
