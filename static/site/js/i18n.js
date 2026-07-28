/* Language toggle. EN and UA both live in the DOM (lang="en"/"uk");
   CSS hides the inactive one. RU is a link out to the current site.
   Choice persists in localStorage. */
(function () {
    var KEY = 'dl_lang';
    var html = document.documentElement;

    function apply(lang) {
        if (lang !== 'en' && lang !== 'uk') lang = 'en';
        html.setAttribute('data-lang', lang);
        html.setAttribute('lang', lang === 'uk' ? 'uk' : 'en');
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
        // first visit: nudge Ukrainian speakers to UA, everyone else EN default
        var nav = (navigator.language || '').toLowerCase();
        saved = nav.indexOf('uk') === 0 ? 'uk' : 'en';
    }
    apply(saved);
})();
