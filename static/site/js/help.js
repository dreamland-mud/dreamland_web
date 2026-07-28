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

    // ---- categories: 70 dump labels folded into something a human can scan ----
    var SECTIONS = [
        { key: 'start',   labels: ['info','system','char','learn','position','move','comm','config','client','note','language','service'],
          en: 'Getting started',   ua: 'З чого почати' },
        { key: 'cmd',     labels: ['cmd','combat','fight','group','locks','milking'],
          en: 'Commands',          ua: 'Команди' },
        /* spells first: a spell is also tagged with its class's -skills label,
           and whichever section matches first wins */
        { key: 'magic',   labels: ['spell','magic'],
          en: 'Spells & magic',    ua: 'Закляття й магія' },
        { key: 'classes', labels: ['class','skillgroup'], skillish: true,
          en: 'Classes & skills',  ua: 'Класи й уміння' },
        { key: 'races',   labels: ['race','raceaptitude','religion'],
          en: 'Races & religions', ua: 'Раси й релігії' },
        { key: 'society', labels: ['clan','family','bank','shop','quest','craft','cityguard'],
          en: 'Clans & society',   ua: 'Клани й суспільство' },
        { key: 'items',   labels: ['item','items','food'],
          en: 'Items',             ua: 'Речі' },
        { key: 'world',   labels: ['area'],
          en: 'World & zones',     ua: 'Світ і зони' },
        { key: 'social',  labels: ['social'],
          en: 'Socials',           ua: 'Соціали' },
    ];
    var FALLBACK = { key: 'more', labels: [], en: 'Everything else', ua: 'Решта' };

    function sectionFor(labels) {
        if (!labels || !labels.length) return FALLBACK;
        for (var i = 0; i < SECTIONS.length; i++) {
            var s = SECTIONS[i];
            for (var j = 0; j < labels.length; j++) {
                if (s.labels.indexOf(labels[j]) >= 0) return s;
                if (s.skillish && /skills?$/.test(labels[j])) return s;
            }
        }
        return FALLBACK;
    }

    // ---- data -------------------------------------------------------------
    var index = [], byId = {}, bodyRu = {}, overlay = {}, ready = false;

    function bodyFor(id) {
        var o = overlay[id];
        return (o != null && o !== '') ? o : (bodyRu[id] || '');
    }

    function loadOverlay(lang) {
        return fetch('data/help-body-' + (lang === 'ua' ? 'ua' : 'en') + '.json')
            .then(function (r) { return r.ok ? r.json() : {}; })
            .catch(function () { return {}; })
            .then(function (d) { overlay = d || {}; });
    }

    Promise.all([
        fetch('data/help-index.json').then(function (r) { return r.json(); }),
        fetch('data/help-body-ru.json').then(function (r) { return r.json(); }),
        loadOverlay(L())
    ]).then(function (res) {
        index = res[0]; bodyRu = res[1];
        index.forEach(function (a) { byId[a.id] = a; });
        ready = true;
        buildIndex();
        openFromHash();
    }).catch(function () {
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
        index.forEach(function (a) { groups[sectionFor(a.labels).key].items.push(a); });

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
                        esc(t(a.toc) || t(a.title) || a.kw) + '</a></li>';
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
        if (!a) {
            artEl.innerHTML = '<p class="help-empty">' +
                (L() === 'ua' ? 'Такої статті немає.' : 'No such article.') + '</p>';
            return;
        }
        artEl.innerHTML =
            '<article class="hart" id="h' + a.id + '">' +
                '<h1>' + esc(t(a.title) || t(a.toc) || a.kw) + '</h1>' +
                '<div class="hart__body">' + DLMarkup.render(bodyFor(a.id)) + '</div>' +
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
            var title = (t(a.toc) || t(a.title) || '').toLowerCase();
            if (kws.indexOf(q) >= 0) exact.push(a);
            else if (title.indexOf(q) >= 0 || kws.some(function (k) { return k.indexOf(q) === 0; })) partial.push(a);
        }
        var hits = exact.concat(partial).slice(0, 24);
        resEl.hidden = false;
        resEl.innerHTML = hits.length
            ? hits.map(function (a) {
                return '<a href="#h' + a.id + '" data-hid="' + a.id + '"><b>' +
                    esc(t(a.toc) || t(a.title) || a.kw) + '</b><span>' +
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
            loadOverlay(L()).then(function () {
                buildIndex();
                openFromHash();
                if (searchEl && searchEl.value) searchFor(searchEl.value);
            });
        });
    });
})();
