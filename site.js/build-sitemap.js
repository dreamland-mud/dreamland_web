#!/usr/bin/env node
/* sitemap.xml for search engines, rebuilt on every deploy.
 *
 * The help pages under help/ are generated on live from the game's dump, so
 * they are not in git and a hand-written sitemap goes stale the day it is
 * committed. Walk what is actually on disk instead.
 *
 * The old Russian site's URLs (/ru/..., /ru/maps/... and a few root copies)
 * are redirect stubs now (site.js/build-stubs.js). They carry
 * <meta name="robots" content="noindex">, and so does anything else that must
 * stay out: every candidate page is checked for it before it is listed.
 *
 * No <lastmod>: every generator rewrites its pages on each deploy, so file
 * mtimes say "today" for everything and would only teach crawlers to ignore it.
 *
 * help.js never deletes a page, so help/ also holds orphans for articles that
 * lost their labels and copies of 2019 pages. Only list what help.js writes
 * from the current dump: one page per labelled article and its three index
 * pages. The per-label pages repeat those articles in full and are noindex.
 *
 * usage: node site.js/build-sitemap.js [static-dir] [helps.json]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '../static'));
const HELPS = process.argv[3] || '/tmp/helps.json';
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

function currentHelpPages() {
    const pages = new Set(['index.html', 'classskill.html', 'clanskills.html']);
    JSON.parse(fs.readFileSync(HELPS, 'utf8')).forEach(topic => {
        if (!topic.labels || topic.labels.length == 0)
            return;
        pages.add(topic.id + '.html');
    });
    return pages;
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
        entries.push(url(rel));
}

PAGES.forEach(add);
entries.push(BASE + '/play/');
const helpPages = currentHelpPages();
htmlIn('help').filter(rel => helpPages.has(path.basename(rel))).forEach(add);
htmlIn('maps').forEach(add);

const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    .concat(entries.map(loc => '  <url><loc>' + loc + '</loc></url>'))
    .concat(['</urlset>', ''])
    .join('\n');

const out = path.join(ROOT, 'sitemap.xml');
fs.writeFileSync(out + '.tmp', xml);
fs.renameSync(out + '.tmp', out);
console.log('sitemap.xml: ' + entries.length + ' urls');
