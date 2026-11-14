/* Reading the game's help dump (/tmp/helps.json): the rules both help
 * builders share, so the help app's data (build-help.js) and the static pages
 * (build-help-pages.js) agree on which article is translated and where it
 * is shelved.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const CAT = require('./help-category.js');

/* Per-language field names in the dump; 'ru' is the base text. */
const LANGS = [
    { key: 'ru', text: 'text',   title: 'title',   toc: 'toc'   },
    { key: 'en', text: 'textEn', title: 'titleEn', toc: 'tocEn' },
    { key: 'ua', text: 'textUa', title: 'titleUa', toc: 'tocUa' },
];

/* The article's text in one language. The dump only grew per-language keys
   once #843 shipped; a missing one legitimately resolves to the Russian. */
function bodyOf(a, L) {
    return a[L.text] != null && a[L.text] !== '' ? a[L.text] : a.text;
}

/* EN/UA count as translated only where the text actually differs from the
   Russian: until then the dump carries a byte-identical copy. */
function isTranslated(a, L) {
    const body = bodyOf(a, L);
    return L.key !== 'ru' && !!body && body !== a.text;
}

/* Categories (HELP_IA.md). Resolved at build time rather than in the browser,
   because the source of truth moves: today the dump still carries the labels
   the game had when it last loaded its plug-ins, so the override file --
   generated from the same table that relabelled the XML -- is what makes the
   site correct before the next reboot. Once the engine emits `cat` itself that
   field wins and the override can be deleted.
   Precedence: dump cat > override > resolve(labels). */
const OVERRIDES = (() => {
    const p = path.join(__dirname, 'help-categories.json');
    try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
        console.warn('no help-categories.json (' + e.message + '); using labels only');
        return {};
    }
})();

/* counts (optional): { dump, override, labels, none } tallied as it goes */
function categoryOf(a, counts) {
    const c = counts || {};
    const bump = k => { c[k] = (c[k] || 0) + 1; };
    if (a.cat) { bump('dump'); return a.cat; }
    const o = OVERRIDES[String(a.id)];
    if (o) { bump('override'); return o; }
    const r = CAT.resolve(a.labels || []);
    bump(r ? 'labels' : 'none');
    return r;
}

/* One help-index.json entry (the shape static/site/js/helpsearch.js and the
   help app read). `kw` is dropped on purpose: it is kwList joined into one
   string, 27% of the index by weight, and the browser only ever searched
   kwList. Empty title/toc slots are dropped too -- most articles have no
   authored title. */
function indexEntry(a, counts) {
    const entry = {
        id: a.id,
        kwList: a.kwList || [],
        labels: a.labels || [],
        cat: categoryOf(a, counts),
        title: {},
        toc: {},
    };
    // the automatic "see also" ids the game computes (help revamp Phase 2 task 4)
    if (a.related && a.related.length) entry.related = a.related;
    // retired ids that open this article (help revamp Phase 1), so old #h<id> links still land
    if (a.aliases && a.aliases.length) entry.aliases = a.aliases;
    for (const L of LANGS) {
        const title = a[L.title] || a.title || '';
        const toc = a[L.toc] || a.toc || '';
        if (title) entry.title[L.key] = title;
        if (toc) entry.toc[L.key] = toc;
    }
    return entry;
}

function read(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8')).filter(a => a.id && a.id > 0);
}

module.exports = { LANGS, bodyOf, isTranslated, categoryOf, indexEntry, read };
