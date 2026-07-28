#!/usr/bin/env node
/* The game's note bucket -> the two shapes the site reads.
 *
 *   /tmp/news.xml (live)  ->  data/news-all.json   every entry, for news.html
 *                         ->  data/news.json       the newest 8, for the home page
 *
 * The home page must NOT pull the full archive: 910 entries are ~940 KB, and
 * that is a lot of weight for a widget showing eight cards above the fold.
 *
 * usage: node site.js/build-news.js [path-to-news.xml] [out-dir]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../static');
const SRC = process.argv[2] || path.join(ROOT, 'data/news.xml');
const OUT = process.argv[3] || path.join(ROOT, 'data');
const HOME_COUNT = 8;

if (!fs.existsSync(SRC)) {
    // Unlike the searcher and help dumps, which the game rewrites on a timer,
    // news.xml only appears when someone runs 'webdump news' in game. A missing
    // one means stale news, not a broken build -- leave whatever is already
    // there and let the deploy go green.
    console.error('no news.xml at ' + SRC + " -- run 'webdump news' in game; keeping existing data");
    process.exit(0);
}

const xml = fs.readFileSync(SRC, 'utf8');

function unent(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
            .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
            .replace(/&amp;/g, '&');
}
function field(node, tag) {
    const m = new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>').exec(node);
    return m ? unent(m[1]) : '';
}
/* A handful of old posts carry terminal colour codes ({r{x). They render as
   literal garbage in a browser, and there is nothing to colour on parchment. */
function decolour(s) { return s.replace(/\{[a-zA-Z0-9]/g, ''); }

const rows = [];
const re = /<node>([\s\S]*?)<\/node>/g;
let m;
while ((m = re.exec(xml)) !== null) {
    const n = m[1];
    const id = parseInt(field(n, 'id').trim(), 10) || 0;
    rows.push({
        id: id,
        date: field(n, 'date').trim(),
        from: field(n, 'from').trim(),
        subject: decolour(field(n, 'subject').trim()),
        // keep leading indentation (some posts are formatted); drop the
        // trailing blank line every node's body ends with
        text: decolour(field(n, 'text')).replace(/\s+$/, '')
    });
}
rows.sort((a, b) => b.id - a.id);            // ids are unix timestamps

fs.writeFileSync(path.join(OUT, 'news-all.json'), JSON.stringify(rows));
fs.writeFileSync(path.join(OUT, 'news.json'), JSON.stringify(rows.slice(0, HOME_COUNT)));

const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
const years = rows.map(r => (r.date.match(/\d{4}$/) || [''])[0]).filter(Boolean);
console.log(`${rows.length} entries · ${years[years.length - 1]}–${years[0]}`);
console.log('news-all.json  ' + kb('news-all.json'));
console.log('news.json      ' + kb('news.json') + `  (newest ${HOME_COUNT})`);
