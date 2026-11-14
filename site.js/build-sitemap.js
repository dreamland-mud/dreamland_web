#!/usr/bin/env node
/* sitemap.xml for search engines, rebuilt on every deploy.
 *
 * The help, news and map pages are generated on live from the game's dumps,
 * so they are not in git and a hand-written sitemap goes stale the day it is
 * committed. List what is actually on disk instead.
 *
 * The old Russian site's URLs (/ru/..., /ru/maps/... and a few root copies)
 * are redirect stubs now (site.js/build-stubs.js). They carry
 * <meta name="robots" content="noindex">, and so does anything else that must
 * stay out: every candidate page is checked for it before it is listed.
 *
 * No <lastmod>: every generator rewrites its pages on each deploy, so file
 * mtimes say "today" for everything and would only teach crawlers to ignore it.
 *
 * The static help and news pages come in up to three languages each. Their
 * builders (build-help-pages.js, build-news.js) leave a list of what they
 * wrote in data/help-pages.json and data/news-pages.json: one row per article
 * or note, {alternates: {hreflang: path}, xdefault}. Every language version is
 * listed with xhtml:link alternates to all of them, so a search engine shows
 * the reader the page in their own language. Pages kept out of the help app's
 * shelves are not in those lists at all.
 *
 * usage: node site.js/build-sitemap.js [static-dir]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '../static'));
const BASE = 'https://dreamland.rocks';

// The trilingual front plus the web client.
const PAGES = ['index.html', 'about.html', 'help.html', 'maps.html', 'news.html', 'searcher.html',
               'values.html', 'legends.html', 'gallery.html', 'feniaapi.html'];

function htmlIn(dir) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs))
        return [];
    return fs.readdirSync(abs)
        .filter(f => f.endsWith('.html'))
        .sort()
        .map(f => path.join(dir, f));
}

function url(rel) {
    let loc = '/' + rel.split(path.sep).join('/');
    loc = loc.replace(/(^|\/)index\.html$/, '$1');
    return BASE + encodeURI(loc).replace(/&/g, '&amp;').replace(/'/g, '&apos;');
}

/* A page that asks not to be indexed (a redirect stub, a per-label help page)
   has no business in the sitemap. The tag sits in <head>: read only the start. */
function noindex(file) {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(4096);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return /<meta name="robots" content="noindex/i.test(buf.toString('utf8', 0, n));
}

const entries = [];
function add(rel) {
    const file = path.join(ROOT, rel);
    if (fs.existsSync(file) && !noindex(file))
        entries.push('  <url><loc>' + url(rel) + '</loc></url>');
}

/* one manifest row -> one <url> per language version, each naming all of them */
let multi = 0;
function addVersions(row) {
    const langs = Object.keys(row.alternates).filter(l => {
        let rel = row.alternates[l].replace(/^\//, '');
        if (rel === '' || rel.endsWith('/')) rel += 'index.html';
        const file = path.join(ROOT, rel);
        return fs.existsSync(file) && !noindex(file);
    });
    const links = langs.map(l => '<xhtml:link rel="alternate" hreflang="' + l + '" href="' + loc(row.alternates[l]) + '"/>');
    if (langs.length > 1 && row.xdefault)
        links.push('<xhtml:link rel="alternate" hreflang="x-default" href="' + loc(row.xdefault) + '"/>');
    langs.forEach(l => {
        entries.push('  <url><loc>' + loc(row.alternates[l]) + '</loc>' +
                     (langs.length > 1 ? links.join('') : '') + '</url>');
        multi++;
    });
}
function loc(p) { return url(p.replace(/^\//, '')); }
function manifest(name) {
    const f = path.join(ROOT, 'data', name);
    if (!fs.existsSync(f)) {
        console.warn('no ' + f + ' -- its pages are left out this time');
        return [];
    }
    return JSON.parse(fs.readFileSync(f, 'utf8'));
}

PAGES.forEach(add);
entries.push('  <url><loc>' + BASE + '/play/</loc></url>');
manifest('help-pages.json').forEach(addVersions);
manifest('news-pages.json').forEach(addVersions);
htmlIn('maps').forEach(add);

const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
             'xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    .concat(entries)
    .concat(['</urlset>', ''])
    .join('\n');

const out = path.join(ROOT, 'sitemap.xml');
fs.writeFileSync(out + '.tmp', xml);
fs.renameSync(out + '.tmp', out);
console.log('sitemap.xml: ' + entries.length + ' urls (' + multi + ' static help and news pages)');
