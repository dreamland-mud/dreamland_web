/* The game's help markup, rendered to HTML. Shared by the help browser and by
 * the zone article on the maps page — the same articles, two places.
 *
 * The raw text is mudjs markup: <c c='fgbw'> colour spans, <hh id='N'>
 * cross-references, <hc> command echoes. 21% of the colour spans straddle a
 * newline, so the text cannot be split into lines as a string without tearing
 * tags in half. Instead it is parsed into a DOM, flattened into segments that
 * remember their wrapper chain, and re-assembled into blocks.
 *
 *   DLMarkup.render(raw, { hrefBase: 'help.html' })
 *
 * hrefBase prefixes the #h<id> cross-links: empty on the help page itself
 * (where the link is a same-page hash), 'help.html' anywhere else.
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
    function flatten(root) {
        var segs = [];
        (function walk(node, chain) {
            for (var n = node.firstChild; n; n = n.nextSibling) {
                if (n.nodeType === 3) {
                    segs.push({ text: n.nodeValue, chain: chain });
                } else if (n.nodeType === 1) {
                    var tag = n.tagName.toLowerCase(), link = null, cls = null;
                    if (tag === 'c') cls = n.getAttribute('c');
                    else if (tag === 'hh') link = n.getAttribute('id');
                    walk(n, chain.concat([{ tag: tag, cls: cls, link: link }]));
                }
            }
        })(root, []);
        return segs;
    }

    function wrapChain(html, chain, base) {
        for (var i = chain.length - 1; i >= 0; i--) {
            var w = chain[i];
            if (w.tag === 'c' && w.cls) html = '<span class="c-' + esc(w.cls) + '">' + html + '</span>';
            else if (w.tag === 'hh') html = '<a class="hlink" href="' + base + '#h' + esc(w.link || '') +
                '" data-hid="' + esc(w.link || '') + '">' + html + '</a>';
            else if (w.tag === 'hc') html = '<code class="hcmd">' + html + '</code>';
        }
        return html;
    }

    // segments -> array of lines, each an array of {html, plain}
    function toLines(segs, base) {
        var lines = [[]];
        segs.forEach(function (s) {
            var parts = s.text.split('\n');
            parts.forEach(function (p, i) {
                if (i > 0) lines.push([]);
                if (p !== '') lines[lines.length - 1].push({ html: wrapChain(esc(p), s.chain, base), plain: p });
            });
        });
        return lines;
    }

    function lineHtml(line) { return line.map(function (s) { return s.html; }).join(''); }
    function linePlain(line) { return line.map(function (s) { return s.plain; }).join(''); }

    function render(raw, opts) {
        var base = (opts && opts.hrefBase) || '';
        var holder = document.createElement('div');
        holder.innerHTML = raw || '';
        var lines = toLines(flatten(holder), base);

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

        var out = [], para = [], pre = [];
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

        for (var n = 0; n < lines.length; n++) {
            var html = lineHtml(lines[n]), plain = linePlain(lines[n]);
            if (kind[n] === 'art') { flushPara(); pre.push(html); continue; }
            flushPre();
            if (kind[n] === 'blank') { flushPara(); continue; }
            if (/^\s*[*•-]\s+/.test(plain)) {         // bullet: its own line
                flushPara();
                out.push('<p class="hbullet">' + html.replace(/^(\s*)([*•-])\s+/, '$1<b>&bull;</b> ') + '</p>');
                continue;
            }
            para.push(html);
        }
        flushPara(); flushPre();
        return out.join('\n');
    }

    return { render: render, esc: esc };
})();
