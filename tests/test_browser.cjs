'use strict';
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(req.url.split('?')[0]).slice(1),allowed=['laboratorio_promedios_definido.html','market_data.json','predictive_engine.js','predictive_ui.js'];
  if(!allowed.includes(name)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(path.join(root,name)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  for(const url of [`http://127.0.0.1:${server.address().port}/laboratorio_promedios_definido.html`,'file://'+path.join(root,'laboratorio_listo.html')]){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.waitForFunction(()=>document.getElementById('pred-data-status').textContent.includes('cierres,')&&document.getElementById('causal').data);
   assert.equal(await page.locator('#retrospective-lab .chart').count(),3);
   await page.selectOption('#lab-mode','predictive');
   assert.equal(await page.locator('#retrospective-lab').isVisible(),false);
   const initial=await page.evaluate(()=>{
    const traces=document.getElementById('pred-chart').data;
    return {names:traces.map(t=>t.name),lastHistory:traces[0].x.at(-1),orig:traces[1].y[0],projections:traces.slice(2).map(t=>({x:t.x[0],y:t.y[0]})),origin:+document.getElementById('pred-origin').value};
   });
   assert(!initial.names.some(n=>/futuros|realizado/.test(n)));
   assert.equal(initial.lastHistory,initial.origin);assert.equal(initial.projections.length,3);
   initial.projections.forEach(p=>{assert.equal(p.x,initial.origin);assert.equal(p.y,initial.orig);});
   await page.selectOption('#pred-view','evaluation');
   await page.waitForFunction(()=>document.getElementById('pred-current-metrics').textContent.includes('Pendiente realizada'));
   await page.locator('#pred-show-prices').uncheck();
   assert(!(await page.evaluate(()=>document.getElementById('pred-chart').data.map(t=>t.name))).includes('Cierres futuros realizados'));
   await page.locator('#pred-show-reference').uncheck();
   assert(!(await page.evaluate(()=>document.getElementById('pred-chart').data.map(t=>t.name))).includes('Suavizado realizado (solo evaluación)'));
   await page.click('#pred-replay');
   await page.waitForFunction(()=>document.getElementById('pred-aggregate-status').textContent.includes('evaluados,'),{timeout:30000});
   const summary=await page.locator('#pred-aggregate-status').textContent();assert(summary.includes('pendientes'));
   const downloadPromise=page.waitForEvent('download');await page.click('#pred-export');const download=await downloadPromise;
   const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert(exported.forecasts.length>=390);
   const issued=exported.forecasts.find(f=>f.t===initial.origin&&f.symbol==='AAPL');assert(issued);assert.equal(issued.origin,initial.orig);
   await page.evaluate(()=>{const c=document.getElementById('pred-origin');c.value=c.max;c.dispatchEvent(new Event('input'));});
   assert((await page.locator('#pred-current-metrics').textContent()).includes('Pendiente:'));
   await page.selectOption('#pred-view','forecast');
   assert.equal(await page.locator('#pred-evaluation').isVisible(),false);
   assert.equal((await page.evaluate(()=>document.getElementById('pred-slopes').data.length)),1);
   await page.selectOption('#pred-symbol','GGAL');
   assert((await page.locator('#pred-data-status').textContent()).includes('minutos faltantes'));
   await page.evaluate(()=>{for(const [id,value] of [['pred-n',600],['pred-boundary','missing']]){const c=document.getElementById(id);c.value=value;c.dispatchEvent(new Event('input'));}});
   assert.equal(await page.evaluate(()=>document.getElementById('pred-chart').data.some(t=>t.name==='Pendiente suavizada')),false);
   await page.selectOption('#pred-view','evaluation');
   assert((await page.locator('#pred-current-metrics').textContent()).includes('Pendiente:'));
   await page.selectOption('#lab-mode','retrospective');
   assert.equal(await page.locator('#retrospective-lab').isVisible(),true);
   await page.selectOption('#symbol','GGAL');
   assert.equal(await page.evaluate(()=>document.getElementById('projection').data.filter(t=>/RW|Proyección lineal/.test(t.name)).length),3);
   assert.deepEqual(errors,[]);console.log('PASS browser:',url.startsWith('file:')?'portable file':'HTTP application',summary);
   await page.close();
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1)});
