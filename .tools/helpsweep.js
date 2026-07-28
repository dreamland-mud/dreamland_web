// Render a wide sample of articles and flag anything that comes out broken.
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/help.html`,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,1200));
  const out=await p.evaluate(()=>{
    // reach into the page: render every article and measure the result
    const idx=[...document.querySelectorAll('.hcat li a')].map(a=>+a.dataset.hid);
    return {count:idx.length, ids:idx};
  });
  const ids=out.ids;
  const step=Math.max(1,Math.floor(ids.length/220));
  const sample=ids.filter((_,i)=>i%step===0).slice(0,220);
  const bad=[];const stat={empty:0,allPre:0,ok:0,preLines:0};
  for(const id of sample){
    await p.evaluate(i=>{location.hash='#h'+i},id);
    await new Promise(r=>setTimeout(r,45));
    const m=await p.evaluate(()=>{
      const body=document.querySelector('.hart__body'); if(!body) return null;
      const txt=body.innerText.trim();
      const pre=[...body.querySelectorAll('pre')];
      return {len:txt.length, paras:body.querySelectorAll('p').length, pres:pre.length,
        preLines:pre.reduce((a,e)=>a+e.innerText.split('\n').length,0),
        title:(document.querySelector('.hart h1')||{innerText:''}).innerText.slice(0,40)};
    });
    if(!m||m.len<2){stat.empty++;bad.push({id,why:'empty',m});continue;}
    if(m.pres&&m.paras===0){stat.allPre++;bad.push({id,why:'all-pre',m});continue;}
    stat.preLines+=m.preLines; stat.ok++;
  }
  console.log(JSON.stringify({sampled:sample.length,stat,badSample:bad.slice(0,8),errors:errs.slice(0,4)},null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
