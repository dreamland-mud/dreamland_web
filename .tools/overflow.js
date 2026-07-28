const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve('/Users/kit/claude/Projects/Dreamland/Ukrainization/website-proto');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
 const p=await b.newPage(); await p.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await p.goto(`http://127.0.0.1:${srv.address().port}/${process.argv[2]}`,{waitUntil:'networkidle0'});
 await new Promise(r=>setTimeout(r,900));
 console.log(JSON.stringify(await p.evaluate(()=>{
   const de=document.documentElement;
   // an element that overflows ITSELF is the source; ancestors just inherit it
   const wide=[...document.querySelectorAll('body *')].filter(e=>{
     const cs=getComputedStyle(e);
     if (cs.overflowX==='auto'||cs.overflowX==='scroll') return false;
     return e.scrollWidth > e.clientWidth+2 && e.clientWidth>0;
   }).slice(0,12).map(e=>({tag:e.tagName.toLowerCase(),cls:String(e.className||'').slice(0,44),
      id:e.id, client:e.clientWidth, scroll:e.scrollWidth}));
   return {innerWidth:window.innerWidth, clientWidth:de.clientWidth, scrollWidth:de.scrollWidth, wide};
 }),null,1));
 await b.close(); srv.close();})();
