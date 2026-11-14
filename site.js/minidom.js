/* Just enough DOM for static/site/js/helpmarkup.js to run under node.
 *
 * The renderer parses an article with innerHTML rather than splitting strings
 * (21% of the colour spans straddle a newline), so it needs a DOM. Pulling in
 * jsdom for the handful of tags the game emits (<c>, <hh>, <hg>, <hc>, <hl>,
 * <hs>) would be one more dependency on a box pinned to node 16; this is the
 * subset of the HTML parser those tags actually exercise:
 *   - an end tag closes the nearest open element of the same name, and a stray
 *     one with no match is dropped (mudtags emits a bare </c> where a colour
 *     region ends inside another; a browser swallows it the same way),
 *   - character references in text and attributes are decoded, so the
 *     renderer's own escaping does not double them.
 *
 * Used by site.js/build-help-pages.js (server-side render) and by
 * site.js/test-helpmarkup.js.
 */
'use strict';

const NAMED = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
        if (e[0] === '#')
            return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
        const v = NAMED[e.toLowerCase()];
        return v === undefined ? m : v;
    });
}

function textOf(n) {
    return n.nodeType === 3 ? n.nodeValue : (n.children || []).map(textOf).join('');
}

function link(node) {
    node.firstChild = (node.children && node.children[0]) || null;
    (node.children || []).forEach((c, i) => {
        c.nextSibling = node.children[i + 1] || null;
        if (c.nodeType === 1) {
            c.getAttribute = k => (k in c.attrs ? c.attrs[k] : null);
            Object.defineProperty(c, 'textContent', { get: () => textOf(c), configurable: true });
            link(c);
        }
    });
}

function parse(html) {
    const root = { nodeType: 1, tagName: 'DIV', attrs: {}, children: [] };
    const stack = [root];
    const re = /<(\/?)([a-z][a-z0-9]*)([^>]*)>/gi;
    const push = n => stack[stack.length - 1].children.push(n);
    let last = 0, m;
    while ((m = re.exec(html))) {
        if (m.index > last) push({ nodeType: 3, nodeValue: decode(html.slice(last, m.index)) });
        last = m.index + m[0].length;
        const tag = m[2].toUpperCase();
        if (m[1]) {
            for (let i = stack.length - 1; i > 0; i--)
                if (stack[i].tagName === tag) { stack.length = i; break; }
            continue;
        }
        const attrs = {};
        m[3].replace(/([a-z-]+)\s*=\s*(?:'([^']*)'|"([^"]*)")/gi, (s, k, v1, v2) => {
            attrs[k.toLowerCase()] = decode(v1 != null ? v1 : v2);
            return s;
        });
        const el = { nodeType: 1, tagName: tag, attrs, children: [] };
        push(el);
        if (!/\/\s*$/.test(m[3])) stack.push(el);
    }
    if (last < html.length) push({ nodeType: 3, nodeValue: decode(html.slice(last)) });
    link(root);
    return root;
}

/* lang: what document.documentElement's data-lang answers ('en' | 'uk' | 'ru') */
function documentFor(lang) {
    const doc = {
        lang: lang || 'en',
        documentElement: { getAttribute: k => (k === 'data-lang' ? doc.lang : null) },
        createElement() {
            const holder = {};
            Object.defineProperty(holder, 'innerHTML', {
                set(v) { holder.firstChild = parse(String(v)).firstChild; },
            });
            return holder;
        },
    };
    return doc;
}

/* Puts a document (and window) on the global object, which is where the
   browser scripts look for them. Returns the document so a caller can change
   doc.lang between renders. */
function install(lang) {
    global.document = documentFor(lang);
    if (typeof global.window === 'undefined') global.window = global;
    return global.document;
}

module.exports = { parse, decode, install };
