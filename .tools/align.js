const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.evaluateOnNewDocument(l=>{try{localStorage.setItem('dl_lang',l)}catch(e){}},process.argv[3]||'en');
  await p.goto(`http://127.0.0.1:${srv.address().port}/searcher.html`,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,800));
  await p.type('#f_name','серебрист');
  await new Promise(r=>setTimeout(r,700));
  // also grab a mixed-alignment item
  const info=await p.evaluate(()=>{
    const rows=[...document.querySelectorAll('#rows tr')].slice(0,6);
    return rows.map(tr=>({name:tr.children[0].innerText.trim().slice(0,30),
      alignIcons:[...tr.querySelectorAll('.alignicon')].map(s=>s.getAttribute('aria-label')+'/'+
        getComputedStyle(s).color)}));
  });
  const tbl=await p.$('.tablewrap');
  await tbl.screenshot({path:process.argv[2]+'/align.png'});
  console.log(JSON.stringify({info,errors:errs},null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
