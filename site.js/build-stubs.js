#!/usr/bin/env node
/* Redirect pages for the URLs of the old Russian site.
 *
 * website.js/main.js used to write a whole Russian edition under /ru plus root
 * copies of some of its pages. Every one of them has a home in the new design
 * now, but the old URLs are bookmarked and indexed, and the web server is
 * nginx with no config we can touch: a redirect has to be a page. Each stub
 * is a few lines of HTML that
 *   - points search engines at the new URL (canonical + noindex),
 *   - for /ru/... URLs switches the new site to Russian before going there,
 *   - redirects with JavaScript, keeping the visitor's #anchor,
 *   - falls back to a meta refresh, and
 *   - shows a plain RU + EN link, for screen readers and no-JS browsers.
 *
 * Written over whatever is on disk, on every deploy, after website.js has run
 * (it writes the /maps pages the /ru/maps stubs point at). None of these files
 * are in git: static/.gitignore covers them.
 *
 * usage: node site.js/build-stubs.js [static-dir]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '../static'));
const BASE = 'https://dreamland.rocks';

const HOME = { ru: 'главная страница', en: 'home page' };
const LEGENDS = { ru: 'Легенды', en: 'Legends' };

/* old path (relative to static/) -> new URL and its name for the visible link */
const STUBS = [
    ['ru/index.html',     '/',                      HOME],
    ['ru/searcher.html',  '/searcher.html',         { ru: 'Поиск вещей', en: 'Item search' }],
    ['ru/maps.html',      '/maps.html',             { ru: 'Карты', en: 'Maps' }],
    ['ru/news.html',      '/news.html',             { ru: 'Новости', en: 'News' }],
    ['ru/values.html',    '/values.html',           { ru: 'Ценности', en: 'Our values' }],
    ['ru/gallery.html',   '/gallery.html',          { ru: 'Галерея', en: 'Gallery' }],
    ['ru/stories.html',   '/legends.html#stories',  LEGENDS],
    ['ru/samurai.html',   '/legends.html#samurai',  LEGENDS],
    ['ru/legends.html',   '/legends.html#legends',  LEGENDS],
    ['ru/links.html',     '/',                      HOME],
    ['ru/feniaapi.html',  '/feniaapi.html',         { ru: 'Fenia API', en: 'Fenia API' }],
    // root copies the old generator wrote next to the new pages
    ['links.html',        '/',                      HOME],
    ['stories.html',      '/legends.html#stories',  LEGENDS],
    ['samurai.html',      '/legends.html#samurai',  LEGENDS],
    // 2019 copies of the old pages left in help/ (help.js never deletes)
    ['help/searcher.html', '/searcher.html',        { ru: 'Поиск вещей', en: 'Item search' }],
    ['help/maps.html',     '/maps.html',            { ru: 'Карты', en: 'Maps' }],
    ['help/news.html',     '/news.html',            { ru: 'Новости', en: 'News' }],
    ['help/stories.html',  '/legends.html#stories', LEGENDS],
    ['help/samurai.html',  '/legends.html#samurai', LEGENDS],
    ['help/legends.html',  '/legends.html#legends', LEGENDS],
    ['help/links.html',    '/',                     HOME],
    ['help/feniaapi.html', '/feniaapi.html',        { ru: 'Fenia API', en: 'Fenia API' }]
];

/* /ru/maps was a symlink to /maps, so every ASCII map page had a /ru twin. */
const MAPS = path.join(ROOT, 'maps');
const ruMaps = fs.existsSync(MAPS)
    ? fs.readdirSync(MAPS).filter(f => f.endsWith('.html')).sort()
    : [];
ruMaps.forEach(f => STUBS.push(['ru/maps/' + f, '/maps/' + f,
    { ru: 'Карта зоны ' + f.slice(0, -5), en: 'Area map ' + f.slice(0, -5) }]));

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stub(from, to, name) {
    const ru = from.startsWith('ru/');
    const canonical = BASE + to.replace(/#.*/, '');
    // keep the visitor's own #anchor unless the target names its own
    const go = to.includes('#') ? JSON.stringify(to) : JSON.stringify(to) + ' + location.hash';
    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>DreamLand MUD: ${esc(name.ru)}</title>
<link rel="canonical" href="${esc(canonical)}"/>
<meta name="robots" content="noindex"/>
<script>
${ru ? "try { localStorage.setItem('dl_lang', 'ru'); } catch (e) {}\n" : ''}location.replace(${go});
</script>
<meta http-equiv="refresh" content="0; url=${esc(to)}"/>
</head>
<body>
<p>Эта страница переехала: <a href="${esc(to)}">${esc(name.ru)}</a>.</p>
<p lang="en">This page has moved: <a href="${esc(to)}">${esc(name.en)}</a>.</p>
</body>
</html>
`;
}

/* The old generator made /ru/maps a symlink into /maps: writing a stub through
   it would overwrite the real map page. Swap the link for a directory. */
const ruMapsDir = path.join(ROOT, 'ru/maps');
const st = fs.lstatSync(ruMapsDir, { throwIfNoEntry: false });
if (st && st.isSymbolicLink())
    fs.unlinkSync(ruMapsDir);
fs.mkdirSync(ruMapsDir, { recursive: true });
if (fs.realpathSync(ruMapsDir) !== path.join(fs.realpathSync(ROOT), 'ru/maps'))
    throw new Error('build-stubs.js: ' + ruMapsDir + ' still leads elsewhere, not writing through it');

let n = 0;
for (const [from, to, name] of STUBS) {
    const out = path.join(ROOT, from);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const tmp = out + '.tmp';
    fs.writeFileSync(tmp, stub(from, to, name));
    fs.renameSync(tmp, out);
    n++;
}
console.log('stubs: ' + n + ' (' + ruMaps.length + ' of them /ru/maps)');
