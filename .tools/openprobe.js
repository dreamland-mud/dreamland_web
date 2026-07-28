const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname, '../static');
const MIME={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
  fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.statusCode=404;return r.end('nf')}r.setHeader('Content-Type',MIME[path.extname(p)]||'text/plain');r.end(d)})});
(async()=>{
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
  const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
  for (const z of process.argv.slice(2)) {
    await p.goto('about:blank');
    await p.goto(`http://127.0.0.1:${srv.address().port}/maps.html#${z}`,{waitUntil:'networkidle0'});
    await new Promise(r=>setTimeout(r,600));
    const o=await p.evaluate(()=>{
      const st=document.getElementById('mapStage').getBoundingClientRect();
      const rooms=[...document.querySelectorAll('.room')];
      let vis=0;
      rooms.forEach(r=>{const b=r.getBoundingClientRect();
        if(b.right>st.left&&b.left<st.right&&b.bottom>st.top&&b.top<st.bottom) vis++;});
      const m=/scale\(([\d.]+)\)/.exec(document.getElementById('mapPan').getAttribute('transform'))||[];
      return {name:document.getElementById('zoneName').textContent,
              rooms:rooms.length, visible:vis, scale:+m[1]};
    });
    console.log(z.padEnd(12), JSON.stringify(o));
  }
  await b.close(); srv.close();
})().catch(e=>{console.error('ERR',e.message);srv.close();process.exit(1)});
