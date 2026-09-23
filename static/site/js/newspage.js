/* The full news archive: 910 notes going back to 2001.
 *
 * Same shape as the help browser — a rail of everything on the left, the one
 * you picked on the right, whole. The home page keeps its own eight-card
 * widget on the trimmed data/news.json; this page is the only thing that pulls
 * the full archive, because it is the only thing that needs it.
 *
 * Entries have no per-language variants: a note was posted in whatever language
 * its author wrote it in (Russian until 2018, Ukrainian since). Only the chrome
 * switches; the text is shown as posted.
 */
(function () {
    'use strict';

    var listEl   = document.getElementById('newsList');
    var artEl    = document.getElementById('newsArticle');
    var searchEl = document.getElementById('newsSearch');
    if (!listEl || !artEl) return;

    function L() { return document.documentElement.getAttribute('data-lang') === 'uk' ? 'uk' : 'en'; }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    var UI = {
        search:   { en: 'Search the archive', uk: 'Пошук в архіві' },
        nothing:  { en: 'Nothing found.',     uk: 'Нічого не знайшлося.' },
        untitled: { en: '(no subject)',       uk: '(без теми)' },
        loading:  { en: 'Loading the archive…', uk: 'Вантажу архів…' },
        failed:   { en: 'Could not load the news.', uk: 'Не вдалося завантажити новини.' },
        count:    { en: 'entries',            uk: 'записів' },
        by:       { en: 'posted by',          uk: 'написав' }
    };
    function t(k) { return UI[k][L()]; }

    var items = [], byId = {}, current = null;

    function subjectOf(n) { return n.subject || t('untitled'); }

    // ---- rail -------------------------------------------------------------
    /* Narrow screens swap the stack of year bands for a picker: one year on
       show, its notes a horizontal swipe rather than a vertical mile. Wide
       screens never see the select and keep the accordions. */
    var mqNarrow = window.matchMedia('(max-width: 900px)');
    var yearPick = document.getElementById('newsYearPick');
    var curYear  = '';

    function setYear(y) {
        var bands = listEl.querySelectorAll('details.nyear');
        if (!bands.length) return;
        var hit = false;
        bands.forEach(function (d) { if (d.getAttribute('data-year') === y) hit = true; });
        if (!hit) y = bands[0].getAttribute('data-year');
        bands.forEach(function (d) {
            var on = d.getAttribute('data-year') === y;
            d.classList.toggle('nyear--active', on);
            // summary is hidden on narrow, so the open state has to be set here
            if (mqNarrow.matches) d.open = on;
        });
        curYear = y;
        if (yearPick && yearPick.value !== y) yearPick.value = y;
    }

    if (yearPick) yearPick.addEventListener('change', function () { setYear(yearPick.value); });
    mqNarrow.addEventListener('change', function () {
        if (mqNarrow.matches) setYear(curYear);
    });

    /* Grouped by year, because a flat list of 910 cards is a scroll with no
       landmarks. The newest year opens by default; a search opens everything
       it matched, since a hit hiding inside a collapsed year reads as no hit. */
    function drawList(filter) {
        var q = (filter || '').trim().toLowerCase();
        var rows = q ? items.filter(function (n) {
            return (n.subject + ' ' + n.from + ' ' + n.date + ' ' + n.text).toLowerCase().indexOf(q) >= 0;
        }) : items;

        if (!rows.length) {
            listEl.innerHTML = '<p class="newsnav__none">' + esc(t('nothing')) + '</p>';
            if (yearPick) yearPick.innerHTML = '';
            return;
        }

        var out = [], year = null, open = q ? ' open' : '';
        var first = true, opts = '';
        rows.forEach(function (n) {
            var y = (n.date.match(/\d{4}$/) || ['?'])[0];
            if (y !== year) {
                if (year !== null) out.push('</div></details>');
                year = y;
                var count = rows.filter(function (r) {
                    return (r.date.match(/\d{4}$/) || ['?'])[0] === y;
                }).length;
                opts += '<option value="' + esc(y) + '">' + esc(y) + ' (' + count + ')</option>';
                out.push('<details class="nyear" data-year="' + esc(y) + '"' +
                    (open || (first ? ' open' : '')) + '><summary>' +
                    '<span class="nyear__y">' + esc(y) + '</span>' +
                    '<span class="nyear__n">' + count + '</span></summary>' +
                    '<div class="nyear__items">');
                first = false;
            }
            out.push(
                '<button type="button" class="news-mini" data-nid="' + n.id + '"' +
                (n.id === current ? ' aria-current="true"' : '') + '>' +
                '<span class="news-mini__date">' + esc(n.date) + '</span>' +
                '<span class="news-mini__subject">' + esc(subjectOf(n)) + '</span>' +
                '</button>');
        });
        out.push('</div></details>');
        listEl.innerHTML = out.join('');
        if (yearPick) yearPick.innerHTML = opts;
        setYear(curYear);
    }

    /* Move the marker instead of redrawing the rail: a redraw would slam every
       year the reader opened shut again. If the current entry sits inside a
       closed year (a deep link into 2004), open that year and scroll to it. */
    function markCurrent() {
        listEl.querySelectorAll('.news-mini[aria-current]').forEach(function (b) {
            b.removeAttribute('aria-current');
        });
        var el = listEl.querySelector('.news-mini[data-nid="' + current + '"]');
        if (!el) return;
        el.setAttribute('aria-current', 'true');
        var det = el.closest('details');
        if (det && !det.open) det.open = true;
        /* on narrow screens only one year is on show, so a deep link into 2004
           has to move the picker there too -- otherwise it lands on a hidden band */
        if (det && det.getAttribute('data-year')) setYear(det.getAttribute('data-year'));
        el.scrollIntoView({ block: 'nearest' });
    }

    // ---- article ----------------------------------------------------------
    function show(id, scroll) {
        var n = byId[id];
        if (!n) return;
        current = id;
        artEl.innerHTML =
            '<article class="news-full" id="n' + n.id + '">' +
                '<div class="news-full__meta">' +
                    '<span class="news-full__date">' + esc(n.date) + '</span>' +
                    '<span class="news-full__from">' + esc(n.from) + '</span>' +
                '</div>' +
                '<h1 class="news-full__subject">' + esc(subjectOf(n)) + '</h1>' +
                '<div class="news-full__text">' + esc(n.text) + '</div>' +
            '</article>';
        markCurrent();
        if (scroll) artEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    function openFromHash(scroll) {
        var m = /^#n(\d+)$/.exec(location.hash || '');
        if (m && byId[+m[1]]) show(+m[1], scroll);
        else if (items.length) show(items[0].id, false);   // newest, by default
    }
    window.addEventListener('hashchange', function () { openFromHash(false); });

    listEl.addEventListener('click', function (ev) {
        var b = ev.target.closest ? ev.target.closest('.news-mini') : null;
        if (!b) return;
        var id = +b.getAttribute('data-nid');
        // let the hash carry it: these entries never had permalinks before
        if (location.hash === '#n' + id) show(id, true);
        else location.hash = '#n' + id;
    });

    if (searchEl) {
        var to;
        searchEl.addEventListener('input', function () {
            clearTimeout(to);
            to = setTimeout(function () { drawList(searchEl.value); markCurrent(); }, 140);
        });
    }

    function paintChrome() {
        if (searchEl) searchEl.setAttribute('placeholder', t('search'));
    }

    // language flip: chrome only — the notes themselves have one language each
    document.querySelectorAll('[data-setlang]').forEach(function (b) {
        b.addEventListener('click', function () {
            setTimeout(function () {
                paintChrome();
                drawList(searchEl ? searchEl.value : '');
                markCurrent();
            }, 0);
        });
    });

    paintChrome();
    artEl.innerHTML = '<p class="news-empty">' + esc(t('loading')) + '</p>';

    fetch('data/news-all.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            items = data || [];
            items.forEach(function (n) { byId[n.id] = n; });
            drawList('');
            openFromHash(false);
        })
        .catch(function () {
            artEl.innerHTML = '<p class="news-empty">' + esc(t('failed')) + '</p>';
        });
})();
