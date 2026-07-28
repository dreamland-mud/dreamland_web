// Checks the REAL trilingual dumps end-to-end: every searcher tab and the help
// browser, rendered in EN and UA, with screenshots.
//
// trilang.js faked nameEn/nameUa into db_pets to prove the plumbing before the
// server could emit them. This one serves the files untouched -- if a column
// still reads Russian under EN, that is the data, not the page.
//
//   node trilang-live.js [outDir]
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '../static');
const OUT = process.argv[2] || '/tmp/trilang-live';
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
    const report = {};

    for (const lang of ['en', 'uk']) {
        const R = report[lang] = { searcher: {}, help: {}, errors: [] };
        const p = await b.newPage();
        await p.setViewport({ width: 1440, height: 1100 });
        p.on('pageerror', e => R.errors.push('searcher: ' + e.message));

        // seed the stored choice BEFORE navigation -- anything rendered at boot
        // reads it, and setting data-lang afterwards silently lies
        await p.evaluateOnNewDocument(l => { try { localStorage.setItem('dl_lang', l); } catch (e) {} }, lang);
        await p.goto(base + '/searcher.html', { waitUntil: 'networkidle0' });
        await sleep(700);

        const tabs = await p.$$('.tab');
        for (let i = 0; i < tabs.length; i++) {
            const label = await p.evaluate(t => t.innerText.trim().replace(/\s+/g, ' '), tabs[i]);
            await tabs[i].click();
            await sleep(400);
            const btn = await p.$('#go');
            if (btn) { await btn.click(); await sleep(900); } else { await sleep(700); }
            R.searcher[i + ':' + label] = await p.evaluate(() => {
                const head = [...document.querySelectorAll('#rows')].length
                    ? [...document.querySelectorAll('thead th')].map(t => t.innerText.trim())
                    : [];
                const rows = [...document.querySelectorAll('#rows tr')].slice(0, 3)
                    .map(tr => [...tr.children].map(td => td.innerText.trim().replace(/\s+/g, ' ')));
                return { cols: head, rows: rows };
            });
            await p.screenshot({ path: `${OUT}/searcher-${lang}-tab${i}.png` });
        }
        await p.close();

        // --- help ---
        const h = await b.newPage();
        await h.setViewport({ width: 1440, height: 1100 });
        h.on('pageerror', e => R.errors.push('help: ' + e.message));
        await h.evaluateOnNewDocument(l => { try { localStorage.setItem('dl_lang', l); } catch (e) {} }, lang);
        await h.goto(base + '/help.html', { waitUntil: 'networkidle0' });
        await sleep(1200);

        R.help.categoryNames = await h.evaluate(() =>
            [...document.querySelectorAll('.hcat__name')]
                .filter(n => n.offsetParent !== null).slice(0, 6).map(n => n.innerText.trim()));

        // open the first article the rail offers and read what it renders
        const link = await h.$('.hcat a, .hlist a, a[data-help], .harticle-link');   // rail entry
        if (link) { await link.click(); await sleep(900); }
        R.help.article = await h.evaluate(() => {
            const t = document.querySelector('#helpArticle .hart h1');
            const body = document.querySelector('#helpArticle .hart');
            return {
                title: t ? t.innerText.trim() : null,
                first: body ? body.innerText.trim().split('\n').filter(Boolean).slice(0, 4) : null,
            };
        });
        await h.screenshot({ path: `${OUT}/help-${lang}.png` });
        await h.close();
    }

    console.log(JSON.stringify(report, null, 1));
    console.log('\nshots -> ' + OUT);
    await b.close(); srv.close();
})().catch(e => { console.error('ERR', e.stack); srv.close(); process.exit(1); });
