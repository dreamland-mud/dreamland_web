/* The help corpus as the website ships it, for the MCP tools.
 *
 * Reads static/data/help-index.json + help-body-{ru,en,ua}.json, the files
 * site.js/build-help.js writes from the game's hourly dump. The dump is
 * rendered for a level-1 character, so immortal and level-gated articles are
 * not in it: whatever is here is already public on dreamland.rocks/help.html.
 * The files are re-read when help-index.json changes on disk.
 *
 * Ranking is the shared static/site/js/helpsearch.js, the same module the
 * site and the game client use.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('../static/site/js/helpsearch.js');

const SITE = 'https://dreamland.rocks/help.html';
const LANGS = ['ru', 'en', 'ua'];

/* Category keys come from site.js/help-category.js via the index `cat`.
   Names and order follow the site rail (static/site/js/help.js SECTIONS). */
const CATEGORIES = [
    { key: 'start',   en: 'Getting started',            ua: 'З чого почати',              ru: 'С чего начать' },
    { key: 'char',    en: 'Your character',             ua: 'Твій персонаж',              ru: 'Твой персонаж' },
    { key: 'skills',  en: 'Skills and learning',        ua: 'Вміння й навчання',          ru: 'Умения и обучение' },
    { key: 'magic',   en: 'Spells and magic',           ua: 'Закляття й магія',           ru: 'Заклинания и магия' },
    { key: 'combat',  en: 'Combat',                     ua: 'Бій',                        ru: 'Бой' },
    { key: 'classes', en: 'Classes',                    ua: 'Класи',                      ru: 'Классы' },
    { key: 'races',   en: 'Races',                      ua: 'Раси',                       ru: 'Расы' },
    { key: 'gods',    en: 'Gods and religions',         ua: 'Боги й релігії',             ru: 'Боги и религии' },
    { key: 'items',   en: 'Items and economy',          ua: 'Речі й господарство',        ru: 'Вещи и хозяйство' },
    { key: 'world',   en: 'World and travel',           ua: 'Світ і подорожі',            ru: 'Мир и путешествия' },
    { key: 'quests',  en: 'Quests',                     ua: 'Квести',                     ru: 'Квесты' },
    { key: 'society', en: 'Players and clans',          ua: 'Гравці й клани',             ru: 'Игроки и кланы' },
    { key: 'comm',    en: 'Communication and settings', ua: 'Спілкування й налаштування', ru: 'Общение и настройки' },
    { key: 'socials', en: 'Socials',                    ua: 'Соціали',                    ru: 'Социалы' },
];

// question words a phrase fallback should not rank by
const STOP = new Set(('how what who why when where which the and for with can does are you your get use about ' +
    'как что кто где когда зачем почему для это или как можно мне ' +
    'як що хто коли чому навіщо для або можна мені').split(' '));

class Corpus {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.mtime = 0;
    }

    file(name) { return path.join(this.dataDir, name); }

    // reload when the index changed; a half-written file keeps the old copy
    fresh() {
        let mtime;
        try { mtime = fs.statSync(this.file('help-index.json')).mtimeMs; }
        catch (e) { if (this.index) return this; throw e; }
        if (mtime === this.mtime) return this;
        try { this.load(); this.mtime = mtime; }
        catch (e) { if (!this.index) throw e; console.error('help reload failed, keeping the old corpus:', e.message); }
        return this;
    }

    load() {
        const read = name => JSON.parse(fs.readFileSync(this.file(name), 'utf8'));
        const index = read('help-index.json');
        const bodies = { ru: read('help-body-ru.json') };
        for (const l of ['en', 'ua']) {
            try { bodies[l] = read('help-body-' + l + '.json'); } catch (e) { bodies[l] = {}; }
        }
        const byId = new Map(index.map(a => [a.id, a]));
        const norm = k => String(k || '').replace(/^'|'$/g, '').trim().toLowerCase();
        const titlesOf = a => LANGS.reduce((t, l) => t.concat([a.toc && a.toc[l], a.title && a.title[l]]), []);
        // bare [links]: keywords first, then titles, first come wins, as on the site
        const byLink = new Map();
        const put = (k, id) => { k = norm(k); if (k && !byLink.has(k)) byLink.set(k, id); };
        index.forEach(a => (a.kwList || []).forEach(k => put(k, a.id)));
        index.forEach(a => titlesOf(a).forEach(t => put(t, a.id)));
        // lookups by name: a title is one article, a bare keyword may be shared
        // ("midgaard" sits on seven zones)
        const byTitle = new Map(), byKeyword = new Map();
        index.forEach(a => {
            titlesOf(a).forEach(t => { t = norm(t); if (t && !byTitle.has(t)) byTitle.set(t, a.id); });
            new Set((a.kwList || []).map(norm)).forEach(k => {
                if (!k) return;
                if (!byKeyword.has(k)) byKeyword.set(k, []);
                byKeyword.get(k).push(a.id);
            });
        });

        this.index = index;
        this.byId = byId;
        this.byLink = byLink;
        this.byTitle = byTitle;
        this.byKeyword = byKeyword;
        this.bodies = bodies;
        this.text = {};
        for (const l of LANGS) this.text[l] = S.textCache(id => this.body(id, l));
    }

    body(id, lang) {
        const o = this.bodies[lang] && this.bodies[lang][id];
        return o != null && o !== '' ? o : (this.bodies.ru[id] || '');
    }

    get(id) { return this.byId.get(id) || null; }

    /* { article } for an exact title or a keyword only one article has;
       { candidates } when the keyword is shared; else the top search hit. */
    find(keyword, lang) {
        const q = S.normQuery(keyword);
        if (this.byTitle.has(q)) return { article: this.get(this.byTitle.get(q)) };
        const ids = this.byKeyword.get(q) || [];
        if (ids.length === 1) return { article: this.get(ids[0]) };
        if (ids.length > 1) return { candidates: ids.map(id => this.get(id)) };
        const hit = this.search(keyword, lang, 1).hits[0];
        return hit ? { article: hit } : {};
    }

    /* The shared ranking on the whole query, then the game's suggestions
       (S.fuzzy: typos, layout, stems over keywords). A phrase neither finds
       ("how to level up") falls back to its words of 3+ letters:
       articles hit by more words first, then by their best rank. MCP clients
       type sentences far more often than the site's search box sees them.
       Returns { hits, words, suggested }: words is set when the word fallback
       ran, suggested (S.fuzzy hits with their hints) when the suggestions did. */
    search(query, lang, limit) {
        const p = S.parseQuery(S.normQuery(query));
        const hits = S.search(this.index, p.q, lang, this.text[lang], limit, p.test);
        if (hits.length) return { hits, words: null };
        // what `help` suggests in game: layout flip, typos, other word forms
        const sug = S.fuzzy(this.index, query, lang).slice(0, limit);
        if (sug.length) return { hits: sug.map(h => h.article), words: null, suggested: sug };
        const words = [...new Set(p.q.split(' ').filter(w => w.length >= 3 && !STOP.has(w)))];
        if (!words.length || (words.length === 1 && words[0] === p.q)) return { hits, words: null };
        const score = new Map();
        words.forEach(w => S.search(this.index, w, lang, this.text[lang], 200, p.test).forEach((a, rank) => {
            const s = score.get(a) || { n: 0, rank: Infinity };
            s.n++;
            s.rank = Math.min(s.rank, rank);
            score.set(a, s);
        }));
        const ranked = [...score.entries()]
            .sort((x, y) => (y[1].n - x[1].n) || (x[1].rank - y[1].rank))
            .slice(0, limit).map(e => e[0]);
        return { hits: ranked, words };
    }

    // { hits: [{ article, before, match, after }], words }, excerpts in the reader's language
    searchWithExcerpts(query, lang, limit) {
        const q = S.parseQuery(S.normQuery(query)).q;
        const r = this.search(query, lang, limit);
        const hits = r.hits.map(a => {
            const txt = this.text[lang](a.id);
            // in the fallback, mark the first of the words this article contains
            const w = r.words ? (r.words.find(w => txt.low.indexOf(w) >= 0) || r.words[0]) : q;
            const ex = S.excerpt(txt, w);
            return { article: a, before: ex[0], match: ex[1], after: ex[2] };
        });
        return { hits, words: r.words, suggested: r.suggested || null };
    }

    categories(lang) {
        const counts = {};
        this.index.forEach(a => { counts[a.cat] = (counts[a.cat] || 0) + 1; });
        return CATEGORIES.map(c => ({ key: c.key, name: c[lang], count: counts[c.key] || 0 }));
    }

    list(category, kindName) {
        return this.index
            .filter(a => (!category || a.cat === category) && (!kindName || (S.kind(a) || {}).en === kindName));
    }
}

// ---- rendering --------------------------------------------------------

const url = id => SITE + '#h' + id;
const title = (a, lang) => S.label(a, lang);
const kindOf = (a, lang) => { const k = S.kind(a); return k ? k[lang] : ''; };
const categoryName = (key, lang) => { const c = CATEGORIES.find(c => c.key === key); return c ? c[lang] : ''; };

function decode(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/* Article markup to Markdown. <c> colour spans go, <hh id> cross-references
   become links to the site, bare <hh>/<hg> resolve by their text like the
   site does, <hc> commands and <hs> speedwalks become code, <hl> keeps the URL. */
function toMarkdown(raw, corpus) {
    // entities stay encoded until the last step, so a decoded '<' is never
    // taken for a tag by the strip that follows
    const inner = s => s.replace(/<[^>]*>/g, '');
    const link = (text, id) => {
        const t = inner(text);
        if (id == null) id = corpus.byLink.get(decode(t).trim().toLowerCase());
        return id != null && corpus.get(Number(id)) ? '[' + t + '](' + url(id) + ')' : t;
    };
    let s = String(raw || '');
    s = s.replace(/<hh id='(\d+)'>([\s\S]*?)<\/hh>/g, (m, id, t) => link(t, id));
    s = s.replace(/<(hh|hg)>([\s\S]*?)<\/\1>/g, (m, tag, t) => link(t, null));
    s = s.replace(/<(hc|hs)>([\s\S]*?)<\/\1>/g, (m, tag, t) => '`' + inner(t) + '`');
    s = s.replace(/<hl>([\s\S]*?)<\/hl>/g, (m, t) => inner(t));
    s = decode(s.replace(/<[^>]*>/g, ''));
    return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { Corpus, CATEGORIES, LANGS, url, title, kindOf, categoryName, toMarkdown };
