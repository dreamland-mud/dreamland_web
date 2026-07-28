// Measures the two things that are easy to break by eye and easy to prove by
// number: does the nav hardware line up with the body content, and how many
// lines does the hero headline take in each language.
//
//   node navalign.js [outDir] [widths]        e.g. node navalign.js /tmp/a 1440,1280,1100,720
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '../static');
const OUT = process.argv[2] || '/tmp/navalign';
const WIDTHS = (process.argv[3] || '1600,1440,1280,1164,1100,900').split(',').map(Number);
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => {
        if (e) { r.statusCode = 404; return r.end('nf'); }
        r.setHeader('Content-Type', MIME[path.extname(p)] || 'text/plain'); r.end(d);
    });
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });

    for (const lang of ['en', 'uk']) {
        console.log('==== ' + lang + ' ====');
        console.log('  width  nav.L  body.L  delta   lang.R  body.R  delta   h1 lines');
        for (const w of WIDTHS) {
            const p = await b.newPage();
            await p.setViewport({ width: w, height: 1000 });
            await p.evaluateOnNewDocument(l => { try { localStorage.setItem('dl_lang', l); } catch (e) {} }, lang);
            await p.goto(base + '/index.html', { waitUntil: 'networkidle0' });
            await sleep(500);
            const m = await p.evaluate(() => {
                const R = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
                const nav = R('.navpill'), ls = R('.langswitch'), bg = R('.burger');
                // a section .wrap is the body's own content box -- the thing the
                // nav is supposed to agree with
                const secs = [...document.querySelectorAll('.section .wrap')];
                const body = secs.length ? secs[0].getBoundingClientRect() : null;
                const pad = body ? parseFloat(getComputedStyle(secs[0]).paddingLeft) : 0;
                // both language copies of the headline are in the DOM; the
                // inactive one is display:none, so measuring the first match
                // silently reports 0 lines for whichever language is not active
                const h1 = [...document.querySelectorAll('.hero h1')]
                    .find(e => e.offsetParent !== null || e.getClientRects().length);
                let lines = 0;
                if (h1) {
                    const cs = getComputedStyle(h1);
                    lines = Math.round(h1.getBoundingClientRect().height /
                        (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.04));
                }
                const right = ls && ls.width ? ls : bg;
                return {
                    navL: nav ? Math.round(nav.left) : null,
                    rightR: right ? Math.round(window.innerWidth - right.right) : null,
                    rightIsBurger: !!(right && right === bg),
                    bodyL: body ? Math.round(body.left + pad) : null,
                    bodyR: body ? Math.round(window.innerWidth - (body.right - pad)) : null,
                    lines: lines,
                    h1w: h1 ? Math.round(h1.getBoundingClientRect().width) : null,
                };
            });
            const d1 = m.navL != null && m.bodyL != null ? m.navL - m.bodyL : NaN;
            const d2 = m.rightR != null && m.bodyR != null ? m.rightR - m.bodyR : NaN;
            const mark = v => (Math.abs(v) <= 1 ? ' ok' : String(v > 0 ? '+' + v : v));
            console.log('  %s  %s  %s  %s   %s  %s  %s   %s%s',
                String(w).padStart(5), String(m.navL).padStart(5), String(m.bodyL).padStart(6),
                mark(d1).padStart(5), String(m.rightR).padStart(6), String(m.bodyR).padStart(6),
                mark(d2).padStart(5), m.lines, m.rightIsBurger ? ' (burger)' : '');
            if (w === WIDTHS[0] || w === 1440)
                await p.screenshot({ path: `${OUT}/nav-${lang}-${w}.png` });
            await p.close();
        }
    }
    console.log('\nshots -> ' + OUT);
    await b.close(); srv.close();
})().catch(e => { console.error('ERR', e.stack); srv.close(); process.exit(1); });
