// Headless smoke test: news unfold cycle, dead links, JS errors.
// usage: node smoke.js
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const miss=[];
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){miss.push(p);r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,600));
  const h=async()=>Math.round(await p.$eval('.news-item__text',e=>e.getBoundingClientRect().height));
  const c0=await h();
  await p.click('.news-item__more'); await new Promise(r=>setTimeout(r,900));
  const e1=await h();
  await p.click('.news-item__more'); await new Promise(r=>setTimeout(r,900));   // collapse same card
  const c1=await h();
  await p.click('.news-item__more'); await new Promise(r=>setTimeout(r,900));   // expand again
  const e2=await h();
  console.log(JSON.stringify({collapsed:c0,expanded:e1,collapsedAgain:c1,expandedAgain:e2,
    missing404:miss,pageErrors:errs}));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
