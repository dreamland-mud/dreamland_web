/* Leaderboards from the game's public /api/leaderboard (daily sums, cached 10
   minutes server side): Accounts (open account pages, one row each under the
   main character), Players (every character on its own) and World ("who
   plays what" counts). All three languages are rendered and i18n.js shows one;
   the native select is relabelled on a language switch. The view lives in
   the hash (#deaths, #players/deaths, #world) so a link opens it. */
(function () {
    var root = document.getElementById('board');
    var pick = document.getElementById('board-pick');
    var titleEn = document.getElementById('board-title-en');
    var titleUk = document.getElementById('board-title-uk');
    var titleRu = document.getElementById('board-title-ru');
    var pickWrap = document.getElementById('board-pickwrap');
    var SCOPES = ['accounts', 'players', 'world'];
    var tabs = SCOPES.map(function (k) { return document.getElementById('tab-' + k); });
    var boardPanel = document.getElementById('panel-board');
    var worldPanel = document.getElementById('panel-world');
    var worldRoot = document.getElementById('world-list');

    var POINTS_EN = 'Points: common 1, rare 3, epic 10, legendary 25.';
    var POINTS_UK = 'Бали: звичайне 1, рідкісне 3, епічне 10, легендарне 25.';
    var POINTS_RU = 'Очки: обычное 1, редкое 3, эпическое 10, легендарное 25.';

    // key, select label, title, value column, note (the daily line is added).
    // col and note are [en, uk, ru].
    var BOARDS = [
        { key: 'score', en: 'Achievements', uk: 'Досягнення', ru: 'Достижения',
          col: ['Points', 'Бали', 'Очки'], extra: true, note: [POINTS_EN, POINTS_UK, POINTS_RU] },
        { key: 'month', en: 'Achievements, last 30 days', uk: 'Досягнення за 30 днів', ru: 'Достижения за 30 дней',
          col: ['Points', 'Бали', 'Очки'],
          note: [POINTS_EN + ' Counts what was earned since November 1, 2026.',
                 POINTS_UK + ' Рахує здобуте з 1 листопада 2026.',
                 POINTS_RU + ' Считает добытое с 1 ноября 2026.'] },
        { key: 'lives', en: 'Rebirths', uk: 'Реморти', ru: 'Реморты',
          col: ['Rebirths', 'Реморти', 'Реморты'],
          note: ['Every rebirth of every character on the account.', 'Усі реморти всіх персонажів акаунта.',
                 'Все реморты всех персонажей аккаунта.'] },
        { key: 'quests', en: 'Questor tasks', uk: 'Завдання квестора', ru: 'Задания квестора',
          col: ['Tasks', 'Завдання', 'Задания'] },
        { key: 'aquests', en: 'Area quests', uk: 'Зональні квести', ru: 'Зональные квесты',
          col: ['Quests', 'Квести', 'Квесты'] },
        { key: 'gquests', en: 'Global quests', uk: 'Глобальні квести', ru: 'Глобальные квесты',
          col: ['Wins', 'Перемоги', 'Победы'] },
        { key: 'kills', en: 'Slayers', uk: 'Мʼясники', ru: 'Мясники',
          col: ['Monsters slain', 'Убито монстрів', 'Убито монстров'],
          note: ['Kills of the current life of each character: a rebirth starts the count over.',
                 'Убивства поточного життя кожного персонажа: ремортом лік починається знову.',
                 'Убийства текущей жизни каждого персонажа: с ремортом счет начинается заново.'] },
        { key: 'bosses', en: 'Boss hunters', uk: 'Мисливці на босів', ru: 'Охотники на боссов',
          col: ['Bosses', 'Боси', 'Боссы'],
          note: ['Different bosses slain, counted since October 2026.', 'Різні вбиті боси, лік з жовтня 2026.',
                 'Разные убитые боссы, счет с октября 2026.'] },
        { key: 'craft', en: 'Craftsmen', uk: 'Майстри', ru: 'Мастера',
          col: ['Craft levels', 'Рівні ремесел', 'Уровни ремесел'],
          note: ['Sum of craft skill levels. A character shows up after the next login.',
                 'Сума рівнів ремесел. Персонаж зʼявиться після наступного входу в гру.',
                 'Сумма уровней ремесел. Персонаж появится после следующего входа в игру.'] },
        { key: 'rooms', en: 'Explorers', uk: 'Мандрівники', ru: 'Странники',
          col: ['World seen', 'Побачено світу', 'Увидено мира'], pct: true,
          note: ['Share of the ordinary rooms seen, by the most travelled character.',
                 'Частка звичайних кімнат, де ступала нога, у найбільш мандрівного персонажа.',
                 'Доля обычных комнат, где ступала нога, у самого бывалого персонажа.'] },
        { key: 'deaths', en: 'Hall of shame', uk: 'Зал ганьби', ru: 'Зал позора',
          col: ['Deaths to monsters', 'Смертей від монстрів', 'Смертей от монстров'],
          note: ['Every death to a monster, all lives included. Wear it with pride.',
                 'Усі смерті від монстрів за всі життя. Носи з гордістю.',
                 'Все смерти от монстров за все жизни. Носи с гордостью.'] }
    ];
    var byKey = {};
    BOARDS.forEach(function (b) { byKey[b.key] = b; });
    var WORLD_TOP = 10;
    var cache = {};
    var current = null;     // "<scope>/<board>" on screen
    var scope = 'accounts';
    var board = 'score';

    function lang() {
        var l = document.documentElement.getAttribute('data-lang');
        return l === 'uk' || l === 'ru' ? l : 'en';
    }

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    // one element per language; i18n.js CSS shows the current one
    function both(tag, cls, en, uk, ru) {
        var f = document.createDocumentFragment();
        [['en', en], ['uk', uk], ['ru', ru]].forEach(function (p) {
            var e = el(tag, cls, p[1]); e.setAttribute('lang', p[0]);
            f.appendChild(e);
        });
        return f;
    }

    function message(box, en, uk, ru) {
        box.textContent = '';
        box.appendChild(both('p', 'board-soon', en, uk, ru));
    }

    function th(en, uk, ru, cls) {
        var c = el('th', cls);
        c.setAttribute('scope', 'col');
        c.appendChild(both('span', null, en, uk, ru));
        return c;
    }

    var ASKING = ['Asking the Archivist...', 'Питаємо Архіваріуса...', 'Спрашиваем Архивариуса...'];
    var SILENT = ['The Archivist is not answering. Try again in a minute.', 'Архіваріус не відповідає. Спробуй за хвилину.',
                  'Архивариус не отвечает. Попробуй через минуту.'];

    function fetchBoard(sc, key) {
        var ck = sc + '/' + key;
        if (cache[ck]) return Promise.resolve(cache[ck]);
        return fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ args: { board: key, scope: sc } })
        }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            return r.json();
        }).then(function (data) {
            cache[ck] = data;
            if (data.names && window.DLPlayerSearch) window.DLPlayerSearch.setNames(data.names);
            return data;
        });
    }

    // ---------- players ----------

    function playerCell(r) {
        var who = el('td');
        var nm = both('span', null, r.name.en || r.name.login, r.name.ua || r.name.ru || r.name.login,
            r.name.ru || r.name.login);
        var a;
        if (r.link) {
            a = el('a', 'bname');
            a.href = '/player/' + encodeURIComponent(r.name.login);
        } else {
            a = el('span', 'bname bname--plain');
        }
        a.appendChild(nm);
        who.appendChild(a);
        if (r.race && r.class) {
            var cap = function (t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; };
            who.appendChild(both('span', 'btitle',
                cap(r.race.en) + ' · ' + cap(r.class.en),
                cap(r.race.ua || r.race.ru) + ' · ' + cap(r.class.ua || r.class.ru),
                cap(r.race.ru) + ' · ' + cap(r.class.ru)));
        }
        return who;
    }

    function accountCell(r) {
        var who = el('td');
        var a = el('a', 'bname');
        a.href = '/player/' + encodeURIComponent(r.name.login);
        a.appendChild(both('span', null, r.name.en || r.name.login, r.name.ua || r.name.ru || r.name.login,
            r.name.ru || r.name.login));
        who.appendChild(a);
        if (r.title) who.appendChild(el('span', 'btitle', r.title));
        return who;
    }

    function renderBoard(b, data, players) {
        if (!data.open) {
            message(root, 'The list is not open yet.', 'Список ще не відкрито.', 'Список еще не открыт.');
            return;
        }
        if (!data.rows || !data.rows.length) {
            message(root, 'Nobody on this list yet.', 'У цьому списку ще нікого.', 'В этом списке еще никого.');
            return;
        }
        var box = el('div', 'board tablewrap');
        var table = el('table', 'results');
        table.setAttribute('aria-labelledby', 'board-title');
        var head = el('thead'), hr = el('tr');
        hr.appendChild(th('#', '#', '#', 'num'));
        hr.appendChild(players ? th('Character', 'Персонаж', 'Персонаж') : th('Account', 'Акаунт', 'Аккаунт'));
        hr.appendChild(th(b.col[0], b.col[1], b.col[2], 'num'));
        if (b.extra) {
            hr.appendChild(th('Legendary', 'Легендарні', 'Легендарные', 'num'));
            hr.appendChild(th('Secrets', 'Таємниці', 'Тайны', 'num col-secrets'));
            hr.appendChild(th('Earned', 'Здобуто', 'Добыто', 'num col-earned'));
        }
        head.appendChild(hr);
        table.appendChild(head);
        var body = el('tbody');
        data.rows.forEach(function (r, i) {
            var tr = el('tr');
            tr.appendChild(el('td', 'num rank', String(i + 1)));
            tr.appendChild(players ? playerCell(r) : accountCell(r));
            tr.appendChild(el('td', 'num', String(r[b.key]) + (b.pct ? '%' : '')));
            if (b.extra) {
                tr.appendChild(el('td', 'num', String(r.legendary)));
                tr.appendChild(el('td', 'num col-secrets', String(r.secrets)));
                tr.appendChild(el('td', 'num col-earned', String(r.earned)));
            }
            body.appendChild(tr);
        });
        table.appendChild(body);
        box.appendChild(table);
        var note = b.note || ['', '', ''];
        var tailEn = players
            ? 'Every character on its own. Updated daily. A linked name opens that player\'s public page.'
            : 'One row per account, under its most played character. Updated daily. Each name opens that player\'s public page.';
        var tailUk = players
            ? 'Кожен персонаж окремо. Оновлюється щодня. Імʼя з посиланням відкриває публічну сторінку гравця.'
            : 'Один рядок на акаунт, під найбільш граним персонажем. Оновлюється щодня. Кожне імʼя відкриває публічну сторінку гравця.';
        var tailRu = players
            ? 'Каждый персонаж отдельно. Обновляется ежедневно. Имя со ссылкой открывает публичную страницу игрока.'
            : 'Одна строка на аккаунт, под самым играемым персонажем. Обновляется ежедневно. Каждое имя открывает публичную страницу игрока.';
        box.appendChild(both('p', 'board-note',
            (note[0] ? note[0] + ' ' : '') + tailEn,
            (note[1] ? note[1] + ' ' : '') + tailUk,
            (note[2] ? note[2] + ' ' : '') + tailRu));
        root.textContent = '';
        root.appendChild(box);
    }

    function showBoard(sc, key) {
        var b = byKey[key] || BOARDS[0];
        var ck = sc + '/' + b.key;
        current = ck;
        pick.value = b.key;
        titleEn.textContent = b.en;
        titleUk.textContent = b.uk;
        if (titleRu) titleRu.textContent = b.ru;
        message(root, ASKING[0], ASKING[1], ASKING[2]);
        fetchBoard(sc, b.key).then(function (data) {
            if (current === ck) renderBoard(b, data, sc === 'players');
        }).catch(function () {
            if (current === ck)
                message(root, SILENT[0], SILENT[1], SILENT[2]);
        });
    }

    function labelOptions() {
        var l = lang();
        Array.prototype.forEach.call(pick.options, function (o) {
            var b = byKey[o.value];
            o.textContent = b[l];
        });
    }

    BOARDS.forEach(function (b) {
        var o = document.createElement('option');
        o.value = b.key;
        pick.appendChild(o);
    });
    labelOptions();
    new MutationObserver(labelOptions).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    pick.addEventListener('change', function () { go(scope, pick.value); });

    // ---------- world ----------

    function nameOf(e) {
        return { en: e.en || e.key, uk: e.ua || e.ru || e.en || e.key, ru: e.ru || e.en || e.key };
    }

    function worldTable(id, en, uk, ru, list, clans) {
        var sec = el('section', 'wtable');
        var h = el('h3', 'wtable__title');
        h.id = 'w-' + id;
        h.appendChild(both('span', null, en, uk, ru));
        sec.appendChild(h);
        if (!list || !list.length) {
            sec.appendChild(both('p', 'board-soon', 'Nobody yet.', 'Поки нікого.', 'Пока никого.'));
            return sec;
        }
        var box = el('div', 'board tablewrap');
        var table = el('table', 'results');
        table.setAttribute('aria-labelledby', h.id);
        var head = el('thead'), hr = el('tr');
        hr.appendChild(th('#', '#', '#', 'num'));
        hr.appendChild(th(clans ? 'Clan' : 'Name', clans ? 'Клан' : 'Назва', clans ? 'Клан' : 'Название'));
        hr.appendChild(th('Active', 'Активні', 'Активные', 'num'));
        if (clans) hr.appendChild(th('All members', 'Усього членів', 'Всего членов', 'num'));
        head.appendChild(hr);
        table.appendChild(head);
        var body = el('tbody');
        list.slice(0, WORLD_TOP).forEach(function (e, i) {
            var tr = el('tr');
            tr.appendChild(el('td', 'num rank', String(i + 1)));
            var n = nameOf(e);
            var td = el('td');
            td.appendChild(both('span', 'wname', n.en, n.uk, n.ru));
            tr.appendChild(td);
            tr.appendChild(el('td', 'num', String(e.n)));
            if (clans) tr.appendChild(el('td', 'num', String(e.members)));
            body.appendChild(tr);
        });
        table.appendChild(body);
        box.appendChild(table);
        sec.appendChild(box);
        return sec;
    }

    function renderWorld(data) {
        worldRoot.textContent = '';
        var grid = el('div', 'wgrid');
        grid.appendChild(worldTable('classes', 'Classes', 'Класи', 'Классы', data.classes));
        grid.appendChild(worldTable('races', 'Races', 'Раси', 'Расы', data.races));
        grid.appendChild(worldTable('religions', 'Gods', 'Боги', 'Боги', data.religions));
        grid.appendChild(worldTable('clans', 'Clans', 'Клани', 'Кланы', data.clans, true));
        worldRoot.appendChild(grid);
        worldRoot.appendChild(both('p', 'wlead',
            data.active + ' characters entered the world in the last ' + data.days + ' days.',
            data.active + ' персонажів заходили у світ за останні ' + data.days + ' днів.',
            'За последние дни (' + data.days + ') в мир заходило персонажей: ' + data.active + '.'));
    }

    function showWorld() {
        if (cache['accounts/world']) { renderWorld(cache['accounts/world']); return; }
        message(worldRoot, ASKING[0], ASKING[1], ASKING[2]);
        fetchBoard('accounts', 'world').then(renderWorld).catch(function () {
            message(worldRoot, SILENT[0], SILENT[1], SILENT[2]);
        });
    }

    // ---------- tabs + hash ----------

    function selectTab(sc) {
        tabs.forEach(function (t, j) {
            var on = SCOPES[j] === sc;
            t.setAttribute('aria-selected', on ? 'true' : 'false');
            t.tabIndex = on ? 0 : -1;
        });
        boardPanel.hidden = sc === 'world';
        worldPanel.hidden = sc !== 'world';
        pickWrap.hidden = sc === 'world';
        if (sc !== 'world') boardPanel.setAttribute('aria-labelledby', 'tab-' + sc);
    }

    tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { go(SCOPES[i], board); });
        t.addEventListener('keydown', function (e) {
            var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            var n = (i + d + tabs.length) % tabs.length;
            tabs[n].click();
            tabs[n].focus();
        });
    });

    // "" or "#<board>" = accounts, "#players[/<board>]", "#world".
    function parseHash() {
        var parts = location.hash.replace('#', '').split('/');
        if (parts[0] === 'world') return { scope: 'world', board: board };
        if (parts[0] === 'players') return { scope: 'players', board: byKey[parts[1]] ? parts[1] : board };
        return { scope: 'accounts', board: byKey[parts[0]] ? parts[0] : 'score' };
    }

    function hashOf(sc, key) {
        if (sc === 'world') return '#world';
        if (sc === 'players') return key === 'score' ? '#players' : '#players/' + key;
        return key === 'score' ? '' : '#' + key;
    }

    function route() {
        var v = parseHash();
        scope = v.scope;
        board = v.board;
        selectTab(scope);
        if (scope === 'world') showWorld();
        else showBoard(scope, board);
    }

    // Boards are cached, so routing to the one already shown only redraws it.
    function go(sc, key) {
        var h = hashOf(sc, key);
        if (location.hash === h) { route(); return; }
        if (h) {
            location.hash = h;
        } else {
            history.replaceState(null, '', location.pathname + location.search);
            route();
        }
    }

    window.addEventListener('hashchange', route);
    route();
})();
