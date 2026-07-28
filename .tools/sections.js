// Screenshot individual sections of a page at readable resolution.
// usage: node sections.js <page.html> <out-dir> [width] [lang] [sel,sel,...]
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '../static');
const MIME = { '.html':'text/html','.css':'text/css','.js':'text/javascript',
    '.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml' };

const target = process.argv[2] || 'index.html';
const outDir = process.argv[3] || '/tmp/shots';
const width = parseInt(process.argv[4] || '1440', 10);
const lang = process.argv[5] || 'en';
const sels = (process.argv[6] || 'section,footer').split(',');

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
    fs.mkdirSync(outDir, { recursive: true });
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
    // open every <details> so collapsed content is visible
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    await new Promise(r => setTimeout(r, 800));

    let i = 0;
    for (const sel of sels) {
        const nodes = await page.$$(sel);
        for (const n of nodes) {
            i++;
            const id = await n.evaluate(el => el.id || el.className.toString().slice(0, 24).replace(/\W+/g, '-'));
            try {
                await n.screenshot({ path: path.join(outDir, `${String(i).padStart(2,'0')}-${id || 'x'}.png`) });
            } catch (e) { console.error(`skip ${sel}#${i}: ${e.message}`); }
        }
    }
    await browser.close(); srv.close();
    console.log(`ok ${i} shots -> ${outDir}`);
})().catch(e => { console.error('ERR ' + e.message); srv.close(); process.exit(1); });
