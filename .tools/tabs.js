// Sample one row from each searcher tab, in both languages.
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const out={};
  for (const lang of ['en','uk']) {
    const p=await b.newPage(); await p.setViewport({width:1600,height:1000});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.evaluateOnNewDocument(l=>{try{localStorage.setItem('dl_lang',l)}catch(e){}},lang);
    await p.goto(`http://127.0.0.1:${srv.address().port}/searcher.html`,{waitUntil:'networkidle0'});
    await new Promise(r=>setTimeout(r,700));
    out[lang]={};
    const tabs=await p.$$('.tab');
    for (let i=0;i<tabs.length;i++){
      await tabs[i].click(); await new Promise(r=>setTimeout(r,900));
      out[lang][i]=await p.evaluate(()=>{
        const tr=document.querySelector('#rows tr');
        return tr?Array.from(tr.children).map(td=>td.innerText.replace(/\s+/g,' ').trim().slice(0,44)):null;
      });
    }
    // no horizontal scroll on desktop?
    out[lang].hscroll=await p.evaluate(()=>{
      const w=document.querySelector('.tablewrap');
      return {tableOverflows:w.scrollWidth>w.clientWidth+1, bodyOverflows:document.body.scrollWidth>window.innerWidth+1};
    });
    out[lang].errors=errs;
    await p.close();
  }
  console.log(JSON.stringify(out,null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
