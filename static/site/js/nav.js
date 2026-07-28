/* Mobile menu. Under 720px the language switch is swapped for a hamburger and
   the nav pill itself expands into the menu panel — the links and the switch
   are the same DOM nodes as on desktop, just re-laid-out by CSS. */
(function () {
    var burger = document.getElementById('burger');
    var pill   = document.getElementById('navpill');
    if (!burger || !pill) return;

    /* The switch lives beside the pill on desktop (the pill is transformed, so a
       child would be trapped inside it) and inside the pill on mobile, where it
       becomes a row of the menu. One node, moved — never duplicated, so the
       i18n click bindings survive. */
    /* Mark the page you are on. Derived from the URL rather than written into
       each page's copy of the nav, because there are five copies of that markup
       and the sixth would be forgotten. index.html is also what "/" serves. */
    (function () {
        var here = (location.pathname.split('/').pop() || 'index.html');
        pill.querySelectorAll('a.navlink').forEach(function (a) {
            // a bare "#start" is this page — on the home page that IS the home link
            var target = (a.getAttribute('href') || '').split('#')[0].split('/').pop() || 'index.html';
            if (target === here) a.setAttribute('aria-current', 'page');
        });
    })();

    var lang = document.querySelector('.langswitch');
    var bar  = document.getElementById('topbar');
    var mq   = window.matchMedia('(max-width: 720px)');
    function place() {
        if (!lang) return;
        if (mq.matches) pill.appendChild(lang);
        else bar.insertBefore(lang, burger);
    }
    if (mq.addEventListener) mq.addEventListener('change', place);
    else mq.addListener(place);
    place();

    function setOpen(open) {
        document.body.classList.toggle('menu-open', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    burger.addEventListener('click', function (e) {
        e.stopPropagation();
        setOpen(burger.getAttribute('aria-expanded') !== 'true');
    });

    // picking a destination closes the menu; picking a language does not
    pill.querySelectorAll('a.navlink').forEach(function (a) {
        a.addEventListener('click', function () { setOpen(false); });
    });

    document.addEventListener('click', function (e) {
        if (!pill.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
    });
    // leaving mobile width with the menu open would strand the open state
    window.addEventListener('resize', function () {
        if (window.innerWidth > 720) setOpen(false);
    });
})();
