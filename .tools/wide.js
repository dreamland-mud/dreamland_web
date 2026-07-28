const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); const W=1920; await p.setViewport({width:W,height:1000});
  await p.goto(`http://127.0.0.1:${srv.address().port}/searcher.html`,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,900));
  const tabs=await p.$$('.tab');
  const res=[];
  for(let i=0;i<tabs.length;i++){
    await tabs[i].click(); await new Promise(r=>setTimeout(r,900));
    res.push(await p.evaluate((W,i)=>{
      const tw=document.querySelector('.tablewrap'), tb=document.querySelector('table.results');
      const over=[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>W+1)
        .slice(0,5).map(e=>({tag:e.tagName,cls:(e.className||'').toString().slice(0,24),
          right:Math.round(e.getBoundingClientRect().right)}));
      return {tab:i, cols:document.querySelectorAll('table.results thead th').length,
        containerW:Math.round(tw.getBoundingClientRect().width),
        tableScrollW:tb.scrollWidth, bodyScrollW:document.body.scrollWidth,
        hScroll:tb.scrollWidth>Math.round(tw.getBoundingClientRect().width)+1, over};
    },W,i));
  }
  console.log(JSON.stringify(res,null,1));
  if(false) console.log(JSON.stringify(await p.evaluate((W)=>{
    const wide=[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>W+1)
      .slice(0,10).map(e=>({tag:e.tagName,cls:(e.className||'').toString().slice(0,26),
        right:Math.round(e.getBoundingClientRect().right),w:Math.round(e.getBoundingClientRect().width)}));
    const tw=document.querySelector('.tablewrap'), tb=document.querySelector('table.results');
    const cols=[...document.querySelectorAll('table.results thead th')].map((th,i)=>({
      i, txt:th.innerText.trim().slice(0,10), w:Math.round(th.getBoundingClientRect().width)}));
    return {viewport:W, wrapW:Math.round(document.querySelector('.wrap--wide').getBoundingClientRect().width),
      tablewrapW:Math.round(tw.getBoundingClientRect().width), tableW:Math.round(tb.getBoundingClientRect().width),
      tableScrollW:tb.scrollWidth, cols, overflowing:wide};
  },W),null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
