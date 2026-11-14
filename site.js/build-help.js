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
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '../static');
const RAW = process.argv[2] || path.join(ROOT, 'data/helps.raw.json');

if (!fs.existsSync(RAW)) {
    console.error('no help dump at ' + RAW);
    process.exit(1);
}

const DUMP = require('./help-dump.js');
const raw = DUMP.read(RAW);

const catSource = { dump: 0, override: 0, labels: 0, none: 0 };
const index = [];
const bodies = { ru: {}, en: {}, ua: {} };
const stats = { total: 0, translated: { en: 0, ua: 0 } };

for (const a of raw) {
    stats.total++;
    for (const L of DUMP.LANGS) {
        // Russian is the base; the others only carry what actually differs
        if (L.key === 'ru') {
            bodies.ru[a.id] = DUMP.bodyOf(a, L) || '';
        } else if (DUMP.isTranslated(a, L)) {
            bodies[L.key][a.id] = DUMP.bodyOf(a, L);
            stats.translated[L.key]++;
        }
    }
    index.push(DUMP.indexEntry(a, catSource));
}

/* Written twice: plain, and gzipped next to it.
 *
 * nginx on this box has `gzip on` but `gzip_types` commented out, so its
 * default applies and only text/html is ever compressed -- every JSON here goes
 * over the wire raw. The config is root-owned and sudo is disabled, so the
 * compression has to happen somewhere we control: the browser fetches the .gz
 * and inflates it with DecompressionStream. The plain file stays for anything
 * without that API, and becomes the only one needed the day nginx is fixed. */
function write(name, data) {
    const p = path.join(ROOT, 'data', name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const json = JSON.stringify(data);
    fs.writeFileSync(p, json);
    fs.writeFileSync(p + '.gz', zlib.gzipSync(json, { level: 9 }));
    const raw = fs.statSync(p).size / 1024;
    const gz = fs.statSync(p + '.gz').size / 1024;
    return raw.toFixed(0) + ' KB (' + gz.toFixed(0) + ' KB gzipped)';
}

console.log('index          ', write('help-index.json', index));
for (const L of DUMP.LANGS)
    console.log('body ' + L.key + '        ', write('help-body-' + L.key + '.json', bodies[L.key]));

console.log(`\n${stats.total} articles · translated: EN ${stats.translated.en}, UA ${stats.translated.ua}`);
if (!stats.translated.en && !stats.translated.ua)
    console.log('(dump has no per-language keys yet — regenerate it after the next reboot)');

console.log(`categories: ${catSource.dump} from the dump, ${catSource.override} from the ` +
            `override file, ${catSource.labels} resolved from labels` +
            (catSource.none ? `, ${catSource.none} UNRESOLVED` : ''));
if (catSource.dump && catSource.override === 0)
    console.log('(the engine now sends `cat` for everything — site.js/help-categories.json ' +
                'is dead weight and can be deleted)');
if (catSource.none)
    console.log('(an unresolved article means the IA has no rule for it — see HELP_IA.md §2)');
