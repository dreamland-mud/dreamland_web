const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1100});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.evaluateOnNewDocument(l=>{try{localStorage.setItem('dl_lang',l)}catch(e){}},process.argv[3]||'uk');
  await p.goto(`http://127.0.0.1:${srv.address().port}/searcher.html`,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,900));
  const chips=await p.$$eval('#c_stats .chip',n=>n.map(c=>c.innerText.trim()));
  const total=await p.$eval('#meta',e=>e.innerText.trim());
  // tick Mana then Saves and watch the count narrow
  const res=[];
  for (const val of ['mana','saves']) {
    // the checkbox itself is visually hidden; the label is the hit target
    await p.evaluate(v=>document.querySelector(`#c_stats .chip input[value="${v}"]`).closest('.chip').click(), val);
    await new Promise(r=>setTimeout(r,500));
    res.push({checked:val, meta:await p.$eval('#meta',e=>e.innerText.trim()),
      firstRowBonuses:await p.$eval('#rows tr .i-bonus',e=>e.innerText.replace(/\s+/g,' ').trim())});
  }
  await (await p.$('.filters')).screenshot({path:process.argv[2]+'/statfilters.png'});
  console.log(JSON.stringify({chips,total,res,errors:errs},null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
