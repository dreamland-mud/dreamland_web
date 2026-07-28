const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');const OUT=process.argv[2];const ZONE=process.argv[3]||'moria';
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{fs.mkdirSync(OUT,{recursive:true});await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
 const p=await b.newPage();await p.setViewport({width:1440,height:1000});
 await p.goto(`http://127.0.0.1:${srv.address().port}/maps.html#${ZONE}`,{waitUntil:'networkidle0'});await sleep(1200);
 for(let i=0;i<4;i++){await p.click('#zoomIn');await sleep(180);}
 await sleep(400);
 const r=await p.evaluate(()=>{const svg=document.getElementById('mapSvg');
   const vis=[...document.querySelectorAll('#mapSvg .lbl')].filter(e=>e.getBoundingClientRect().width>0).length;
   return {far:svg.classList.contains('far'), labelsVisible:vis,
     sample:[...document.querySelectorAll('#mapSvg .lbl')].slice(0,3).map(e=>[...e.querySelectorAll('tspan')].map(t=>t.textContent).join(' '))};});
 console.log(JSON.stringify(r,null,1));
 await p.screenshot({path:OUT+'/zoomed.png'});
 await b.close();srv.close();})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
