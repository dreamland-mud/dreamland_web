/* Deep link into an old year at phone width: the picker has to follow, or the
   reader lands on a band that display:none has taken off the page. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const port=srv.address().port;
 const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 // pick a note from a year that is not the newest
 await p.goto(`http://127.0.0.1:${port}/data/news-all.json`,{waitUntil:'networkidle0'});
 const all=JSON.parse(await p.evaluate(()=>document.body.innerText));
 const list=Array.isArray(all)?all:(all.notes||all.items||[]);
 const old=list.find(n=>/2003$/.test(n.date))||list[list.length-1];
 await p.goto(`http://127.0.0.1:${port}/news.html#n${old.id}`,{waitUntil:'networkidle0'});
 await new Promise(r=>setTimeout(r,1100));
 console.log(JSON.stringify(await p.evaluate(()=>{
   const act=document.querySelector('details.nyear--active');
   const cur=document.querySelector('.news-mini[aria-current="true"]');
   const de=document.documentElement;
   return {pick:(document.getElementById('newsYearPick')||{}).value,
     activeYear:act&&act.getAttribute('data-year'),
     currentCardVisible: !!(cur && cur.getBoundingClientRect().width>0),
     currentInsideActive: !!(cur && act && act.contains(cur)),
     openSubject:(document.querySelector('.news-full__subject')||{}).textContent,
     hOverflow: de.scrollWidth>de.clientWidth+2};
 }),null,1));
 if(errs.length) console.log('JS ERRORS: '+errs.join(' | '));
 await b.close(); srv.close();})();
