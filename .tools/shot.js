// Headless screenshot of the prototype. Serves the site from an in-process
// http server (short-lived, dies with the node process) so fetch() works,
// then renders with puppeteer's bundled chromium.
// usage: node shot.js <page.html> <out-prefix> [width] [lang]
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '../static');
const MIME = { '.html':'text/html','.css':'text/css','.js':'text/javascript',
    '.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml' };

const target = process.argv[2] || 'index.html';
const out = process.argv[3] || 'shot';
const width = parseInt(process.argv[4] || '1440', 10);
const lang = process.argv[5] || 'en';

const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const fp = path.join(ROOT, p);
    fs.readFile(fp, (e, d) => {
        if (e) { res.statusCode = 404; res.end('nf'); return; }
        res.setHeader('Content-Type', MIME[path.extname(fp)] || 'application/octet-stream');
        res.end(d);
    });
});

(async () => {
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const port = srv.address().port;
    const browser = await puppeteer.launch({ headless: 'new',
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--force-prefers-reduced-motion'] });
    const page = await browser.newPage();
    await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
    // seed the language the way a returning visitor arrives, so scripts that
    // render language-dependent content see the right value at boot
    await page.evaluateOnNewDocument(function (l) {
        try { localStorage.setItem('dl_lang', l); } catch (e) {}
    }, lang);
    await page.goto(`http://127.0.0.1:${port}/${target}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 700));
    // hero / first viewport
    await page.screenshot({ path: `${out}-top.png` });
    // full page
    await page.screenshot({ path: `${out}-full.png`, fullPage: true });
    await browser.close(); srv.close();
    console.log('ok ' + target);
})().catch(e => { console.error('ERR ' + e.message); srv.close(); process.exit(1); });
