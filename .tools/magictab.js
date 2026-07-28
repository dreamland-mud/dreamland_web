/* Magic is the one tab whose group row holds the limited toggle ALONE -- the
   spacer label must drop out there, or the chip floats a line low. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(`http://127.0.0.1:${srv.address().port}/searcher.html`,{waitUntil:'networkidle0'});
 await new Promise(r=>setTimeout(r,900));
 const report=async label=>p.evaluate(l=>{
   const g=[...document.querySelectorAll('.ctrlgroup')].map(e=>{
     const r=e.getBoundingClientRect();
     return {cls:e.className.replace('ctrlgroup','').trim()||'(bonus? )',x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width)};
   });
   const lab=document.querySelector('.ctrlgroup--limit .chips-label');
   return {tab:l, groups:g, sameRow:new Set(g.map(x=>x.y)).size===1,
     spacerShown: !!(lab && getComputedStyle(lab).display!=='none')};
 },label);
 console.log(JSON.stringify(await report('armor')));
 for (const name of ['Weapons','Magic']) {
   await p.evaluate(n=>{[...document.querySelectorAll('#tabbar button, #tabbar .tab')]
     .find(b=>b.textContent.trim().indexOf(n)>=0).click();}, name);
   await new Promise(r=>setTimeout(r,900));
   console.log(JSON.stringify(await report(name.toLowerCase())));
 }
 if(errs.length) console.log('JS ERRORS: '+errs.join(' | '));
 await b.close(); srv.close();})();
