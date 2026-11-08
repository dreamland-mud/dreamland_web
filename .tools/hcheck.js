/* Heading-outline gate: one h1 per page, no skipped levels, visible headings only.
   Prints the outline + computed font-size/weight/line-height of every heading. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname,'../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';if(p.endsWith('/'))p+='index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
const PAGES=process.argv.slice(2).length?process.argv.slice(2):['index.html','help.html#h130','news.html','maps.html','searcher.html','leaderboard.html','about.html','design/','mapedit/'];
(async()=>{await new Promise(r=>srv.listen(0,r));const port=srv.address().port;
 const b=await puppeteer.launch({args:['--no-sandbox']});let bad=0;
 for(const pg of PAGES){const p=await b.newPage();await p.setViewport({width:1280,height:900});
  await p.goto(`http://localhost:${port}/${pg}`,{waitUntil:'networkidle0'}).catch(()=>{});await new Promise(r=>setTimeout(r,900));
  if(pg.startsWith('news')){await p.evaluate(()=>{const a=document.querySelector('.news-mini a, .news-mini');a&&a.click()});await new Promise(r=>setTimeout(r,600));}
  if(pg.startsWith('maps')){await p.evaluate(()=>{const z=document.querySelector('.zone');z&&z.click()});await new Promise(r=>setTimeout(r,1500));}
  const out=await p.evaluate(()=>[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h=>{const r=h.getClientRects().length;const cs=getComputedStyle(h);return (r&&cs.visibility!=='hidden')||h.classList.contains('sr-only')}).map(h=>{const cs=getComputedStyle(h);return {l:+h.tagName[1],t:h.textContent.trim().slice(0,38),fs:cs.fontSize,fw:cs.fontWeight,lh:cs.lineHeight,m:cs.margin}}));
  const errs=[];let prev=0;const h1=out.filter(h=>h.l===1).length;if(h1!==1)errs.push(h1+' h1');
  out.forEach(h=>{if(prev&&h.l>prev+1)errs.push('skip h'+prev+'->h'+h.l+' at "'+h.t+'"');if(!prev&&h.l!==1)errs.push('starts at h'+h.l);prev=h.l});
  console.log('== '+pg+(errs.length?'  FAIL: '+errs.join('; '):'  ok'));bad+=errs.length;
  out.forEach(h=>console.log('  '.repeat(h.l)+'h'+h.l+' '+h.t+'  ['+h.fs+' '+h.fw+' lh '+h.lh+' m '+h.m+']'));await p.close();}
 await b.close();srv.close();process.exit(bad?1:0);})();
