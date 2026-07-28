/* End-to-end checks for the pieces added in this pass:
   searcher zone link -> the right zone map, maps zone article -> help.html,
   news deep link + rail search, and EVERY page checked for sideways scroll at
   phone and breakpoint width.

   That last one earns its place: a horizontal overflow is invisible in a
   screenshot -- the shot is taken at the layout width, so the page looks fine
   while a real phone shows a scrollbar and half the chrome off-screen. It bit
   us once already (the news gallery pushed its grid column wide because a grid
   item defaults to min-width:auto). So it is a standing gate, not a one-off:
   this script exits non-zero when any page scrolls sideways, and names the
   element that starts it rather than just saying "true". */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const OUT=process.argv[2]||'/tmp';

const PAGES=['index.html','searcher.html','maps.html','help.html','news.html'];
// 390 = phone; 900 = the exact edge where every max-width:900px rule flips on
const WIDTHS=[390,900];

/* An element that overflows ITSELF is the source; every ancestor just inherits
   the width. Anything that scrolls on purpose is not a fault. */
function measureSideways(page){
  return page.evaluate(()=>{
    const de=document.documentElement;
    const over=de.scrollWidth-de.clientWidth;
    if(over<=2) return {over:0,source:[]};
    const source=[...document.querySelectorAll('body *')].filter(e=>{
      const cs=getComputedStyle(e);
      if(cs.overflowX==='auto'||cs.overflowX==='scroll') return false;
      if(cs.position==='fixed'||cs.position==='absolute') return false;
      return e.clientWidth>0 && e.scrollWidth>e.clientWidth+2;
    }).slice(0,6).map(e=>({tag:e.tagName.toLowerCase(),
      cls:String(e.className||'').slice(0,44),id:e.id||undefined,
      client:e.clientWidth,scroll:e.scrollWidth}));
    return {over,source};
  });
}
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${srv.address().port}`;
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const R={errors:[]};
  const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
  p.on('pageerror',e=>R.errors.push('searcher/maps: '+e.message));

  // 1. searcher -> maps
  await p.goto(base+'/searcher.html',{waitUntil:'networkidle0'}); await sleep(900);
  const href=await p.$eval('#rows a.i-zone',a=>a.getAttribute('href'));
  await p.click('#rows a.i-zone'); await sleep(1400);
  R.searcherToMap={href, landedOn:await p.$eval('#zoneName',e=>e.textContent),
                   hash:await p.evaluate(()=>location.hash)};

  // 2. maps zone article: cross-links leave for the help page
  R.zoneArticle=await p.evaluate(()=>{
    const a=document.querySelector('#zoneHelp .hart__body a.hlink');
    return {links:document.querySelectorAll('#zoneHelp a.hlink').length,
            sampleHref:a?a.getAttribute('href'):null,
            more:document.querySelector('.zonehelp__more')?.getAttribute('href')||null,
            title:document.querySelector('#zoneHelp h1')?.textContent||null};
  });

  // 3. news: deep link, rail search, mobile
  const n=await b.newPage(); await n.setViewport({width:1440,height:1000});
  n.on('pageerror',e=>R.errors.push('news: '+e.message));
  await n.goto(base+'/news.html#n1072504178',{waitUntil:'networkidle0'}); await sleep(900);
  R.newsDeepLink=await n.evaluate(()=>({
      subject:document.querySelector('.news-full__subject')?.textContent,
      date:document.querySelector('.news-full__date')?.textContent,
      yearOpen:document.querySelector('.news-mini[aria-current="true"]')?.closest('details')?.querySelector('.nyear__y')?.textContent,
      cards:document.querySelectorAll('.news-mini').length}));
  await n.type('#newsSearch','дракон'); await sleep(500);
  R.newsSearch=await n.evaluate(()=>({hits:document.querySelectorAll('.news-mini').length,
      years:document.querySelectorAll('details.nyear[open]').length}));
  await n.setViewport({width:390,height:844}); await sleep(500);
  await n.screenshot({path:OUT+'/news-mobile.png',fullPage:false});
  await n.close();

  // 4. sideways scroll: every page, phone and breakpoint width
  R.sideways={};
  const s=await b.newPage();
  s.on('pageerror',e=>R.errors.push('sideways: '+e.message));
  for(const w of WIDTHS){
    await s.setViewport({width:w,height:w<700?844:900,isMobile:w<700,hasTouch:w<700});
    for(const page of PAGES){
      await s.goto(base+'/'+page,{waitUntil:'networkidle0'}); await sleep(700);
      const m=await measureSideways(s);
      if(m.over>2) R.sideways[page+' @'+w]=m;
    }
  }
  const bad=Object.keys(R.sideways).length;
  R.sidewaysClean = bad===0;

  console.log(JSON.stringify(R,null,1));
  if(bad) console.error(`\nFAIL: ${bad} page/width combination(s) scroll sideways (see .sideways above).\n` +
    `Run  node overflow.js <page.html>  for a single page in detail.`);
  await b.close(); srv.close();
  process.exit(bad || R.errors.length ? 1 : 0);
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
