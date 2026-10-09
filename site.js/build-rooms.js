#!/usr/bin/env node
/* Pick real rooms for the homepage "One world" block: rooms that have at least
 * one mob and one item on the floor by their resets, with everything readable
 * in English, Ukrainian and Russian.
 *
 *   dreamland_areas/*.are.xml  ->  static/data/rooms/index.json  (room count)
 *                                   static/data/rooms/<n>.json  (one room each)
 *
 * One small file per room so the homepage fetches ~2 KB, not the whole pool.
 *
 * A room makes the cut when:
 *   - its resets load a mob AND drop an object on the floor;
 *   - it isn't a deathtrap, god-only, no_mob, private or nowhere room;
 *   - name, description, every mob's long_descr and every dropped object's
 *     description exist in all three languages;
 *   - the text carries no mudtags beyond plain colour codes (links, gender and
 *     language tags would need the game's renderer);
 *   - the English description is long enough to be worth reading.
 *
 * Runs on every deploy (.drone.yml update_site_data) against the live area files.
 *
 * usage: node site.js/build-rooms.js [path/to/dreamland_areas]
 */
const fs = require('fs');
const path = require('path');

const AREAS = path.resolve(process.argv[2] || path.join(__dirname, '../../dreamland_areas'));
const OUT = path.resolve(__dirname, '../static/data/rooms');
const LANGS = ['en', 'ua', 'ru'];
const MIN_DESC = 200;
// real-world religious satire: fine in the game, not as a random homepage sample
const SKIP_AREAS = new Set(['armagddn']);
const BAD_ROOM = /\b(death|gods_only|imp_only|heroes_only|no_mob|private|nowhere|system)\b/;

// Just enough XML for the area files: elements, attributes, text. No DTDs, no CDATA.
function parse(src) {
    const root = { tag: '#root', attrs: {}, kids: [], text: '' };
    const stack = [root];
    const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([\w:-]+)\s*>|<([\w:-]+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(src))) {
        const top = stack[stack.length - 1];
        if (m[1]) { stack.pop(); continue; }
        if (m[2]) {
            const attrs = {};
            m[3].replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, (_, k, v) => { attrs[k] = unescape(v); });
            const el = { tag: m[2], attrs, kids: [], text: '' };
            top.kids.push(el);
            if (!m[4]) stack.push(el);
            continue;
        }
        if (m[5]) top.text += unescape(m[5]);
    }
    return root;
}

function unescape(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

const child = (el, tag) => el && el.kids.find(k => k.tag === tag);

// <tag l="en">..</tag> x3 -> {en, ua, ru}, or null if any language is missing or unusable
function multi(el, tag) {
    if (!el) return null;
    const out = {};
    for (const k of el.kids) {
        if (k.tag === tag && LANGS.includes(k.attrs.l)) out[k.attrs.l] = clean(k.text);
    }
    return LANGS.every(l => out[l]) ? out : null;
}

function clean(s) {
    s = String(s || '').trim();
    if (!s) return '';
    // links, gender, language and pronoun tags need the game to render them
    if (/\{[hlnsSIi]|\$|%/.test(s)) return '';
    return s.replace(/\{\{/g, '\u0000').replace(/\{./g, '').replace(/\u0000/g, '{')
        .replace(/[ \t]*\n[ \t]*/g, ' ').replace(/ {2,}/g, ' ').trim();
}

const files = fs.readdirSync(AREAS).filter(f => f.endsWith('.are.xml')).sort();
const mobs = {}, objs = {}, rooms = [];

for (const f of files) {
    if (SKIP_AREAS.has(f.replace(/\.are\.xml$/, ''))) continue;
    const area = child(parse(fs.readFileSync(path.join(AREAS, f), 'utf8')), 'area');
    if (!area) continue;
    const ad = child(area, 'areadata');
    const areaFlags = (child(ad, 'flags') || {}).text || '';
    for (const m of (child(area, 'mobiles') || { kids: [] }).kids) mobs[m.attrs.name] = multi(m, 'long_descr');
    for (const o of (child(area, 'objects') || { kids: [] }).kids) objs[o.attrs.name] = multi(o, 'description');
    if (BAD_ROOM.test(areaFlags)) continue;
    for (const r of (child(area, 'rooms') || { kids: [] }).kids) rooms.push({ f, r });
}

const out = [];
for (const { f, r } of rooms) {
    const resets = child(r, 'resets');
    if (!resets || BAD_ROOM.test((child(r, 'flags') || {}).text || '')) continue;
    const mv = [...new Set(resets.kids.filter(k => k.tag === 'mob').map(k => k.attrs.vnum))];
    const ov = [...new Set(resets.kids.filter(k => k.tag === 'drop').map(k => k.attrs.vnum))];
    if (!mv.length || !ov.length) continue;
    const name = multi(r, 'name'), desc = multi(r, 'description');
    const things = ov.map(v => objs[v]), people = mv.map(v => mobs[v]);
    if (!name || !desc || things.some(x => !x) || people.some(x => !x)) continue;
    if (desc.en.length < MIN_DESC) continue;
    out.push({ vnum: +r.attrs.name, area: f.replace(/\.are\.xml$/, ''), name, desc, objs: things, mobs: people });
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json')) fs.unlinkSync(path.join(OUT, f));
out.forEach((room, i) => fs.writeFileSync(path.join(OUT, i + '.json'), JSON.stringify(room)));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ count: out.length }));
console.log(`${out.length} rooms from ${files.length} areas -> ${path.relative(process.cwd(), OUT)}/`);
