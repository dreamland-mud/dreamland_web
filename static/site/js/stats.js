/* Count-up animation for the "DreamLand in numbers" tiles.
   Animates each number from 0 to its data-count when it scrolls into view.
   Skipped under prefers-reduced-motion (final value shown immediately). */
(function () {
    var nums = document.querySelectorAll('.stat__num[data-count]');
    if (!nums.length) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function fmt(n) { return n.toLocaleString('en-US'); }

    function animate(el) {
        var target = parseInt(el.getAttribute('data-count'), 10) || 0;
        var prefix = /^\s*~/.test(el.textContent) ? '~' : '';
        if (reduce) { el.textContent = prefix + fmt(target); return; }
        var dur = 1100, start = null;
        function step(ts) {
            if (start === null) start = ts;
            var p = Math.min(1, (ts - start) / dur);
            var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
            el.textContent = prefix + fmt(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
        nums.forEach(animate); return;
    }
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) { animate(e.target); io.unobserve(e.target); }
        });
    }, { threshold: 0.4 });
    nums.forEach(function (n) { io.observe(n); });
})();
