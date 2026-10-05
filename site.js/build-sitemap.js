#!/usr/bin/env node
/* sitemap.xml for search engines, rebuilt on every deploy.
 *
 * The help pages under help/ are generated on live from the game's dump, so
 * they are not in git and a hand-written sitemap goes stale the day it is
 * committed. Walk what is actually on disk instead.
 *
 * /maps/*.html and /ru/maps/*.html are byte-identical copies; only /maps/ is
 * listed, since that is the URL old links point at.
 *
 * No <lastmod>: every generator rewrites its pages on each deploy, so file
 * mtimes say "today" for everything and would only teach crawlers to ignore it.
 *
 * usage: node site.js/build-sitemap.js [static-dir]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '../static'));
const BASE = 'https://dreamland.rocks';

// The EN/UA front plus the web client. Legacy pages at the root are
// duplicates of /ru/ and stay out.
const PAGES = ['index.html', 'help.html', 'maps.html', 'news.html', 'searcher.html'];

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
    return BASE + encodeURI(loc);
}

const entries = [];
function add(rel) {
    const file = path.join(ROOT, rel);
    if (fs.existsSync(file))
        entries.push(url(rel));
}

PAGES.forEach(add);
entries.push(BASE + '/play/');
htmlIn('ru').forEach(add);
htmlIn('help').forEach(add);
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
