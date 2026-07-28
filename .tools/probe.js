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
  await new Promise(r=>setTimeout(r,600));
  const m=await p.evaluate(()=>{
    const hero=document.querySelector('.hero'), cta=document.querySelector('.hero__cta a'),
          h1=document.querySelector('html[data-lang=en] h1, .hero h1');
    const hr=hero.getBoundingClientRect(), cr=cta.getBoundingClientRect(), tr=h1.getBoundingClientRect();
    return {heroBottom:Math.round(hr.bottom), ctaTop:Math.round(cr.top), ctaBottom:Math.round(cr.bottom),
      ctaCentreX:Math.round(cr.left+cr.width/2), h1CentreX:Math.round(tr.left+tr.width/2),
      viewportCentreX:720, heroOverflow:getComputedStyle(hero).overflow,
      frameBottomY:Math.round(hr.bottom-26)};
  });
  // crop the hero foot so the straddle is visible
  await p.screenshot({path:process.argv[2]+'/cta.png',clip:{x:440,y:890,width:560,height:200},captureBeyondViewport:true});
  console.log(JSON.stringify(m,null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
