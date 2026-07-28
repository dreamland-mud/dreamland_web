#!/usr/bin/env node
/* Split the game's help dump into what the site actually loads.
 *
 *   data/helps.raw.json  (from live /tmp/helps.json)
 *     -> data/help-index.json     ids, keywords, labels, titles   (always loaded)
 *     -> data/help-body-ru.json   id -> raw article text          (the base)
 *     -> data/help-body-<l>.json  id -> text, ONLY where it differs from Russian
 *
 * EN/UA are overlays, not copies: until an article is actually translated its
 * text is byte-identical to the Russian, and shipping three identical 2.5 MB
 * files would be silly. They start near-empty and grow as translation lands.
 *
 * Bodies stay raw here on purpose: js/help.js renders one article at a time and
 * does the <c>/<hh>/<hc> transform then, so a language switch never needs a
 * rebuild. Articles whose EN/UA text is still missing fall back to Russian,
 * which is what the dump itself does.
 *
 * usage: node site.js/build-help.js [path-to-helps.json]
 *
 * On the server the dump is read straight from /tmp/helps.json, which the game
 * rewrites hourly and on boot -- there is no intermediate copy to keep in sync.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../static');
const RAW = process.argv[2] || path.join(ROOT, 'data/helps.raw.json');

if (!fs.existsSync(RAW)) {
    console.error('no help dump at ' + RAW);
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));

const LANGS = [
    { key: 'ru', text: 'text',   title: 'title',   toc: 'toc'   },
    { key: 'en', text: 'textEn', title: 'titleEn', toc: 'tocEn' },
    { key: 'ua', text: 'textUa', title: 'titleUa', toc: 'tocUa' },
];

const index = [];
const bodies = { ru: {}, en: {}, ua: {} };
const stats = { total: 0, translated: { en: 0, ua: 0 } };

for (const a of raw) {
    if (!a.id || a.id <= 0) continue;
    stats.total++;

    const entry = {
        id: a.id,
        kw: a.kw || '',
        kwList: a.kwList || [],
        labels: a.labels || [],
        title: {},
        toc: {},
    };

    for (const L of LANGS) {
        // the dump only grew per-language keys once #843 shipped; before that
        // every language legitimately resolves to the Russian original
        const body = a[L.text] != null && a[L.text] !== '' ? a[L.text] : a.text;
        const title = a[L.title] || a.title || '';
        const toc = a[L.toc] || a.toc || '';

        // Russian is the base; the others only carry what actually differs
        if (L.key === 'ru') {
            bodies.ru[a.id] = body || '';
        } else if (body && body !== a.text) {
            bodies[L.key][a.id] = body;
            stats.translated[L.key]++;
        }
        entry.title[L.key] = title;
        entry.toc[L.key] = toc;
    }

    index.push(entry);
}

function write(name, data) {
    const p = path.join(ROOT, 'data', name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data));
    return (fs.statSync(p).size / 1024).toFixed(0) + ' KB';
}

console.log('index          ', write('help-index.json', index));
for (const L of LANGS)
    console.log('body ' + L.key + '        ', write('help-body-' + L.key + '.json', bodies[L.key]));

console.log(`\n${stats.total} articles · translated: EN ${stats.translated.en}, UA ${stats.translated.ua}`);
if (!stats.translated.en && !stats.translated.ua)
    console.log('(dump has no per-language keys yet — regenerate it after the next reboot)');
