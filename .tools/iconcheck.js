/* Blow the alignment icons up so the shapes can be judged, and shoot a slice of
   the table that contains limited (purple) items. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const OUT=process.argv[2]||'/tmp';
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/searcher.html`,{waitUntil:'networkidle0'});
  await sleep(900);
  // icons at 90px on parchment, as a legibility test
  await p.evaluate(()=>{
    const d=document.createElement('div');
    d.id='iconlab';
    d.style.cssText='position:fixed;z-index:9999;left:0;top:0;padding:18px;display:flex;gap:24px;background:#e8d9b0';
    d.innerHTML=['al-sun','al-scales','al-skull','al-limit'].map(i=>
      `<svg viewBox="0 0 24 24" width="90" height="90" style="fill:${i==='al-skull'?'#8f1f30':i==='al-limit'?'#7a3597':i==='al-sun'?'#d8ae2e':'#7a6a3a'}"><use href="#${i}"/></svg>`).join('');
    document.body.appendChild(d);
  });
  await sleep(200);
  await (await p.$('#iconlab')).screenshot({path:OUT+'/icons.png'});
  await p.evaluate(()=>document.getElementById('iconlab').remove());
  // limited rows: sort by finding ones flagged limited
  const info=await p.evaluate(()=>{
    const rows=[...document.querySelectorAll('#rows tr')];
    const lim=rows.filter(r=>r.querySelector('.i-name--limit'));
    const n=lim[0]&&lim[0].querySelector('.i-name--limit');
    lim.slice(0,6).forEach(r=>r.setAttribute('data-lim','1'));
    return {rowsShown:rows.length, limitedShown:lim.length,
            nameColor:n?getComputedStyle(n).color:null,
            diamond:!!(lim[0]&&lim[0].querySelector('svg.i-limit')),
            first:lim.length?lim[0].innerText.split('\n')[0]:null};
  });
  const el=await p.$('tr[data-lim="1"]');
  if(el) await el.screenshot({path:OUT+'/limited-row.png'});
  console.log(JSON.stringify({...info,errors:errs}));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
