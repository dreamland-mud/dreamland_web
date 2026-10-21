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

    // Clan colour letter -> the Nirvana dark-surface ANSI palette (design/design.css
    // .fgd* / .fgb*), uppercase = bright. Feeds the clan data-chip's --chip-accent.
    var MUD_COLOURS = {
        r: '#cc0000', g: '#4e9a06', y: '#c4a000', b: '#3465a4', m: '#75507b', c: '#06989a', w: '#d3d7cf', d: '#555753',
        R: '#ed2330', G: '#8ee34f', Y: '#fdea56', B: '#55a3f2', M: '#d384cb', C: '#2cf4eb', W: '#ffffff', D: '#555753'
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

    // Read-only facts as Nirvana data-chips: --chip-accent carries the meaning,
    // the label always says it in words (colour is never the only signal).
    function chips(c) {
        var row = el('ul', 'pchips');
        function add(mod, content, accent) {
            var chip = el('span', 'ds-datachip' + (mod ? ' ds-datachip--' + mod : ''));
            if (accent) chip.style.setProperty('--chip-accent', accent);
            // A clan colour can be near-black (Invaders are dark grey), so it tints
            // only the border; the label keeps the readable text colour.
            if (accent) chip.appendChild(content);
            else { var b = el('b'); b.appendChild(content); chip.appendChild(b); }
            row.appendChild(el('li', null, [chip]));
        }
        var fem = c.sex === 'f';
        if (c.rank === 'immortal') add('magic', bi('Immortal', fem ? 'Безсмертна' : 'Безсмертний'));
        else if (c.rank === 'legendary') add('gold', bi('Legend', 'Легенда'));
        if (c.remorts > 0)
            add('magic', plural(c.remorts, 'rebirth', 'rebirths', 'переродження', 'переродження', 'перероджень'));
        if (c.clan)
            add(null, bi(c.clan.en, c.clan.ua), c.clan.color && MUD_COLOURS[c.clan.color.charAt(0)]);
        if (c.online) add('buff', bi('online', 'онлайн'));
        return row;
    }

    // The whois-like sheet that opens under a card: a Nirvana parchment.
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

        var parch = el('div', 'ds-parch ds-frame pchar__sheet');
        parch.appendChild(el('div', 'ds-parch__body', [dl]));
        return DLFrame.dress(parch);
    }

    // A character: a clickable windowlet (native <details>, so a screen reader
    // opens it unaided) that unfolds the parchment sheet below it.
    function card(c) {
        var d = el('details', 'pchar');
        d.id = c.name.en;

        var sum = el('summary', 'windowlet ds-card--hover pchar__card');
        sum.appendChild(emblem(c.class, 'card'));
        var id = el('span', 'pchar__id');
        id.appendChild(bi(c.name.en, ukName(c), 'ds-card__title pchar__name'));
        id.appendChild(bi(c.race.en + ' ' + c.class.en, c.race.ua + ' ' + c.class.ua, 'pchar__cls'));
        id.appendChild(chips(c));
        sum.appendChild(id);
        d.appendChild(sum);
        d.appendChild(sheet(c));

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
