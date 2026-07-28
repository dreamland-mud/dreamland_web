/* Screenshot one viewport of a page, scrolled to a chosen element, and print the
   geometry of whatever selectors you ask about. shot.js gives you the top of the
   page or a 9MB full-page dump; almost every check is really "how does THIS bit
   look at THIS width", which is what this does.

   usage: node at.js <page.html> <out> <width> [scrollTo-selector] [lang] [measure,selectors]
   e.g.   node at.js searcher.html f 390 '.row--groups'
          node at.js maps.html m 1440 '.mapstage' en '.mapstage,.maps'
*/
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '../static');
const MIME = { '.html':'text/html','.css':'text/css','.js':'text/javascript',
    '.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml' };

const [target = 'index.html', out = 'at', widthArg = '1440',
       scrollTo = '', lang = 'en', measure = ''] = process.argv.slice(2);
const width = parseInt(widthArg, 10);

const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    fs.readFile(path.join(ROOT, p), (e, d) => {
        if (e) { res.statusCode = 404; return res.end('nf'); }
        res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream');
        res.end(d);
    });
});

(async () => {
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: 'new',
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--force-prefers-reduced-motion'] });
    const page = await browser.newPage();
    await page.setViewport({ width, height: width < 700 ? 844 : 900, deviceScaleFactor: 1,
        isMobile: width < 700, hasTouch: width < 700 });
    await page.evaluateOnNewDocument(l => { try { localStorage.setItem('dl_lang', l); } catch (e) {} }, lang);
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/${target}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));

    if (scrollTo) {
        const found = await page.evaluate(s => {
            const el = document.querySelector(s);
            if (!el) return false;
            el.scrollIntoView({ block: 'center', behavior: 'instant' });
            return true;
        }, scrollTo);
        if (!found) console.log('scrollTo MISS: ' + scrollTo);
        await new Promise(r => setTimeout(r, 250));
    }

    await page.screenshot({ path: `${out}.png` });

    const sels = measure ? measure.split(',') : (scrollTo ? [scrollTo] : []);
    if (sels.length) {
        const geo = await page.evaluate(list => list.map(s => {
            const el = document.querySelector(s);
            if (!el) return { s, miss: true };
            const r = el.getBoundingClientRect();
            return { s, x: Math.round(r.x), y: Math.round(r.y),
                     w: Math.round(r.width), h: Math.round(r.height),
                     vh: window.innerHeight, scrollH: document.documentElement.scrollHeight };
        }), sels);
        geo.forEach(g => console.log(g.miss ? `  ${g.s}  MISSING`
            : `  ${g.s}  x=${g.x} y=${g.y} w=${g.w} h=${g.h}  (viewport ${g.vh}, page ${g.scrollH})`));
    }
    if (errs.length) console.log('JS ERRORS: ' + errs.join(' | '));

    await browser.close(); srv.close();
    console.log(`ok ${target} @${width}px -> ${out}.png`);
})().catch(e => { console.error('ERR ' + e.message); srv.close(); process.exit(1); });
