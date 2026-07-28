/* Animated <details> for the FAQ scrolls. Native <details> snaps open with no
   transition, so the summary click is intercepted and the body's height is
   animated instead. The padding is moved onto a wrapper injected here — a
   padded element can't collapse to zero height, and doing it in JS keeps the
   markup plain <details>. */
(function () {
    var items = document.querySelectorAll('details.scroll');
    if (!items.length) return;

    items.forEach(function (d) {
        var body = d.querySelector('.scroll__body');
        var summary = d.querySelector('summary');
        if (!body || !summary) return;

        var inner = document.createElement('div');
        inner.className = 'scroll__inner';
        while (body.firstChild) inner.appendChild(body.firstChild);
        body.appendChild(inner);

        var busy = false;

        summary.addEventListener('click', function (e) {
            e.preventDefault();
            if (busy) return;
            busy = true;

            if (d.open) {
                body.style.height = inner.offsetHeight + 'px';
                void body.offsetHeight;                 // flush, so the next value transitions
                body.style.height = '0px';
                once(function () { d.open = false; body.style.height = ''; });
            } else {
                d.open = true;
                body.style.height = '0px';
                void body.offsetHeight;
                body.style.height = inner.offsetHeight + 'px';
                once(function () { body.style.height = 'auto'; });
            }

            function once(done) {
                var fired = false;
                function end(ev) {
                    if (ev && ev.propertyName !== 'height') return;
                    if (fired) return;
                    fired = true; busy = false;
                    body.removeEventListener('transitionend', end);
                    done();
                }
                body.addEventListener('transitionend', end);
                setTimeout(end, 500);                   // fallback if the transition never fires
            }
        });
    });
})();
