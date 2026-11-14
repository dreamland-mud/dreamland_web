/* The page shell of the new site (head, top bar, footer) for the pages a
 * builder writes instead of a person: legends.html, gallery.html and
 * feniaapi.html (website.js/main.js).
 *
 * The top bar and the footer site map are lifted from static/about.html, so a
 * nav change made by hand there reaches the generated pages on the next
 * deploy instead of drifting as one more copy.
 */
const fs = require('fs');
const path = require('path');

const STATIC = path.resolve(__dirname, '../static');
const BASE = 'https://dreamland.rocks';

function lift(re, what) {
    const about = fs.readFileSync(path.join(STATIC, 'about.html'), 'utf8');
    const m = re.exec(about);
    if (!m)
        throw new Error('shell.js: no ' + what + ' in static/about.html');
    return m[0];
}

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* opts: file, title, description (EN; meta only), css (extra stylesheet),
 *       body (everything between the top bar and the footer), note (footer
 *       line after "back home", {en, uk, ru}) */
function page(opts) {
    const topbar = lift(/<header class="topbar[\s\S]*?<\/header>/, 'top bar');
    const footnav = lift(/ *<nav class="wrap footer__nav"[\s\S]*?<\/nav>\n/, 'footer site map');
    const url = BASE + '/' + opts.file;
    const note = opts.note || { en: '', uk: '', ru: '' };
    const tail = l => note[l] ? ' · ' + note[l] : '';
    return `<!DOCTYPE html>
<html lang="en" data-lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}"/>
<link rel="canonical" href="${url}"/>
<meta name="robots" content="index,follow,max-image-preview:large"/>
<meta name="theme-color" content="#0d0b12"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="DreamLand MUD"/>
<meta property="og:title" content="${esc(opts.title)}"/>
<meta property="og:description" content="${esc(opts.description)}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${BASE}/site/assets/og-card.jpg"/>
<meta property="og:image:alt" content="The DreamLand logo over a purple map of Thera"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<link rel="stylesheet" href="site/css/theme.css"/>
<link rel="stylesheet" href="site/css/${opts.css}"/>
</head>
<body>

${topbar}

${opts.body}

<footer class="footer" style="padding:40px 0 30px;">
${footnav}    <div class="wrap footer__bottom" style="margin:0;padding-top:0;border:0;">
        <span lang="en">DreamLand MUD · <a href="index.html">back home</a>${tail('en')}</span>
        <span lang="uk">DreamLand MUD · <a href="index.html">на головну</a>${tail('uk')}</span>
        <span lang="ru">DreamLand MUD · <a href="index.html">на главную</a>${tail('ru')}</span>
    </div>
</footer>

<script src="site/js/src.js"></script>
<script src="site/js/nav.js"></script>
<script src="site/js/i18n.js"></script>
</body>
</html>
`;
}

/* ---- one-language pages ---------------------------------------------------
 * The static help and news pages (build-help-pages.js, build-news.js) are one
 * page per language at its own URL, for search engines and answer engines
 * that read the HTML and never run the language toggle. So the shell differs
 * from page() above in three ways:
 *   - only the page's own language is in the markup: the trilingual top bar
 *     and footer are cut down to it, and i18n.js is not loaded (it would flip
 *     data-lang to the visitor's saved choice and hide the whole page),
 *   - the language switch is a row of links to the sibling URLs, not buttons
 *     that swap spans in place (langlinks.js saves the choice on click),
 *   - every URL is absolute, because these pages live in subdirectories.
 */
const LANG = {
    en: { name: 'EN', label: 'Language', note: 'back home' },
    uk: { name: 'UA', label: 'Мова', note: 'на головну' },
    ru: { name: 'RU', label: 'Язык', note: 'на главную' },
};

/* Drop every element tagged with another language. The top bar and the footer
   only ever put lang= on leaf elements (a link, a span, a heading), so a
   non-greedy match up to the same closing tag is the whole element. */
function oneLanguage(html, lang) {
    return html.replace(/<(a|span|h[1-6]|p|button)\b[^>]*\slang="(en|uk|ru)"[^>]*>[\s\S]*?<\/\1>/g,
                        (m, tag, l) => (l === lang ? m : ''));
}

/* about.html links relative to the site root; from /en/help/ those resolve
   into the subdirectory. */
function absolute(html) {
    return html.replace(/\b(href|src)="(?!\/|#|[a-z][a-z0-9+.-]*:)([^"]*)"/gi, '$1="/$2"');
}

/* opts:
 *   lang         'en' | 'uk' | 'ru'
 *   path         this page, from the site root ('/en/help/12.html')
 *   title, description
 *   alternates   {lang: path} for every language version that exists, this
 *                one included: rel=alternate hreflang, plus x-default
 *   xdefault     path for x-default
 *   switchTo     {lang: href} where each language button goes: the sibling
 *                page, or the app in that language when there is none
 *   css          extra stylesheets under /site/css/
 *   jsonld       an object, written as application/ld+json
 *   noindex      true to keep the page out of search
 *   body         everything between the top bar and the footer
 *   note         footer line after "back home", in this language
 *   section      the top-bar link this page belongs under ('help.html'),
 *                marked as the current one
 */
function langPage(opts) {
    const L = LANG[opts.lang];
    const url = BASE + opts.path;
    const switcher = '<div class="langswitch" role="group" aria-label="' + L.label + '">\n' +
        ['en', 'uk', 'ru'].map(l => {
            const cur = l === opts.lang;
            return '        <a href="' + esc(opts.switchTo[l]) + '" hreflang="' + l + '" data-golang="' + l + '"' +
                (cur ? ' aria-current="true"' : '') + '>' + LANG[l].name + '</a>';
        }).join('\n') + '\n    </div>';
    let topbar = absolute(oneLanguage(lift(/<header class="topbar[\s\S]*?<\/header>/, 'top bar'), opts.lang))
        .replace(/<div class="langswitch"[\s\S]*?<\/div>/, switcher);
    if (opts.section)
        topbar = topbar.split('<a class="navlink" href="/' + opts.section + '"')
            .join('<a class="navlink" href="/' + opts.section + '" aria-current="page"');
    const footnav = absolute(oneLanguage(lift(/ *<nav class="wrap footer__nav"[\s\S]*?<\/nav>\n/, 'footer site map'), opts.lang));
    const alts = Object.keys(opts.alternates || {}).map(l =>
        `<link rel="alternate" hreflang="${l}" href="${BASE + opts.alternates[l]}"/>`);
    if (opts.xdefault)
        alts.push(`<link rel="alternate" hreflang="x-default" href="${BASE + opts.xdefault}"/>`);
    const css = ['theme.css'].concat(opts.css || [])
        .map(c => `<link rel="stylesheet" href="/site/css/${c}"/>`).join('\n');
    const ld = opts.jsonld
        ? '<script type="application/ld+json">' + JSON.stringify(opts.jsonld).replace(/</g, '\\u003c') + '</script>\n'
        : '';
    return `<!DOCTYPE html>
<html lang="${opts.lang}" data-lang="${opts.lang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}"/>
<link rel="canonical" href="${url}"/>
${alts.join('\n')}
<meta name="robots" content="${opts.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large'}"/>
<meta name="theme-color" content="#0d0b12"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="DreamLand MUD"/>
<meta property="og:title" content="${esc(opts.title)}"/>
<meta property="og:description" content="${esc(opts.description)}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${BASE}/site/assets/og-card.jpg"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
${css}
${ld}</head>
<body>

${topbar}

${opts.body}

<footer class="footer" style="padding:40px 0 30px;">
${footnav}    <div class="wrap footer__bottom" style="margin:0;padding-top:0;border:0;">
        <span>DreamLand MUD · <a href="/">${L.note}</a>${opts.note ? ' · ' + opts.note : ''}</span>
    </div>
</footer>

<script src="/site/js/src.js"></script>
<script src="/site/js/nav.js"></script>
<script src="/site/js/langlinks.js"></script>
</body>
</html>
`;
}

/* Write a directory of pages next to its final place, then swap it in whole:
 * pages for articles that are gone simply are not in the new tree, and no
 * reader ever sees a half-written one. pages: {relative path: html}. */
function writeTree(dir, pages) {
    const tmp = dir + '.new-' + process.pid;
    const old = dir + '.old-' + process.pid;
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const rel of Object.keys(pages)) {
        const out = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, pages[rel]);
    }
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    if (fs.existsSync(dir)) fs.renameSync(dir, old);
    fs.renameSync(tmp, dir);
    fs.rmSync(old, { recursive: true, force: true });
}

/* Write next to a temp name and rename, so a half-written page is never served. */
function write(file, html) {
    const out = path.join(STATIC, file);
    fs.writeFileSync(out + '.tmp', html);
    fs.renameSync(out + '.tmp', out);
    console.log(file + '  ' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}

/* The {en, uk, ru} sibling set every heading and line of the site is made of. */
function tri(tag, t, attrs) {
    const a = attrs ? ' ' + attrs : '';
    return ['en', 'uk', 'ru'].map(l => `<${tag}${a} lang="${l}">${t[l]}</${tag}>`).join('');
}

module.exports = { page, write, esc, tri, langPage, writeTree, BASE, STATIC };
