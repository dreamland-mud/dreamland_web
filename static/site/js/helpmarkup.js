/* The game's help markup, rendered to HTML. Shared by the help browser and by
 * the zone article on the maps page — the same articles, two places.
 *
 * The raw text is mudjs markup: <c c='fgbw'> colour spans, <hh id='N'>
 * cross-references, <hc> command echoes. 21% of the colour spans straddle a
 * newline, so the text cannot be split into lines as a string without tearing
 * tags in half. Instead it is parsed into a DOM, flattened into segments that
 * remember their wrapper chain, and re-assembled into blocks.
 *
 *   DLMarkup.render(raw, { hrefBase: 'help.html', resolveLink: fn })
 *
 * hrefBase prefixes the #h<id> cross-links: empty on the help page itself
 * (where the link is a same-page hash), 'help.html' anywhere else.
 *
 * resolveLink(text) -> id | null turns an <hh> that carries NO id into one.
 * The game's [square bracket] markup compiles to a bare {hh with no number
 * (helpformatter.cpp), so 301 references in the corpus arrive here unnumbered.
 * The game client resolves those by sending `help <anchor text>`; without the
 * same lookup here they became links to "#h". Callers that have the help index
 * pass a keyword lookup; where none is given, or the anchor matches nothing,
 * the text renders as plain emphasis rather than as a link that goes nowhere.
 */
window.DLMarkup = (function () {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    var ARTCH = '|/\\+_-=~^<>*#$─│┌┐└┘├┤┬┴┼═║';
    /* An "art" line is indented and mostly strokes rather than letters. Real
       ASCII diagrams in the corpus (the compass, the login banners, the damage
       scale) always come in runs, so a run of two is the trigger — that keeps
       one-off sentences containing a stray '|' out of <pre>. */
    function isArt(line) {
        if (line.length - line.replace(/^ +/, '').length < 4) return false;
        var body = line.trim();
        if (!body) return false;
        var letters = 0, art = 0;
        for (var i = 0; i < body.length; i++) {
            var ch = body[i];
            if (/[a-zA-Zа-яА-ЯёЁіїєґІЇЄҐ]/.test(ch)) letters++;
            if (ARTCH.indexOf(ch) >= 0) art++;
        }
        return art >= 2 && letters / body.length < 0.45;
    }

    /* Flatten the parsed markup into segments that remember which inline
       elements wrap them, so a line can be rebuilt with its formatting even
       when the original span crossed the newline. */
    function flatten(root, resolve) {
        var segs = [];
        (function walk(node, chain) {
            for (var n = node.firstChild; n; n = n.nextSibling) {
                if (n.nodeType === 3) {
                    segs.push({ text: n.nodeValue, chain: chain });
                } else if (n.nodeType === 1) {
                    var tag = n.tagName.toLowerCase(), link = null, cls = null, href = null;
                    if (tag === 'c') cls = n.getAttribute('c');
                    else if (tag === 'hh' || tag === 'hg') {
                        // Resolved from the whole element, not per segment: a
                        // colour span inside the anchor would otherwise split
                        // the phrase that has to be looked up.
                        link = n.getAttribute('id');
                        if (!link && resolve) link = resolve(n.textContent || '');
                    } else if (tag === 'hl') {
                        href = (n.textContent || '').trim();
                    }
                    walk(n, chain.concat([{ tag: tag, cls: cls, link: link, href: href }]));
                }
            }
        })(root, []);
        return segs;
    }

    /* Only these schemes become a real href. The tag's content is authored game
       text, so a javascript: or data: URL in it must never survive. */
    function safeHref(u) {
        return /^(https?:\/\/|\/|#)/i.test(u) ? u : null;
    }

    /* [map=<file>.are] is the game's own marker for "the zone this article is
       about has a map"; the in-game web client turns it into a button. Nothing
       here knew about it, so on the site it reached the reader as the literal
       four-word placeholder. Run last, over assembled HTML: esc() leaves every
       character of the marker alone, and the only markup around it by then is
       the <li> the metadata bullet became. */
    var MAP_LABEL = { en: 'open the map', ua: 'відкрити мапу' };
    function mapLinks(html) {
        var l = document.documentElement.getAttribute('data-lang') === 'uk' ? 'ua' : 'en';
        return html.replace(/\[map=([-0-9a-z_]{1,15})\.are\]/g, function (m, file) {
            return '<a class="hlink hlink--map" href="maps.html#' + file + '">' +
                esc(MAP_LABEL[l]) + '</a>';
        });
    }

    function wrapChain(html, chain, base) {
        for (var i = chain.length - 1; i >= 0; i--) {
            var w = chain[i];
            if (w.tag === 'c' && w.cls) html = '<span class="c-' + esc(w.cls) + '">' + html + '</span>';
            /* hh is a help cross-reference; hg is a skill-group name, which is
               also an article. Both were rendered by the game client and by
               nothing here, so hg used to reach the page as literal "<hg>". */
            else if (w.tag === 'hh' || w.tag === 'hg') html = w.link
                ? '<a class="hlink" href="' + base + '#h' + esc(w.link) +
                    '" data-hid="' + esc(w.link) + '">' + html + '</a>'
                : '<b class="hlink-plain">' + html + '</b>';
            else if (w.tag === 'hc') html = '<code class="hcmd">' + html + '</code>';
            /* hl carries the URL as its own text */
            else if (w.tag === 'hl') {
                var href = safeHref(w.href || '');
                html = href
                    ? '<a class="hlink hlink--ext" href="' + esc(href) +
                        '" target="_blank" rel="noopener noreferrer">' + html + '</a>'
                    : html;
            }
            /* hs is a speedwalk: a run of direction letters the game client can
               walk for you. Nothing to click on a web page, but it is still not
               prose -- show it as the opaque token it is. */
            else if (w.tag === 'hs') html = '<code class="hwalk">' + html + '</code>';
        }
        return html;
    }

    // segments -> array of lines, each an array of {text, chain}
    function toLines(segs) {
        var lines = [[]];
        segs.forEach(function (s) {
            var parts = s.text.split('\n');
            parts.forEach(function (p, i) {
                if (i > 0) lines.push([]);
                if (p !== '') lines[lines.length - 1].push({ text: p, chain: s.chain });
            });
        });
        return lines;
    }

    function linePlain(line) {
        return line.map(function (s) { return s.text; }).join('');
    }
    function lineHtml(line, base) {
        return line.map(function (s) { return wrapChain(esc(s.text), s.chain, base); }).join('');
    }
    /* Drop `n` plain characters off the front and render the rest. The marker
       words handled below always sit at the head of the line's first segment,
       so this only ever trims within one segment. */
    function lineHtmlFrom(line, n, base) {
        var rest = [];
        line.forEach(function (s) {
            if (n <= 0) { rest.push(s); return; }
            if (s.text.length <= n) { n -= s.text.length; return; }
            rest.push({ text: s.text.slice(n), chain: s.chain });
            n = 0;
        });
        return lineHtml(rest, base);
    }

    /* The word %FMT% compiles to, in each of the three languages, and the seven
       spaces %FFF% compiles to. A help that lists several call shapes puts one
       marker per source line; the paragraph builder used to join them, so
       `sacrifice` read "Format: sacrifice all Format: sacrifice item" as a
       single run-on line. Each call shape is now its own block. */
    var FMT_WORD = /^(\s*)(Формат:|Format:)[ \t]*/;
    var FMT_CONT = /^ {7}(?! )\S/;

    function render(raw, opts) {
        var base = (opts && opts.hrefBase) || '';
        var resolve = (opts && opts.resolveLink) || null;
        var holder = document.createElement('div');
        holder.innerHTML = raw || '';
        var lines = toLines(flatten(holder, resolve));

        // classify first, so an art run can be recognised before emitting
        var kind = lines.map(function (l) {
            var p = linePlain(l);
            if (!p.trim()) return 'blank';
            return isArt(p) ? 'art' : 'text';
        });
        var i;
        for (i = 0; i < kind.length; i++) {           // lone "art" line is prose
            if (kind[i] === 'art' && kind[i - 1] !== 'art' && kind[i + 1] !== 'art') kind[i] = 'text';
        }
        /* A diagram's labelled rows ("запад------+------восток") are mostly
           letters, so they read as prose on their own and would be lifted out
           of the picture. Grow each run outwards over neighbouring indented
           lines so the whole diagram stays in one block. */
        function indented(n) {
            var p = linePlain(lines[n] || []);
            return !!p.trim() && p.length - p.replace(/^ +/, '').length >= 4;
        }
        for (i = 0; i < kind.length; i++) {
            if (kind[i] !== 'art') continue;
            for (var b = i - 1; b >= 0 && kind[b] !== 'art' && indented(b); b--) kind[b] = 'art';
            var e = i;
            while (e + 1 < kind.length && kind[e + 1] === 'art') e++;
            for (var f = e + 1; f < kind.length && indented(f); f++) kind[f] = 'art';
            i = e;
        }

        var out = [], para = [], pre = [], list = [];
        function flushPara() {
            if (!para.length) return;
            out.push('<p>' + para.join(' ') + '</p>');
            para = [];
        }
        function flushPre() {
            if (!pre.length) return;
            out.push('<pre>' + pre.join('\n') + '</pre>');
            pre = [];
        }
        /* Bullets were a paragraph each with a bold • glued on the front, which
           is a list drawn by hand: no indent hanging off the marker, and a
           screen reader announced no list at all. */
        function flushList() {
            if (!list.length) return;
            out.push('<ul class="hlist">' + list.map(function (li) {
                return '<li>' + li + '</li>';
            }).join('') + '</ul>');
            list = [];
        }
        function flushAll() { flushPara(); flushList(); flushPre(); }

        var lastWasFmt = false;
        for (var n = 0; n < lines.length; n++) {
            var line = lines[n], plain = linePlain(line);

            if (kind[n] === 'art') { flushPara(); flushList(); pre.push(lineHtml(line, base)); lastWasFmt = false; continue; }
            flushPre();
            if (kind[n] === 'blank') { flushPara(); flushList(); lastWasFmt = false; continue; }

            var fmt = FMT_WORD.exec(plain);
            if (fmt) {
                flushPara(); flushList();
                out.push('<p class="hfmt"><b class="hfmt__label">' + esc(fmt[2]) + '</b> ' +
                         '<code class="hfmt__call">' + lineHtmlFrom(line, fmt[0].length, base) + '</code></p>');
                lastWasFmt = true;
                continue;
            }
            /* A %FFF% line is a second call shape under the previous "Format:",
               so it keeps the same shape minus the repeated label. */
            if (lastWasFmt && FMT_CONT.test(plain)) {
                flushPara(); flushList();
                out.push('<p class="hfmt hfmt--cont">' +
                         '<code class="hfmt__call">' + lineHtmlFrom(line, 7, base) + '</code></p>');
                continue;
            }
            lastWasFmt = false;

            if (/^\s*[*•-]\s+/.test(plain)) {         // bullet: joins the list
                flushPara();
                var head = /^(\s*)([*•-])\s+/.exec(plain);
                list.push(lineHtmlFrom(line, head[0].length, base));
                continue;
            }
            flushList();
            para.push(lineHtml(line, base));
        }
        flushAll();
        return mapLinks(out.join('\n'));
    }

    return { render: render, esc: esc };
})();
