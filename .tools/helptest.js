const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1100});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const base=`http://127.0.0.1:${srv.address().port}/help.html`;
  await p.goto(base,{waitUntil:'networkidle0'}); await new Promise(r=>setTimeout(r,900));

  // 1. the compass article: does the diagram survive as <pre> while prose reflows?
  await p.goto(base+'#h1022',{waitUntil:'networkidle0'}); await new Promise(r=>setTimeout(r,700));
  const art=await p.evaluate(()=>{
    const a=document.querySelector('.hart'); if(!a) return null;
    return {title:a.querySelector('h1').innerText.trim(),
      paras:a.querySelectorAll('.hart__body p').length,
      pres:a.querySelectorAll('.hart__body pre').length,
      preText:(a.querySelector('.hart__body pre')||{innerText:''}).innerText.split('\n').slice(0,4),
      links:a.querySelectorAll('a.hlink').length,
      colours:new Set([...a.querySelectorAll('[class^=c-]')].map(e=>e.className)).size};
  });
  await (await p.$('.hart')).screenshot({path:process.argv[2]+'/help-article.png'});

  // 2. cross-link navigation
  const before=await p.$eval('.hart h1',e=>e.innerText);
  const hl=await p.$('a.hlink');
  let after=before;
  if(hl){ await hl.click(); await new Promise(r=>setTimeout(r,600)); after=await p.$eval('.hart h1',e=>e.innerText); }

  // 3. search
  await p.click('#helpSearch'); await p.type('#helpSearch','sanctuary');
  await new Promise(r=>setTimeout(r,500));
  const hits=await p.$$eval('#helpResults a',n=>n.slice(0,3).map(a=>a.innerText.split('\n')[0]));

  console.log(JSON.stringify({article:art, crossLink:{before,after,worked:before!==after}, searchHits:hits, errors:errs},null,1));
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
