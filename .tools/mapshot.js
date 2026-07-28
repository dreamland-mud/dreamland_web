// Loads the maps page, opens a zone, and reports what actually rendered.
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const OUT=process.argv[2]||'/tmp/mapshot';
const ZONE=process.argv[3]||'midgaard';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${srv.address().port}`;
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  for (const lang of ['en','uk']) {
    const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
    await p.evaluateOnNewDocument(l=>{try{localStorage.setItem('dl_lang',l)}catch(e){}},lang);
    await p.goto(base+'/maps.html#'+ZONE,{waitUntil:'networkidle0'});
    await sleep(1400);
    const info=await p.evaluate(()=>({
      zones:document.querySelectorAll('.zone').length,
      bands:[...document.querySelectorAll('.zones__band')].map(e=>e.textContent),
      title:(document.getElementById('zoneName')||{}).textContent,
      meta:(document.getElementById('zoneMeta')||{}).textContent,
      layers:[...document.querySelectorAll('.layer')].map(e=>e.textContent),
      rooms:document.querySelectorAll('#mapSvg .room').length,
      edges:document.querySelectorAll('#mapSvg .edges > *').length,
      firstLabels:[...document.querySelectorAll('#mapSvg .room text')].slice(0,4).map(e=>e.textContent),
      vb:(document.getElementById('mapSvg')||{}).getAttribute&&document.getElementById('mapSvg').getAttribute('viewBox'),
    }));
    await p.screenshot({path:`${OUT}/maps-${lang}.png`});
    // click a room
    // synthetic click: after centring, the first tile can sit outside the
    // viewport and puppeteer refuses to click what it cannot reach
    await p.evaluate(()=>{const r=document.querySelector('#mapSvg .room');
      if(r) r.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
    await sleep(500);
    info.card=await p.evaluate(()=>{const c=document.getElementById('roomCard');
      return c&&!c.hidden?{h3:c.querySelector('h3').textContent,ex:[...c.querySelectorAll('li')].slice(0,3).map(e=>e.textContent.trim())}:null;});
    await p.screenshot({path:`${OUT}/maps-${lang}-room.png`});
    // text view
    await p.click('#viewToggle'); await sleep(500);
    info.textRows=await p.$$eval('.maptext .trow',n=>n.length);
    info.textSample=await p.$$eval('.maptext .trow',n=>n.slice(0,2).map(e=>e.innerText.replace(/\s+/g,' ')));
    await p.screenshot({path:`${OUT}/maps-${lang}-text.png`});
    info.errors=errs;
    console.log('==== '+lang+' ====');
    console.log(JSON.stringify(info,null,1));
    await p.close();
  }
  console.log('shots -> '+OUT);
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.stack);srv.close();process.exit(1)});
