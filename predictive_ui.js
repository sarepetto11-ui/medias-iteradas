(function(){
 'use strict';
 const E=window.Predictive,q=id=>document.getElementById(id);
 const ledger=new E.Ledger();let payload=null,token=0,lastReplay=null;
 const colors=['#f4c542','#7ca6ff','#ec81d2'];
 const fmt=v=>Number.isFinite(v)?v.toFixed(6):'NA';
 const layout=title=>({paper_bgcolor:'#161c25',plot_bgcolor:'#161c25',font:{color:'#c5cedb'},
  margin:{l:65,r:20,t:60,b:55},title:{text:title,font:{size:14}},
  xaxis:{title:{text:'Índice de observación (no minutos físicos)'},gridcolor:'#283140'},
  yaxis:{gridcolor:'#283140'},legend:{orientation:'h',y:1.17}});
 const opts={responsive:true,displaylogo:false};
 function state(){
  const symbol=q('pred-symbol').value,item=payload.predictive.instruments[symbol];
  return {symbol,item,rows:item.observations,t:+q('pred-origin').value,
   params:{symbol,n:+q('pred-n').value,H:+q('pred-h').value,boundary:q('pred-boundary').value},
   evaluation:q('pred-view').value==='evaluation'};
 }
 function table(headers,rows){
  return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>'+headers.map(h=>'<th style="padding:8px">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td style="padding:8px;border-top:1px solid #303847">'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 }
 function currentTable(f,result){
  if(result.status!=='evaluated'){
   const message=result.status==='pending'?`Pendiente: requiere observación ${result.requiredThrough}; hay datos hasta ${result.availableThrough}.`:`No evaluable: ${result.reason}.`;
   return '<p>'+message+'</p>'+table(['Método','Pendiente estimada'],E.names.map((n,j)=>[n,fmt(f.slopes[j])]));
  }
  return `<p>Pendiente realizada: ${fmt(result.beta)} · misma ventana de ${f.H} observaciones para los tres métodos.</p>`+
   table(['Método','Pendiente estimada','Error pendiente','|Error pendiente|','Dirección','MAE trayectoria','RMSE trayectoria'],E.names.map((name,j)=>{
    const m=result.metrics[j];return [name,fmt(f.slopes[j]),fmt(m.slopeError),fmt(m.absSlopeError),m.direction?'Acierto':'No acierto',fmt(m.mae),fmt(m.rmse)];
   }));
 }
 function ledgerStatus(){q('pred-ledger-status').textContent=`${ledger.values().length} pronósticos guardados en esta apertura. Se conservan sus parámetros y valores originales; descargá el registro para mantenerlo al cerrar el archivo.`;}
 function render(){
  if(!payload)return;
  token++;lastReplay=null;q('pred-replay').disabled=false;
  q('pred-aggregate-metrics').innerHTML='';
  q('pred-aggregate-status').textContent='Evaluá la reproducción para calcular promedios de todos los orígenes con n y H actuales.';
  const {rows,item,t,params,evaluation}=state(),f=ledger.get(rows.slice(0,t+1),params);
  q('pred-n-value').textContent=params.n;q('pred-h-value').textContent=params.H;
  q('pred-time').textContent=rows[t].timestamp;
  q('pred-origin-status').textContent=`Origen t=${t}, Pₜ=${fmt(f.origin)} · historia: ${f.history_count} cierres desde ${f.history_start} · horizonte ${params.H} observaciones. ${evaluation?'Evaluación posterior: se revelan resultados; no se modifica el pronóstico.':'Pronóstico: ningún precio posterior se muestra ni se usa para estimar.'}`;
  q('pred-reveal-controls').hidden=!evaluation;q('pred-evaluation').hidden=!evaluation;
  const trace=(x,y,name,color,dash='solid')=>({x,y,name,type:'scatter',mode:'lines',line:{color,width:2,dash}});
  const hist=rows.slice(0,t+1);
  const traces=[{...trace(hist.map((_,i)=>i),hist.map(r=>r.close),'Historia conocida','#cdd5e1'),
   customdata:hist.map(r=>r.timestamp),hovertemplate:'%{customdata}<br>%{y}<extra></extra>'},
   {x:[t],y:[f.origin],name:'Origen Pₜ',mode:'markers',marker:{size:10,color:'#fff'},type:'scatter'}];
  f.projections.forEach((values,j)=>{if(values)traces.push(trace(values.map((_,h)=>t+h),values,E.names[j],colors[j],'dash'));});
  let result=null;
  if(evaluation){
   result=E.evaluate(f,rows);
   if(q('pred-show-prices').checked){
    const future=rows.slice(t+1);
    traces.push({...trace(future.map((_,i)=>t+i+1),future.map(r=>r.close),'Cierres futuros realizados','#9bd46b'),
     customdata:future.map(r=>r.timestamp),hovertemplate:'%{customdata}<br>%{y}<extra></extra>'});
   }
   if(q('pred-show-reference').checked){
    const filtered=E.smooth(rows.map(r=>r.close),params.n,params.boundary);
    const points=filtered.map((y,i)=>({x:i-params.n/2,y})).filter(p=>Number.isFinite(p.y));
    traces.push(trace(points.map(p=>p.x),points.map(p=>p.y),'Suavizado realizado (solo evaluación)','#4dd0cf'));
   }
   q('pred-current-metrics').innerHTML=currentTable(f,result);
  }else q('pred-current-metrics').innerHTML='';
  const lay=layout(evaluation?'Evaluación posterior':'Pronóstico usando solo historia hasta t');
  lay.shapes=[{type:'line',x0:t,x1:t,y0:0,y1:1,yref:'paper',line:{color:'#fff',dash:'dot'}},
   {type:'line',x0:item.second_session_start,x1:item.second_session_start,y0:0,y1:1,yref:'paper',line:{color:'#8394a8',dash:'dash'}}];
  lay.annotations=[{x:item.second_session_start,y:1,yref:'paper',text:'Inicio sesión 2',showarrow:false}];
  Plotly.react('pred-chart',traces,lay,opts);
  const bars=[{x:E.names,y:f.slopes,type:'bar',name:'Estimadas en t',marker:{color:colors}}];
  if(result&&result.status==='evaluated')bars.push({x:['Realizada'],y:[result.beta],type:'bar',name:'Realizada después',marker:{color:'#4dd0cf'}});
  const sl=layout('Pendientes: precio por observación');sl.xaxis={};
  Plotly.react('pred-slopes',bars,sl,opts);ledgerStatus();
 }
 function configure(){
  if(!payload)return;
  const symbol=q('pred-symbol').value,item=payload.predictive.instruments[symbol];
  q('pred-origin').min=item.second_session_start;q('pred-origin').max=item.observations.length-1;
  q('pred-origin').value=item.second_session_start;
  q('pred-data-status').textContent=symbol+' · '+item.sessions.map(s=>`${s.session}: ${s.count}/${s.expected_count} cierres, ${s.missing_count} minutos faltantes`).join(' | ')+' · timestamps America/New_York. Sin rellenar precios.';
  render();
 }
 q('lab-mode').onchange=()=>{
  const predictive=q('lab-mode').value==='predictive';
  q('retrospective-lab').hidden=predictive;q('predictive-lab').hidden=!predictive;
  if(predictive)render();else window.dispatchEvent(new Event('resize'));
 };
 q('pred-symbol').onchange=configure;
 for(const id of ['pred-origin','pred-n','pred-h','pred-boundary','pred-view','pred-show-prices','pred-show-reference'])q(id).oninput=render;
 q('pred-replay').onclick=()=>{
  if(!payload||!state().evaluation)return;
  const captured=state(),id=++token;
  q('pred-replay').disabled=true;q('pred-aggregate-status').textContent='Reproduciendo cronológicamente los orígenes de la sesión 2…';
  setTimeout(()=>{
   if(id!==token)return;
   try{
    const records=E.replay(captured.rows,captured.item.second_session_start,captured.params,ledger);
    const summary=E.aggregate(records,captured.rows);lastReplay=summary;
    q('pred-aggregate-status').textContent=`n=${captured.params.n}, H=${captured.params.H} · ${summary.total} orígenes: ${summary.count} evaluados, ${summary.pending} pendientes, ${summary.invalid} no evaluables. Mismas ventanas para los tres.`;
    q('pred-aggregate-metrics').innerHTML=table(['Método','Ventanas','Promedio |error pendiente|','Acierto dirección','MAE trayectoria','RMSE trayectoria'],summary.metrics.map(m=>[m.name,m.count,fmt(m.absSlopeError),m.direction===null?'NA':(100*m.direction).toFixed(1)+'%',fmt(m.mae),fmt(m.rmse)]));
    ledgerStatus();
   }catch(error){q('pred-aggregate-status').textContent='No se pudo evaluar: '+error.message;}
   finally{q('pred-replay').disabled=false;}
  },20);
 };
 q('pred-export').onclick=()=>{
  if(!payload)return;
  const data={dataset_generated_at:payload.generated_at,sessions:payload.predictive.session_dates,
   unit:'observations, not physical minutes',forecasts:ledger.values()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='pronosticos_emitidos.json';a.click();URL.revokeObjectURL(url);
 };
 async function init(){
  try{
   let data=window.MARKET_DATA;
   if(!data){const response=await fetch('market_data.json',{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);data=await response.json();}
   if(!data.predictive)throw Error('Actualizá los datos con run_lab.py para descargar dos sesiones');
   for(const symbol of ['AAPL','GGAL']){
    const item=data.predictive.instruments[symbol];
    if(!item||item.sessions.length!==2||item.second_session_start!==item.sessions[0].count||item.observations.length!==item.sessions.reduce((n,s)=>n+s.count,0))throw Error('Límites de sesiones inválidos');
    if(item.observations.some((r,i)=>!Number.isFinite(r.close)||!Number.isFinite(Date.parse(r.timestamp))||(i>0&&Date.parse(r.timestamp)<=Date.parse(item.observations[i-1].timestamp))))throw Error('Serie inválida o desordenada');
   }
   payload=data;configure();
  }catch(error){q('pred-data-status').textContent='Experimento no disponible: '+error.message;}
 }
 init();
})();
