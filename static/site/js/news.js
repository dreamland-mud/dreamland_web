/* News widget: one big featured entry that unfolds on "read more", plus a
   horizontal gallery of the older entries (date + title only). Clicking a
   gallery card promotes it into the featured slot — the entries have no
   permalinks of their own, so swapping in place beats a dead link. */
(function () {
    var featWrap = document.getElementById('newsfeatured');
    var gallery  = document.getElementById('newsgallery');
    var loading  = document.getElementById('newsloading');
    if (!featWrap || !gallery) return;

    var COLLAPSED = '8.6em';          /* must match the mask ramp in theme.css */
    var LABELS = {
        more: { en: 'Read more', uk: 'Читати далі' },
        less: { en: 'Show less', uk: 'Згорнути' }
    };

    function esc(s) {
        return String(s).replace(/[&<>]/g, function (c) {
            return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;';
        });
    }
    function curLang() {
        return document.documentElement.getAttribute('data-lang') === 'uk' ? 'uk' : 'en';
    }

    var items = [], current = 0;

    /* ---- featured card ---- */
    function renderFeatured(n) {
        var el = document.createElement('article');
        el.className = 'news-item';
        el.innerHTML =
            '<div class="news-item__meta">' +
                '<span class="news-item__date">' + esc(n.date) + '</span>' +
                '<span class="news-item__from">' + esc(n.from) + '</span>' +
            '</div>' +
            '<h3 class="news-item__subject">' + esc(n.subject) + '</h3>' +
            '<div class="news-item__text">' + esc(n.text) + '</div>' +
            '<button class="news-item__more" type="button"></button>';

        var body = el.querySelector('.news-item__text');
        var btn  = el.querySelector('.news-item__more');
        body.style.maxHeight = COLLAPSED;

        function setLabel() {
            btn.textContent = LABELS[el.classList.contains('expanded') ? 'less' : 'more'][curLang()];
        }

        btn.addEventListener('click', function () {
            if (el.classList.contains('expanded')) {
                // fix the current height in px so the transition has somewhere to start
                body.style.maxHeight = body.scrollHeight + 'px';
                void body.offsetHeight;
                el.classList.remove('expanded');
                body.style.maxHeight = COLLAPSED;
            } else {
                el.classList.add('expanded');
                body.style.maxHeight = body.scrollHeight + 'px';
            }
            setLabel();
        });
        // once expanded, drop the cap so later reflow (font swap, resize) can't clip
        body.addEventListener('transitionend', function (e) {
            if (e.propertyName === 'max-height' && el.classList.contains('expanded'))
                body.style.maxHeight = 'none';
        });

        featWrap.innerHTML = '';
        featWrap.appendChild(el);

        // no toggle needed when the text was never long enough to clip
        requestAnimationFrame(function () {
            if (body.scrollHeight <= body.clientHeight + 4) btn.style.display = 'none';
        });
        setLabel();
        el._setLabel = setLabel;
    }

    /* ---- gallery of the rest ---- */
    function renderGallery() {
        gallery.innerHTML = '';
        items.forEach(function (n, i) {
            if (i === current) return;
            var card = document.createElement('button');
            card.type = 'button';
            card.className = 'news-mini';
            card.innerHTML =
                '<span class="news-mini__date">' + esc(n.date) + '</span>' +
                '<span class="news-mini__subject">' + esc(n.subject) + '</span>';
            card.addEventListener('click', function () {
                current = i;
                renderFeatured(items[current]);
                renderGallery();
                featWrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            });
            gallery.appendChild(card);
        });
    }

    fetch('data/news.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            items = data || [];
            if (loading) loading.remove();
            if (!items.length) return;
            renderFeatured(items[0]);
            renderGallery();
        })
        .catch(function () {
            if (loading) {
                loading.textContent = curLang() === 'uk'
                    ? 'Не вдалося завантажити новини.' : 'Could not load news.';
            }
        });

    // refresh the "read more" label when the language flips
    document.querySelectorAll('[data-setlang]').forEach(function (b) {
        b.addEventListener('click', function () {
            var el = featWrap.firstElementChild;
            if (el && el._setLabel) el._setLabel();
        });
    });
})();
