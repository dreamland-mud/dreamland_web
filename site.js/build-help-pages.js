#!/usr/bin/env node
/* One real HTML page per help article and language, for search and answer
 * engines: the help app (help.html) renders from JSON in the browser, so a
 * crawler that runs no script sees an empty shell there.
 *
 *   /tmp/helps.json  ->  help/<id>.html         Russian, every labelled article
 *                        en/help/<id>.html      English, where it is translated
 *                        ua/help/<id>.html      Ukrainian, where it is translated
 *                        help/, en/help/, ua/help/   an index per language,
 *                                               shelved like the help app's rail
 *                        data/help-pages.json   what was written, for the sitemap
 *
 * "Translated" is build-help.js's rule (help-dump.js): EN/UA text that differs
 * from the Russian. The Russian URLs are the ones the retired help.js wrote and
 * search engines already know, so they stay where they were.
 *
 * Bodies go through the help app's own renderer (static/site/js/helpmarkup.js,
 * on site.js/minidom.js), so a page reads like the article in the app. A cross
 * link goes to the same-language page when there is one, else to the help app,
 * switched to that language.
 *
 * en/help/ and ua/help/ are wholly ours and are swapped in as a tree, so a page
 * whose article lost its translation or its labels is simply gone. help/ also
 * holds files that are not ours (hedit.json, helps.json, the old per-label pages
 * that build-stubs.js turns into stubs), so there only <number>.html and
 * index.html are owned. Those URLs are indexed, so one that is not written as
 * a page this time never becomes a 404: it turns into a noindex stub, to the
 * article in the help app if the dump still has it (unlabelled), else to the
 * index. A stub is itself a <number>.html, so the next run rewrites it the
 * same way, and replaces it with a page the day the article is labelled again.
 *
 * usage: node site.js/build-help-pages.js [helps.json] [static-dir]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DUMP = require('./help-dump.js');
const CAT = require('./help-category.js');
const { langPage, writeTree, esc, BASE } = require('./shell.js');
const { stub } = require('./build-stubs.js');
const doc = require('./minidom.js').install('en');
const DLMarkup = require('../static/site/js/helpmarkup.js');
const S = require('../static/site/js/helpsearch.js');

const RAW = process.argv[2] || '/tmp/helps.json';
const ROOT = path.resolve(process.argv[3] || path.join(__dirname, '../static'));

if (!fs.existsSync(RAW)) {
    // the game rewrites the dump hourly and on boot: a missing one means stale
    // pages, not a broken deploy
    console.error('no help dump at ' + RAW + ' -- keeping the existing pages');
    process.exit(0);
}

/* key: help-data language; html: lang attribute / hreflang; dir: URL prefix */
const LANGS = [
    { key: 'en', html: 'en', dir: '/en/help/' },
    { key: 'ua', html: 'uk', dir: '/ua/help/' },
    { key: 'ru', html: 'ru', dir: '/help/' },
];
const BY_KEY = {};
LANGS.forEach(L => { BY_KEY[L.key] = L; });
const DUMP_LANG = {};
DUMP.LANGS.forEach(L => { DUMP_LANG[L.key] = L; });

const T = {
    help:     { en: 'Help', ua: 'Довідка', ru: 'Справка' },
    title:    { en: 'DreamLand help', ua: 'Довідка DreamLand', ru: 'Справка DreamLand' },
    intro:    {
        en: 'Every help article the game itself will show you, one page each. The same articles with search and filters are in the interactive help.',
        ua: 'Усі статті довідки, які покаже сама гра, кожна на своїй сторінці. Ті самі статті з пошуком і фільтрами є в інтерактивній довідці.',
        ru: 'Все статьи справки, которые покажет сама игра, каждая на своей странице. Те же статьи с поиском и фильтрами есть в интерактивной справке.',
    },
    app:      { en: 'Interactive help', ua: 'Інтерактивна довідка', ru: 'Интерактивная справка' },
    appThis:  { en: 'Open in the interactive help', ua: 'Відкрити в інтерактивній довідці', ru: 'Открыть в интерактивной справке' },
    play:     { en: 'Play in the browser', ua: 'Грати в браузері', ru: 'Играть в браузере' },
    contents: { en: 'Categories', ua: 'Розділи', ru: 'Разделы' },
    crumbs:   { en: 'Breadcrumb', ua: 'Навігація', ru: 'Навигация' },
    related:  { en: 'See also', ua: 'Див. також', ru: 'См. также' },
    count:    { en: n => n + ' articles', ua: n => 'статей: ' + n, ru: n => 'статей: ' + n },
    indexDesc: {
        en: 'Every help article of DreamLand MUD in English: commands, classes, skills, spells, races, religions, clans and the lore of the world.',
        ua: 'Усі статті довідки DreamLand MUD українською: команди, класи, вміння, закляття, раси, релігії, клани й історія світу.',
        ru: 'Все статьи справки DreamLand MUD на русском: команды, классы, умения, заклинания, расы, религии, кланы и история мира.',
    },
    note:     { en: 'help text comes straight from the running game',
                ua: 'текст довідки -- просто з гри, що працює',
                ru: 'текст справки -- прямо из работающей игры' },
};

const HIDDEN = CAT.NON_PLAYER;          // shelved nowhere in the app: pages, but noindex

// ---- what exists ----------------------------------------------------------
const raw = DUMP.read(RAW);
const index = raw.map(a => DUMP.indexEntry(a));
const byId = {};
index.forEach(e => { byId[e.id] = e; });
const aliasOf = {};
index.forEach(e => (e.aliases || []).forEach(x => { if (!byId[x]) aliasOf[x] = e.id; }));
const resolveLink = DLMarkup.keywordResolver(index);

/* has[lang][id] = raw text, for every page that will exist */
const has = { en: {}, ua: {}, ru: {} };
for (const a of raw) {
    if (!a.labels || !a.labels.length) continue;     // the app shelves nothing unlabelled either
    has.ru[a.id] = a.text || '';
    for (const k of ['en', 'ua'])
        if (DUMP.isTranslated(a, DUMP_LANG[k])) has[k][a.id] = DUMP.bodyOf(a, DUMP_LANG[k]);
}

function real(id) { id = +id; return byId[id] ? id : (aliasOf[id] || id); }
function pagePath(lang, id) { return BY_KEY[lang].dir + id + '.html'; }
/* where a link to article id goes from a page in `lang` */
function hrefFor(lang, id) {
    id = real(id);
    return has[lang][id] != null ? pagePath(lang, id) : '/help.html#h' + id;
}
/* app links switch the app to the page's language on the way (langlinks.js) */
function markAppLinks(html, lang) {
    return html.replace(/<a class="hlink" href="\/help\.html#h/g,
        '<a class="hlink" data-golang="' + BY_KEY[lang].html + '" href="/help.html#h');
}

function plain(html) {
    return html.replace(/<\/?(p|li|ul|pre|div|h\d)\b[^>]*>/g, ' ').replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ').trim();
}
function clip(s, n) {
    if (s.length <= n) return s;
    const cut = s.slice(0, n - 3);
    return cut.replace(/\s+\S*$/, '') + '...';
}

function siblings(id) {
    const alt = {}, sw = {};
    for (const L of LANGS) {
        if (has[L.key][id] != null) alt[L.html] = pagePath(L.key, id);
        sw[L.html] = has[L.key][id] != null ? pagePath(L.key, id) : '/help.html#h' + id;
    }
    return { alt, sw, xdefault: alt.en || alt.ru };
}

// ---- an article -----------------------------------------------------------
function articlePage(lang, a) {
    const L = BY_KEY[lang];
    doc.lang = L.html;
    const title = S.label(a, lang);
    const kind = S.kind(a);
    const body = markAppLinks(DLMarkup.render(has[lang][a.id], {
        lang: L.html,
        linkHref: id => hrefFor(lang, id),
        mapHref: '/maps.html',
        resolveLink: resolveLink,
    }), lang);
    const description = clip(plain(body), 160) || title;
    const shelf = CAT.DISPLAY[a.cat];
    const hidden = !shelf || HIDDEN.indexOf(a.cat) >= 0;
    const rel = (a.related || []).map(real).filter(id => byId[id]);
    const { alt, sw, xdefault } = siblings(a.id);
    const url = pagePath(lang, a.id);

    const crumbs = `<nav class="hstatic__crumbs" aria-label="${T.crumbs[lang]}"><a href="${L.dir}">${T.help[lang]}</a>` +
        (hidden ? '' : ` › <a href="${L.dir}#cat-${a.cat}">${esc(shelf[lang])}</a>`) + '</nav>';
    const related = rel.length ? `
        <nav class="hart__related" aria-labelledby="rel">
            <h2 id="rel">${T.related[lang]}</h2>
            <ul>${rel.map(id => {
                const href = hrefFor(lang, id);
                const app = href.startsWith('/help.html') ? ` data-golang="${L.html}"` : '';
                return `<li><a href="${esc(href)}"${app}>${esc(S.label(byId[id], lang))}</a></li>`;
            }).join('')}</ul>
        </nav>` : '';

    return langPage({
        lang: L.html,
        path: url,
        title: T.title[lang] + ': ' + title,
        description,
        alternates: alt,
        xdefault,
        switchTo: sw,
        css: ['helpart.css', 'hstatic.css'],
        section: 'help.html',
        noindex: hidden,
        note: T.note[lang],
        jsonld: {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: clip(title, 110),
            description,
            inLanguage: L.html,
            url: BASE + url,
            mainEntityOfPage: BASE + url,
            isPartOf: { '@type': 'WebSite', name: 'DreamLand MUD', url: BASE + '/' },
            publisher: { '@type': 'Organization', name: 'DreamLand MUD', url: BASE + '/' },
        },
        body: `<main class="wrap hstatic" id="main">
    ${crumbs}
    <article class="hart">
        <h1>${esc(title)}${kind ? ' <span class="hkind">' + esc(kind[lang]) + '</span>' : ''}</h1>
        <div class="hart__body">
${body}
        </div>${related}
    </article>
    <p class="hstatic__more">
        <a class="btn btn--gold" href="/play/?src=help">${T.play[lang]}</a>
        <a class="btn btn--ghost" href="/help.html#h${a.id}" data-golang="${L.html}">${T.appThis[lang]}</a>
    </p>
</main>`,
    });
}

// ---- the index of one language ----------------------------------------------
function indexPage(lang) {
    const L = BY_KEY[lang];
    const shelves = CAT.SHELVES.map(key => ({
        key,
        name: CAT.DISPLAY[key][lang],
        items: index.filter(a => a.cat === key && has[lang][a.id] != null)
            .map(a => ({ a, label: S.label(a, lang) }))
            .sort((x, y) => x.label.localeCompare(y.label, L.html)),
    })).filter(s => s.items.length);
    const total = shelves.reduce((n, s) => n + s.items.length, 0);
    const alt = {}, sw = {};
    LANGS.forEach(o => { alt[o.html] = o.dir; sw[o.html] = o.dir; });

    return langPage({
        lang: L.html,
        path: L.dir,
        title: T.title[lang],
        description: T.indexDesc[lang],
        alternates: alt,
        xdefault: BY_KEY.en.dir,
        switchTo: sw,
        css: ['helpart.css', 'hstatic.css'],
        section: 'help.html',
        note: T.note[lang],
        jsonld: {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: T.title[lang],
            description: T.indexDesc[lang],
            inLanguage: L.html,
            url: BASE + L.dir,
        },
        body: `<section class="pagehead">
    <div class="wrap">
        <h1>${T.title[lang]}</h1>
        <p>${T.intro[lang]}</p>
        <p class="hstatic__more">
            <a class="btn btn--gold" href="/play/?src=help">${T.play[lang]}</a>
            <a class="btn btn--ghost" href="/help.html" data-golang="${L.html}">${T.app[lang]}</a>
        </p>
    </div>
</section>

<main class="wrap hstatic hstatic--index" id="main">
    <nav class="hstatic__toc" aria-labelledby="toc">
        <h2 id="toc">${T.contents[lang]} <span class="hstatic__n">${T.count[lang](total)}</span></h2>
        <ul>
${shelves.map(s => `            <li><a href="#cat-${s.key}">${esc(s.name)}</a> <span class="hstatic__n">${s.items.length}</span></li>`).join('\n')}
        </ul>
    </nav>
${shelves.map(s => `
    <section class="hstatic__shelf" aria-labelledby="cat-${s.key}">
        <h2 id="cat-${s.key}">${esc(s.name)}</h2>
        <ul>
${s.items.map(({ a, label }) => {
    const k = S.kind(a);
    return `            <li><a href="${pagePath(lang, a.id)}">${esc(label)}</a>${k ? ' <span class="hkind">' + esc(k[lang]) + '</span>' : ''}</li>`;
}).join('\n')}
        </ul>
    </section>`).join('\n')}
</main>`,
    });
}

// ---- write ----------------------------------------------------------------
const manifest = [];            // indexable pages and their language versions, for the sitemap
const counts = {};

/* retired ids: a stub where the article they now open has a page */
function aliasStubs(lang) {
    const out = {};
    for (const x of Object.keys(aliasOf)) {
        const id = aliasOf[x];
        if (has[lang][id] == null) continue;
        const to = pagePath(lang, id);
        const name = { ru: S.label(byId[id], 'ru'), en: S.label(byId[id], 'en') };
        out[x + '.html'] = stub(to.slice(1), to, name, BY_KEY[lang].html);
    }
    return out;
}

function pagesFor(lang) {
    const out = {};
    let n = 0;
    for (const a of index) {
        if (has[lang][a.id] == null) continue;
        out[a.id + '.html'] = articlePage(lang, a);
        n++;
        if (lang === 'ru') {          // one manifest row per article, written once
            const { alt, xdefault } = siblings(a.id);
            const hidden = !CAT.DISPLAY[a.cat] || HIDDEN.indexOf(a.cat) >= 0;
            if (!hidden) manifest.push({ alternates: alt, xdefault });
        }
    }
    const stubs = aliasStubs(lang);
    Object.assign(out, stubs);
    out['index.html'] = indexPage(lang);
    counts[lang] = { pages: n, aliases: Object.keys(stubs).length };
    return out;
}

const ru = pagesFor('ru');
const en = pagesFor('en');
const ua = pagesFor('ua');
manifest.unshift({ alternates: { en: '/en/help/', uk: '/ua/help/', ru: '/help/' }, xdefault: '/en/help/' });

writeTree(path.join(ROOT, 'en/help'), en);
writeTree(path.join(ROOT, 'ua/help'), ua);

/* help/ is shared: stage, move in, then drop the owned files not written now */
const HELP = path.join(ROOT, 'help');
const OWNED = /^(\d+|index)\.html$/;
const stage = path.join(ROOT, 'help.new-' + process.pid);
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
for (const f of Object.keys(ru)) fs.writeFileSync(path.join(stage, f), ru[f]);
fs.mkdirSync(HELP, { recursive: true });
for (const f of Object.keys(ru)) fs.renameSync(path.join(stage, f), path.join(HELP, f));
fs.rmSync(stage, { recursive: true, force: true });
const gone = { kept: 0, removed: 0 };
for (const f of fs.readdirSync(HELP)) {
    if (!OWNED.test(f) || f in ru) continue;
    const id = +f.slice(0, -5);
    const out = path.join(HELP, f);
    const known = byId[id];
    const to = known ? '/help.html#h' + id : '/help/';
    const name = known
        ? { ru: S.label(known, 'ru'), en: S.label(known, 'en') }
        : { ru: T.help.ru, en: T.help.en };
    fs.writeFileSync(out + '.tmp', stub('help/' + f, to, name, 'ru'));
    fs.renameSync(out + '.tmp', out);
    gone[known ? 'kept' : 'removed']++;
}

const data = path.join(ROOT, 'data');
fs.mkdirSync(data, { recursive: true });
fs.writeFileSync(path.join(data, 'help-pages.json.tmp'), JSON.stringify(manifest));
fs.renameSync(path.join(data, 'help-pages.json.tmp'), path.join(data, 'help-pages.json'));

const hiddenN = index.filter(a => has.ru[a.id] != null && (!CAT.DISPLAY[a.cat] || HIDDEN.indexOf(a.cat) >= 0)).length;
console.log(LANGS.map(L => `${L.key.toUpperCase()} ${counts[L.key].pages} pages` +
    (counts[L.key].aliases ? ` + ${counts[L.key].aliases} alias stubs` : '')).join(' · '));
console.log(`${hiddenN} of them noindex (not on any shelf) · old help/ pages now stubs: ` +
            `${gone.kept} to the help app (unlabelled), ${gone.removed} to the index (article gone)`);
