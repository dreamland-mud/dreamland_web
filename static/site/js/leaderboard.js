/* Leaderboard: account pages ranked by achievement score, from the game's
   public /api/leaderboard (daily sums, cached 10 minutes server side). Both
   languages are rendered and i18n.js shows one. */
(function () {
    var root = document.getElementById('board');

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

    function message(en, uk) {
        root.textContent = '';
        root.appendChild(both('p', 'board-soon', en, uk));
    }

    function th(en, uk, cls) {
        var c = el('th', cls);
        c.setAttribute('scope', 'col');
        c.appendChild(both('span', null, en, uk));
        return c;
    }

    function render(data) {
        if (!data.open) {
            message('The list is not open yet.', 'Список ще не відкрито.');
            return;
        }
        if (!data.rows || !data.rows.length) {
            message('Nobody on the list yet.', 'У списку ще нікого.');
            return;
        }
        var box = el('div', 'board tablewrap');
        var table = el('table', 'results');
        table.setAttribute('aria-labelledby', 'board-title');
        var head = el('thead'), hr = el('tr');
        hr.appendChild(th('#', '#', 'num'));
        hr.appendChild(th('Player', 'Гравець'));
        hr.appendChild(th('Points', 'Бали', 'num'));
        hr.appendChild(th('Legendary', 'Легендарні', 'num'));
        hr.appendChild(th('Secrets', 'Таємниці', 'num col-secrets'));
        hr.appendChild(th('Earned', 'Здобуто', 'num col-earned'));
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
            tr.appendChild(el('td', 'num', String(r.score)));
            tr.appendChild(el('td', 'num', String(r.legendary)));
            tr.appendChild(el('td', 'num col-secrets', String(r.secrets)));
            tr.appendChild(el('td', 'num col-earned', String(r.earned)));
            body.appendChild(tr);
        });
        table.appendChild(body);
        box.appendChild(table);
        box.appendChild(both('p', 'board-note',
            'Points: common 1, rare 3, epic 10, legendary 25. Updated daily. Each name opens that player\'s public page.',
            'Бали: звичайне 1, рідкісне 3, епічне 10, легендарне 25. Оновлюється щодня. Кожне імʼя відкриває публічну сторінку гравця.'));
        root.textContent = '';
        root.appendChild(box);
    }

    fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args: {} })
    }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
    }).then(function (data) {
        if (data.names && window.DLPlayerSearch) window.DLPlayerSearch.setNames(data.names);
        render(data);
    }).catch(function () {
        message('The Archivist is not answering. Try again in a minute.', 'Архіваріус не відповідає. Спробуй за хвилину.');
    });
})();
