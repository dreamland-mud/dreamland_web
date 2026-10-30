/* Client-side item searcher. Reimplements dreamland_web searcher.js/app.js
   filters over the bundled data/db_*.json dumps — no backend needed.
   Item names, zones and "found on" come from the game's own dump. The dump
   carries `name`/`nameEn`/`nameUa` (same for area/where) once the trilingual
   searcher.cpp is live; older dumps only have the bare Russian key, so every
   read goes through dl() and falls back to it. */
(function () {
    var T = function () { return document.documentElement.getAttribute('data-lang') === 'uk' ? 'uk' : 'en'; };
    function tr(o) { return o[T()]; }
    /* Pick the viewer-language variant of a dump field, falling back to the
       bare (Russian) key. Lets the same code run against old and new dumps. */
    function dl(item, key) {
        var suffix = T() === 'uk' ? 'Ua' : 'En';
        var v = item[key + suffix];
        if (v == null || v === '') v = item[key];
        return v == null ? '' : v;
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) {
        return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'; }); }
    var S = window.DLItemSearch;
    var num = S.num, nz = S.nz, sign = S.sign;

    var UI = {
        lvlRange:{ en: 'Level range', uk: 'Діапазон рівнів' },
        name:    { en: 'Name',      uk: 'Назва' },
        slot:    { en: 'Worn on',   uk: 'Куди' },
        wtype:   { en: 'Weapon type', uk: 'Тип зброї' },
        itype:   { en: 'Item type', uk: 'Тип' },
        reqstat: { en: 'Gives a bonus', uk: 'Дає бонус' },
        search:  { en: 'Search',    uk: 'Шукати' },
        reset:   { en: 'Reset',     uk: 'Скинути' },
        found:   { en: 'found',     uk: 'знайдено' },
        showing: { en: 'showing first', uk: 'показано перші' },
        none:    { en: 'Nothing matches. Loosen the filters a little.', uk: 'Нічого не знайшлося. Послаб фільтри.' },
        loading: { en: 'Searching the vaults…', uk: 'Шукаю в сховищах…' },
        anylvl:  { en: 'any',       uk: 'будь-який' },
        limited: { en: 'limited quantity', uk: 'обмежена кількість' },
        alignf:  { en: 'Usable by', uk: 'Кому доступна' },
        showLimited: { en: 'Show limited', uk: 'Показувати обмежені' },
        spellHint: { en: 'Type an English spell name, e.g. "cure light", or an item name.',
                     uk: 'Впиши англійську назву закляття, напр. "cure light", або назву речі.' }
    };
    // shared column headers
    var C = {
        name: { en: 'Name', uk: 'Назва' }, lvl: { en: 'Lvl', uk: 'Рів' },
        kind: { en: 'Kind', uk: 'Тип' }, slot: { en: 'Slot', uk: 'Куди' },
        bonus:{ en: 'Bonuses', uk: 'Бонуси' }, align:{ en: 'Align', uk: 'Натура' },
        zone: { en: 'Zone', uk: 'Зона' }, where:{ en: 'Found on', uk: 'Де' },
        dice: { en: 'Damage', uk: 'Урон' }, effects:{ en: 'Effects', uk: 'Ефекти' },
        slvl: { en: 'Spell lv', uk: 'Ур.закл' }, chg:{ en: 'Charges', uk: 'Заряди' },
        spells:{ en: 'Spells', uk: 'Закляття' }, aff:{ en: 'Affects', uk: 'Аффекти' },
        tricks:{ en: 'Tricks', uk: 'Прийоми' }
    };
    var STATS = S.STATS;
    function bonusCell(item) {
        var out = [];
        STATS.forEach(function (s) {
            var v = nz(item[s.k]);
            if (v !== null) out.push('<span class="ds-datachip ds-datachip--parch"><b>' + sign(v) + '</b>' + tr(s) + '</span>');
        });
        return out.length ? out.join('') : '<span class="i-dim">—</span>';
    }
    var ALIGN = S.ALIGN;
    var nameHit = S.nameHit;
    function alignCell(a) {
        if (!a || a === '-') return '<span class="i-dim">—</span>';
        var letters = String(a).match(/[GNE]/g);
        if (!letters) return '<span class="i-dim">—</span>';
        return letters.map(function (L) {
            var d = ALIGN[L];
            return '<span class="ds-datachip ds-datachip--parch alignchip alignchip--' + L + '">' +
                '<svg class="alignicon align-' + L + '" viewBox="0 0 24 24" role="img" aria-label="' +
                esc(tr(d)) + '"><title>' + esc(tr(d)) + '</title><use href="#' + d.icon + '"/></svg></span>';
        }).join('');
    }
    var isLimited = S.isLimited;
    function nameCell(item) {
        if (!isLimited(item))
            return '<span class="i-name">' + esc(dl(item, 'name')) + '</span>';
        return '<span class="i-name i-name--limit">' + esc(dl(item, 'name')) + '</span>' +
            ' <svg class="i-limit" viewBox="0 0 24 24" role="img" aria-label="' + esc(tr(UI.limited)) +
            '"><title>' + esc(tr(UI.limited)) + '</title><use href="#al-limit"/></svg>';
    }

    /* "Where does this drop" is a question about a place, so the zone should be
       a door to it. The item dumps name a zone; the maps page is keyed by area
       FILE; maps-index.json holds both, so it is the bridge.
       Apostrophes differ between the two dumps -- the item dump writes ASCII '
       in Мах'н-Тор where the map index writes the modifier letter ʼ -- so both
       sides are stripped of them before matching, or 80 items lose their link
       for a character nobody can see. */
    var ZONEFILE = {};
    function zoneKey(s) {
        return String(s == null ? '' : s).replace(/[ʼ’'`]/g, '').toLowerCase();
    }
    function zoneCell(it) {
        var label = dl(it, 'area');
        var f = ZONEFILE[zoneKey(it.area)] || ZONEFILE[zoneKey(label)];
        if (!f) return '<td class="i-dim">' + esc(label) + '</td>';
        return '<td class="i-dim"><a class="i-zone" href="maps.html#' + esc(f) + '">' +
               esc(label) + '</a></td>';
    }

    var SLOTS = S.SLOTS, WCLASS = S.WCLASS, ITYPE = S.ITYPE, KIND = S.KIND,
        WSPECIAL = S.WSPECIAL, PETFLAG = S.PETFLAG;
    // a space-separated flag string -> labels in the page language
    function flags(str, map) { return S.flagLabels(str, map, T()); }
    /* One chip per flag, never one long nowrap span: a single span of joined
       flags cannot break, and forced the pets table 1625px wide at any viewport. */
    function flagChips(list) {
        if (!list.length) return '<span class="i-dim">—</span>';
        return list.map(function (t) { return '<span class="ds-datachip ds-datachip--parch">' + esc(t) + '</span>'; }).join('');
    }
    function kindOf(v) { return KIND[v] ? tr(KIND[v]) : (v || ''); }

    var STATFILT = S.STATFILT;

    // ---------- Tab specs ----------
    var TABS = [
        {
            key: 'armor', file: 'data/db_armor.json', gem: 'ruby',
            label: { en: 'Armor & gear', uk: 'Броня і речі' },
            controls: ['level', 'name', 'slots', 'stats', 'align', 'limited'],
            statKeys: ['str','int','wis','dex','con','cha','hr','dr','hp','mana','saves'],
            columns: [C.name, C.lvl, C.kind, C.bonus, C.align, C.zone, C.where],
            filter: S.FILTERS.armor,
            row: function (it) {
                return '<td>' + nameCell(it) + '</td><td class="i-lvl">' + it.level + '</td>' +
                    '<td class="i-dim">' + esc(kindOf(it.itemtype)) + '</td>' +
                    '<td class="i-bonus">' + bonusCell(it) + '</td>' +
                    '<td class="i-align">' + alignCell(it.align) + '</td>' +
                    zoneCell(it) + '<td class="i-dim">' + esc(dl(it, 'where')) + '</td>';
            }
        },
        {
            key: 'weapon', file: 'data/db_weapon.json', gem: 'sapphire',
            label: { en: 'Weapons', uk: 'Зброя' },
            controls: ['level', 'name', 'wclass', 'stats', 'align', 'limited'],
            statKeys: ['str','int','wis','dex','con','hr','dr','hp','mana','saves'],
            columns: [C.name, C.lvl, C.dice, C.effects, C.bonus, C.align, C.zone, C.where],
            filter: S.FILTERS.weapon,
            row: function (it) {
                var d1 = num(it.d1), d2 = num(it.d2);
                var dice = (d1 && d2) ? (d1 + 'd' + d2 + (it.ave && it.ave !== '-' ? ' <span class="i-dim">(~' + esc(it.ave) + ')</span>' : ''))
                    : '<span class="i-dim">—</span>';
                var eff = flagChips(flags(it.special, WSPECIAL));
                return '<td>' + nameCell(it) + '</td><td class="i-lvl">' + it.level + '</td>' +
                    '<td class="i-bonus">' + dice + '</td><td class="i-bonus">' + eff + '</td>' +
                    '<td class="i-bonus">' + bonusCell(it) + '</td>' +
                    '<td class="i-align">' + alignCell(it.align) + '</td>' +
                    zoneCell(it) + '<td class="i-dim">' + esc(dl(it, 'where')) + '</td>';
            }
        },
        {
            key: 'magic', file: 'data/db_magic.json', gem: 'amethyst',
            label: { en: 'Magic', uk: 'Магія' },
            controls: ['level', 'itype', 'spellsearch', 'limited'],
            columns: [C.name, C.lvl, C.kind, C.slvl, C.chg, C.spells, C.zone, C.where],
            filter: S.FILTERS.magic,
            row: function (it) {
                // show RU spell list if the query looked Russian; else English
                var ru = /[а-яё]/i.test(currentSearch);
                var spells = ru ? (it.ruspells || it.spells) : (it.spells || it.ruspells);
                return '<td>' + nameCell(it) + '</td><td class="i-lvl">' + it.level + '</td>' +
                    '<td class="i-dim">' + esc(tr(ITYPE[it.itemtype] || { en: it.itemtype, uk: it.itemtype })) + '</td>' +
                    '<td class="i-lvl">' + (num(it.spellLevel) || '<span class="i-dim">—</span>') + '</td>' +
                    '<td class="i-lvl">' + (num(it.charges) !== null ? it.charges : '<span class="i-dim">—</span>') + '</td>' +
                    '<td class="i-bonus">' + (spells ? esc(spells) : '<span class="i-dim">—</span>') + '</td>' +
                    zoneCell(it) + '<td class="i-dim">' + esc(dl(it, 'where')) + '</td>';
            }
        },
        {
            key: 'pet', file: 'data/db_pets.json', gem: 'emerald',
            label: { en: 'Pets', uk: 'Улюбленці' },
            controls: ['level', 'name'],
            columns: [C.name, C.lvl, C.aff, C.tricks, C.zone],
            filter: S.FILTERS.pet,
            row: function (it) {
                var tricks = flags(it.off, PETFLAG).concat(flags(it.act, PETFLAG));
                return '<td>' + nameCell(it) + '</td><td class="i-lvl">' +
                    (it.level < 0 ? '<span class="i-dim">' + tr(UI.anylvl) + '</span>' : it.level) + '</td>' +
                    '<td class="i-bonus">' + flagChips(flags(it.aff, PETFLAG)) + '</td>' +
                    '<td class="i-bonus">' + flagChips(tricks) + '</td>' +
                    zoneCell(it);
            }
        }
    ];

    var CAP = 800;
    var MAXLEVEL = 100;      // the game's ceiling; nothing in the dumps is above it
    var cache = {};          // file → data array
    var active = TABS[0];
    var currentSearch = '';
    var tabbar = document.getElementById('tabbar');
    var panel = document.getElementById('panel');

    // ---------- build tab bar ----------
    TABS.forEach(function (t) {
        var b = document.createElement('button');
        b.className = 'tab'; b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', t === active ? 'true' : 'false');
        b.innerHTML = '<span class="tgem tgem--' + t.gem + '"></span>' +
            '<span lang="en">' + t.label.en + '</span><span lang="uk">' + t.label.uk + '</span>';
        b.addEventListener('click', function () { selectTab(t); });
        t._btn = b; tabbar.appendChild(b);
    });

    function selectTab(t) {
        active = t; currentSearch = '';
        TABS.forEach(function (x) { x._btn.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
        renderControls(t);
        load(t).then(function () { runSearch(); });
    }

    // ---------- controls ----------
    // one label over both bounds; the pair reads as a single range control
    function ctrl_level() {
        return '<div class="field"><label lang="en">' + UI.lvlRange.en + '</label><label lang="uk">' + UI.lvlRange.uk + '</label>' +
            '<div class="lvlrange">' +
                '<input class="ds-input" type="number" id="f_lo" min="0" max="' + MAXLEVEL + '" placeholder="0" aria-label="from"/>' +
                '<input class="ds-input" type="number" id="f_hi" min="0" max="' + MAXLEVEL + '" placeholder="' + MAXLEVEL + '" aria-label="to"/>' +
            '</div></div>';
    }
    function ctrl_name(hintKey) {
        var lbl = hintKey === 'spellsearch' ? UI.search : UI.name;
        return '<div class="field field--name"><label lang="en">' + lbl.en + '</label><label lang="uk">' + lbl.uk + '</label>' +
            '<input class="ds-input" type="text" id="f_name" autocomplete="off" placeholder=""/></div>';
    }
    function ctrl_select(id, map, labelObj) {
        var opts = '<option value="">— ' + '</option>';
        Object.keys(map).forEach(function (k) {
            opts += '<option value="' + k + '">' + esc(tr(map[k])) + ' (' + k + ')</option>';
        });
        return '<div class="field"><label lang="en">' + labelObj.en + '</label><label lang="uk">' + labelObj.uk + '</label>' +
            '<select class="ds-select" id="' + id + '">' + opts + '</select></div>';
    }
    function ctrl_chips(id, map, labelObj) {
        var chips = '';
        Object.keys(map).forEach(function (k) {
            chips += '<label class="chip"><input type="checkbox" value="' + k + '"/>' +
                '<span lang="en">' + map[k].en + '</span><span lang="uk">' + map[k].uk + '</span></label>';
        });
        return '<div style="flex-basis:100%"><div class="chips-label"><span lang="en">' + labelObj.en + '</span><span lang="uk">' + labelObj.uk + '</span></div>' +
            '<div class="chips" id="' + id + '">' + chips + '</div></div>';
    }
    /* Alignment chips carry the same three icons the column does. The dump only
       fills `align` when the item IS restricted, so an unrestricted item (the
       majority — 1342 of 1620 armor pieces) carries no letters and matches no
       chip: the filter selects by what the column actually shows. */
    function ctrl_align() {
        var chips = '';
        ['G', 'N', 'E'].forEach(function (k) {
            var d = ALIGN[k];
            chips += '<label class="chip chip--icon"><input type="checkbox" value="' + k + '"/>' +
                '<svg class="alignicon align-' + k + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#' +
                d.icon + '"/></svg>' +
                '<span lang="en">' + d.en + '</span><span lang="uk">' + d.uk + '</span></label>';
        });
        return '<div class="ctrlgroup"><div class="chips-label"><span lang="en">' + UI.alignf.en +
            '</span><span lang="uk">' + UI.alignf.uk + '</span></div>' +
            '<div class="chips" id="c_align">' + chips + '</div></div>';
    }
    /* Limited items are IN by default -- this chip is a way to take them out
       (they are the ones you probably cannot get), not a way to seek them.
       The blank label is a spacer: it puts this lone chip on the same line as
       the labelled groups beside it, and drops out when it stands alone. */
    function ctrl_limited() {
        return '<div class="ctrlgroup ctrlgroup--limit">' +
            '<div class="chips-label" aria-hidden="true">&nbsp;</div>' +
            '<div class="chips">' +
            '<label class="chip chip--icon chip--limit on" id="c_limited">' +
            '<input type="checkbox" value="1" checked/>' +
            '<svg class="i-limit" viewBox="0 0 24 24" aria-hidden="true"><use href="#al-limit"/></svg>' +
            '<span lang="en">' + UI.showLimited.en + '</span><span lang="uk">' + UI.showLimited.uk + '</span>' +
            '</label></div></div>';
    }

    function ctrl_statfilt() {
        var chips = '';
        STATFILT.forEach(function (s) {
            chips += '<label class="chip"><input type="checkbox" value="' + s.k + '"/>' +
                '<span lang="en">' + s.en + '</span><span lang="uk">' + s.uk + '</span></label>';
        });
        return '<div class="ctrlgroup ctrlgroup--wide"><div class="chips-label"><span lang="en">' + UI.reqstat.en + '</span><span lang="uk">' + UI.reqstat.uk + '</span></div>' +
            '<div class="chips" id="c_stats">' + chips + '</div></div>';
    }

    function renderControls(t) {
        var top = '', rows = '';
        if (t.controls.indexOf('level') >= 0) top += ctrl_level();
        if (t.controls.indexOf('itype') >= 0) top += ctrl_select('f_itype', ITYPE, UI.itype);
        if (t.controls.indexOf('name') >= 0) top += ctrl_name('name');
        if (t.controls.indexOf('spellsearch') >= 0) top += ctrl_name('spellsearch');
        if (t.controls.indexOf('slots') >= 0) rows += ctrl_chips('c_slots', SLOTS, UI.slot);
        if (t.controls.indexOf('wclass') >= 0) rows += ctrl_chips('c_wclass', WCLASS, UI.wtype);
        /* Bonuses, who may use it and the limited toggle are all "what the item
           is like" rather than "what kind of item" -- they read as one band and
           share a single row instead of eating three. */
        var groups = '';
        if (t.controls.indexOf('stats') >= 0) groups += ctrl_statfilt();
        if (t.controls.indexOf('align') >= 0) groups += ctrl_align();
        if (t.controls.indexOf('limited') >= 0) groups += ctrl_limited();
        if (groups) rows += '<div class="row row--groups">' + groups + '</div>';

        var hint = t.controls.indexOf('spellsearch') >= 0 ?
            '<p class="legend"><span lang="en">' + UI.spellHint.en + '</span><span lang="uk">' + UI.spellHint.uk + '</span></p>' : '';

        panel.innerHTML =
            '<div class="filters windowlet">' +
                '<div class="row">' + top +
                    '<div class="field"><label>&nbsp;</label><button class="btn btn--gold" id="btnSearch">' +
                        '<span lang="en">' + UI.search.en + '</span><span lang="uk">' + UI.search.uk + '</span></button></div>' +
                    '<div class="field"><label>&nbsp;</label><button class="btn btn--ghost" id="btnReset">' +
                        '<span lang="en">' + UI.reset.en + '</span><span lang="uk">' + UI.reset.uk + '</span></button></div>' +
                '</div>' + rows + hint +
            '</div>' +
            '<div class="result-meta" id="meta"></div>' +
            '<div class="tablewrap"><table class="results"><thead><tr>' +
                t.columns.map(function (c) { return '<th><span lang="en">' + c.en + '</span><span lang="uk">' + c.uk + '</span></th>'; }).join('') +
            '</tr></thead><tbody id="rows"></tbody></table></div>';

        // wire chips (toggle .on class) + live search
        panel.querySelectorAll('.chip input').forEach(function (cb) {
            cb.addEventListener('change', function () {
                cb.closest('.chip').classList.toggle('on', cb.checked); runSearch();
            });
        });
        var nameInput = document.getElementById('f_name');
        if (nameInput) nameInput.addEventListener('input', debounce(runSearch, 180));
        ['f_lo', 'f_hi', 'f_itype'].forEach(function (id) {
            var el = document.getElementById(id); if (el) el.addEventListener('change', runSearch);
        });
        document.getElementById('btnSearch').addEventListener('click', runSearch);
        document.getElementById('btnReset').addEventListener('click', function () { selectTab(t); });
    }

    function collect() {
        function checked(id) {
            var el = document.getElementById(id); if (!el) return [];
            return Array.prototype.slice.call(el.querySelectorAll('input:checked')).map(function (i) { return i.value; });
        }
        var loEl = document.getElementById('f_lo'), hiEl = document.getElementById('f_hi');
        var nameEl = document.getElementById('f_name'), itEl = document.getElementById('f_itype');
        var limEl = document.querySelector('#c_limited input');
        currentSearch = nameEl ? nameEl.value.trim() : '';
        return {
            lo: loEl && loEl.value !== '' ? parseInt(loEl.value, 10) : -1,
            hi: hiEl && hiEl.value !== '' ? parseInt(hiEl.value, 10) : MAXLEVEL,
            name: currentSearch.toLowerCase(),
            itype: itEl ? itEl.value : '',
            slots: checked('c_slots'),
            wclass: checked('c_wclass'),
            stats: checked('c_stats'),
            align: checked('c_align'),
            // no chip on this tab means no opinion, not "hide everything"
            limited: limEl ? limEl.checked : true
        };
    }

    /* Filters every tab shares, kept out of the per-tab predicates so a tab
       cannot quietly forget one. An item with no alignment letters is
       unrestricted and matches no chip -- see ctrl_align. */
    var passesCommon = S.passesCommon;
    function matches(it, f) { return passesCommon(it, f) && active.filter(it, f); }

    function runSearch() {
        var data = cache[active.file] || [];
        var f = collect();
        var out = [];
        for (var i = 0; i < data.length && out.length < CAP; i++) {
            if (matches(data[i], f)) out.push(data[i]);
        }
        var total = 0;
        for (var j = 0; j < data.length; j++) if (matches(data[j], f)) total++;

        var meta = document.getElementById('meta');
        if (total === 0) {
            meta.innerHTML = '';
            document.getElementById('rows').innerHTML =
                '<tr><td colspan="' + active.columns.length + '" class="empty">' +
                '<span lang="en">' + UI.none.en + '</span><span lang="uk">' + UI.none.uk + '</span></td></tr>';
            return;
        }
        var capped = total > CAP;
        meta.innerHTML = '<b>' + total + '</b> ' +
            '<span lang="en">' + UI.found.en + (capped ? ' · ' + UI.showing.en + ' ' + CAP : '') + '</span>' +
            '<span lang="uk">' + UI.found.uk + (capped ? ' · ' + UI.showing.uk + ' ' + CAP : '') + '</span>';
        var html = '';
        for (var r = 0; r < out.length; r++) html += '<tr>' + active.row(out[r]) + '</tr>';
        document.getElementById('rows').innerHTML = html;
    }

    function load(t) {
        if (cache[t.file]) return Promise.resolve(cache[t.file]);
        document.getElementById('rows').innerHTML =
            '<tr><td colspan="' + t.columns.length + '" class="empty">' +
            '<span lang="en">' + UI.loading.en + '</span><span lang="uk">' + UI.loading.uk + '</span></td></tr>';
        return fetch(t.file).then(function (r) { return r.json(); }).then(function (d) {
            cache[t.file] = d; return d;
        });
    }

    function debounce(fn, ms) { var to; return function () { clearTimeout(to); to = setTimeout(fn, ms); }; }

    // re-apply language to freshly injected nodes when the toggle flips
    /* Chrome (labels, headers, chips) is dual-DOM and CSS-switched, but the data
       cells are rendered once with the active language baked in — so a language
       flip has to re-run the search. */
    document.querySelectorAll('[data-setlang]').forEach(function (b) {
        b.addEventListener('click', function () { renderControls(active); runSearch(); });
    });

    // boot
    selectTab(TABS[0]);

    /* The zone index is small and only decorates the table, so it loads beside
       the dumps rather than gating them: rows drawn before it lands are redrawn
       once it does. */
    fetch('data/maps-index.json')
        .then(function (r) { return r.json(); })
        .then(function (list) {
            list.forEach(function (z) {
                [z.name, z.nameEn, z.nameUa].forEach(function (n) {
                    var k = zoneKey(n);
                    if (k && !ZONEFILE[k]) ZONEFILE[k] = z.file;
                });
            });
            if (cache[active.file]) runSearch();
        })
        .catch(function () {});
})();
