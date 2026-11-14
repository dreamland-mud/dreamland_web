/* Language links on the one-language static pages (/help/<id>.html,
   /en/help/..., /ua/news/... -- site.js/shell.js langPage). The switch there
   is a row of links to the sibling pages, not buttons that swap spans in
   place, so this only remembers the choice: the next page that reads dl_lang
   (the help and news apps, the home page) opens in the language picked here.
   The same goes for a cross-link into an app ([data-golang] on any link). */
(function () {
    document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[data-golang]') : null;
        if (!a) return;
        try { localStorage.setItem('dl_lang', a.getAttribute('data-golang')); } catch (err) {}
    });
})();
