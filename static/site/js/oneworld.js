/* "One world" block: a real room from the game, drawn the way the /play
   terminal draws `look` -- name, description, exits, floor items, mobs, in the
   game's own colours (plug-ins/comm/look.cpp, exits.cpp) -- and typed out like
   live output. The reader flips it between English, Ukrainian and Russian.
   Rooms come from data/rooms/<n>.json, built by site.js/build-rooms.js.
   Starts in the site's language and follows the site toggle until the reader
   picks a room language by hand.

   Screen readers get the plain text in #owSr; the animated screen is
   aria-hidden. prefers-reduced-motion skips the typing and the scramble. */
(function () {
    var room = document.getElementById('owRoom');
    var bar = document.getElementById('owBar');
    if (!room || !bar) return;

    var screen = document.getElementById('owScreen');
    var sr = document.getElementById('owSr');
    var seg = bar.querySelector('.ds-seg');
    var btns = seg.querySelectorAll('[data-owlang]');
    var reroll = document.getElementById('owReroll');
    var TAGS = { en: 'en-GB', ua: 'uk-UA', ru: 'ru-RU' };
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // the command a player of that language would type, and the autoexit words
    var LOOK = { en: 'look', ua: 'дивитися', ru: 'смотреть' };
    var EXITS = { en: 'Exits', ua: 'Виходи', ru: 'Выходы' };
    var NONE = { en: 'none', ua: 'немає', ru: 'нет' };
    var DIRS = {
        north: { en: 'north', ua: 'північ', ru: 'север' },
        east: { en: 'east', ua: 'схід', ru: 'восток' },
        south: { en: 'south', ua: 'південь', ru: 'юг' },
        west: { en: 'west', ua: 'захід', ru: 'запад' },
        up: { en: 'up', ua: 'вгору', ru: 'вверх' },
        down: { en: 'down', ua: 'вниз', ru: 'вниз' }
    };

    // wyvern 1607: offline fallback, same room the static HTML shows
    var PANCAKE = {
        name: { en: 'Pancake House', ua: 'Млинцевий дім', ru: 'Блинный дом' },
        desc: {
            en: "The instant you step inside, the ceiling caves in and flattens you into a pancake! What can you say to that? 'Flapjack... flapjack... flapjack...' the echo grumbles, as it always does.",
            ua: "Щойно ти переступаєш поріг, як стеля з гуркотом осідає і розплющує тебе в корж! А що тут скажеш? 'Млинець... млинець... млинець...' -- звично відлунює луна.",
            ru: 'В тот миг, когда ты входишь, потолок обрушивается и сплющивает тебя в лепешку! Что тут можно сказать? "Блин, блин, блин...", привычно отзывается эхо.'
        },
        exits: [], objs: [], mobs: []
    };

    var count = 0, last = -1, current = PANCAKE, picked = false, placed = false;
    var lang = siteLang();
    var run = 0; // bumps on every new animation; older loops see it and stop

    function siteLang() {
        return document.documentElement.getAttribute('data-lang') === 'uk' ? 'ua' : 'en';
    }

    // A room as terminal lines; each line is a list of [colour class, text].
    function lines(r) {
        var ex = r.exits || [];
        var words = ex.length ? ex.map(function (e) {
            var w = DIRS[e.dir][lang];
            return e.closed ? '*' + w + '*' : w;
        }).join(' ') : NONE[lang];
        var out = [
            [['t-W', r.name[lang]]],
            [['t-x', ' ' + r.desc[lang]]],
            [['t-c', '['], ['t-C', EXITS[lang]], ['t-c', ':'], ['t-C', ' ' + words], ['t-c', ']']]
        ];
        r.objs.forEach(function (o) { out.push([['t-G', o[lang]]]); });
        r.mobs.forEach(function (m) { out.push([['t-Y', m[lang]]]); });
        return out;
    }

    function plain(ls) {
        return ls.map(function (l) {
            return l.map(function (s) { return s[1]; }).join('');
        }).join('\n');
    }

    // the client echoes a typed command in arcane with a ▸ anchor (mudjs input.js)
    function promptLine() {
        var div = document.createElement('div');
        div.className = 'term__line t-p';
        return div;
    }

    // Build the screen with empty spans; returns the spans and their full texts.
    function layout(ls) {
        screen.textContent = '';
        var prompt = promptLine();
        var cmd = document.createElement('span');
        prompt.appendChild(cmd);
        screen.appendChild(prompt);
        var spans = [];
        ls.forEach(function (l) {
            var div = document.createElement('div');
            div.className = 'term__line';
            l.forEach(function (s) {
                // typed part + a hidden "ghost" of the rest: the card has its final
                // height and line breaks from the first frame, nothing jumps
                var sp = document.createElement('span');
                sp.className = s[0];
                var shown = document.createTextNode('');
                var ghost = document.createElement('span');
                ghost.className = 'term__ghost';
                ghost.textContent = s[1];
                sp.appendChild(shown);
                sp.appendChild(ghost);
                div.appendChild(sp);
                spans.push([sp, s[1], shown, ghost]);
            });
            screen.appendChild(div);
        });
        var tail = promptLine();
        var caret = document.createElement('span');
        caret.className = 'term__caret';
        tail.appendChild(caret);
        screen.appendChild(tail);
        tail.style.visibility = 'hidden';
        return { cmd: cmd, spans: spans, tail: tail };
    }

    function render() {
        var my = ++run;
        var ls = lines(current);
        room.setAttribute('lang', TAGS[lang]);
        // from here the animated screen is decoration, #owSr carries the text
        sr.textContent = plain(ls);
        screen.setAttribute('aria-hidden', 'true');
        btns.forEach(function (b) {
            b.setAttribute('aria-pressed', b.getAttribute('data-owlang') === lang ? 'true' : 'false');
        });
        seg.setAttribute('aria-label', siteLang() === 'ua' ? 'Мова кімнати' : 'Room language');
        moveInd();

        var v = layout(ls);
        if (reduce) {
            v.cmd.textContent = LOOK[lang];
            v.spans.forEach(function (s) { s[0].textContent = s[1]; });
            v.tail.style.visibility = '';
            return;
        }

        // the command at a typist's pace, then the output in about a second
        // whatever its length
        var cmd = LOOK[lang], ci = 0;
        var total = v.spans.reduce(function (n, s) { return n + s[1].length; }, 0);
        var perFrame = Math.max(4, Math.ceil(total / 55));
        var si = 0, pos = 0;
        v.cmd.className = 'term__typing';

        function typeCmd() {
            if (my !== run) return;
            v.cmd.textContent = cmd.slice(0, ++ci);
            if (ci < cmd.length) { setTimeout(typeCmd, 38); return; }
            v.cmd.className = '';
            setTimeout(function () { requestAnimationFrame(print); }, 110);
        }
        function print() {
            if (my !== run) return;
            var left = perFrame;
            while (left > 0 && si < v.spans.length) {
                var s = v.spans[si], take = Math.min(left, s[1].length - pos);
                pos += take;
                left -= take;
                s[2].nodeValue = s[1].slice(0, pos);
                s[3].textContent = s[1].slice(pos);
                if (pos >= s[1].length) { si++; pos = 0; }
            }
            if (si < v.spans.length) requestAnimationFrame(print);
            else v.tail.style.visibility = '';
        }
        typeCmd();
    }

    // Reroll: the old text dissolves into random glyphs while the next room loads.
    var GLYPHS = 'abcdefghijklmnopqrstuvwxyzабвгдежзиклмнопрстуфхцчшщюяієї#%&*+=?/<>~';
    function scramble(done) {
        if (reduce) { done(); return; }
        var my = ++run;
        var spans = screen.querySelectorAll('span:not(.term__ghost):not(.term__caret)');
        var start = null;
        function frame(ts) {
            if (my !== run) return;
            if (start === null) start = ts;
            var p = Math.min(1, (ts - start) / 260);
            spans.forEach(function (sp) {
                sp.textContent = sp.textContent.replace(/\S/g, function (c) {
                    return Math.random() < 0.35 + p * 0.65 ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : c;
                });
            });
            if (p < 1) requestAnimationFrame(frame);
            else done();
        }
        requestAnimationFrame(frame);
    }

    // design-system segmented control: slide the gem under the active button
    function moveInd() {
        var ind = seg.querySelector('.ds-seg__ind');
        var act = seg.querySelector('[aria-pressed="true"]');
        if (!ind || !act) return;
        // the first placement jumps; only real switches slide
        if (!placed) ind.style.transition = 'none';
        ind.style.width = act.offsetWidth + 'px';
        ind.style.transform = 'translateX(' + act.offsetLeft + 'px)';
        if (!placed) { void ind.offsetWidth; ind.style.transition = ''; placed = true; }
    }

    function load(animate) {
        if (!count) return;
        var n;
        do { n = Math.floor(Math.random() * count); } while (count > 1 && n === last);
        last = n;
        var got = null, ready = !animate;
        function show() {
            if (!got || !ready) return;
            current = got;
            reroll.classList.remove('is-rolling');
            render();
        }
        if (animate) {
            reroll.classList.add('is-rolling');
            scramble(function () { ready = true; show(); });
        }
        fetch('data/rooms/' + n + '.json')
            .then(function (r) { if (!r.ok) throw r; return r.json(); })
            .then(function (r) {
                got = r;
                show();
                // announce room changes, but not the swap from the fallback on load
                requestAnimationFrame(function () {
                    setTimeout(function () { sr.setAttribute('aria-live', 'polite'); }, 0);
                });
            })
            .catch(function () { reroll.classList.remove('is-rolling'); render(); });
    }

    btns.forEach(function (b) {
        b.addEventListener('click', function () {
            lang = b.getAttribute('data-owlang');
            picked = true;
            render();
        });
    });
    reroll.addEventListener('click', function () { load(true); });

    new MutationObserver(function () {
        if (!picked && lang !== siteLang()) { lang = siteLang(); render(); }
        else seg.setAttribute('aria-label', siteLang() === 'ua' ? 'Мова кімнати' : 'Room language');
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

    window.addEventListener('resize', moveInd);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInd);

    bar.hidden = false;
    fetch('data/rooms/index.json')
        .then(function (r) { if (!r.ok) throw r; return r.json(); })
        .then(function (d) {
            count = d.count || 0;
            reroll.hidden = count < 2;
            if (count) load(false);
            else render();
        })
        .catch(function () { render(); });
})();
