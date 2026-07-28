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
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,600));
  const h=()=>p.$eval('details.scroll .scroll__body',e=>Math.round(e.getBoundingClientRect().height));
  const probe=()=>p.$eval('details.scroll',d=>{
    const b=d.querySelector('.scroll__body'), cs=getComputedStyle(b);
    return {open:d.open, detailsH:Math.round(d.getBoundingClientRect().height),
      bodyH:Math.round(b.getBoundingClientRect().height), inline:b.style.height||'(none)',
      display:cs.display, contentVis:cs.contentVisibility, overflow:cs.overflow,
      hasInner:!!d.querySelector('.scroll__inner')};});
  const open=()=>p.$eval('details.scroll',e=>e.open);
  console.log('INITIAL', JSON.stringify(await probe()));
  // the <details> box is what the user sees; the child keeps a phantom rect while closed
  const dh=()=>p.$eval('details.scroll',d=>Math.round(d.getBoundingClientRect().height));
  const sample=async(ms,n)=>{const out=[];for(let i=0;i<n;i++){out.push(await dh());await new Promise(r=>setTimeout(r,ms));}return out;};
  const closed0=await h(), o0=await open();
  const dClosed=await dh();
  await p.click('details.scroll summary');
  const openTrace=await sample(55,9);
  const dOpen=await dh(); const o1=await open();
  await p.click('details.scroll summary');
  const closeTrace=await sample(55,9);
  const dReclosed=await dh(); const o2=await open();
  const mid=0, opened=0, reclosed=0;
  console.log('AFTER CLOSE', JSON.stringify(await probe()));
  // link targets
  const links=await p.$$eval('#start a',a=>a.map(x=>x.textContent.trim()+' -> '+x.getAttribute('href')));
  const uniqOpen=new Set(openTrace).size, uniqClose=new Set(closeTrace).size;
  console.log(JSON.stringify({detailsHeight:{closed:dClosed,open:dOpen,reclosed:dReclosed},
    openAttr:[o0,o1,o2], openTrace, closeTrace,
    animatedOpen:uniqOpen>=4, animatedClose:uniqClose>=4,
    links, errors:errs},null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
