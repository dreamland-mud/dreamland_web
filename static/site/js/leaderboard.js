/* Leaderboards: account pages ranked by one number each, and "who plays what"
   counts, from the game's public /api/leaderboard (daily sums, cached 10
   minutes server side). Both languages are rendered and i18n.js shows one;
   the native select is relabelled on a language switch. The chosen board
   lives in the hash (#deaths, #world) so a link opens it. */
(function () {
    var root = document.getElementById('board');
    var pick = document.getElementById('board-pick');
    var titleEn = document.getElementById('board-title-en');
    var titleUk = document.getElementById('board-title-uk');
    var tabs = [document.getElementById('tab-players'), document.getElementById('tab-world')];
    var panels = [document.getElementById('panel-players'), document.getElementById('panel-world')];
    var worldRoot = document.getElementById('world');

    var POINTS_EN = 'Points: common 1, rare 3, epic 10, legendary 25.';
    var POINTS_UK = 'Бали: звичайне 1, рідкісне 3, епічне 10, легендарне 25.';

    // key, select label, title, value column, note (the daily line is added).
    var BOARDS = [
        { key: 'score', en: 'Achievements', uk: 'Досягнення',
          col: ['Points', 'Бали'], extra: true, note: [POINTS_EN, POINTS_UK] },
        { key: 'month', en: 'Achievements, last 30 days', uk: 'Досягнення за 30 днів',
          col: ['Points', 'Бали'],
          note: [POINTS_EN + ' Counts what was earned since November 1, 2026.',
                 POINTS_UK + ' Рахує здобуте з 1 листопада 2026.'] },
        { key: 'lives', en: 'Rebirths', uk: 'Реморти',
          col: ['Rebirths', 'Реморти'],
          note: ['Every rebirth of every character on the account.', 'Усі реморти всіх персонажів акаунта.'] },
        { key: 'quests', en: 'Questor tasks', uk: 'Завдання квестора',
          col: ['Tasks', 'Завдання'] },
        { key: 'aquests', en: 'Area quests', uk: 'Зональні квести',
          col: ['Quests', 'Квести'] },
        { key: 'gquests', en: 'Global quests', uk: 'Глобальні квести',
          col: ['Wins', 'Перемоги'] },
        { key: 'kills', en: 'Slayers', uk: 'Мʼясники',
          col: ['Monsters slain', 'Убито монстрів'],
          note: ['Kills of the current life of each character: a rebirth starts the count over.',
                 'Убивства поточного життя кожного персонажа: ремортом лік починається знову.'] },
        { key: 'bosses', en: 'Boss hunters', uk: 'Мисливці на босів',
          col: ['Bosses', 'Боси'],
          note: ['Different bosses slain, counted since October 2026.', 'Різні вбиті боси, лік з жовтня 2026.'] },
        { key: 'craft', en: 'Craftsmen', uk: 'Майстри',
          col: ['Craft levels', 'Рівні ремесел'],
          note: ['Sum of craft skill levels. A character shows up after the next login.',
                 'Сума рівнів ремесел. Персонаж зʼявиться після наступного входу в гру.'] },
        { key: 'rooms', en: 'Explorers', uk: 'Мандрівники',
          col: ['World seen', 'Побачено світу'], pct: true,
          note: ['Share of the ordinary rooms seen, by the most travelled character.',
                 'Частка звичайних кімнат, де ступала нога, у найбільш мандрівного персонажа.'] },
        { key: 'deaths', en: 'Hall of shame', uk: 'Зал ганьби',
          col: ['Deaths to monsters', 'Смертей від монстрів'],
          note: ['Every death to a monster, all lives included. Wear it with pride.',
                 'Усі смерті від монстрів за всі життя. Носи з гордістю.'] }
    ];
    var byKey = {};
    BOARDS.forEach(function (b) { byKey[b.key] = b; });
    var cache = {};
    var current = null;

    function isUk() { return document.documentElement.getAttribute('data-lang') === 'uk'; }

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    function both(tag, cls, en, uk) {
        var f = document.createDocumentFragment();
        var a = el(tag, cls, en); a.setAttribute('lang', 'en');
        var b = el(tag, cls, uk); b.setAttribute('lang', 'uk');
        f.appendChild(a); f.appendChild(b);
        return f;
    }

    function message(box, en, uk) {
        box.textContent = '';
        box.appendChild(both('p', 'board-soon', en, uk));
    }

    function th(en, uk, cls) {
        var c = el('th', cls);
        c.setAttribute('scope', 'col');
        c.appendChild(both('span', null, en, uk));
        return c;
    }

    function fetchBoard(key) {
        if (cache[key]) return Promise.resolve(cache[key]);
        return fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ args: { board: key } })
        }).then(function (r) {
            if (!r.ok) throw new Error(r.status);
            return r.json();
        }).then(function (data) {
            cache[key] = data;
            if (data.names && window.DLPlayerSearch) window.DLPlayerSearch.setNames(data.names);
            return data;
        });
    }

    // ---------- players ----------

    function renderBoard(b, data) {
        if (!data.open) {
            message(root, 'The list is not open yet.', 'Список ще не відкрито.');
            return;
        }
        if (!data.rows || !data.rows.length) {
            message(root, 'Nobody on this list yet.', 'У цьому списку ще нікого.');
            return;
        }
        var box = el('div', 'board tablewrap');
        var table = el('table', 'results');
        table.setAttribute('aria-labelledby', 'board-title');
        var head = el('thead'), hr = el('tr');
        hr.appendChild(th('#', '#', 'num'));
        hr.appendChild(th('Player', 'Гравець'));
        hr.appendChild(th(b.col[0], b.col[1], 'num'));
        if (b.extra) {
            hr.appendChild(th('Legendary', 'Легендарні', 'num'));
            hr.appendChild(th('Secrets', 'Таємниці', 'num col-secrets'));
            hr.appendChild(th('Earned', 'Здобуто', 'num col-earned'));
        }
        head.appendChild(hr);
        table.appendChild(head);
        var body = el('tbody');
        data.rows.forEach(function (r, i) {
            var tr = el('tr');
            tr.appendChild(el('td', 'num rank', String(i + 1)));
            var who = el('td');
            var a = el('a', 'bname');
            a.href = '/player/' + encodeURIComponent(r.name.login);
            a.appendChild(both('span', null, r.name.en || r.name.login, r.name.ua || r.name.ru || r.name.login));
            who.appendChild(a);
            if (r.title) who.appendChild(el('span', 'btitle', r.title));
            tr.appendChild(who);
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
        var note = b.note || ['', ''];
        box.appendChild(both('p', 'board-note',
            (note[0] ? note[0] + ' ' : '') + 'Updated daily. Each name opens that player\'s public page.',
            (note[1] ? note[1] + ' ' : '') + 'Оновлюється щодня. Кожне імʼя відкриває публічну сторінку гравця.'));
        root.textContent = '';
        root.appendChild(box);
    }

    function showBoard(key) {
        var b = byKey[key] || BOARDS[0];
        current = b.key;
        pick.value = b.key;
        titleEn.textContent = b.en;
        titleUk.textContent = b.uk;
        message(root, 'Asking the Archivist...', 'Питаємо Архіваріуса...');
        fetchBoard(b.key).then(function (data) {
            if (current === b.key) renderBoard(b, data);
        }).catch(function () {
            if (current === b.key)
                message(root, 'The Archivist is not answering. Try again in a minute.', 'Архіваріус не відповідає. Спробуй за хвилину.');
        });
    }

    function labelOptions() {
        var uk = isUk();
        Array.prototype.forEach.call(pick.options, function (o) {
            var b = byKey[o.value];
            o.textContent = uk ? b.uk : b.en;
        });
    }

    BOARDS.forEach(function (b) {
        var o = document.createElement('option');
        o.value = b.key;
        pick.appendChild(o);
    });
    labelOptions();
    new MutationObserver(labelOptions).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    pick.addEventListener('change', function () { go(pick.value); });

    // ---------- world ----------

    function nameOf(e) {
        return { en: e.en || e.key, uk: e.ua || e.ru || e.en || e.key };
    }

    function worldTable(id, en, uk, list, clans) {
        var sec = el('section', 'wtable');
        var h = el('h3', 'wtable__title');
        h.id = 'w-' + id;
        h.appendChild(both('span', null, en, uk));
        sec.appendChild(h);
        if (!list || !list.length) {
            sec.appendChild(both('p', 'board-soon', 'Nobody yet.', 'Поки нікого.'));
            return sec;
        }
        var box = el('div', 'board tablewrap');
        var table = el('table', 'results');
        table.setAttribute('aria-labelledby', h.id);
        var head = el('thead'), hr = el('tr');
        hr.appendChild(th('#', '#', 'num'));
        hr.appendChild(th(clans ? 'Clan' : 'Name', clans ? 'Клан' : 'Назва'));
        hr.appendChild(th('Active', 'Активні', 'num'));
        if (clans) hr.appendChild(th('All members', 'Усього членів', 'num'));
        head.appendChild(hr);
        table.appendChild(head);
        var body = el('tbody');
        list.forEach(function (e, i) {
            var tr = el('tr');
            tr.appendChild(el('td', 'num rank', String(i + 1)));
            var n = nameOf(e);
            var td = el('td');
            td.appendChild(both('span', 'wname', n.en, n.uk));
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
        worldRoot.appendChild(both('p', 'wlead',
            data.active + ' characters entered the world in the last ' + data.days + ' days. Counts only, no names.',
            data.active + ' персонажів заходили у світ за останні ' + data.days + ' днів. Лише числа, без імен.'));
        var grid = el('div', 'wgrid');
        grid.appendChild(worldTable('classes', 'Classes', 'Класи', data.classes));
        grid.appendChild(worldTable('races', 'Races', 'Раси', data.races));
        grid.appendChild(worldTable('religions', 'Gods', 'Боги', data.religions));
        grid.appendChild(worldTable('clans', 'Clans', 'Клани', data.clans, true));
        worldRoot.appendChild(grid);
    }

    function showWorld() {
        if (cache.world) { renderWorld(cache.world); return; }
        message(worldRoot, 'Asking the Archivist...', 'Питаємо Архіваріуса...');
        fetchBoard('world').then(renderWorld).catch(function () {
            message(worldRoot, 'The Archivist is not answering. Try again in a minute.', 'Архіваріус не відповідає. Спробуй за хвилину.');
        });
    }

    // ---------- tabs + hash ----------

    function selectTab(i) {
        tabs.forEach(function (t, j) {
            t.setAttribute('aria-selected', i === j ? 'true' : 'false');
            t.tabIndex = i === j ? 0 : -1;
            panels[j].hidden = i !== j;
        });
    }

    tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { go(i === 1 ? 'world' : (current || 'score')); });
        t.addEventListener('keydown', function (e) {
            var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            var n = (i + d + tabs.length) % tabs.length;
            tabs[n].click();
            tabs[n].focus();
        });
    });

    function route() {
        var key = location.hash.replace('#', '');
        if (key === 'world') {
            selectTab(1);
            showWorld();
        } else {
            selectTab(0);
            showBoard(key);
        }
    }

    // Boards are cached, so routing to the one already shown only redraws it.
    function go(key) {
        var h = key === 'score' ? '' : '#' + key;
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
