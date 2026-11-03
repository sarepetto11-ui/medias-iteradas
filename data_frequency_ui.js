/* Dataset tabs only: original prices and the mathematical filters are unchanged. */
(function(){
 'use strict';
 const q=id=>document.getElementById(id),cache={};let data=null;
 window.labFrequency='intraday';
 function snapshot(){
  const values={},meta={};
  for(const key of Object.keys(series)){values[key]=series[key];if(metadata[key])meta[key]=metadata[key];}
  return {values,meta};
 }
 function apply(frequency){
  if(!data||frequency===window.labFrequency)return;
  cache[window.labFrequency]=snapshot();
  window.labFrequency=frequency;
  if(!cache[frequency]){
   const instruments=frequency==='daily'?data.daily.instruments:data.instruments;
   cache[frequency]={values:{},meta:{}};
   for(const symbol of ['AAPL','GGAL']){
    const item=instruments[symbol];cache[frequency].values[symbol]=item.observations.map(r=>({t:r.timestamp,y:r.close}));cache[frequency].meta[symbol]=item;
   }
  }
  for(const key of Object.keys(series))delete series[key];
  for(const key of Object.keys(metadata))delete metadata[key];
  Object.assign(series,cache[frequency].values);Object.assign(metadata,cache[frequency].meta);
  refreshOptions();draw();
  const daily=frequency==='daily';
  q('tab-daily').setAttribute('aria-selected',String(daily));q('tab-intraday').setAttribute('aria-selected',String(!daily));
  q('tab-daily').tabIndex=daily?0:-1;q('tab-intraday').tabIndex=daily?-1:0;
  q('frequency-content').setAttribute('aria-labelledby',daily?'tab-daily':'tab-intraday');
  q('frequency-status').textContent=daily?
   'Diarios: un año calendario hacia atrás desde el último cierre completo disponible de cada activo. Cada paso es una sesión observada; no se rellenan sesiones faltantes.':
   'Intradiarios: cierres por minuto de dos sesiones consecutivas; cada paso es una observación disponible, no necesariamente un minuto exacto.';
  window.dispatchEvent(new Event('lab-frequency-change'));
 }
 q('tab-intraday').onclick=()=>apply('intraday');q('tab-daily').onclick=()=>apply('daily');
 for(const id of ['tab-intraday','tab-daily'])q(id).onkeydown=e=>{
  if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
   e.preventDefault();const target=(e.key==='Home'||(e.key==='ArrowLeft'&&id==='tab-daily'))?'tab-intraday':'tab-daily';
   if(!q(target).disabled){q(target).focus();q(target).click();}
  }
 };
 async function init(){
  try{
   await retrospectiveReady;
   data=window.MARKET_DATA;
   if(!data){const response=await fetch('market_data.json',{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);data=await response.json();}
   if(!data.daily)throw Error('Actualizá los datos para incluir un año de cierres diarios');
   for(const symbol of ['AAPL','GGAL']){
    const item=data.daily.instruments[symbol];
    if(!item||item.observations.length<3||item.observations.length!==item.count||item.observations.some((r,i)=>!Number.isFinite(r.close)||!Number.isFinite(Date.parse(r.timestamp))||(i&&Date.parse(r.timestamp)<=Date.parse(item.observations[i-1].timestamp))))throw Error('Serie diaria inválida: '+symbol);
   }
   q('tab-daily').disabled=false;
  }catch(error){q('frequency-status').textContent+=' · Datos diarios no disponibles: '+error.message;}
 }
 init();
})();
