/* Zone banners: the painted header art the old Russian maps pages wear, one
   per area file in /maps/banners/<file>.jpg (not every zone has one). Paints
   it behind a .pagehead under the same darkening gradient, and only once the
   image has loaded, so a zone without art keeps the default map. */
(function () {
    var SHADE = 'linear-gradient(180deg, rgba(13,11,18,.4), rgba(13,11,18,.92))';

    // file: an area file with or without ".are" ("midgaard" or "midgaard.are").
    // fallback: another zone's banner to show when this one has none.
    function apply(el, file, fallback) {
        if (!el) return;
        var want = file ? String(file).replace(/\.are$/, '') : '';
        el.setAttribute('data-banner', want);
        if (!want) { el.style.backgroundImage = ''; return; }
        var url = '/maps/banners/' + want + '.are.jpg';
        var img = new Image();
        img.onload = function () {
            // a later pick may have overtaken this one
            if (el.getAttribute('data-banner') !== want) return;
            el.style.backgroundImage = SHADE + ', url("' + url + '")';
            el.classList.add('has-banner');
        };
        img.onerror = function () {
            if (el.getAttribute('data-banner') !== want) return;
            var alt = fallback ? String(fallback).replace(/\.are$/, '') : '';
            if (alt && alt !== want) { apply(el, alt); return; }
            el.style.backgroundImage = '';
            el.classList.remove('has-banner');
        };
        img.src = url;
    }

    window.DLZoneBanner = { apply: apply };
})();
