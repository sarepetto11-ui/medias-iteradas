/* Pure experiment logic: estimates receive a prefix; outcomes are separate. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.Predictive=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const names=['RW sin deriva','RW con deriva','Pendiente suavizada'];
 const finite=Number.isFinite;
 function freeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
   Object.values(value).forEach(freeze);Object.freeze(value);
  }
  return value;
 }
 function smooth(prices,n,boundary){
  let a=prices.slice();
  for(let k=0;k<n;k++){
   const b=new Array(a.length);
   b[0]=boundary==='fixed'?a[0]:NaN;
   for(let i=1;i<a.length;i++)b[i]=finite(a[i])&&finite(a[i-1])?(a[i]+a[i-1])/2:NaN;
   a=b;
  }
  return a;
 }
 function slope(points){
  const q=points.filter(p=>finite(p.y)).slice(-15);
  if(q.length<3)return null;
  const mx=q.reduce((a,p)=>a+p.x,0)/q.length,my=q.reduce((a,p)=>a+p.y,0)/q.length;
  const den=q.reduce((a,p)=>a+(p.x-mx)**2,0);
  return den>0?q.reduce((a,p)=>a+(p.x-mx)*(p.y-my),0)/den:null;
 }
 function validateParams(n,H,boundary){
  if(!Number.isInteger(n)||n<0||n>600||!Number.isInteger(H)||H<1||H>390||!['fixed','missing'].includes(boundary))throw Error('Parámetros inválidos');
 }
 function issue(history,{symbol,n,H,boundary}){
  validateParams(n,H,boundary);
  if(!history.length||history.some(r=>!finite(r.close)))throw Error('Historia vacía o inválida');
  const t=history.length-1,p=history.map(r=>r.close),filtered=smooth(p,n,boundary);
  const beta=slope(filtered.map((y,i)=>({x:i-n/2,y})));
  const drift=t>0?(p[t]-p[0])/t:null;
  const slopes=[0,drift,beta];
  const forecast={symbol,t,timestamp:history[t].timestamp,n,H,boundary,
   history_start:history[0].timestamp,history_count:history.length,origin:p[t],
   slopes,projections:slopes.map(s=>s===null?null:Array.from({length:H+1},(_,h)=>p[t]+s*h))};
  // Forecast object and every value inside it are immutable. Evaluation is separate.
  return freeze(forecast);
 }
 function referenceAt(filtered,n,x){
  const u=x+n/2,lo=Math.floor(u),hi=Math.ceil(u);
  if(lo<0||hi>=filtered.length||!finite(filtered[lo])||!finite(filtered[hi]))return null;
  return lo===hi?filtered[lo]:(filtered[lo]+filtered[hi])/2;
 }
 function evaluate(forecast,observed){
  const {t,n,H,boundary}=forecast;
  const requiredThrough=Math.ceil(t+H+n/2);
  if(observed.length<=requiredThrough)return {status:'pending',requiredThrough,availableThrough:observed.length-1};
  const filtered=smooth(observed.slice(0,requiredThrough+1).map(r=>r.close),n,boundary);
  const realized=Array.from({length:H+1},(_,h)=>referenceAt(filtered,n,t+h));
  if(realized.some(v=>v===null))return {status:'not_evaluable',reason:'Sin historial suficiente para el borde elegido',requiredThrough};
  if(forecast.slopes.some(s=>s===null))return {status:'not_evaluable',reason:'Una pendiente no está definida; no se comparan ventanas distintas',requiredThrough};
  const beta=(realized[H]-realized[0])/H;
  const metrics=forecast.slopes.map((s,j)=>{
   const errors=realized.slice(1).map((v,i)=>forecast.projections[j][i+1]-v);
   return {slopeError:s-beta,absSlopeError:Math.abs(s-beta),
    direction:Math.sign(s)===Math.sign(beta),
    mae:errors.reduce((sum,e)=>sum+Math.abs(e),0)/H,
    rmse:Math.sqrt(errors.reduce((sum,e)=>sum+e*e,0)/H),count:H};
  });
  return {status:'evaluated',requiredThrough,realized,beta,metrics};
 }
 function aggregate(forecasts,observed){
  let pending=0,invalid=0;const accepted=[];
  for(const forecast of forecasts){
   const result=evaluate(forecast,observed);
   if(result.status==='pending')pending++;
   else if(result.status==='not_evaluable')invalid++;
   else accepted.push(result);
  }
  const count=accepted.length;
  const metrics=names.map((name,j)=>{
   if(!count)return {name,count,absSlopeError:null,direction:null,mae:null,rmse:null};
   const mean=key=>accepted.reduce((sum,e)=>sum+e.metrics[j][key],0)/count;
   return {name,count,absSlopeError:mean('absSlopeError'),direction:mean('direction'),mae:mean('mae'),
    rmse:Math.sqrt(accepted.reduce((sum,e)=>sum+e.metrics[j].rmse**2,0)/count)};
  });
  return {count,pending,invalid,total:forecasts.length,metrics};
 }
 // Records are scoped to one dataset. Replacing its future never overwrites an
 // existing issuance at the same origin and parameters. Reset only on new data.
 class Ledger{
  constructor(){this.records=new Map();}
  get(history,params){
   const key=JSON.stringify([params.symbol,history.length-1,params.n,params.H,params.boundary]);
   if(!this.records.has(key))this.records.set(key,issue(history,params));
   return this.records.get(key);
  }
  values(){return [...this.records.values()];}
 }
 function replay(rows,start,params,ledger=new Ledger()){
  return rows.slice(start).map((_,i)=>ledger.get(rows.slice(0,start+i+1),params));
 }
 function grid(rows,start,ns,horizons,boundary,symbol){
  return ns.flatMap(n=>horizons.map(H=>({n,H,...aggregate(replay(rows,start,{n,H,boundary,symbol}),rows)})));
 }
 return {names,smooth,slope,issue,referenceAt,evaluate,aggregate,Ledger,replay,grid};
});
