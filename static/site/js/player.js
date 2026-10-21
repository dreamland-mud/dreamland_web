/* Public account profile: /player/<id> (or /player/<CharName>).
   Data comes live from the game's public /api/profile endpoint, which answers
   404 for an account that has no reborn character, was switched off by its
   owner, or has every character hidden. Every text renders in both languages
   at once (lang="en" / lang="uk"), like the rest of the site, so the language
   switch needs no re-render. */
(function () {
    var head = document.getElementById('profileHead');
    var body = document.getElementById('profileBody');

    var EMBLEMS = ['anti-paladin', 'cleric', 'druid', 'necromancer', 'ninja', 'paladin',
        'ranger', 'samurai', 'thief', 'vampire', 'warlock', 'warrior', 'witch'];

    // Mud colour letters -> the terminal palette's hues (uppercase = bright).
    var MUD_COLOURS = {
        r: '#b0413e', g: '#4f9a4a', y: '#c9a227', b: '#4a6fc0', m: '#9a4fb0', c: '#3f9fa6', w: '#c8c0ad', d: '#6f6857',
        R: '#e2554f', G: '#6fd36a', Y: '#f2d24b', B: '#6f95f0', M: '#d277f0', C: '#5fd6dc', W: '#ffffff', D: '#8d8574'
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

    function plural(n, en1, enN, uk1, uk2, uk5) {
        var m10 = n % 10, m100 = n % 100;
        var uk = (m10 === 1 && m100 !== 11) ? uk1
            : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) ? uk2 : uk5;
        return bi(n + ' ' + (n === 1 ? en1 : enN), n + ' ' + uk);
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

    function ukName(c) { return c.name.ru || c.name.en; }

    function badges(c) {
        var row = el('ul', 'pbadges');
        function add(cls, content, title) {
            var li = el('li', 'pbadge ' + cls, [content]);
            if (title) li.title = title;
            row.appendChild(li);
        }
        var fem = c.sex === 'f';
        if (c.rank === 'immortal') add('pbadge--god', bi('Immortal', fem ? 'Безсмертна' : 'Безсмертний'));
        else if (c.rank === 'legendary') add('pbadge--legend', bi('Legend', 'Легенда'));
        if (c.remorts > 0)
            add('pbadge--remort', plural(c.remorts, 'rebirth', 'rebirths', 'переродження', 'переродження', 'перероджень'));
        if (c.clan) {
            var chip = el('span', 'pbadge__dot');
            var col = c.clan.color && MUD_COLOURS[c.clan.color.charAt(0)];
            if (col) chip.style.background = col;
            var f = document.createDocumentFragment();
            f.appendChild(chip);
            f.appendChild(bi(c.clan.en, c.clan.ua));
            add('pbadge--clan', f);
        }
        if (c.online) add('pbadge--online', bi('in the world now', 'зараз у світі'));
        return row;
    }

    // The whois-like sheet that opens under a card.
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
        return dl;
    }

    function card(c) {
        var d = el('details', 'pchar');
        d.id = c.name.en;

        var sum = el('summary', 'pchar__card');
        sum.appendChild(emblem(c.class, 'card'));
        var id = el('span', 'pchar__id');
        id.appendChild(bi(c.name.en, ukName(c), 'pchar__name'));
        id.appendChild(bi(c.race.en + ' ' + c.class.en, c.race.ua + ' ' + c.class.ua, 'pchar__cls'));
        sum.appendChild(id);
        if (c.online) {
            var dot = el('span', 'pchar__live');
            dot.appendChild(bi('online', 'онлайн', 'sr-only'));
            sum.appendChild(dot);
        }
        d.appendChild(sum);

        var open = el('div', 'pchar__open');
        open.appendChild(badges(c));
        open.appendChild(sheet(c));
        d.appendChild(open);

        d.addEventListener('toggle', function () {
            if (d.open && history.replaceState)
                history.replaceState(null, '', '#' + c.name.en);
        });
        return d;
    }

    function renderProfile(p) {
        var chars = p.chars || [];
        var lead = chars[0];
        var total = chars.reduce(function (s, c) { return s + (c.remorts || 0); }, 0);

        head.innerHTML = '';
        var w = el('div', 'wrap phead');
        if (lead) w.appendChild(emblem(lead.class, 'head'));
        var h1 = el('h1', 'phead__title', [p.title || p.id]);
        w.appendChild(h1);
        var meta = el('p', 'phead__meta');
        meta.appendChild(plural(chars.length, 'character', 'characters', 'персонаж', 'персонажі', 'персонажів'));
        meta.appendChild(document.createTextNode(' · '));
        meta.appendChild(plural(total, 'rebirth', 'rebirths', 'переродження', 'переродження', 'перероджень'));
        w.appendChild(meta);
        head.appendChild(w);

        document.title = 'DreamLand — ' + (p.title || p.id);

        body.innerHTML = '';
        var list = el('div', 'pchars');
        chars.forEach(function (c) { list.appendChild(card(c)); });
        body.appendChild(el('h2', 'sr-only', [bi('Characters', 'Персонажі')]));
        body.appendChild(list);

        // Deep link: /player/<id>#Name opens that character.
        var want = decodeURIComponent((location.hash || '').slice(1)).toLowerCase();
        if (want) {
            Array.prototype.forEach.call(list.children, function (d) {
                if (d.id.toLowerCase() === want) { d.open = true; d.scrollIntoView({ block: 'center' }); }
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
