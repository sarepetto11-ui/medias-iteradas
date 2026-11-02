'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../predictive_engine.js');
function rows(N,fn=i=>100+2*i){return Array.from({length:N},(_,i)=>({timestamp:new Date(1700000000000+i*60000).toISOString(),close:fn(i)}));}
const params={symbol:'AAPL',n:3,H:5,boundary:'fixed'};
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('estimates use only prefix, even if later prices change radically',()=>{
 const original=rows(50,i=>100+Math.sin(i)+i/10);
 const changed=original.map((r,i)=>i>20?{...r,close:1e8*i}:r);
 for(const n of [0,1,25,600])for(const boundary of ['fixed','missing']){
  assert.deepEqual(E.issue(original.slice(0,21),{...params,n,boundary}),E.issue(changed.slice(0,21),{...params,n,boundary}));
 }
});
test('all projections start at the observed close, not compensated endpoint',()=>{
 const data=rows(50,i=>100+i*i);
 const f=E.issue(data.slice(0,31),params);
 f.projections.forEach(p=>assert.equal(p[0],data[30].close));
 near(f.slopes[1],(data[30].close-data[0].close)/30);
 const filt=E.smooth(data.slice(0,31).map(r=>r.close),3,'fixed');
 const q=filt.slice(-15);const xs=q.map((_,i)=>30-14+i-1.5),mx=xs.reduce((a,b)=>a+b)/15,my=q.reduce((a,b)=>a+b)/15;
 near(f.slopes[2],xs.reduce((s,x,i)=>s+(x-mx)*(q[i]-my),0)/xs.reduce((s,x)=>s+(x-mx)**2,0));
});
test('issued forecasts deeply frozen and unchanged by evaluation/replay/appended data',()=>{
 const data=rows(40),ledger=new E.Ledger(),f=ledger.get(data.slice(0,21),params),snapshot=JSON.stringify(f);
 assert.throws(()=>{f.slopes[1]=100;},TypeError);
 assert.throws(()=>{f.projections[0][0]=100;},TypeError);
 E.evaluate(f,data);E.replay(rows(60),20,params,ledger);
 assert.equal(JSON.stringify(f),snapshot);assert.equal(ledger.get(data.slice(0,21),params),f);
 const altered=data.slice(0,21).map(r=>({...r,close:999}));assert.equal(ledger.get(altered,params),f);
});
test('odd n requires the later neighbor of the last compensated evaluation point',()=>{
 const data=rows(50),f=E.issue(data.slice(0,11),params);
 assert.equal(E.evaluate(f,data.slice(0,17)).status,'pending'); // requires t+H+1.5 => ceil(16.5)=17
 const result=E.evaluate(f,data.slice(0,18));assert.equal(result.status,'evaluated');assert.equal(result.requiredThrough,17);
 near(result.beta,2);near(result.realized[0],data[10].close);near(result.realized[5],data[15].close);
});
test('half-coordinate reference interpolates filtered values only',()=>{
 const prices=[1,4,2,8,3,9,5,10,6,12],filtered=E.smooth(prices,3,'fixed');
 near(E.referenceAt(filtered,3,3),(filtered[4]+filtered[5])/2);
 const f=E.issue(rows(10).slice(0,5),{...params,H:2,n:2});
 assert.equal(E.evaluate(f,rows(7)).status,'pending');
 assert.equal(E.evaluate(f,rows(8)).status,'evaluated');
});
test('slope and trajectory metrics verified analytically on a linear series',()=>{
 const data=rows(80),f=E.issue(data.slice(0,21),params),r=E.evaluate(f,data);
 near(r.beta,2);near(r.metrics[0].slopeError,-2);near(r.metrics[0].absSlopeError,2);
 near(r.metrics[0].mae,6);near(r.metrics[0].rmse,Math.sqrt(44));
 near(r.metrics[1].mae,0);near(r.metrics[2].rmse,0);
 assert.deepEqual(r.metrics.map(m=>m.count),[5,5,5]);
 assert.equal(r.metrics[0].direction,false);assert.equal(r.metrics[1].direction,true);
});
test('zero direction matches zero exactly; unavailable slope remains NA',()=>{
 const data=rows(50,()=>100),f=E.issue(data.slice(0,21),params);
 assert(E.evaluate(f,data).metrics.every(m=>m.direction));
 const short=E.issue(data.slice(0,2),{...params,n:25,boundary:'missing'});
 assert.equal(short.slopes[2],null);assert.equal(short.projections[2],null);
 assert.equal(E.evaluate(short,rows(100)).status,'not_evaluable');
});
test('all three methods use identical full windows; pending and NA excluded',()=>{
 const data=rows(60),forecasts=E.replay(data,30,params),summary=E.aggregate(forecasts,data);
 assert.equal(summary.total,30);assert.equal(summary.count,23);assert.equal(summary.pending,7);
 assert(summary.metrics.every(m=>m.count===23));
 const snapshot=JSON.stringify(forecasts[0]);
 E.aggregate(forecasts,rows(80));assert.equal(JSON.stringify(forecasts[0]),snapshot);
});
test('gaps and session boundary do not create artificial price points',()=>{
 const data=rows(60);data[30].timestamp='2023-11-17T14:30:00-05:00';
 const f=E.issue(data.slice(0,31),params);
 assert.equal(f.history_count,31);assert.equal(f.t,30);assert.equal(f.timestamp,data[30].timestamp);
 assert.equal(f.projections[0].length,6); // 5 observations, independent of elapsed minutes or overnight gap
});
test('matrix E(n,H) handles several scales and horizons without optimization',()=>{
 const result=E.grid(rows(60),30,[0,3],[2,5],'fixed','AAPL');
 assert.deepEqual(result.map(r=>[r.n,r.H]),[[0,2],[0,5],[3,2],[3,5]]);
 assert(result.every(r=>r.metrics.every(m=>m.count===r.count)));
});
test('evaluation ignores prices beyond the exact required information date',()=>{
 const f=E.issue(rows(30).slice(0,11),params),data=rows(50),r=E.evaluate(f,data);
 const changed=data.map((p,i)=>i>r.requiredThrough?{...p,close:999999}:p);
 assert.deepEqual(E.evaluate(f,changed),r);
});
