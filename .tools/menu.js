// Mobile hamburger smoke test: does the menu open, and does it hold nav + lang?
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:390,height:844});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`,{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,500));
  const vis=s=>p.$eval(s,e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});
  const closed={lang:await vis('.langswitch'),nav:await vis('.topnav'),burger:await vis('.burger')};
  await p.click('.burger'); await new Promise(r=>setTimeout(r,400));
  const open={lang:await vis('.langswitch'),nav:await vis('.topnav'),
              langInPill:await p.$eval('.langswitch',e=>!!e.closest('#navpill')),
              links:await p.$$eval('.topnav a.navlink',n=>n.filter(e=>e.offsetParent!==null).length)};
  await p.screenshot({path:process.argv[2]+'/menu-open.png',clip:{x:0,y:0,width:390,height:420}});
  // desktop: switch must hop back out of the pill
  await p.setViewport({width:1440,height:900}); await new Promise(r=>setTimeout(r,400));
  const desk={langInPill:await p.$eval('.langswitch',e=>!!e.closest('#navpill')),lang:await vis('.langswitch')};
  console.log(JSON.stringify({closed,open,desktop:desk,errors:errs}));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
