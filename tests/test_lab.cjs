const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('laboratorio_promedios_definido.html','utf8');
const code=html.slice(html.lastIndexOf('<script>')+8,html.indexOf('</script>',html.lastIndexOf('<script>'))).replace('const retrospectiveReady=loadMarketData();','');
const els={};for(const id of ['symbol','n','h','boundary','nv','hv','metrics','file','status'])els['#'+id]={value:({symbol:'AAPL',n:25,h:30,boundary:'fixed'})[id],replaceChildren(){}};
const plots={};
const context={document:{querySelector:s=>els[s]},Option:function(t,v){this.value=v},Plotly:{react:(id,traces)=>{plots[id]=traces}},console};
vm.createContext(context);vm.runInContext(code,context);
vm.runInContext(`series.AAPL=Array.from({length:390},(_,i)=>({t:new Date(1700000000000+i*60000).toISOString(),y:100+i*.2+Math.sin(i)}));series.GGAL=series.AAPL.map(r=>({...r,y:r.y/5}));`,context);
function run(s){return vm.runInContext(s,context)}
assert.equal(run("smooth([2,4,8],1,'fixed').join(',')"),'2,3,6');
assert(run("Number.isNaN(smooth([2,4,8],1,'missing')[0])"));
for(const boundary of ['fixed','missing'])for(const n of [0,1,25,26,389,600]){
 els['#n'].value=n;els['#boundary'].value=boundary;run('draw()');
 assert.deepEqual(Object.keys(plots).sort(),['causal','centered','projection']);
 const proj=plots.projection.find(t=>t.name==='Proyección lineal');
 const rw=plots.projection.find(t=>t.name==='RW sin drift / persistencia');
 if(proj){assert.equal(proj.x[0],389-n/2);assert.equal(proj.y[0],rw.y[0]);assert.deepEqual(proj.x,rw.x);assert(proj.x.slice(1).every(x=>x>proj.x[0]));assert.equal(proj.x.length,new Set(proj.x).size);}
}
els['#n'].value=25;els['#boundary'].value='fixed';run('draw()');const original=plots.causal[0].y[0];els['#symbol'].value='GGAL';run('draw()');assert.equal(plots.causal[0].y[0],original/5);
assert(els['#metrics'].innerHTML.includes('look-ahead declarado'));
console.log('PASS: recurrence, boundaries, iterations 0–600, three panels, anchor alignment, identical evaluation indices, asset switching');
assert.equal(run('estimateDrift([10,12,14,500],2.5)'),2);
assert(run('Number.isNaN(estimateDrift([10,12],0.5))'));
assert.equal(run("winners([{name:'a',mae:1},{name:'b',mae:1},{name:'c',mae:2}],'mae')"),'a / b');
for(const symbol of ['AAPL','GGAL'])for(const boundary of ['fixed','missing'])for(const n of [0,1,25,26,389,600]){
 els['#symbol'].value=symbol;els['#n'].value=n;els['#boundary'].value=boundary;run('draw()');
 const drift=plots.projection.find(t=>t.name==='RW con deriva');
 const rw=plots.projection.find(t=>t.name==='RW sin drift / persistencia');
 const projection=plots.projection.find(t=>t.name==='Proyección lineal');
 if(drift){
  assert.deepEqual(drift.x,rw.x);assert.deepEqual(drift.x,projection.x);
  assert.equal(drift.y[0],rw.y[0]);assert.equal(drift.y[0],projection.y[0]);
  const prices=plots.causal[0].y,end=Math.floor(drift.x[0]);
  const mu=(prices[end]-prices[0])/end;
  drift.x.forEach((x,i)=>assert(Math.abs(drift.y[i]-(rw.y[0]+mu*(x-drift.x[0])))<1e-9));
  const actual=plots.projection.find(t=>t.name==='Serie real posterior').y;
  const error=actual.reduce((sum,y,i)=>sum+Math.abs(y-drift.y[i+1]),0)/actual.length;
  if(actual.length)assert(els['#metrics'].innerHTML.includes(error.toFixed(4)));
 }
 assert(els['#metrics'].innerHTML.includes('RW con deriva'));
}
console.log('PASS: drift estimation excludes later closes; shared anchors and samples; table drift MAE; tie handling; both assets and borders');

assert(!html.includes('id="randomwalk"'));
assert(html.indexOf('id="centered"')<html.indexOf('id="parameters"'));
assert(html.indexOf('id="parameters"')<html.indexOf('id="projection"'));
for(const id of ["n","h","boundary"])assert.equal((html.match(new RegExp(`id="${id}"`,"g"))||[]).length,1);
console.log("PASS: exactly three charts; single parameter controls between charts 2 and 3");
