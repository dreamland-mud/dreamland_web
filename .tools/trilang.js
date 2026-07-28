// Proves the searcher picks up nameEn/nameUa/areaEn/... when the dump has them,
// and still falls back to the bare Russian key when it doesn't.
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{
  let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{
    if(e){r.statusCode=404;return r.end('nf')}
    if(p==='/data/db_pets.json'){                       // simulate the new dump
      const rows=JSON.parse(d.toString());
      rows.forEach((x,i)=>{ if(i%2===0){ x.nameEn='EN '+x.name; x.nameUa='UA '+x.name;
                                         x.areaEn='EN '+x.area; x.areaUa='UA '+x.area; } });
      d=Buffer.from(JSON.stringify(rows));
    }
    r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain'); r.end(d);
  })});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const out={};
  for (const lang of ['en','uk']) {
    const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.evaluateOnNewDocument(l=>{try{localStorage.setItem('dl_lang',l)}catch(e){}},lang);
    await p.goto(`http://127.0.0.1:${srv.address().port}/searcher.html`,{waitUntil:'networkidle0'});
    await new Promise(r=>setTimeout(r,600));
    const tabs=await p.$$('.tab'); await tabs[3].click();      // Pets
    await new Promise(r=>setTimeout(r,900));
    out[lang]={rows:await p.evaluate(()=>[...document.querySelectorAll('#rows tr')].slice(0,4)
      .map(tr=>tr.children[0].innerText.trim()+' | '+tr.children[4].innerText.trim()))};
    // search must match the translated name too
    await p.type('#f_name','EN ');
    await new Promise(r=>setTimeout(r,700));
    out[lang].hitsForEnQuery=await p.$$eval('#rows tr',n=>n.length);
    out[lang].errors=errs;
    await p.close();
  }
  console.log(JSON.stringify(out,null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
