const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,500));
  console.log(JSON.stringify(await p.evaluate(()=>{
    const g=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();
      return {h:+r.height.toFixed(1), top:+r.top.toFixed(1), bottom:+r.bottom.toFixed(1), mid:+((r.top+r.bottom)/2).toFixed(1)};};
    return {navpill:g('.navpill'), langswitch:g('.langswitch'), brandImg:g('.brand img'),
            navlink:g('.topnav a.navlink'), langBtn:g('.langswitch button'), burger:g('.burger')};
  }),null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
