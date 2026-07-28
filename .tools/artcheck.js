// Opens the same set of articles in EN and UA and reports whether the BODY
// actually differs per language -- the thing the trilingual help dump was for.
//
//   node artcheck.js [id,id,id] [outDir]
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '../static');
const IDS = (process.argv[2] || '9,11,12,222,1088').split(',').map(s => s.trim());
const OUT = process.argv[3] || '/tmp/artcheck';
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
    const got = {};

    for (const lang of ['en', 'uk']) {
        const p = await b.newPage();
        await p.setViewport({ width: 1440, height: 1000 });
        const errs = [];
        p.on('pageerror', e => errs.push(e.message));
        await p.evaluateOnNewDocument(l => { try { localStorage.setItem('dl_lang', l); } catch (e) {} }, lang);
        got[lang] = { errors: errs, arts: {} };

        for (const id of IDS) {
            // the route is #h<id>, not #<id>
            await p.goto(base + '/help.html#h' + id, { waitUntil: 'networkidle0' });
            await sleep(900);
            got[lang].arts[id] = await p.evaluate(() => {
                const a = document.querySelector('.hart');
                if (!a) return null;
                const h = a.querySelector('h1');
                const body = a.innerText.trim().split('\n').filter(Boolean);
                return { h1: h ? h.innerText.trim() : null, lines: body.slice(1, 5), chars: a.innerText.length };
            });
            if (id === IDS[0]) await p.screenshot({ path: `${OUT}/art-${id}-${lang}.png`, fullPage: false });
        }
        await p.close();
    }

    for (const id of IDS) {
        const e = got.en.arts[id], u = got.uk.arts[id];
        console.log('--- id ' + id + ' ---');
        console.log('  EN h1: ' + (e && e.h1));
        console.log('  UA h1: ' + (u && u.h1));
        console.log('  EN   : ' + (e ? e.lines.slice(0, 2).join(' / ') : 'MISSING'));
        console.log('  UA   : ' + (u ? u.lines.slice(0, 2).join(' / ') : 'MISSING'));
        console.log('  body differs: ' + (e && u ? (e.lines.join('') !== u.lines.join('')) : 'n/a'));
    }
    console.log('\nJS errors  EN: ' + JSON.stringify(got.en.errors) + '  UA: ' + JSON.stringify(got.uk.errors));
    console.log('shots -> ' + OUT);
    await b.close(); srv.close();
})().catch(e => { console.error('ERR', e.stack); srv.close(); process.exit(1); });
