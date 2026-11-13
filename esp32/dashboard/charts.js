// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
// Browser-only presentation. These plots never provide scheduler inputs.
(() => {
  const D=window.esp32Dashboard;
  const charts=new Map(),signatures=new Map();
  const parts=at=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));
  const offset=at=>{const p=parts(at);return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-Math.floor(at/1000)*1000;};
  const midnight=at=>{const p=parts(at),guess=Date.UTC(+p.year,+p.month-1,+p.day);return guess-offset(guess);};
  const clock=at=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at));
  function draw(id,config,signature){
    const canvas=D.$(id);if(!canvas||canvas.offsetParent===null)return;
    const key=JSON.stringify([document.documentElement.dataset.theme,signature]);
    if(signatures.get(id)===key)return;
    charts.get(id)?.destroy();charts.set(id,new Chart(canvas,config));signatures.set(id,key);
  }
  const colors=()=>{const dark=document.documentElement.dataset.theme==='dark';return {text:dark?'#94a3b8':'#64748b',grid:dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)'};};
  // Matches the existing web edition's stepped tariff series, scales and tooltips.
  D.drawTariffs=state=>{
    const start=midnight((state.now||Date.now()/1000)*1000),end=midnight(start+36*3600000);
    const slots=[];for(let at=start;at<=end;at+=1800000)slots.push(at);
    const labels=slots.map(at=>at===end?'24:00':clock(at));
    const {text,grid}=colors(),unit=window.priceDisplay.unit();
    const offPeak=Math.min(...(state.import_rates||[]).filter(r=>Number.isFinite(r.value)).map(r=>r.value));
    for(const kind of ['import','export']){
      const rates=state[kind+'_rates']||[],color=kind==='import'?'#10b981':'#3b82f6';
      const values=slots.map(at=>{
        const rate=rates.find(r=>r.start<=at/1000&&at/1000<r.end);let value=rate?.value??null;
        if(kind==='import'&&Number.isFinite(value)&&Number.isFinite(offPeak)&&(state.dispatches||[]).some(d=>Date.parse(d.startDt)<at+1800000&&Date.parse(d.endDt)>at))value=offPeak;
        return window.priceDisplay.convert(value);
      });
      const hasData=values.some(Number.isFinite),empty=D.$(kind+'-chart-empty'),canvas=D.$(kind+'PriceChart');
      canvas.hidden=!hasData;empty.hidden=hasData;
      empty.textContent=rates.length?'No rates available for today.':'Waiting for '+kind+' tariff data…';
      if(!hasData)continue;
      draw(kind+'PriceChart',{type:'line',data:{labels,datasets:[{label:kind==='import'?'Import tariff':'Export tariff',data:values,borderColor:color,backgroundColor:kind==='import'?'rgba(16,185,129,0.14)':'rgba(59,130,246,0.14)',stepped:'after',fill:true,borderWidth:2.5,pointRadius:0,spanGaps:false}]},options:{animation:false,responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},plugins:{legend:{display:false},tooltip:{displayColors:false,callbacks:{title:items=>items[0]?.label||'',label:context=>`${context.parsed.y.toFixed(window.priceDisplay.read().enabled?4:2)} ${unit}`}}},scales:{x:{ticks:{maxTicksLimit:7,color:text},grid:{display:false}},y:{beginAtZero:true,border:{display:false},title:{display:true,text:unit,color:text},ticks:{color:text,maxTicksLimit:5},grid:{color:grid}}}}},[labels,values,unit]);
    }
  };
  const groups=[
    {id:'home',title:'Solar and home demand',unit:'kW',series:[['solar','Solar generation (+)','#f59e0b',1],['home','Home demand (−)','#e879f9',-1]]},
    {id:'grid',title:'Grid import and export',unit:'kW',series:[['grid','Import (+)','#38bdf8',1,'positive'],['grid','Export (−)','#34d399',1,'negative']]},
    {id:'battery',title:'Battery charge and discharge',unit:'kW',series:[['battery','Charge (+)','#2dd4bf',1,'positive'],['battery','Discharge (−)','#fb923c',1,'negative']]},
    {id:'soc',title:'Battery level',unit:'%',series:[['soc','Charge level','#c084fc',1]]}
  ];
  D.historyGroups=groups;
  function historyConfig(group,rows){
    const {text,grid}=colors(),byTime=new Map([...rows].sort((a,b)=>a.at-b.at).map(row=>[row.at,row]));
    // Flash rows cover an hour; RAM rows cover 15 minutes. Insert gaps only
    // outside a recorded interval, rather than between every hourly sample.
    const ticks=[];let previous;
    for(const row of byTime.values()){
      if(previous){const end=previous.at+(previous.interval_seconds===3600?3600:900);if(row.at>end)ticks.push(end);}
      ticks.push(row.at);previous=row;
    }
    const datasets=group.series.map(([field,label,color,direction,filter])=>({label,borderColor:color,borderWidth:2,pointRadius:rows.length<3?3:1.5,spanGaps:false,data:ticks.map(at=>{let y=byTime.get(at)?.[field];if(!Number.isFinite(y))y=null;else if(filter==='positive')y=Math.max(0,y);else if(filter==='negative')y=Math.min(0,y);return {x:at*1000,y:y===null?null:y*direction};})}));
    const signed=group.unit==='kW',extent=Math.max(.1,...datasets.flatMap(s=>s.data.map(p=>Math.abs(p.y||0))));
    return {type:'line',data:{datasets},options:{animation:false,responsive:true,maintainAspectRatio:false,parsing:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{color:text,usePointStyle:true,boxWidth:8,padding:18}},tooltip:{callbacks:{title:items=>items.length?new Date(items[0].parsed.x).toLocaleString('en-GB',{timeZone:'Europe/London'}):'',label:item=>`${item.dataset.label}: ${item.parsed.y.toFixed(2)} ${group.unit}`}}},scales:{x:{type:'linear',min:ticks.length?((ticks[0]-900)*1000):undefined,max:ticks.length?((ticks.at(-1)+900)*1000):undefined,grid:{color:grid},ticks:{maxTicksLimit:6,color:text,callback:value=>clock(value)}},y:{beginAtZero:true,min:signed?undefined:0,max:signed?undefined:100,suggestedMin:signed?-extent:undefined,suggestedMax:signed?extent:undefined,title:{display:true,text:signed?'Average power (kW)':'Charge level (%)',color:text},ticks:{color:text},grid:{color:grid}}}}};
  }
  D.drawHistory=(rows)=>{const sorted=[...rows].sort((a,b)=>a.at-b.at);for(const group of groups)draw('esp-history-'+group.id,historyConfig(group,sorted),[group.id,sorted]);};
  D.expandHistory=group=>{
    const dialog=D.$('esp-history-expanded');D.$('esp-history-expanded-title').textContent=group.title;dialog.showModal();
    charts.get('esp-history-expanded-chart')?.destroy();charts.set('esp-history-expanded-chart',new Chart(D.$('esp-history-expanded-chart'),historyConfig(group,D.history())));
  };
})();
