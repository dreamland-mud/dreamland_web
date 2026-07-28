/* The two new filters have to actually filter: alignment chips by the letters
   the column shows, and the limited toggle by the diamond. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1200});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/searcher.html`,{waitUntil:'networkidle0'});
  await sleep(900);
  const stat=()=>p.evaluate(()=>{
    const rows=[...document.querySelectorAll('#rows tr')];
    return {shown:rows.length, total:+(document.querySelector('#meta b')||{}).textContent,
      limited:rows.filter(r=>r.querySelector('.i-name--limit')).length,
      good:rows.filter(r=>r.querySelector('.align-G')).length,
      evil:rows.filter(r=>r.querySelector('.align-E')).length,
      none:rows.filter(r=>!r.querySelector('.alignicon')).length};
  });
  console.log('baseline      ', JSON.stringify(await stat()));
  await p.click('#c_limited'); await sleep(500);
  console.log('limited OFF   ', JSON.stringify(await stat()));
  await p.click('#c_limited'); await sleep(400);
  await p.evaluate(()=>document.querySelector('#c_align .chip input[value="E"]').closest('.chip').click());
  await sleep(500);
  console.log('evil only     ', JSON.stringify(await stat()));
  await p.evaluate(()=>document.querySelector('#c_align .chip input[value="G"]').closest('.chip').click());
  await sleep(500);
  console.log('evil OR good  ', JSON.stringify(await stat()));
  console.log('errors', errs);
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
