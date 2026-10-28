/* Help browser over the game's own dump.
 *
 * The markup renderer lives in helpmarkup.js — the maps page shows the same
 * articles in its zone sidebar and needs the identical treatment. Ranking,
 * facet words, kinds and excerpts live in helpsearch.js, shared with mudjs
 * and the MCP server. */
(function () {
    var S = window.DLHelpSearch;
    var idxEl   = document.getElementById('helpIndex');
    var artEl   = document.getElementById('helpArticle');
    var searchEl= document.getElementById('helpSearch');
    var resEl   = document.getElementById('helpResults');
    if (!idxEl || !artEl) return;

    function L() { return document.documentElement.getAttribute('data-lang') === 'uk' ? 'ua' : 'en'; }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }
    function t(obj) { return (obj && (obj[L()] || obj.ru)) || ''; }
    /* the index used to carry a joined `kw` string purely as a title fallback;
       it was 27% of the file, so the first keyword stands in for it */
    function label(a) { return S.label(a, L()); }

    /* ---- categories (HELP_IA.md) -------------------------------------------
     * The article's category is resolved at build time and shipped as `cat` in
     * help-index.json, so this file only has to know how to name and order the
     * categories. It used to fold 70 dump labels into ten sections by hand here,
     * which put 100+ articles into an "Everything else" bucket; that guesswork
     * now lives in one place (site.js/help-category.js) shared with the engine.
     *
     * Order is the reading order a newcomer wants, not alphabetical: where to
     * start, then your character, then what you do, then the world around it. */
    var SECTIONS = [
        { key: 'start',   en: 'Getting started',   ua: 'З чого почати' },
        { key: 'char',    en: 'Your character',    ua: 'Твій персонаж' },
        { key: 'skills',  en: 'Skills and learning', ua: 'Вміння й навчання' },
        { key: 'magic',   en: 'Spells and magic',    ua: 'Закляття й магія' },
        { key: 'combat',  en: 'Combat',            ua: 'Бій' },
        { key: 'classes', en: 'Classes',           ua: 'Класи' },
        { key: 'races',   en: 'Races',             ua: 'Раси' },
        { key: 'gods',    en: 'Gods and religions',  ua: 'Боги й релігії' },
        { key: 'items',   en: 'Items and economy',   ua: 'Речі й господарство' },
        { key: 'world',   en: 'World and travel',    ua: 'Світ і подорожі' },
        { key: 'quests',  en: 'Quests',            ua: 'Квести' },
        { key: 'society', en: 'Players and clans',   ua: 'Гравці й клани' },
        { key: 'comm',    en: 'Communication and settings',
          ua: 'Спілкування й налаштування' },
        { key: 'socials', en: 'Socials',           ua: 'Соціали' },
    ];
    /* Anything the resolver could not place. Should stay empty -- if this band
       ever appears, an article slipped through and the IA needs a rule, so it is
       deliberately not given a friendly name. */
    var FALLBACK = { key: 'more', en: 'Uncategorised', ua: 'Без категорії' };

    /* Immortal docs, licences and engine-internal articles stay reachable by
       search and by direct link, but never clutter the browsable index. */
    var HIDDEN = ['imm', 'credits', 'engine', 'deprecated'];

    function sectionFor(a) {
        var cat = a && a.cat;
        if (!cat || HIDDEN.indexOf(cat) >= 0) return null;
        for (var i = 0; i < SECTIONS.length; i++)
            if (SECTIONS[i].key === cat) return SECTIONS[i];
        return FALLBACK;
    }

    /* ---- type badge --------------------------------------------------------
     * The article's kind, taken from the facet labels the engine already ships.
     * The titles used to carry it as a prefix ("Skill 'accuracy'"), which sorted
     * the rail by type instead of by name and repeated the same word 800 times;
     * the name now stands alone and the kind is a chip beside it. Order matters
     * for the same reason it does in the category resolver: spell before skill,
     * or every spell reads as a skill. */
    var kindOf = S.kind;
    function badge(a) {
        var k = kindOf(a);
        if (!k) return '';
        return '<span class="hkind">' + esc(L() === 'ua' ? k.ua : k.en) + '</span>';
    }

    /* ---- facet filter --------------------------------------------------------
     * Two ways in, same tests. The type picker narrows the rail and the search;
     * a leading facet word in the query narrows the search only, exactly like
     * `help spell fire` in game (plug-ins/comm/help.cpp help_facet_labels), so
     * the habit carries over. mudjs helpSearch.js keeps the same word table. */
    var hasLabel = S.hasLabel;
    function kindIs(name) { return function (a) { var k = kindOf(a); return !!k && k.en === name; }; }

    // the 13 player classes; other `<x>-skills` labels are clans and mob races
    var CLASSES = [
        { key: 'warrior', en: 'warrior', ua: 'воїн' },
        { key: 'ranger', en: 'ranger', ua: 'рейнджер' },
        { key: 'samurai', en: 'samurai', ua: 'самурай' },
        { key: 'thief', en: 'thief', ua: 'крадій' },
        { key: 'ninja', en: 'ninja', ua: 'ніндзя' },
        { key: 'paladin', en: 'paladin', ua: 'паладин' },
        { key: 'anti-paladin', en: 'anti-paladin', ua: 'анти-паладин' },
        { key: 'vampire', en: 'vampire', ua: 'вампір' },
        { key: 'cleric', en: 'cleric', ua: 'клірик' },
        { key: 'witch', en: 'witch', ua: 'відьма' },
        { key: 'warlock', en: 'warlock', ua: 'чаклун' },
        { key: 'druid', en: 'druid', ua: 'друїд' },
        { key: 'necromancer', en: 'necromancer', ua: 'некромант' },
    ];

    // picker entries: one per badge kind, in the rail's reading order
    var KIND_PICKS = [
        { key: 'skill', en: 'skills', ua: 'вміння' },
        { key: 'spell', en: 'spells', ua: 'закляття' },
        { key: 'command', en: 'commands', ua: 'команди' },
        { key: 'social', en: 'socials', ua: 'соціали' },
        { key: 'race', en: 'races', ua: 'раси' },
        { key: 'class', en: 'classes', ua: 'класи' },
        { key: 'religion', en: 'religions', ua: 'релігії' },
        { key: 'zone', en: 'zones', ua: 'зони' },
        { key: 'craft', en: 'crafts', ua: 'ремесла' },
        { key: 'group', en: 'skill groups', ua: 'групи вмінь' },
        { key: 'behavior', en: 'behaviors', ua: 'поведінки' },
        { key: 'language', en: 'languages', ua: 'мови' },
    ];

    function pickTest(v) {
        if (!v) return null;
        var m = /^(k|c):(.+)$/.exec(v);
        if (!m) return null;
        if (m[1] === 'c') {
            var cls = CLASSES.filter(function (c) { return c.key === m[2]; })[0];
            return cls ? function (a) { return hasLabel(a, cls.key + '-skills'); } : null;
        }
        var kp = KIND_PICKS.filter(function (k) { return k.key === m[2]; })[0];
        return kp ? kindIs(kp.key) : null;
    }

    var kindPick = '';                      // picker value: '' | 'k:<kind>' | 'c:<class>'
    var kindTest = null;
    function passes(a) { return !kindTest || kindTest(a); }

    // ?kind=spell or ?class=warrior, so a filtered view can be linked
    function readPickFromUrl() {
        var p = new URLSearchParams(location.search);
        var v = p.get('class') ? 'c:' + p.get('class') : (p.get('kind') ? 'k:' + p.get('kind') : '');
        kindTest = pickTest(v);
        kindPick = kindTest ? v : '';
    }
    function writePickToUrl() {
        var p = new URLSearchParams(location.search);
        p.delete('kind'); p.delete('class');
        if (kindPick) p.set(kindPick.charAt(0) === 'c' ? 'class' : 'kind', kindPick.slice(2));
        var s = p.toString();
        history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
    }

    // ---- data -------------------------------------------------------------
    var index = [], byId = {}, bodyRu = {}, overlay = {}, ready = false;
    var byKeyword = {};

    /* The [square bracket] references in the corpus arrive with no article id
       (helpformatter.cpp emits a bare {hh), so they are resolved here the same
       way the game client resolves them: by the anchor text. Keywords first,
       then the visible title, which is what anchors like "Traveller's Comfort"
       are actually written against. */
    function buildKeywordIndex() {
        byKeyword = {};
        function put(key, id) {
            if (!key) return;
            key = key.trim().toLowerCase();
            if (key && byKeyword[key] === undefined) byKeyword[key] = id;
        }
        index.forEach(function (a) {
            (a.kwList || []).forEach(function (k) { put(String(k).replace(/^'|'$/g, ''), a.id); });
        });
        // second pass: titles never outrank a real keyword
        index.forEach(function (a) {
            ['ru', 'en', 'ua'].forEach(function (l) {
                put((a.toc && a.toc[l]) || '', a.id);
                put((a.title && a.title[l]) || '', a.id);
            });
        });
    }
    function resolveLink(text) {
        var id = byKeyword[String(text || '').trim().toLowerCase()];
        return id === undefined ? null : id;
    }

    function bodyFor(id) {
        var o = overlay[id];
        return (o != null && o !== '') ? o : (bodyRu[id] || '');
    }

    /* Fetch a data file, preferring the gzipped copy.
     *
     * nginx here compresses nothing but text/html (gzip_types is commented out
     * and the config is root-only), so these JSONs would otherwise travel raw --
     * about 3 MB for one visit. The .gz is fetched as opaque bytes and inflated
     * with DecompressionStream, which is the one part of the pipeline we own.
     * Anything without that API, or any missing .gz, falls back to the plain
     * file, so this can never be the reason the page fails to load. */
    function fetchData(name) {
        var plain = function () {
            return fetch('data/' + name).then(function (r) {
                if (!r.ok) throw new Error(name);
                return r.json();
            });
        };
        if (typeof DecompressionStream !== 'function') return plain();

        return fetch('data/' + name + '.gz').then(function (r) {
            if (!r.ok || !r.body) throw new Error('no gz');
            return new Response(
                r.body.pipeThrough(new DecompressionStream('gzip'))
            ).json();
        }).catch(plain);
    }

    function loadOverlay(lang) {
        return fetchData('help-body-' + (lang === 'ua' ? 'ua' : 'en') + '.json')
            .catch(function () { return {}; })
            .then(function (d) { overlay = d || {}; textFor = null; });
    }

    /* The index is ~0.5 MB and the bodies are ~5 MB across the three languages.
       Waiting on all of it before doing anything left search and the random
       button dead for seconds after the page looked ready. Only the index gates
       the page now; the bodies stream in behind it and an article that is asked
       for early waits on its own. */
    var bodiesReady = null;          // Promise, resolved when bodyRu + overlay are in
    var bodiesIn = false;            // an article's body may legitimately be ''
    var pendingId = 0;               // article requested before the bodies landed

    function loadBodies() {
        if (bodiesReady) return bodiesReady;
        bodiesReady = Promise.all([
            fetchData('help-body-ru.json'),
            loadOverlay(L())
        ]).then(function (res) {
            bodyRu = res[0];
            bodiesIn = true;
            if (pendingId) { var id = pendingId; pendingId = 0; show(id); }
            if (searchEl && searchEl.value && !resEl.hidden) searchFor(searchEl.value);
        });
        return bodiesReady;
    }

    fetchData('help-index.json')
        .then(function (data) {
            index = data;
            index.forEach(function (a) { byId[a.id] = a; });
            buildKeywordIndex();
            ready = true;              // search, random and the rail work from here
            readPickFromUrl();
            buildIndex();
            openFromHash();
            loadBodies();
        })
        .catch(function () {
            artEl.innerHTML = '<p class="help-empty">' +
                (L() === 'ua' ? 'Не вдалося завантажити довідку.' : 'Could not load the help.') + '</p>';
        });

    // ---- category index ---------------------------------------------------
    /* Narrow screens get a picker instead of the accordion stack: thirteen
       collapsed bands pushed the article itself the better part of a screen
       down. The picker says which single category is on show -- same DOM, one
       band of it visible. Wide screens never see the select and keep the
       accordions exactly as they were. */
    var mqNarrow = window.matchMedia('(max-width: 900px)');
    var curCat = '';

    function setCat(key) {
        var cats = idxEl.querySelectorAll('details.hcat');
        if (!cats.length) return;
        var hit = false;
        cats.forEach(function (d) { if (d.getAttribute('data-cat') === key) hit = true; });
        if (!hit) key = cats[0].getAttribute('data-cat');
        cats.forEach(function (d) {
            var on = d.getAttribute('data-cat') === key;
            d.classList.toggle('hcat--active', on);
            // summary is hidden on narrow, so the open state has to be set here
            if (mqNarrow.matches) d.open = on;
        });
        curCat = key;
        var pick = document.getElementById('helpCatPick');
        if (pick && pick.value !== key) pick.value = key;
    }

    mqNarrow.addEventListener('change', function () {
        if (mqNarrow.matches) setCat(curCat);
        else idxEl.querySelectorAll('details.hcat').forEach(function (d) { d.open = false; });
    });

    function buildIndex() {
        var groups = {};
        SECTIONS.concat([FALLBACK]).forEach(function (s) { groups[s.key] = { sec: s, items: [] }; });
        var shown = 0;
        index.forEach(function (a) {
            var s = sectionFor(a);
            if (s && passes(a)) { groups[s.key].items.push(a); shown++; }   // null = deliberately not indexed
        });
        buildKindPick();

        var html = '', opts = '';
        SECTIONS.concat([FALLBACK]).forEach(function (s) {
            var g = groups[s.key];
            if (!g.items.length) return;
            g.items.sort(function (x, y) { return t(x.toc).localeCompare(t(y.toc)); });
            opts += '<option value="' + s.key + '">' +
                esc(L() === 'ua' ? s.ua : s.en) + ' (' + g.items.length + ')</option>';
            html += '<details class="hcat ds-menu__group" data-cat="' + s.key + '">' +
                '<summary class="ds-menu__cat">' +
                '<span class="hcat__name" lang="en">' + esc(s.en) + '</span>' +
                '<span class="hcat__name" lang="uk">' + esc(s.ua) + '</span>' +
                '<span class="ds-menu__count">' + g.items.length + '</span>' +
                '<span class="ds-menu__caret" aria-hidden="true"></span></summary>' +
                '<ul class="ds-menu__list">' +
                g.items.map(function (a) {
                    return '<li><a class="ds-menu__item" href="#h' + a.id + '" data-hid="' + a.id + '">' +
                        '<span class="ds-menu__name">' + esc(label(a)) + '</span>' + badge(a) + '</a></li>';
                }).join('') + '</ul></details>';
        });
        if (!shown) html = '<p class="help-empty">' +
            (L() === 'ua' ? 'Статей такого типу немає.' : 'No articles of this type.') + '</p>';
        idxEl.innerHTML =
            (opts ? '<select class="catpick" id="helpCatPick" aria-label="' +
                esc(L() === 'ua' ? 'Категорія довідки' : 'Help category') + '">' + opts + '</select>' : '') +
            html;
        var pick = document.getElementById('helpCatPick');
        if (pick) pick.addEventListener('change', function () { setCat(pick.value); });
        setCat(curCat);
        return shown;
    }

    /* The picker lists only what the rail can show, with the count it would
       show, so no option leads to an empty rail. */
    var kindEl = document.getElementById('helpKind');
    function buildKindPick() {
        if (!kindEl) return;
        var ua = L() === 'ua';
        function count(test) {
            var n = 0;
            index.forEach(function (a) { if (sectionFor(a) && test(a)) n++; });
            return n;
        }
        function opt(v, text, n) {
            return '<option value="' + esc(v) + '"' + (v === kindPick ? ' selected' : '') + '>' +
                esc(text) + (n == null ? '' : ' (' + n + ')') + '</option>';
        }
        var html = opt('', ua ? 'Усі типи' : 'All types', null);
        KIND_PICKS.forEach(function (k) {
            var n = count(kindIs(k.key));
            if (n) html += opt('k:' + k.key, ua ? k.ua : k.en, n);
        });
        var cls = '';
        CLASSES.forEach(function (c) {
            var n = count(function (a) { return hasLabel(a, c.key + '-skills'); });
            if (n) cls += opt('c:' + c.key, ua ? c.ua : c.en, n);
        });
        if (cls) html += '<optgroup label="' + esc(ua ? 'Вміння класу' : 'Class skills') + '">' + cls + '</optgroup>';
        kindEl.innerHTML = html;
        kindEl.value = kindPick;
        kindEl.classList.toggle('is-on', !!kindPick);
        kindEl.setAttribute('aria-label', ua ? 'Тип статті' : 'Article type');
    }
    if (kindEl) kindEl.addEventListener('change', function () {
        kindPick = kindEl.value;
        kindTest = pickTest(kindPick);
        writePickToUrl();
        var n = buildIndex();
        markCurrent(curId);
        var st = document.getElementById('helpFilterStatus');
        if (st) st.textContent = L() === 'ua' ? ('Статей у списку: ' + n) : (n + ' articles listed');
        if (searchEl && searchEl.value) searchFor(searchEl.value);
    });

    // ---- article ----------------------------------------------------------
    // The automatic "see also": the same ids the game prints after the body.
    // A plain list of links, so a screen reader announces how many there are.
    function related(a) {
        var items = (a.related || []).map(function (id) { return byId[id]; })
            .filter(function (r) { return r; });
        if (!items.length) return '';
        var title = L() === 'ua' ? 'Див. також' : 'See also';
        return '<nav class="hart__related" aria-label="' + esc(title) + '">' +
            '<h2>' + esc(title) + '</h2><ul>' +
            items.map(function (r) {
                return '<li><a href="#h' + r.id + '" data-hid="' + r.id + '">' + esc(label(r)) + '</a></li>';
            }).join('') +
            '</ul></nav>';
    }

    function show(id) {
        var a = byId[id];
        if (a && !bodiesIn) {
            // the bodies are still on the wire -- claim the slot and come back
            pendingId = id;
            artEl.innerHTML = '<p class="help-empty">' +
                (L() === 'ua' ? 'Завантаження...' : 'Loading...') + '</p>';
            loadBodies();
            return;
        }
        if (!a) {
            artEl.innerHTML = '<p class="help-empty">' +
                (L() === 'ua' ? 'Такої статті немає.' : 'No such article.') + '</p>';
            return;
        }
        artEl.innerHTML =
            '<article class="hart" id="h' + a.id + '">' +
                '<h1>' + esc(label(a)) + badge(a) + '</h1>' +
                '<div class="hart__body">' +
                    DLMarkup.render(bodyFor(a.id), { resolveLink: resolveLink }) +
                '</div>' +
                related(a) +
            '</article>';
        artEl.scrollTop = 0;
        curId = a.id;
        markCurrent(a.id);
    }

    // the rail says where you are: the open article's item lights up, and on the
    // wide layout its category unfolds so the item is actually in view
    function markCurrent(id) {
        var cur = null;
        idxEl.querySelectorAll('.ds-menu__item').forEach(function (el) {
            var on = el.getAttribute('data-hid') === String(id);
            el.classList.toggle('is-on', on);
            if (on) { el.setAttribute('aria-current', 'page'); cur = el; }
            else el.removeAttribute('aria-current');
        });
        if (cur && !mqNarrow.matches) {
            var grp = cur.closest('details');
            if (grp) grp.open = true;
        }
    }

    /* Landing on the page with no article chosen, open the one that explains
       the help system itself — the same thing a bare `help` gives you in game. */
    var DEFAULT_ID = 995;
    var curId = 0;                   // the article on show, so a re-filtered rail can light it again
    function openFromHash() {
        var m = /^#h(\d+)$/.exec(location.hash || '');
        if (m) show(parseInt(m[1], 10));
        else show(byId[DEFAULT_ID] ? DEFAULT_ID : (index[0] || {}).id);
    }
    window.addEventListener('hashchange', openFromHash);

    // ---- search -----------------------------------------------------------
    /* Each hit shows a slice of the article in the page language with the query
       marked, instead of a keyword dump. Ranking and excerpts come from
       helpsearch.js; only the HTML around them lives here. */
    var textFor = null, textLang = '';   // S.textCache over the page language
    function textOf(id) {
        if (!bodiesIn) return null;
        if (!textFor || textLang !== L()) { textFor = S.textCache(bodyFor); textLang = L(); }
        return textFor(id);
    }

    function excerpt(txt, q) {
        var p = S.excerpt(txt, q);
        return p[1] ? esc(p[0]) + '<mark>' + esc(p[1]) + '</mark>' + esc(p[2]) : esc(p[0]);
    }

    function searchFor(q) {
        var facet = S.parseQuery(S.normQuery(q));
        q = facet.q;
        if (!q) { resEl.hidden = true; resEl.innerHTML = ''; return; }
        var hits = S.search(index, q, L(), bodiesIn ? textOf : null, 24, function (a) {
            return passes(a) && (!facet.test || facet.test(a));
        });
        resEl.hidden = false;
        resEl.innerHTML = hits.length
            ? hits.map(function (a) {
                var txt = textOf(a.id), ex = txt && txt.flat ? excerpt(txt, q) : '';
                var sub = ex
                    ? '<span class="hsearch__excerpt">' + ex + '</span>'
                    : '<span>' + esc((a.kwList || []).slice(0, 4).join(' · ').toLowerCase()) + '</span>';
                return '<a href="#h' + a.id + '" data-hid="' + a.id + '"><b>' +
                    esc(label(a)) + badge(a) + '</b>' + sub + '</a>';
              }).join('')
            : '<p class="help-empty">' + (L() === 'ua' ? 'Нічого не знайшлося.' : 'Nothing found.') + '</p>';
    }

    /* Random article: 1340 of them, most of which nobody would ever think to
       search for. It is the cheapest way to make the corpus browsable. */
    var randomBtn = document.getElementById('helpRandom');
    if (randomBtn) randomBtn.addEventListener('click', function () {
        if (!ready || !index.length) return;
        var a = index[Math.floor(Math.random() * index.length)];
        if (location.hash === '#h' + a.id) show(a.id);   // same one twice: no hashchange
        else location.hash = '#h' + a.id;
    });

    if (searchEl) {
        var to;
        searchEl.addEventListener('input', function () {
            clearTimeout(to);
            to = setTimeout(function () { if (ready) searchFor(searchEl.value); }, 140);
        });
        document.addEventListener('click', function (e) {
            if (!resEl.contains(e.target) && e.target !== searchEl) resEl.hidden = true;
        });
    }

    // the placeholder is an attribute, so the dual-DOM trick can't carry it
    function paintChrome() {
        if (searchEl) searchEl.setAttribute('placeholder',
            L() === 'ua' ? 'Шукай будь-що' : 'Search anything');
    }
    paintChrome();

    // language flip: swap the overlay, then redraw whatever is on screen
    document.querySelectorAll('[data-setlang]').forEach(function (b) {
        b.addEventListener('click', function () {
            paintChrome();
            if (!ready) return;
            bodiesReady = null;
            loadOverlay(L()).then(function () {
                buildKeywordIndex();
                buildIndex();
                openFromHash();
                if (searchEl && searchEl.value) searchFor(searchEl.value);
            });
        });
    });
})();
