/* "One world" block: show a real room from the game, with its mobs and floor
   items, and let the reader flip it between English, Ukrainian and Russian.
   Rooms come from data/rooms/<n>.json, built by site.js/build-rooms.js.
   Starts in the site's language and follows the site toggle until the reader
   picks a room language by hand. */
(function () {
    var room = document.getElementById('owRoom');
    var bar = document.getElementById('owBar');
    if (!room || !bar) return;

    var nameEl = document.getElementById('owName');
    var descEl = document.getElementById('owDesc');
    var listEl = document.getElementById('owList');
    var seg = bar.querySelector('.ds-seg');
    var btns = seg.querySelectorAll('[data-owlang]');
    var reroll = document.getElementById('owReroll');
    var TAGS = { en: 'en-GB', ua: 'uk-UA', ru: 'ru-RU' };

    // wyvern 1607: offline fallback, same room the static HTML shows
    var PANCAKE = {
        name: { en: 'Pancake House', ua: 'Млинцевий дім', ru: 'Блинный дом' },
        desc: {
            en: "The instant you step inside, the ceiling caves in and flattens you into a pancake! What can you say to that? 'Flapjack... flapjack... flapjack...' the echo grumbles, as it always does.",
            ua: "Щойно ти переступаєш поріг, як стеля з гуркотом осідає і розплющує тебе в корж! А що тут скажеш? 'Млинець... млинець... млинець...' -- звично відлунює луна.",
            ru: 'В тот миг, когда ты входишь, потолок обрушивается и сплющивает тебя в лепешку! Что тут можно сказать? "Блин, блин, блин...", привычно отзывается эхо.'
        },
        objs: [], mobs: []
    };

    var count = 0, last = -1, current = PANCAKE, picked = false, placed = false;
    var lang = siteLang();

    function siteLang() {
        return document.documentElement.getAttribute('data-lang') === 'uk' ? 'ua' : 'en';
    }

    function line(text, cls) {
        var li = document.createElement('li');
        li.className = cls;
        li.textContent = text;
        return li;
    }

    function render() {
        var r = current;
        room.setAttribute('lang', TAGS[lang]);
        nameEl.textContent = r.name[lang];
        descEl.textContent = r.desc[lang];
        listEl.textContent = '';
        r.objs.forEach(function (o) { listEl.appendChild(line(o[lang], 'oneworld__obj')); });
        r.mobs.forEach(function (m) { listEl.appendChild(line(m[lang], 'oneworld__mob')); });
        btns.forEach(function (b) {
            b.setAttribute('aria-pressed', b.getAttribute('data-owlang') === lang ? 'true' : 'false');
        });
        moveInd();
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

    function load() {
        if (!count) return;
        var n;
        do { n = Math.floor(Math.random() * count); } while (count > 1 && n === last);
        last = n;
        fetch('data/rooms/' + n + '.json')
            .then(function (r) { if (!r.ok) throw r; return r.json(); })
            .then(function (r) { current = r; render(); })
            .catch(function () {});
    }

    btns.forEach(function (b) {
        b.addEventListener('click', function () {
            lang = b.getAttribute('data-owlang');
            picked = true;
            render();
        });
    });
    reroll.addEventListener('click', load);

    new MutationObserver(function () {
        if (!picked && lang !== siteLang()) { lang = siteLang(); render(); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

    window.addEventListener('resize', moveInd);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInd);

    bar.hidden = false;
    render();
    fetch('data/rooms/index.json')
        .then(function (r) { if (!r.ok) throw r; return r.json(); })
        .then(function (d) { count = d.count || 0; load(); })
        .catch(function () {});
})();
