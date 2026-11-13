/* Language toggle. EN, UA and RU all live in the DOM (lang="en"/"uk"/"ru");
   CSS hides the inactive ones. Choice persists in localStorage. */
(function () {
    var KEY = 'dl_lang';
    var html = document.documentElement;

    function apply(lang) {
        if (lang !== 'en' && lang !== 'uk' && lang !== 'ru') lang = 'en';
        html.setAttribute('data-lang', lang);
        html.setAttribute('lang', lang);
        document.querySelectorAll('[data-setlang]').forEach(function (b) {
            b.setAttribute('aria-current', b.getAttribute('data-setlang') === lang ? 'true' : 'false');
        });
        try { localStorage.setItem(KEY, lang); } catch (e) {}
    }

    document.querySelectorAll('[data-setlang]').forEach(function (b) {
        b.addEventListener('click', function () { apply(b.getAttribute('data-setlang')); });
    });

    var saved;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (!saved) {
        // first visit: follow the browser for UA and RU, everyone else EN default
        var nav = (navigator.language || '').toLowerCase();
        saved = nav.indexOf('uk') === 0 ? 'uk' : nav.indexOf('ru') === 0 ? 'ru' : 'en';
    }
    apply(saved);
})();
