#!/usr/bin/env node
/* Cut the per-zone help article out of the help dump, one small file per zone,
 * so the maps page can show a zone's article beside its map without pulling the
 * whole 2 MB help body.
 *
 *   data/helps.raw.json  ->  data/zonehelp/<area-file>.json   (148 zones)
 *
 * The link between a help article and an area file is the [map=<file>.are]
 * marker the game itself writes into the article body — the only field that
 * names the area file, and present in every one of the 148 zone articles.
 * (156 zones exist; the 8 without an article are system/hidden ones.)
 *
 * usage: node site.js/build-zonehelp.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../static');
const RAW = process.argv[2] || path.join(ROOT, 'data/helps.raw.json');
const OUT = path.join(ROOT, 'data/zonehelp');

if (!fs.existsSync(RAW)) {
    console.error('no help dump at ' + RAW);
    process.exit(1);
}

const helps = JSON.parse(fs.readFileSync(RAW, 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT, f));

const MARK = /\[map=([^\]]+)\]/;
// the marker is an instruction to the in-game client, not prose — strip it
const strip = s => String(s || '').replace(/\[map=[^\]]+\]/g, '');

let n = 0, bytes = 0;
for (const a of helps) {
    const hit = MARK.exec(a.text || '') || MARK.exec(a.textEn || '') || MARK.exec(a.textUa || '');
    if (!hit) continue;
    const file = hit[1].replace(/\.are$/, '');
    const out = JSON.stringify({
        id: a.id,
        toc: { ru: a.toc || '', en: a.tocEn || '', ua: a.tocUa || '' },
        text: { ru: strip(a.text), en: strip(a.textEn), ua: strip(a.textUa) }
    });
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
