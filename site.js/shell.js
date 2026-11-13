/* The page shell of the new site (head, top bar, footer) for the pages a
 * builder writes instead of a person: legends.html, gallery.html.
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

module.exports = { page, write, esc, tri };
