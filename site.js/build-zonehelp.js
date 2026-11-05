#!/usr/bin/env node
/* Cut the per-zone help article out of the help dump, one small file per zone,
 * so the maps page can show a zone's article beside its map without pulling the
 * whole 2 MB help body.
 *
 *   data/helps.raw.json + area files  ->  data/zonehelp/<area-file>.json
 *
 * A zone's article is the help the game labels 'area' (AreaHelp::selfHelp) among
 * the helps that area file carries in its <helps> section. The help dump does not
 * name the area file, so the ids are read from the area XML itself.
 * (156 zones exist; the few without an article are system/hidden ones.)
 *
 * usage: node site.js/build-zonehelp.js [helps.json] [areas dir]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../static');
const RAW = process.argv[2] || path.join(ROOT, 'data/helps.raw.json');
const AREAS = process.argv[3] || path.resolve(__dirname, '../../dreamland_areas');
const OUT = path.join(ROOT, 'data/zonehelp');
// Fewer than this means the dump or the area files are not what we think: keep
// the old files rather than wipe the sidebar for every zone.
const MIN_ZONES = 100;

for (const p of [RAW, AREAS]) {
    if (!fs.existsSync(p)) {
        console.error('not found: ' + p);
        process.exit(1);
    }
}

// help id -> area file, from each area's <helps> section
const fileOf = new Map();
for (const f of fs.readdirSync(AREAS)) {
    if (!f.endsWith('.are.xml')) continue;
    const xml = fs.readFileSync(path.join(AREAS, f), 'utf8');
    const block = /<helps>([\s\S]*?)<\/helps>/.exec(xml);
    if (!block) continue;
    for (const m of block[1].matchAll(/<node id="(\d+)"/g))
        fileOf.set(Number(m[1]), f.replace(/\.are\.xml$/, ''));
}

const helps = JSON.parse(fs.readFileSync(RAW, 'utf8'));
const articles = new Map();
for (const a of helps) {
    const file = fileOf.get(Number(a.id));
    if (!file || !(a.labels || []).includes('area')) continue;
    articles.set(file, JSON.stringify({
        id: a.id,
        toc: { ru: a.toc || '', en: a.tocEn || '', ua: a.tocUa || '' },
        text: { ru: a.text || '', en: a.textEn || '', ua: a.textUa || '' }
    }));
}

if (articles.size < MIN_ZONES) {
    console.error(`only ${articles.size} zone articles found, kept the old ${OUT}`);
    process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT, f));
let n = 0, bytes = 0;
for (const [file, out] of articles) {
    fs.writeFileSync(path.join(OUT, file + '.json'), out);
    n++; bytes += out.length;
}

console.log(`${n} zone articles · ${(bytes / 1024).toFixed(0)} KB total, ` +
            `${(bytes / n / 1024).toFixed(1)} KB each`);

// a zone whose article went missing just shows no sidebar, but say so out loud
const idxPath = path.join(ROOT, 'data/maps-index.json');
if (fs.existsSync(idxPath)) {
    const zones = JSON.parse(fs.readFileSync(idxPath, 'utf8')).map(z => z.file);
    const missing = zones.filter(f => !fs.existsSync(path.join(OUT, f + '.json')));
    if (missing.length) console.log(`${missing.length} zones without an article: ` + missing.join(' '));
}
