/* Player search: any <form data-playersearch> with a text input and an
   aria-live [data-playersearch-msg]. The game's /api/profile takes a login or
   any shown name (English, Russian, Ukrainian) and answers 404 when there is
   no public page, so a hidden character looks the same as a missing one. */
(function () {
    function say(msg, en, uk) {
        msg.innerHTML = '';
        [['en', en], ['uk', uk]].forEach(function (p) {
            var s = document.createElement('span');
            s.setAttribute('lang', p[0]);
            s.textContent = p[1];
            msg.appendChild(s);
        });
    }

    document.querySelectorAll('form[data-playersearch]').forEach(function (form) {
        var input = form.querySelector('input');
        var msg = form.querySelector('[data-playersearch-msg]');
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var name = input.value.trim();
            if (!name) { input.focus(); return; }
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
    });
})();
