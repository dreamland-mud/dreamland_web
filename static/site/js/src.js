/* Landing source. A link with ?src=<label> (reddit, dou, mudlet...) marks where
   the visitor came from. The first label ever seen is kept in localStorage;
   the web client at /play shares this origin, reads it and hands it to the
   server, which saves it on a newly created character for the newcomer
   reports. A label, not a tracker: no cookies, nothing sent anywhere else. */
(function () {
    try {
        var src = new URLSearchParams(location.search).get('src');
        if (src && !localStorage.getItem('dl.src'))
            localStorage.setItem('dl.src', src.slice(0, 32));
    } catch (e) {}
})();
