const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--force-prefers-reduced-motion']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:900});
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`,{waitUntil:'networkidle0'});
  await p.evaluate(()=>window.scrollTo(0,1400));
  await new Promise(r=>setTimeout(r,700));
  const m=await p.evaluate(()=>{const t=document.getElementById('topbar'),
    pill=document.querySelector('.navpill'); const tr=t.getBoundingClientRect(),pr=pill.getBoundingClientRect();
    return {scrolled:t.classList.contains('scrolled'), barTop:Math.round(tr.top), barBottom:Math.round(tr.bottom),
      pillTop:Math.round(pr.top), pillBottom:Math.round(pr.bottom),
      airAbove:Math.round(pr.top-tr.top), airBelow:Math.round(tr.bottom-pr.bottom)};});
  await p.screenshot({path:process.argv[2]+'/scrolled-viewport.png'});
  console.log(JSON.stringify(m));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
