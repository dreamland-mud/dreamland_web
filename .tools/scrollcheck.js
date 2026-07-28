/* No column may carry its own scrollbar any more: rail, zone article and text
   view all grow with their content and the page does the scrolling. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${srv.address().port}`;
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const scrolls=sel=>p.evaluate(s=>{const e=document.querySelector(s);
    if(!e) return null; return {h:Math.round(e.clientHeight), inner:Math.round(e.scrollHeight),
      scrolls:e.scrollHeight>e.clientHeight+2};},sel);
  await p.goto(base+'/maps.html#moria',{waitUntil:'networkidle0'}); await sleep(1200);
  const open=await p.evaluate(()=>({bands:document.querySelectorAll('details.zband').length,
      open:document.querySelectorAll('details.zband[open]').length,
      openName:[...document.querySelectorAll('details.zband[open] .zband__name')].map(e=>e.textContent),
      ascii:document.getElementById('asciiLink').hidden?null:document.getElementById('asciiLink').href}));
  console.log('bands', JSON.stringify(open));
  console.log('rail      ', JSON.stringify(await scrolls('.zones__list')));
  console.log('zonehelp  ', JSON.stringify(await scrolls('.zonehelp .hart')));
  await p.click('#viewToggle'); await sleep(600);
  console.log('text view ', JSON.stringify(await scrolls('#mapText')));
  // zoom feel: one wheel notch (deltaY 100) and a trackpad flick (deltaY 8 x10)
  await p.click('#viewToggle'); await sleep(400);
  const zoom=async(dy,times)=>{const s0=await p.evaluate(()=>/scale\(([\d.]+)\)/.exec(document.getElementById('mapPan').getAttribute('transform'))[1]);
    for(let i=0;i<times;i++){await p.mouse.move(700,600);await p.mouse.wheel({deltaY:dy});await sleep(30);}
    await sleep(200);
    const s1=await p.evaluate(()=>/scale\(([\d.]+)\)/.exec(document.getElementById('mapPan').getAttribute('transform'))[1]);
    return {from:+s0,to:+s1,ratio:+(s1/s0).toFixed(2)};};
  console.log('1 wheel notch (-100) ', JSON.stringify(await zoom(-100,1)));
  console.log('trackpad flick 10x-8 ', JSON.stringify(await zoom(-8,10)));
  console.log('errors', errs);
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
