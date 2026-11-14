#!/usr/bin/env node
/* The game's note bucket -> the two shapes the site reads.
 *
 *   /tmp/news.xml (live)  ->  data/news-all.json   every entry, for news.html
 *                         ->  data/news.json       the newest 8, for the home page
 *
 * English translations live in site.js/news-en.json ({id: {subject, text}},
 * written by the workspace's dl-narrative.py after each Discord post). Rows
 * with one carry en_subject/en_text. The EN site shows only those rows, so
 * news.json is the newest 8 overall PLUS the newest 8 translated ones: the
 * widget slices 8 of whichever set its language needs.
 *
 * The home page must NOT pull the full archive: 910 entries are ~940 KB, and
 * that is a lot of weight for a widget showing eight cards above the fold.
 *
 * It also writes one static page per note and language, plus an index per
 * language, for search and answer engines (the news app renders in the
 * browser, so a crawler sees an empty shell there):
 *
 *   en/news/<id>.html   the English translation, or a note written in English
 *   ua/news/<id>.html   a note written in Ukrainian
 *   ru/news/<id>.html   a note written in Russian
 *   data/news-pages.json  what was written, for the sitemap
 *
 * The game keeps no language on a note, so originalLang() reads it off the
 * letters. Every row in news-all.json carries the result as `lang`.
 *
 * usage: node site.js/build-news.js [path-to-news.xml] [out-dir] [static-dir]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../static');
const SRC = process.argv[2] || path.join(ROOT, 'data/news.xml');
const OUT = process.argv[3] || path.join(ROOT, 'data');
const HOME_COUNT = 8;                         // news.js slices the same number
const EN_SRC = path.join(__dirname, 'news-en.json');
const STATIC = path.resolve(process.argv[4] || ROOT);

if (!fs.existsSync(SRC)) {
    // Unlike the searcher and help dumps, which the game rewrites on a timer,
    // news.xml only appears when someone runs 'webdump news' in game. A missing
    // one means stale news, not a broken build -- leave whatever is already
    // there and let the deploy go green.
    console.error('no news.xml at ' + SRC + " -- run 'webdump news' in game; keeping existing data");
    process.exit(0);
}

const xml = fs.readFileSync(SRC, 'utf8');
const en = fs.existsSync(EN_SRC) ? JSON.parse(fs.readFileSync(EN_SRC, 'utf8')) : {};

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
    const t = en[id];
    if (t && t.subject && t.text) {
        rows[rows.length - 1].en_subject = t.subject;
        rows[rows.length - 1].en_text = t.text;
    }
}
rows.sort((a, b) => b.id - a.id);            // ids are unix timestamps

/* The language a note was written in: 'en' | 'ua' | 'ru'. The game keeps none,
 * so it is read off the letters of subject + text:
 *   - under a fifth of the letters Cyrillic: English. The 2023-2024 notes, and
 *     the 2001-2004 coders' changelogs, which are English bullets signed in
 *     Cyrillic; notes that only quote English skill names stay Russian,
 *   - else letters only one of the two languages has: і ї є ґ ʼ (and a Latin i
 *     between Cyrillic letters, which older posts typed for і) for Ukrainian,
 *     ы э ё ъ for Russian. Ukrainian needs at least three and more than the
 *     Russian ones: a Russian note that ends "Слава Українi" is still Russian,
 *   - anything else is Russian, the language of the whole archive before
 *     2022 -- mostly one-liners like "краш" or "реморт". */
const langStats = { en: 0, ua: 0, ru: 0, guessed: 0 };
function originalLang(r) {
    const s = r.subject + '\n' + r.text;
    const cyr = (s.match(/[а-яёіїєґ]/gi) || []).length;
    const lat = (s.match(/[a-z]/gi) || []).length;
    if (cyr < 0.2 * (cyr + lat)) { langStats.en++; return 'en'; }
    const ua = (s.match(/[іїєґʼ]/gi) || []).length + (s.match(/[а-яґєії]i|i[а-яґєії]/gi) || []).length;
    const ru = (s.match(/[ыэёъ]/gi) || []).length;
    if (ua >= 3 && ua > ru) { langStats.ua++; return 'ua'; }
    if (!ru) langStats.guessed++;
    langStats.ru++;
    return 'ru';
}
rows.forEach(r => { r.lang = originalLang(r); });

const enRows = rows.filter(r => r.en_subject);
const home = rows.slice(0, HOME_COUNT);
enRows.slice(0, HOME_COUNT).forEach(r => { if (home.indexOf(r) < 0) home.push(r); });
home.sort((a, b) => b.id - a.id);

fs.writeFileSync(path.join(OUT, 'news-all.json'), JSON.stringify(rows));
fs.writeFileSync(path.join(OUT, 'news.json'), JSON.stringify(home));

const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
const years = rows.map(r => (r.date.match(/\d{4}$/) || [''])[0]).filter(Boolean);
console.log(`${rows.length} entries · ${years[years.length - 1]}–${years[0]}`);
console.log('news-all.json  ' + kb('news-all.json'));
console.log('news.json      ' + kb('news.json') + `  (${home.length} rows: newest ${HOME_COUNT} + newest ${HOME_COUNT} EN)`);
console.log(`EN translations: ${enRows.length} of ${Object.keys(en).length} in news-en.json matched`);
console.log(`written in: RU ${langStats.ru} (${langStats.guessed} of them with no Russian-only letter), ` +
            `UA ${langStats.ua}, EN ${langStats.en}`);

writePages(rows);

// ---- static pages -----------------------------------------------------------
function writePages(rows) {
    const { langPage, writeTree, esc, BASE } = require('./shell.js');
    const LANGS = {
        en: { html: 'en', dir: '/en/news/' },
        ua: { html: 'uk', dir: '/ua/news/' },
        ru: { html: 'ru', dir: '/ru/news/' },
    };
    const T = {
        news:   { en: 'DreamLand news', ua: 'Новини DreamLand', ru: 'Новости DreamLand' },
        intro:  {
            en: 'The notes the game has posted about what changed in the world, newest first: those written in English or translated into it. The rest are in Ukrainian and Russian.',
            ua: 'Усі записи гри про те, що змінилося у світі, від найновіших. Тут ті, що написані українською.',
            ru: 'Все записи игры о том, что изменилось в мире, от самых новых. Здесь те, что написаны по-русски.',
        },
        desc:   {
            en: 'The changelog of DreamLand MUD in English: new areas, classes, skills, quests and fixes, as posted in the game.',
            ua: 'Новини DreamLand MUD українською: нові зони, класи, вміння, квести й виправлення, як їх оголошено у грі.',
            ru: 'Новости DreamLand MUD на русском: новые зоны, классы, умения, квесты и исправления, как их объявили в игре.',
        },
        all:    { en: 'All news', ua: 'Усі новини', ru: 'Все новости' },
        app:    { en: 'News with search by year', ua: 'Новини з вибором року', ru: 'Новости с выбором года' },
        play:   { en: 'Play in the browser', ua: 'Грати в браузері', ru: 'Играть в браузере' },
        by:     { en: 'by', ua: 'автор:', ru: 'автор:' },
        crumbs: { en: 'Breadcrumb', ua: 'Навігація', ru: 'Навигация' },
        years:  { en: 'Years', ua: 'Роки', ru: 'Годы' },
        count:  { en: n => n + ' notes', ua: n => 'записів: ' + n, ru: n => 'записей: ' + n },
    };

    /* versions[id] = {lang: {subject, text}} for every page that will exist */
    const versions = {};
    for (const r of rows) {
        const v = {};
        if (r.en_subject) v.en = { subject: r.en_subject, text: r.en_text };
        if (!(r.lang === 'en' && v.en)) v[r.lang] = { subject: r.subject, text: r.text };
        versions[r.id] = v;
    }
    const pathOf = (l, id) => LANGS[l].dir + id + '.html';
    function siblings(id) {
        const v = versions[id], alt = {}, sw = {};
        for (const l of ['en', 'ua', 'ru']) {
            if (v[l]) alt[LANGS[l].html] = pathOf(l, id);
            sw[LANGS[l].html] = v[l] ? pathOf(l, id) : '/news.html#n' + id;
        }
        return { alt, sw, xdefault: alt.en || alt.uk || alt.ru };
    }
    const iso = id => new Date(id * 1000).toISOString();
    function dateIn(l, r) {
        try {
            return new Date(r.id * 1000).toLocaleDateString(LANGS[l].html,
                { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
        } catch (e) { return r.date; }
    }
    /* blank lines split paragraphs; inside one, line breaks and leading
       indentation stay as written (pre-wrap) */
    function paras(text) {
        return text.split(/\n[ \t]*\n/).filter(p => p.trim())
            .map(p => '<p>' + esc(p.replace(/^\n+|\s+$/g, '')) + '</p>').join('\n');
    }
    function plain(s) { return s.replace(/\s+/g, ' ').trim(); }
    function clip(s, n) {
        return s.length <= n ? s : s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...';
    }

    function notePage(l, r) {
        const L = LANGS[l], v = versions[r.id][l];
        const { alt, sw, xdefault } = siblings(r.id);
        const url = pathOf(l, r.id);
        const description = clip(plain(v.text), 160) || v.subject;
        return langPage({
            lang: L.html, path: url,
            title: T.news[l] + ': ' + v.subject,
            description, alternates: alt, xdefault, switchTo: sw,
            css: ['helpart.css', 'hstatic.css'], section: 'news.html',
            jsonld: {
                '@context': 'https://schema.org', '@type': 'NewsArticle',
                headline: clip(v.subject, 110), description, inLanguage: L.html,
                datePublished: iso(r.id), url: BASE + url, mainEntityOfPage: BASE + url,
                author: { '@type': 'Person', name: r.from },
                publisher: { '@type': 'Organization', name: 'DreamLand MUD', url: BASE + '/' },
            },
            body: `<main class="wrap hstatic" id="main">
    <nav class="hstatic__crumbs" aria-label="${T.crumbs[l]}"><a href="${L.dir}">${T.news[l]}</a> › <a href="/news.html#n${r.id}" data-golang="${L.html}">${T.all[l]}</a></nav>
    <article class="hart">
        <h1>${esc(v.subject)}</h1>
        <p class="hart__meta"><time datetime="${iso(r.id)}">${esc(dateIn(l, r))}</time> · ${T.by[l]} ${esc(r.from)}</p>
        <div class="hart__body hart__body--note">
${paras(v.text)}
        </div>
    </article>
    <p class="hstatic__more">
        <a class="btn btn--gold" href="/play/?src=news">${T.play[l]}</a>
        <a class="btn btn--ghost" href="${L.dir}">${T.news[l]}</a>
    </p>
</main>`,
        });
    }

    function indexPage(l, list) {
        const L = LANGS[l];
        const years = [];
        list.forEach(r => {
            const y = new Date(r.id * 1000).getUTCFullYear();
            if (!years.length || years[years.length - 1].y !== y) years.push({ y, rows: [] });
            years[years.length - 1].rows.push(r);
        });
        const alt = {}, sw = {};
        Object.keys(LANGS).forEach(k => { alt[LANGS[k].html] = LANGS[k].dir; sw[LANGS[k].html] = LANGS[k].dir; });
        return langPage({
            lang: L.html, path: L.dir,
            title: T.news[l], description: T.desc[l],
            alternates: alt, xdefault: LANGS.en.dir, switchTo: sw,
            css: ['helpart.css', 'hstatic.css'], section: 'news.html',
            jsonld: { '@context': 'https://schema.org', '@type': 'CollectionPage',
                      name: T.news[l], description: T.desc[l], inLanguage: L.html, url: BASE + L.dir },
            body: `<section class="pagehead">
    <div class="wrap">
        <h1>${T.news[l]}</h1>
        <p>${T.intro[l]}</p>
        <p class="hstatic__more">
            <a class="btn btn--gold" href="/play/?src=news">${T.play[l]}</a>
            <a class="btn btn--ghost" href="/news.html" data-golang="${L.html}">${T.app[l]}</a>
        </p>
    </div>
</section>

<main class="wrap hstatic hstatic--index" id="main">
    <nav class="hstatic__toc" aria-labelledby="toc">
        <h2 id="toc">${T.years[l]} <span class="hstatic__n">${T.count[l](list.length)}</span></h2>
        <ul>
${years.map(g => `            <li><a href="#y${g.y}">${g.y}</a> <span class="hstatic__n">${g.rows.length}</span></li>`).join('\n')}
        </ul>
    </nav>
${years.map(g => `
    <section class="hstatic__shelf" aria-labelledby="y${g.y}">
        <h2 id="y${g.y}">${g.y}</h2>
        <ul class="hstatic__list">
${g.rows.map(r => `            <li><span class="hstatic__date">${esc(dateIn(l, r))}</span> <a href="${pathOf(l, r.id)}">${esc(versions[r.id][l].subject)}</a></li>`).join('\n')}
        </ul>
    </section>`).join('\n')}
</main>`,
        });
    }

    const manifest = [{ alternates: { en: '/en/news/', uk: '/ua/news/', ru: '/ru/news/' }, xdefault: '/en/news/' }];
    const counts = {};
    for (const l of Object.keys(LANGS)) {
        const list = rows.filter(r => versions[r.id][l]);
        const pages = { 'index.html': indexPage(l, list) };
        list.forEach(r => { pages[r.id + '.html'] = notePage(l, r); });
        writeTree(path.join(STATIC, l, 'news'), pages);
        counts[l] = list.length;
    }
    rows.forEach(r => {
        const { alt, xdefault } = siblings(r.id);
        manifest.push({ alternates: alt, xdefault });
    });
    fs.writeFileSync(path.join(OUT, 'news-pages.json.tmp'), JSON.stringify(manifest));
    fs.renameSync(path.join(OUT, 'news-pages.json.tmp'), path.join(OUT, 'news-pages.json'));
    console.log(`news pages: EN ${counts.en}, UA ${counts.ua}, RU ${counts.ru}`);
}
