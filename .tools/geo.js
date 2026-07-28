const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--force-prefers-reduced-motion']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,500));
  console.log(JSON.stringify(await p.evaluate(()=>{
    const v=s=>{const e=document.querySelector(s);const r=e.getBoundingClientRect();
      return {top:Math.round(r.top),bottom:Math.round(r.bottom)};};
    const hero=document.querySelector('.hero').getBoundingClientRect();
    const fTop=hero.top+26, fBot=hero.bottom-26;
    const h1=v('.hero h1'), sub=v('.hero__sub'), kick=v('.hero__kicker'), cta=v('.hero__cta a');
    return {frame:{top:Math.round(fTop),bottom:Math.round(fBot),centre:Math.round((fTop+fBot)/2)},
      h1, kicker:kick, sub, cta,
      block:{top:h1.top,bottom:sub.bottom,centre:Math.round((h1.top+sub.bottom)/2)},
      gapAbove:Math.round(h1.top-fTop), gapBelow:Math.round(fBot-sub.bottom)};
  }),null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
