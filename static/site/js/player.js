/* Public account profile: /player/<id> (or /player/<CharName>).
   Data comes live from the game's public /api/profile endpoint, which answers
   404 for an account that has no reborn character, was switched off by its
   owner, or has every character hidden. Every text renders in both languages
   at once (lang="en" / lang="uk"), like the rest of the site, so the language
   switch needs no re-render.

   Page order: header (the main character -- the one played longest -- with the
   account title under it) and the account numbers, then achievements (the
   heart of the page), then the characters as a card grid. A character card or
   an achievement opens a side sheet: a parchment docked to the right. Achievements come with the profile when the game sends
   them (field "achievements"); otherwise the page shows a "coming soon" shelf.
   An unearned secret arrives without name or description and stays "???". */
(function () {
    var head = document.getElementById('profileHead');
    // Filled by renderProfile: the sheets look characters and achievements up.
    var achList = null;
    var charByLogin = {};
    var body = document.getElementById('profileBody');

    var EMBLEMS = ['anti-paladin', 'cleric', 'druid', 'necromancer', 'ninja', 'paladin',
        'ranger', 'samurai', 'thief', 'vampire', 'warlock', 'warrior', 'witch'];

    // Clan badges, keyed by the first letter of the clan's internal name (the
    // who widget's key). The badge carries the short name; the sheet the full one.
    var CLAN_BADGES = {
        a: ['Artificers', 'Артіль'], b: ['Fury', 'Ярості'], c: ['Chaos', 'Хаос'],
        f: ['Flowers', 'Квіти'], g: ['Ghosts', 'Привиди'], i: ['Invaders', 'Загарбники'],
        k: ['Knights', 'Лицарі'], l: ['Lions', 'Леви'], r: ['Rulers', 'Правителі'],
        s: ['Shalafi', 'Шалафі']
    };

    function el(tag, cls, kids) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        (kids || []).forEach(function (k) {
            if (k == null) return;
            e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
        });
        return e;
    }

    // One text in both languages: two sibling spans, CSS shows the active one.
    function bi(en, uk, cls) {
        var f = document.createDocumentFragment();
        var a = el('span', cls, [en]); a.setAttribute('lang', 'en');
        var b = el('span', cls, [uk == null || uk === '' ? en : uk]); b.setAttribute('lang', 'uk');
        f.appendChild(a); f.appendChild(b);
        return f;
    }

    function ukPlural(n, uk1, uk2, uk5) {
        var m10 = n % 10, m100 = n % 100;
        return (m10 === 1 && m100 !== 11) ? uk1
            : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? uk2 : uk5;
    }

    function plural(n, en1, enN, uk1, uk2, uk5) {
        return bi(n + ' ' + (n === 1 ? en1 : enN), n + ' ' + ukPlural(n, uk1, uk2, uk5));
    }

    function num(n, locale) { return Number(n).toLocaleString(locale); }

    function monthYear(unix) {
        var d = new Date(unix * 1000);
        var o = { month: 'long', year: 'numeric' };
        return bi(d.toLocaleDateString('en-GB', o), d.toLocaleDateString('uk-UA', o));
    }

    function shortDate(iso) {
        var d = new Date(iso);
        var o = { day: 'numeric', month: 'short', year: 'numeric' };
        return bi(d.toLocaleDateString('en-GB', o), d.toLocaleDateString('uk-UA', o));
    }

    function emblem(cls, size) {
        var key = (cls && cls.key || '').toLowerCase();
        var box = el('span', 'pemblem pemblem--' + size);
        box.setAttribute('aria-hidden', 'true');
        if (EMBLEMS.indexOf(key) >= 0) {
            var img = el('img');
            img.src = '/site/assets/classemblems/' + key + '.png';
            img.alt = '';
            box.appendChild(img);
        } else {
            box.classList.add('pemblem--blank');
        }
        return box;
    }

    // Nirvana's faceted jewel (#dl-gem in player.html), tinted by colour class.
    function jewel(tint, cls) {
        var g = el('span', 'ds-tgem ds-tgem--' + tint + (cls ? ' ' + cls : ''));
        g.setAttribute('aria-hidden', 'true');
        g.innerHTML = '<svg><use href="#dl-gem"/></svg>';
        return g;
    }

    // The game's own per-language name: the Ukrainian form, else the Russian one.
    function ukName(c) { return c.name.ua || c.name.ru || c.name.en; }
    // The login: a stable anchor for #Name deep links whatever the display form.
    function login(c) { return c.name.login || c.name.en; }

    function clanLetter(clan) { return (clan.key || '').charAt(0).toLowerCase(); }

    // The client's clan badge; a clan without one falls back to a data-chip.
    function clanBadge(clan) {
        var names = CLAN_BADGES[clanLetter(clan)];
        if (!names) {
            var chip = el('span', 'ds-datachip');
            chip.appendChild(bi(clan.en, clan.ua));
            return chip;
        }
        var b = el('span', 'clan-chip clan-chip--md');
        b.setAttribute('data-clan', clanLetter(clan));
        b.appendChild(el('span', 'clan-chip__glow'));
        var label = el('span', 'clan-chip__label');
        label.appendChild(bi(names[0], names[1]));
        b.appendChild(label);
        b.appendChild(el('span', 'clan-chip__orn clan-chip__orn--l'));
        b.appendChild(el('span', 'clan-chip__orn clan-chip__orn--r'));
        return b;
    }

    // What a card shows at a glance: rank, clan, online. Rebirths live in the sheet.
    function chips(c) {
        var row = el('ul', 'pchips');
        function add(node) { row.appendChild(el('li', null, [node])); }
        function dchip(mod, content) {
            var chip = el('span', 'ds-datachip ds-datachip--' + mod);
            var b = el('b'); b.appendChild(content); chip.appendChild(b);
            return chip;
        }
        var fem = c.sex === 'f';
        if (c.rank === 'immortal') add(dchip('magic', bi(fem ? 'Goddess' : 'God', fem ? 'Богиня' : 'Бог')));
        else if (c.rank === 'legendary') add(dchip('gold', bi('Legend', 'Легенда')));
        if (c.clan) add(clanBadge(c.clan));
        if (c.online) add(dchip('buff', bi('online', 'онлайн')));
        return row;
    }

    // The whois-like sheet: a Nirvana parchment.
    function sheet(c) {
        var dl = el('dl', 'psheet');
        function row(k, v) {
            if (v == null) return;
            dl.appendChild(el('dt', null, [k]));
            dl.appendChild(el('dd', null, [v]));
        }

        // The game's titles carry a leading space (they follow the name in who).
        function t(s) { return (s || '').trim(); }
        var full = document.createDocumentFragment();
        var pre = c.pretitle || {}, ti = c.title || {};
        full.appendChild(bi(
            [t(pre.en), c.name.en, t(ti.en)].filter(Boolean).join(' '),
            [t(pre.ru) || t(pre.en), ukName(c), t(ti.ua) || t(ti.ru)].filter(Boolean).join(' ')));
        row(bi('Full name', 'Повне імʼя'), full);
        row(bi('Race', 'Раса'), bi(c.race.en, c.race.ua));
        row(bi('Class', 'Клас'), bi(c.class.en, c.class.ua));
        row(bi('Rebirths', 'Переродження'), document.createTextNode(String(c.remorts)));
        if (c.clan) {
            var cl = document.createDocumentFragment();
            cl.appendChild(bi(c.clan.en, c.clan.ua));
            if (c.clan.title && (c.clan.title.en || c.clan.title.ua))
                cl.appendChild(bi(', ' + c.clan.title.en, ', ' + (c.clan.title.ua || c.clan.title.en)));
            row(bi('Clan', 'Клан'), cl);
        } else {
            row(bi('Clan', 'Клан'), bi('none', 'без клану'));
        }
        row(bi('Status', 'Статус'), c.online ? bi('in the world', 'у світі') : bi('away', 'не в грі'));

        var bodyKids = [dl];
        if (c.desc && (c.desc.en || c.desc.ua || c.desc.ru)) {
            bodyKids.push(el('h5', 'psheet__h', [bi('Description', 'Опис')]));
            bodyKids.push(el('div', 'psheet__desc', [bi(c.desc.en || c.desc.ru, c.desc.ua || c.desc.ru)]));
        }

        // What this character holds: its titles, then everything else it earned.
        var mine = (achList || []).filter(function (a) {
            return a.unlocked && (a.chars || []).indexOf(login(c)) >= 0;
        });
        bodyKids.push(el('h5', 'psheet__h', [bi(
            'Achievements: ' + mine.length, 'Досягнення: ' + mine.length)]));
        var titles = mine.filter(function (a) { return a.group === 'titles'; });
        var rest = mine.filter(function (a) { return a.group !== 'titles'; });
        rest.sort(function (x, y) { return RARITY[rarityOf(x)].rank - RARITY[rarityOf(y)].rank; });
        if (titles.length) {
            bodyKids.push(el('p', 'psheet__sub', [bi('Titles', 'Титули')]));
            bodyKids.push(achMiniList(titles));
        }
        if (rest.length) {
            if (titles.length) bodyKids.push(el('p', 'psheet__sub', [bi('Achievements', 'Досягнення')]));
            bodyKids.push(achMiniList(rest));
        }

        return parchment(bi(c.name.en, ukName(c)), bodyKids, 'pchar__sheet');
    }

    // A side-sheet parchment: title, then the body nodes.
    function parchment(title, kids, cls) {
        var parch = el('div', 'ds-parch ds-frame ' + (cls || ''));
        var h = el('h4', 'psheet__title', [title]);
        h.id = 'sheetTitle';
        parch.appendChild(h);
        parch.appendChild(el('div', 'ds-parch__body', kids));
        return DLFrame.dress(parch);
    }

    // Achievements as gem + name rows; each opens its own sheet.
    function achMiniList(list) {
        var ul = el('ul', 'pmini');
        list.forEach(function (a) {
            var b = el('button', 'pmini__btn');
            b.type = 'button';
            b.appendChild(jewel(gemTint(a)));
            b.appendChild(bi(nameOf(a).en, nameOf(a).ua, 'pmini__name'));
            b.addEventListener('click', function () { openAch(a); });
            ul.appendChild(el('li', null, [b]));
        });
        return ul;
    }

    // Who on the account holds an achievement, by display name.
    function holderNames(a) {
        var names = [];
        (a.chars || []).forEach(function (l) {
            var c = charByLogin[l.toLowerCase()];
            if (c) names.push(c);
        });
        return names;
    }

    function achSheet(a) {
        var dl = el('dl', 'psheet');
        function row(k, v) {
            dl.appendChild(el('dt', null, [k]));
            dl.appendChild(el('dd', null, [v]));
        }
        var r = RARITY[rarityOf(a)];
        var tier = document.createDocumentFragment();
        tier.appendChild(jewel(r.gem, 'psheet__gem'));
        tier.appendChild(bi(r.en, r.uk));
        row(bi('Tier', 'Рівень'), tier);
        // Rarity: the share of active accounts (seen within a year) holding it.
        if (a.rarity && a.rarity.of > 0) {
            var pct = a.rarity.have * 100 / a.rarity.of;
            var shown = pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
            var txt = (a.rarity.have > 0 && shown === 0) ? '<0.1' : String(shown);
            row(bi('Rarity', 'Рідкість'), bi(
                txt + '% of players (' + a.rarity.have + ' of ' + a.rarity.of + ')',
                txt + '% гравців (' + a.rarity.have + ' з ' + a.rarity.of + ')'));
        }
        if (a.unlocked && a.former) {
            row(bi('Status', 'Статус'), bi('Previously held', 'Колишній титул'));
            row(bi('Last held', 'Востаннє'), shortDate(a.unlocked * 1000));
        } else if (a.unlocked) {
            row(bi('Earned', 'Здобуто'), shortDate(a.unlocked * 1000));
        }
        if (a.unlocked) {
            var who = holderNames(a);
            if (who.length) {
                var f = document.createDocumentFragment();
                f.appendChild(bi(who.map(function (c) { return c.name.en; }).join(', '),
                    who.map(ukName).join(', ')));
                row(who.length === 1 ? bi('Character', 'Персонаж') : bi('Characters', 'Персонажі'), f);
            }
        } else {
            row(bi('Status', 'Статус'), bi('Not earned yet', 'Ще не здобуто'));
        }
        var kids = [el('p', 'psheet__lead', [bi(descOf(a).en, descOf(a).ua)]), dl];
        if (!a.unlocked && a.progress) {
            kids.push(progressBar(a.progress.have, a.progress.need));
            kids.push(el('p', 'psheet__count', [a.progress.have + ' / ' + a.progress.need]));
        }
        return parchment(bi(nameOf(a).en, nameOf(a).ua), kids, 'pach__sheet');
    }

    // One side sheet for every sheet: native <dialog> traps focus, closes on
    // Esc and hands focus back to whatever opened it.
    var dialog = el('dialog', 'ds-sheet');
    var dialogBody = el('div', 'ds-sheet__body');
    var closeBtn = el('button', 'ds-sheet__close', ['\u2715']);
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', function () { dialog.close(); });
    dialog.appendChild(closeBtn);
    dialog.appendChild(dialogBody);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', function () {
        if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    });
    document.body.appendChild(dialog);

    function showSheet(node, hash) {
        dialogBody.innerHTML = '';
        dialogBody.appendChild(node);
        dialog.setAttribute('aria-labelledby', 'sheetTitle');
        if (!dialog.open) dialog.showModal();
        dialogBody.scrollTop = 0;
        if (history.replaceState) history.replaceState(null, '', '#' + hash);
    }

    function openSheet(c) { showSheet(sheet(c), login(c)); }
    function openAch(a) { showSheet(achSheet(a), a.id); }

    // Close label follows the language switch (an aria-label holds no spans).
    function relabelClose() {
        closeBtn.setAttribute('aria-label',
            document.documentElement.getAttribute('data-lang') === 'uk' ? 'Закрити' : 'Close');
    }
    relabelClose();
    new MutationObserver(relabelClose).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

    function card(c) {
        var b = el('button', 'windowlet ds-card--hover pchar');
        b.type = 'button';
        b.id = login(c);
        b.setAttribute('aria-haspopup', 'dialog');
        b.appendChild(emblem(c.class, 'card'));
        var id = el('span', 'pchar__id');
        id.appendChild(bi(c.name.en, ukName(c),
            'ds-card__title pchar__name' + (c.rank === 'immortal' ? ' pchar__name--god' : '')));
        id.appendChild(bi(c.race.en + ' ' + c.class.en, c.race.ua + ' ' + c.class.ua, 'pchar__cls'));
        id.appendChild(chips(c));
        b.appendChild(id);
        b.addEventListener('click', function () { openSheet(c); });
        return b;
    }

    // ---------- account numbers ----------

    function stat(value, label) {
        // dt before dd as HTML wants; CSS lifts the value above its label.
        var s = el('div', 'pstat');
        s.appendChild(el('dt', 'pstat__label', [label]));
        s.appendChild(el('dd', 'pstat__value', [value]));
        return s;
    }

    function stats(p, chars, ach) {
        var a = p.account || {};
        var dl = el('dl', 'pstats');
        if (a.since)
            dl.appendChild(stat(monthYear(a.since), bi('playing since', 'перший персонаж')));
        if (a.hours != null)
            dl.appendChild(stat(bi(num(a.hours, 'en-GB'), num(a.hours, 'uk-UA')),
                bi(a.hours === 1 ? 'hour played' : 'hours played',
                    ukPlural(a.hours, 'година', 'години', 'годин') + ' у грі')));
        var lives = a.lives != null ? a.lives
            : chars.reduce(function (s, c) { return s + 1 + (c.remorts || 0); }, 0);
        dl.appendChild(stat(document.createTextNode(String(lives)),
            bi(lives === 1 ? 'life lived' : 'lives lived',
                ukPlural(lives, 'життя прожите', 'життя прожиті', 'життів прожито'))));
        if (a.favClass) {
            dl.appendChild(stat(bi(a.favClass.en, a.favClass.ua, 'pstat__cap'),
                bi('favourite class', 'улюблений клас')));
        }
        if (ach)
            dl.appendChild(stat(document.createTextNode(ach.unlocked + ' / ' + ach.total),
                bi('achievements', 'досягнення')));
        return dl;
    }

    // ---------- achievements ----------

    // Display groups, in shelf order. The game sends the key per achievement.
    var CATEGORIES = [
        { key: 'quests', en: 'Quests', uk: 'Квести' },
        { key: 'combat', en: 'Combat', uk: 'Бій' },
        { key: 'life', en: 'Lives and time', uk: 'Життя й час' },
        { key: 'craft', en: 'Crafting', uk: 'Ремесло' },
        { key: 'world', en: 'World', uk: 'Світ' },
        { key: 'clans', en: 'Clans', uk: 'Клани' },
        { key: 'classes', en: 'Classes', uk: 'Класи' },
        { key: 'titles', en: 'Titles', uk: 'Титули' },
        { key: 'collection', en: 'Collection', uk: 'Колекція' },
        { key: 'secrets', en: 'Secrets', uk: 'Таємниці' }
    ];

    // Tier is set by hand from effort and luck. The word always rides with the tint.
    var RARITY = {
        common: { gem: 'emerald', en: 'Common', uk: 'Звичайне', rank: 3 },
        rare: { gem: 'sapphire', en: 'Rare', uk: 'Рідкісне', rank: 2 },
        epic: { gem: 'amethyst', en: 'Epic', uk: 'Епічне', rank: 1 },
        legendary: { gem: 'gold', en: 'Legendary', uk: 'Легендарне', rank: 0 }
    };

    // An earned achievement wears its tier's jewel; one still ahead, plain stone.
    function gemTint(a) {
        return a.unlocked ? RARITY[rarityOf(a)].gem : 'stone';
    }

    function rarityOf(a) {
        return RARITY[a.tier] ? a.tier : 'common';
    }

    // Secrets nobody on the account has found come without words.
    function nameOf(a) {
        return a.name || { en: '???', ua: '???' };
    }

    function descOf(a) {
        return a.desc || { en: 'A secret. Keep playing.', ua: 'Таємниця. Грай далі.' };
    }

    function progressOf(a) {
        return a.progress && a.progress.need > 0 ? a.progress.have / a.progress.need : 0;
    }

    // Nirvana's vital bar in the gold (move) colourway, the jewel on its cap.
    function progressBar(have, need, cls) {
        var bar = el('div', 'ds-pbar move pbar' + (cls ? ' ' + cls : ''));
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', String(need));
        bar.setAttribute('aria-valuenow', String(have));
        var gem = el('span', 'ds-pbar__gem');
        gem.innerHTML = '<svg><use href="#dl-gem"/></svg>';
        bar.appendChild(gem);
        var fill = el('div', 'ds-pbar__fill');
        fill.style.width = (need > 0 ? Math.min(100, have / need * 100) : 0) + '%';
        bar.appendChild(fill);
        return bar;
    }

    // A card opens the achievement's sheet: tier, when, on which characters.
    function achTile(a) {
        var locked = !a.unlocked;
        var li = el('li', 'pach-cell');
        var btn = el('button', 'windowlet ds-card--hover pach' + (locked ? ' is-locked' : ''));
        btn.type = 'button';
        btn.setAttribute('aria-haspopup', 'dialog');
        btn.setAttribute('data-cat', a.group);
        btn.addEventListener('click', function () { openAch(a); });
        li.appendChild(btn);

        btn.appendChild(jewel(gemTint(a), 'pach__gem'));

        var txt = el('div', 'pach__txt');
        txt.appendChild(bi(nameOf(a).en, nameOf(a).ua, 'pach__name'));
        txt.appendChild(bi(descOf(a).en, descOf(a).ua, 'pach__desc'));
        if (locked && a.progress) {
            txt.appendChild(progressBar(a.progress.have, a.progress.need));
            txt.appendChild(el('span', 'pach__count', [a.progress.have + ' / ' + a.progress.need]));
        }

        // A title someone on the account held before (or a god topped).
        if (a.former) txt.appendChild(bi('Previously held', 'Колишній титул', 'pach__former'));

        // Tier in words for screen readers; the jewel carries it for the eye.
        var r = RARITY[rarityOf(a)];
        txt.appendChild(el('span', 'sr-only', [bi(
            r.en + (locked ? ', not earned yet' : ', earned'),
            r.uk + (locked ? ', ще не здобуто' : ', здобуто'))]));

        btn.appendChild(txt);
        return li;
    }

    function achievementsShelf(list) {
        var sec = el('section', 'pach-sec');
        sec.setAttribute('aria-labelledby', 'achTitle');
        var h = el('h2', 'pach-sec__title', [bi('Achievements', 'Досягнення')]);
        h.id = 'achTitle';
        sec.appendChild(h);

        var got = list.filter(function (a) { return a.unlocked; }).length;
        var sum = el('div', 'pach-sum');
        sum.appendChild(el('p', 'pach-sum__count', [bi(
            got + ' of ' + list.length + ' unlocked', got + ' з ' + list.length + ' здобуто')]));
        sum.appendChild(progressBar(got, list.length, 'pbar--lg'));
        // Secrets nobody on the account has found are only counted, never shown.
        var secrets = list.filter(function (a) { return a.secret; });
        if (secrets.length) {
            var found = secrets.filter(function (a) { return a.unlocked; }).length;
            sum.appendChild(el('p', 'pach-sum__secrets', [bi(
                'Secrets found: ' + found + ' of ' + secrets.length,
                'Знайдено таємниць: ' + found + ' з ' + secrets.length)]));
        }
        sec.appendChild(sum);

        var state = { cat: 'all', locked: true, q: '', sort: 'rare' };

        // Filters: categories as toggle-chips with their own counts, a locked
        // toggle, search and sort. With hundreds of entries, filters are the UI.
        var tools = el('div', 'pach-tools');
        var cats = el('div', 'pach-cats');
        cats.setAttribute('role', 'group');
        function catChip(key, en, uk) {
            var inCat = list.filter(function (a) { return key === 'all' || a.group === key; });
            var have = inCat.filter(function (a) { return a.unlocked; }).length;
            var c = el('button', 'ds-chip', [bi(en, uk), el('span', 'pach-cats__n', [have + '/' + inCat.length])]);
            c.type = 'button';
            c.setAttribute('aria-pressed', key === state.cat ? 'true' : 'false');
            c.addEventListener('click', function () {
                state.cat = key;
                Array.prototype.forEach.call(cats.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
                c.setAttribute('aria-pressed', 'true');
                draw();
            });
            cats.appendChild(c);
        }
        catChip('all', 'All', 'Усі');
        CATEGORIES.forEach(function (c) { catChip(c.key, c.en, c.uk); });
        tools.appendChild(cats);

        var row = el('div', 'pach-row');
        var search = el('input', 'ds-input pach-search');
        search.type = 'search';
        search.addEventListener('input', function () { state.q = search.value.trim().toLowerCase(); draw(); });
        row.appendChild(search);

        var sort = el('select', 'ds-select pach-sort');
        var SORTS = [['recent', 'Newest first', 'Спершу нові'], ['rare', 'Rarest first', 'Спершу рідкісні'],
            ['name', 'A to Z', 'За абеткою']];
        SORTS.forEach(function (o) {
            var opt = el('option'); opt.value = o[0]; sort.appendChild(opt);
        });
        sort.value = state.sort;
        sort.addEventListener('change', function () { state.sort = sort.value; draw(); });
        row.appendChild(sort);

        var lockedBtn = el('button', 'ds-chip', [bi('Show locked', 'Показати не здобуті')]);
        lockedBtn.type = 'button';
        lockedBtn.setAttribute('aria-pressed', 'true');
        lockedBtn.addEventListener('click', function () {
            state.locked = !state.locked;
            lockedBtn.setAttribute('aria-pressed', state.locked ? 'true' : 'false');
            draw();
        });
        row.appendChild(lockedBtn);
        tools.appendChild(row);

        // Attributes and <option> text cannot hold the lang spans, so they follow the switch.
        function relabel() {
            var uk = document.documentElement.getAttribute('data-lang') === 'uk';
            search.placeholder = uk ? 'Шукати досягнення' : 'Search achievements';
            search.setAttribute('aria-label', search.placeholder);
            sort.setAttribute('aria-label', uk ? 'Порядок' : 'Sort');
            cats.setAttribute('aria-label', uk ? 'Категорії' : 'Categories');
            SORTS.forEach(function (o, i) { sort.options[i].textContent = uk ? o[2] : o[1]; });
        }
        relabel();
        new MutationObserver(relabel).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
        sec.appendChild(tools);

        var grid = el('ul', 'pach-grid');
        var empty = el('p', 'pach-empty', [bi('Nothing here yet.', 'Тут поки порожньо.')]);
        var live = el('p', 'sr-only');
        live.setAttribute('aria-live', 'polite');
        sec.appendChild(grid);
        sec.appendChild(empty);
        sec.appendChild(live);

        function draw() {
            var shown = list.filter(function (a) {
                if (a.secret && !a.unlocked) return false;
                if (state.cat !== 'all' && a.group !== state.cat) return false;
                if (!state.locked && !a.unlocked) return false;
                var n = nameOf(a), d = descOf(a);
                if (state.q && (n.en + ' ' + n.ua + ' ' + d.en + ' ' + d.ua)
                    .toLowerCase().indexOf(state.q) < 0) return false;
                return true;
            });
            shown.sort(function (x, y) {
                var rx = RARITY[rarityOf(x)].rank, ry = RARITY[rarityOf(y)].rank;
                // rarest first; within a tier, earned ones lead, then by name
                if (state.sort === 'rare') return rx - ry || (!!y.unlocked - !!x.unlocked)
                    || nameOf(x).en.localeCompare(nameOf(y).en);
                if (state.sort === 'name') return nameOf(x).en.localeCompare(nameOf(y).en);
                // newest unlocks first, then the locked ones closest to done
                if (!!x.unlocked !== !!y.unlocked) return x.unlocked ? -1 : 1;
                if (x.unlocked) return y.unlocked - x.unlocked;
                return progressOf(y) - progressOf(x) || ry - rx;
            });
            grid.innerHTML = '';
            shown.forEach(function (a) { grid.appendChild(achTile(a)); });
            empty.hidden = shown.length > 0;
            live.textContent = String(shown.length);
        }
        draw();
        return sec;
    }

    // The public shelf until the backend lands: honest "coming soon", no fake data.
    function achievementsSoon() {
        var sec = el('section', 'pach-sec');
        sec.setAttribute('aria-labelledby', 'achTitle');
        var h = el('h2', 'pach-sec__title', [bi('Achievements', 'Досягнення')]);
        h.id = 'achTitle';
        sec.appendChild(h);
        sec.appendChild(el('p', 'pach-soon', [bi(
            'The Archivist is still counting every deed of every life. Achievements open here soon.',
            'Архіваріус ще рахує кожен подвиг кожного життя. Досягнення відкриються тут незабаром.')]));
        var grid = el('ul', 'pach-grid pach-grid--ghost');
        grid.setAttribute('aria-hidden', 'true');
        for (var i = 0; i < 8; i++) {
            var li = el('li', 'windowlet pach is-locked is-ghost');
            li.appendChild(el('span', 'pach__gem'));
            var txt = el('div', 'pach__txt');
            txt.appendChild(el('span', 'pach__bone pach__bone--name'));
            txt.appendChild(el('span', 'pach__bone'));
            li.appendChild(txt);
            grid.appendChild(li);
        }
        sec.appendChild(grid);
        return sec;
    }

    // ---------- page ----------

    function renderProfile(p) {
        var chars = p.chars || [];
        var lead = chars.filter(function (c) { return c.main; })[0] || chars[0];
        var ach = Array.isArray(p.achievements) && p.achievements.length ? p.achievements : null;
        achList = ach;
        charByLogin = {};
        chars.forEach(function (c) { charByLogin[login(c).toLowerCase()] = c; });

        head.innerHTML = '';
        var w = el('div', 'wrap phead');
        if (lead) {
            w.appendChild(emblem(lead.class, 'head'));
            w.appendChild(el('h1', 'phead__title' + (lead.rank === 'immortal' ? ' pchar__name--god' : ''),
                [bi(lead.name.en, ukName(lead))]));
            w.appendChild(el('p', 'phead__sub', [p.title || p.id]));
        } else {
            w.appendChild(el('h1', 'phead__title', [p.title || p.id]));
        }
        w.appendChild(stats(p, chars, ach && {
            unlocked: ach.filter(function (a) { return a.unlocked; }).length, total: ach.length
        }));
        head.appendChild(w);

        document.title = 'DreamLand — ' + (lead ? lead.name.en : (p.title || p.id));

        body.innerHTML = '';
        body.appendChild(ach ? achievementsShelf(ach) : achievementsSoon());

        var csec = el('section', 'pchars-sec');
        csec.setAttribute('aria-labelledby', 'charsTitle');
        var ch = el('h2', 'pach-sec__title', [bi('Characters', 'Персонажі')]);
        ch.id = 'charsTitle';
        csec.appendChild(ch);
        var list = el('div', 'pchars');
        chars.forEach(function (c) { list.appendChild(card(c)); });
        csec.appendChild(list);
        body.appendChild(csec);

        // Deep link: /player/<id>#Name opens that character's sheet.
        var want = decodeURIComponent((location.hash || '').slice(1)).toLowerCase();
        if (want && ach) {
            ach.forEach(function (a) {
                if (!a.secret || a.unlocked)
                    if (String(a.id).toLowerCase() === want) openAch(a);
            });
        }
        if (want) {
            chars.forEach(function (c) {
                if (login(c).toLowerCase() === want) {
                    document.getElementById(login(c)).scrollIntoView({ block: 'center' });
                    openSheet(c);
                }
            });
        }
    }

    function renderMissing() {
        head.innerHTML = '';
        var w = el('div', 'wrap');
        var h1 = el('h1', null, [bi('No such profile', 'Такого профілю немає')]);
        w.appendChild(h1);
        w.appendChild(el('p', null, [bi(
            'Either the link is wrong, or the player keeps their characters to themselves. A profile opens once one of the account\'s characters has been reborn.',
            'Або посилання хибне, або гравець тримає своїх персонажів при собі. Профіль відкривається, коли хтось із персонажів акаунта переродиться.')]));
        head.appendChild(w);
        body.innerHTML = '';
    }

    function renderError() {
        head.innerHTML = '';
        var w = el('div', 'wrap');
        w.appendChild(el('h1', null, [bi('The Archivist is busy', 'Архіваріус зайнятий')]));
        w.appendChild(el('p', null, [bi('The game did not answer. Try again in a minute.', 'Гра не відповіла. Спробуй за хвилину.')]));
        head.appendChild(w);
    }

    // /player/NU3D8Y, /player/Taiphoen, or /player.html?id=... for local runs.
    var key = location.pathname.replace(/\/+$/, '').split('/').pop();
    if (!key || /\.html$/.test(key)) key = new URLSearchParams(location.search).get('id') || '';
    key = decodeURIComponent(key);

    if (!key) { renderMissing(); return; }

    var args = /^[A-Z0-9]{6}$/.test(key) ? { id: key } : { char: key };
    fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args: args })
    }).then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    }).then(function (p) {
        if (p && p.chars && p.chars.length) renderProfile(p);
        else renderMissing();
    }).catch(renderError);
})();
