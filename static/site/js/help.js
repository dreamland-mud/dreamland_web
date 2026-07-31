/* Help browser over the game's own dump.
 *
 * The markup renderer lives in helpmarkup.js — the maps page shows the same
 * articles in its zone sidebar and needs the identical treatment. */
(function () {
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
    function label(a) { return t(a.toc) || t(a.title) || (a.kwList && a.kwList[0]) || ('#' + a.id); }

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
    var KINDS = [
        { label: 'spell',    en: 'spell',    ua: 'закляття' },
        { label: 'social',   en: 'social',   ua: 'соціал' },
        { label: 'race',     en: 'race',     ua: 'раса' },
        { label: 'raceaptitude', en: 'race', ua: 'раса' },
        { label: 'religion', en: 'religion', ua: 'релігія' },
        { label: 'class',    en: 'class',    ua: 'клас' },
        { label: 'skillgroup', en: 'group',  ua: 'група' },
        { label: 'craftskill', en: 'craft',  ua: 'ремесло' },
        { label: 'craft',    en: 'craft',    ua: 'ремесло' },
        { label: 'item',     en: 'behavior', ua: 'поведінка' },
        { label: 'clanskill', en: 'skill',   ua: 'вміння' },
        { label: 'cardskill', en: 'skill',   ua: 'вміння' },
        { label: 'language', en: 'language', ua: 'мова' },
        { label: 'skill',    en: 'skill',    ua: 'вміння' },
        { label: 'area',     en: 'zone',     ua: 'зона' },
        { label: 'cmd',      en: 'command',  ua: 'команда' },
    ];

    function kindOf(a) {
        var labels = (a && a.labels) || [];
        for (var i = 0; i < KINDS.length; i++)
            if (labels.indexOf(KINDS[i].label) >= 0) return KINDS[i];
        return null;
    }
    function badge(a) {
        var k = kindOf(a);
        if (!k) return '';
        return '<span class="hkind">' + esc(L() === 'ua' ? k.ua : k.en) + '</span>';
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
            .then(function (d) { overlay = d || {}; });
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
        });
        return bodiesReady;
    }

    fetchData('help-index.json')
        .then(function (data) {
            index = data;
            index.forEach(function (a) { byId[a.id] = a; });
            buildKeywordIndex();
            ready = true;              // search, random and the rail work from here
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
        index.forEach(function (a) {
            var s = sectionFor(a);
            if (s) groups[s.key].items.push(a);   // null = deliberately not indexed
        });

        var html = '', opts = '';
        SECTIONS.concat([FALLBACK]).forEach(function (s) {
            var g = groups[s.key];
            if (!g.items.length) return;
            g.items.sort(function (x, y) { return t(x.toc).localeCompare(t(y.toc)); });
            opts += '<option value="' + s.key + '">' +
                esc(L() === 'ua' ? s.ua : s.en) + ' (' + g.items.length + ')</option>';
            html += '<details class="hcat" data-cat="' + s.key + '"><summary>' +
                '<span class="hcat__name" lang="en">' + esc(s.en) + '</span>' +
                '<span class="hcat__name" lang="uk">' + esc(s.ua) + '</span>' +
                '<span class="hcat__n">' + g.items.length + '</span></summary><ul>' +
                g.items.map(function (a) {
                    return '<li><a href="#h' + a.id + '" data-hid="' + a.id + '">' +
                        esc(label(a)) + badge(a) + '</a></li>';
                }).join('') + '</ul></details>';
        });
        idxEl.innerHTML =
            '<select class="catpick" id="helpCatPick" aria-label="' +
                esc(L() === 'ua' ? 'Категорія довідки' : 'Help category') + '">' + opts + '</select>' +
            html;
        var pick = document.getElementById('helpCatPick');
        if (pick) pick.addEventListener('change', function () { setCat(pick.value); });
        setCat(curCat);
    }

    // ---- article ----------------------------------------------------------
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
            '</article>';
        artEl.scrollTop = 0;
    }

    /* Landing on the page with no article chosen, open the one that explains
       the help system itself — the same thing a bare `help` gives you in game. */
    var DEFAULT_ID = 995;
    function openFromHash() {
        var m = /^#h(\d+)$/.exec(location.hash || '');
        if (m) show(parseInt(m[1], 10));
        else show(byId[DEFAULT_ID] ? DEFAULT_ID : (index[0] || {}).id);
    }
    window.addEventListener('hashchange', openFromHash);

    // ---- search -----------------------------------------------------------
    function searchFor(q) {
        q = q.trim().toLowerCase();
        if (!q) { resEl.hidden = true; resEl.innerHTML = ''; return; }
        var exact = [], partial = [];
        for (var i = 0; i < index.length && exact.length + partial.length < 60; i++) {
            var a = index[i];
            var kws = (a.kwList || []).map(function (k) { return k.toLowerCase(); });
            var title = label(a).toLowerCase();
            if (kws.indexOf(q) >= 0) exact.push(a);
            else if (title.indexOf(q) >= 0 || kws.some(function (k) { return k.indexOf(q) === 0; })) partial.push(a);
        }
        var hits = exact.concat(partial).slice(0, 24);
        resEl.hidden = false;
        resEl.innerHTML = hits.length
            ? hits.map(function (a) {
                return '<a href="#h' + a.id + '" data-hid="' + a.id + '"><b>' +
                    esc(label(a)) + badge(a) + '</b><span>' +
                    esc((a.kwList || []).slice(0, 4).join(' · ').toLowerCase()) + '</span></a>';
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
