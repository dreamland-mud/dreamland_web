// Renders each button in rest + hover state, side by side, for review.
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
const OUT=process.argv[2];
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,700));
  const shots=[
    ['play','.hero__cta a'],
    ['news','.news-foot .btn'],
    ['github','.footer__git'],
  ];
  for (const [name,sel] of shots){
    const el=await p.$(sel); if(!el){console.log('skip '+name);continue}
    await el.evaluate(e=>e.scrollIntoView({block:'center'}));
    await new Promise(r=>setTimeout(r,350));
    await el.screenshot({path:`${OUT}/btn-${name}-rest.png`});
    await el.hover(); await new Promise(r=>setTimeout(r,450));
    await el.screenshot({path:`${OUT}/btn-${name}-hover.png`});
    await p.mouse.move(0,0); await new Promise(r=>setTimeout(r,300));
  }
  console.log('ok');
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
