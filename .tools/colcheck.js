/* The zone-article column must vanish for the 8 zones that have no article, and
   the map must take the space -- and the drawing must stay centred through it. */
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
  const probe=()=>p.evaluate(()=>{
    const st=document.getElementById('mapStage').getBoundingClientRect();
    const rooms=[...document.querySelectorAll('.room')];
    let vis=0; rooms.forEach(r=>{const b=r.getBoundingClientRect();
      if(b.right>st.left&&b.left<st.right&&b.bottom>st.top&&b.top<st.bottom) vis++;});
    return {zone:document.getElementById('zoneName').textContent,
            stageW:Math.round(st.width), visible:vis, rooms:rooms.length,
            article:!!document.querySelector('#zoneHelp .hart'),
            noart:document.getElementById('maps').classList.contains('maps--noart')};
  });
  await p.goto(base+'/maps.html#intro',{waitUntil:'networkidle0'}); await sleep(800);
  console.log('no-article zone  :', JSON.stringify(await probe()));
  await p.evaluate(()=>{[...document.querySelectorAll('.zone')].find(b=>b.getAttribute('data-zone')==='moria').click();});
  await sleep(1200);
  console.log('then article zone:', JSON.stringify(await probe()));
  await p.evaluate(()=>{[...document.querySelectorAll('.zone')].find(b=>b.getAttribute('data-zone')==='intro').click();});
  await sleep(1200);
  console.log('back to no-article:', JSON.stringify(await probe()));
  console.log('errors', errs);
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
