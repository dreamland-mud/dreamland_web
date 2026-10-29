/* Player search: a <form data-playersearch> with a combobox input, its
   listbox and an aria-live [data-playersearch-msg]. Suggestions come from
   DLPlayerSearch.setNames (the leaderboard feeds /api/leaderboard "names":
   every character some /player page shows). Submitting free text asks
   /api/profile, which takes a login or any shown English/Russian/Ukrainian
   name and answers 404 when there is no public page. */
(function () {
    var MAX = 8;
    var names = [];

    function lang() { return document.documentElement.getAttribute('data-lang') === 'uk' ? 'uk' : 'en'; }

    function say(msg, en, uk) {
        msg.innerHTML = '';
        [['en', en], ['uk', uk]].forEach(function (p) {
            var s = document.createElement('span');
            s.setAttribute('lang', p[0]);
            s.textContent = p[1];
            msg.appendChild(s);
        });
    }

    // The name in the page language, and the other spellings beside it.
    function label(n) {
        var main = lang() === 'uk' ? (n.ua || n.ru || n.en || n.login) : (n.en || n.login);
        var other = [n.login, n.en, n.ua, n.ru].filter(function (v, i, a) {
            return v && v !== main && a.indexOf(v) === i;
        });
        return { main: main, other: other.join(', ') };
    }

    // Prefix matches first, then matches inside a name.
    function match(q) {
        q = q.toLowerCase();
        var head = [], rest = [];
        names.forEach(function (n) {
            var vs = [n.login, n.en, n.ru, n.ua].filter(Boolean).map(function (v) { return v.toLowerCase(); });
            if (vs.some(function (v) { return v.indexOf(q) === 0; })) head.push(n);
            else if (vs.some(function (v) { return v.indexOf(q) > 0; })) rest.push(n);
        });
        return head.concat(rest).slice(0, MAX);
    }

    function go(login) { location.href = '/player/' + encodeURIComponent(login); }

    function wire(form) {
        var input = form.querySelector('input');
        var list = form.querySelector('[role="listbox"]');
        var msg = form.querySelector('[data-playersearch-msg]');
        var hits = [], active = -1;

        function placeholder() { input.placeholder = input.getAttribute('data-ph-' + lang()) || ''; }
        placeholder();
        new MutationObserver(function () { placeholder(); if (!list.hidden) show(); })
            .observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

        function close() {
            list.hidden = true;
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            active = -1;
        }

        function show() {
            list.innerHTML = '';
            if (!hits.length) { close(); return; }
            hits.forEach(function (n, i) {
                var li = document.createElement('li');
                li.className = 'ds-search__opt';
                li.id = list.id + '-' + i;
                li.setAttribute('role', 'option');
                li.setAttribute('aria-selected', i === active ? 'true' : 'false');
                var l = label(n);
                var b = document.createElement('b');
                b.textContent = l.main;
                li.appendChild(b);
                if (l.other) {
                    var sm = document.createElement('small');
                    sm.textContent = l.other;
                    li.appendChild(sm);
                }
                // mousedown, not click: it lands before the input's blur closes the list
                li.addEventListener('mousedown', function (e) { e.preventDefault(); go(n.login); });
                list.appendChild(li);
            });
            list.hidden = false;
            input.setAttribute('aria-expanded', 'true');
            if (active >= 0) input.setAttribute('aria-activedescendant', list.id + '-' + active);
            else input.removeAttribute('aria-activedescendant');
        }

        input.addEventListener('input', function () {
            msg.innerHTML = '';
            var q = input.value.trim();
            hits = q ? match(q) : [];
            active = -1;
            show();
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' && hits.length) {
                e.preventDefault(); active = (active + 1) % hits.length; show();
            } else if (e.key === 'ArrowUp' && hits.length) {
                e.preventDefault(); active = active <= 0 ? hits.length - 1 : active - 1; show();
            } else if (e.key === 'Escape') {
                close();
            } else if (e.key === 'Enter' && active >= 0 && !list.hidden) {
                e.preventDefault(); go(hits[active].login);
            }
        });
        input.addEventListener('blur', close);

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            close();
            var name = input.value.trim();
            if (!name) { input.focus(); return; }
            if (hits.length === 1) { go(hits[0].login); return; }
            say(msg, 'Looking...', 'Шукаємо...');
            fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ args: { char: name } })
            }).then(function (r) {
                if (r.status === 404) return null;
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            }).then(function (p) {
                if (p && p.id) { location.href = '/player/' + encodeURIComponent(p.id); return; }
                say(msg, 'No public page under that name.', 'Під таким імʼям публічної сторінки немає.');
                input.focus();
            }).catch(function () {
                say(msg, 'The game did not answer. Try again in a minute.', 'Гра не відповіла. Спробуй за хвилину.');
            });
        });
    }

    window.DLPlayerSearch = { setNames: function (list) { names = list || []; } };
    document.querySelectorAll('form[data-playersearch]').forEach(wire);
})();
