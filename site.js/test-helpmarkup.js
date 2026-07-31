#!/usr/bin/env node
/* Renderer test for static/site/js/helpmarkup.js.
 *
 *   node site.js/test-helpmarkup.js        # exits non-zero on any failure
 *
 * The renderer is the one piece of the site that reinterprets game markup, and
 * it had no test: every change to it was verified by opening a page and
 * squinting. It needs a DOM (it parses the article with innerHTML rather than
 * splitting strings, because 21% of the colour spans straddle a newline), so
 * rather than pull in jsdom for one file there is a small DOM below -- enough
 * for the handful of tags the game actually emits.
 *
 * Fixtures are written in the markup the help dump carries -- {W -> fgbw,
 * {x -> fgdx, {c -> fgbc, {Y -> fgby -- copied from real articles in
 * static/data/help-body-ru.json.
 */
const fs = require('fs');
const path = require('path');

// ---- a DOM with just enough in it ----------------------------------------
function parse(html) {
    const root = { nodeType: 1, tagName: 'DIV', children: [] };
    const stack = [root];
    const re = /<\/?([a-z]+)([^>]*)>/gi;
    let last = 0, m;
    const push = n => (stack[stack.length - 1] || root).children.push(n);
    while ((m = re.exec(html))) {
        if (m.index > last) push({ nodeType: 3, nodeValue: html.slice(last, m.index) });
        last = m.index + m[0].length;
        /* Real article bodies carry stray closing tags -- mudtags emits a bare
           </c> where a colour region ends inside another. A browser's innerHTML
           swallows them, so this has to as well, or the shim only ever works on
           hand-written fixtures. */
        if (m[0][1] === '/') { if (stack.length > 1) stack.pop(); continue; }
        const attrs = {};
        m[2].replace(/([a-z-]+)\s*=\s*'([^']*)'/gi, (s, k, v) => { attrs[k] = v; return s; });
        const el = { nodeType: 1, tagName: m[1].toUpperCase(), attrs, children: [] };
        push(el);
        stack.push(el);
    }
    if (last < html.length) push({ nodeType: 3, nodeValue: html.slice(last) });
    link(root);
    return root;
}
function textOf(n) {
    return n.nodeType === 3 ? n.nodeValue : (n.children || []).map(textOf).join('');
}
function link(node) {
    node.firstChild = (node.children && node.children[0]) || null;
    (node.children || []).forEach((c, i) => {
        c.nextSibling = node.children[i + 1] || null;
        c.getAttribute = k => (c.attrs && k in c.attrs ? c.attrs[k] : null);
        Object.defineProperty(c, 'textContent', { get: () => textOf(c), configurable: true });
        if (c.nodeType === 1) link(c);
    });
}
let pageLang = 'en';
global.document = {
    documentElement: { getAttribute: k => (k === 'data-lang' ? pageLang : null) },
    createElement() {
        const holder = {};
        Object.defineProperty(holder, 'innerHTML', {
            set(v) { holder.firstChild = parse(v).firstChild; },
        });
        return holder;
    },
};
global.window = global;
eval(fs.readFileSync(path.resolve(__dirname, '../static/site/js/helpmarkup.js'), 'utf8'));

// ---- fixtures ------------------------------------------------------------
const C = (cls, s) => "<c c='" + cls + "'>" + s + '</c>';
const bullet = (label, rest) =>
    C('fgdx', '\n  ') + C('fgbw', '*') + C('fgdx', ' ') + C('fgbc', label) + C('fgdx', ': ') + rest;

// A zone article as areahelp.cpp composes it: heading, metadata bullets, prose.
const ZONE =
    C('fgbc', 'Plains of the North') +
    bullet('Levels', C('fgby', '1-20')) +
    bullet('Danger', C('fgdx', 'easy opponents')) +
    bullet('Author', C('fgdy', 'Copper')) +
    bullet('How to get there', '<hs>3n2e</hs>' + C('fgdd', ' (from the Market Square)')) +
    bullet('Map', C('fgdx', '[map=plains.are]')) +
    C('fgdx', '\n\nA vast plain stretches north, ') +
    "<hh id='42'>" + C('fgdx', 'cold') + '</hh>' + C('fgdx', ' and empty.\n');

// A skill article: same bullets, plus the %FMT% call shape and a paragraph.
const SKILL =
    C('fgbw', "Skill 'bash'.") +
    bullet('Delay', C('fgbw', '6') + C('fgdx', ' seconds')) +
    C('fgdx', '\n\nFormat: bash victim\n\nYou throw your weight at them.\n');

const cases = [];
function check(name, cond) { cases.push([name, !!cond]); }

let out = DLMarkup.render(ZONE, { hrefBase: 'help.html' });
check('metadata bullets collapse into one list', (out.match(/<ul class="hlist">/g) || []).length === 1);
check('one <li> per bullet', (out.match(/<li>/g) || []).length === 5);
check('no literal [map=] marker survives', out.indexOf('[map=') === -1);
check('map bullet links to the zone map page', /href="maps\.html#plains"/.test(out));
check('map label in English', out.indexOf('open the map') > -1);
check('prose after the list is a paragraph', /<p><span class="c-fgdx">A vast plain/.test(out));
check('help cross-reference still links', /href="help\.html#h42" data-hid="42"/.test(out));
check('speedwalk still renders as a token', /<code class="hwalk">3n2e<\/code>/.test(out));

pageLang = 'uk';
out = DLMarkup.render(ZONE, { hrefBase: 'help.html' });
check('map label follows the page language', out.indexOf('відкрити мапу') > -1);
pageLang = 'en';

out = DLMarkup.render(SKILL, { hrefBase: 'help.html' });
check('skill bullet is a list too', /<ul class="hlist"><li>/.test(out));
check('call shape keeps its own block', /<p class="hfmt">/.test(out));

// A javascript: URL in an <hl> must never become an href.
out = DLMarkup.render('<hl>javascript:alert(1)</hl>', {});
check('unsafe scheme is not linked', out.indexOf('href="javascript:') === -1);

let bad = 0;
for (const [name, ok] of cases) {
    console.log((ok ? 'ok   ' : 'FAIL ') + name);
    if (!ok) bad++;
}
console.log(`\n${cases.length - bad}/${cases.length} passed`);
process.exit(bad ? 1 : 0);
