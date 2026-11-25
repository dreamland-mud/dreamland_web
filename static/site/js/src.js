/* Landing source. A link with ?src=<label> (reddit, dou, mudlet...) marks where
   the visitor came from. The first label ever seen is kept in localStorage
   (a ref- referral label replaces a plain one);
   the web client at /play shares this origin, reads it and hands it to the
   server, which saves it on a newly created character for the newcomer
   reports. A label, not a tracker: no cookies, nothing sent anywhere else. */
(function () {
    try {
        var src = new URLSearchParams(location.search).get('src');
        if (!src)
            return;
        src = src.slice(0, 32);
        var kept = localStorage.getItem('dl.src');
        // A friend's referral link (ref-<account>) beats an older plain label,
        // or the friend would never be bound to whoever invited them. The first
        // referral label still wins over a later one, same rule as /play.
        var isRef = function (s) { return !!s && s.toLowerCase().indexOf('ref-') === 0; };
        if (!kept || (isRef(src) && !isRef(kept)))
            localStorage.setItem('dl.src', src);
    } catch (e) {}
})();
