/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. History overview and expanded charts. */
(() => {
  const groups = [
    {id:'home',title:'Solar and home demand',unit:'kW',fields:[['pvPower','Solar generation (+)','#f59e0b',1],['loadsPower','Home demand (−)','#e879f9',-1]]},
    {id:'grid',title:'Grid import and export',unit:'kW',fields:[['gridConsumptionPower','Import (+)','#38bdf8',1],['feedinPower','Export (−)','#34d399',-1]]},
    {id:'battery',title:'Battery charge and discharge',unit:'kW',fields:[['batChargePower','Charge (+)','#2dd4bf',1],['batDischargePower','Discharge (−)','#fb923c',-1]]},
    {id:'soc',title:'Battery level',unit:'%',fields:[['SoC','Charge level','#c084fc']]}
  ];
  window.installHistoryView = (panel, {piEdition,isVisible}) => {
    panel.innerHTML = `<div class="dev-history-controls"><label>Month<input type="month" id="dev-history-month"></label><button id="dev-history-refresh">Refresh history</button><button id="dev-history-export">Download month CSV</button></div><div class="history-metadata"><p id="dev-history-status" role="status">Open History to load recorded data.</p><p class="history-save-status" role="status"></p></div><div class="history-chart-grid"></div><p class="dev-muted history-data-note">Observed averages, not billing-grade energy totals. Missing readings stay as gaps. Recording starts when history storage is installed.</p><div class="history-activity-heading"><h2>Automation activity</h2><nav aria-label="Activity pages" hidden><button type="button" class="history-previous">Previous</button><span role="status"></span><button type="button" class="history-next">Next</button></nav></div><div id="history-activity" aria-live="polite"></div>`;
    const monthInput=panel.querySelector('#dev-history-month');
    monthInput.value=new Date().toISOString().slice(0,7);monthInput.max=monthInput.value;
    const status=panel.querySelector('#dev-history-status');
    const chartGrid=panel.querySelector('.history-chart-grid');
    const refresh=panel.querySelector('#dev-history-refresh');
    const exportButton=panel.querySelector('#dev-history-export');
    let data=null,loading=false,requestRevision=0,expandedGroup=null,expandedChart=null;
    let activityPage=0;
    const pageSize=3;
    const pager=panel.querySelector('[aria-label="Activity pages"]');
    const previous=pager.querySelector('.history-previous'),next=pager.querySelector('.history-next');
    previous.addEventListener('click',()=>{activityPage--;drawActivity();});
    next.addEventListener('click',()=>{activityPage++;drawActivity();});
    const charts=new Map(),cards=new Map();
    const dialog=document.createElement('dialog');dialog.className='dev-review-dialog history-expanded';
    dialog.setAttribute('aria-labelledby','history-expanded-title');
    dialog.innerHTML='<div class="history-expanded-header next-dialog-header"><div><h2 id="history-expanded-title"></h2><p class="history-expanded-month"></p></div><button type="button" aria-label="Close expanded chart">Close</button></div><div class="history-expanded-plot"><canvas role="img"></canvas></div><p>15-minute observed averages. Missing readings remain gaps.</p>';
    document.body.append(dialog);
    dialog.querySelector('button').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>{expandedChart?.destroy();expandedChart=null;expandedGroup=null;});
    for(const group of groups) {
      const card=document.createElement('section');card.className='history-chart-card';
      const header=document.createElement('div');header.className='history-chart-header';
      const title=document.createElement('h2');title.textContent=group.title;
      const expand=document.createElement('button');expand.type='button';expand.textContent='Expand';expand.setAttribute('aria-label',`Expand ${group.title.toLowerCase()} chart`);expand.disabled=true;
      expand.addEventListener('click',()=>{expandedGroup=group;dialog.showModal();drawExpanded();});
      header.append(title,expand);
      const plot=document.createElement('div');plot.className='dev-history-chart';
      const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${group.title} history`);plot.append(canvas);
      const caption=document.createElement('p');caption.className='history-chart-caption';
      card.append(header,plot,caption);chartGrid.append(card);cards.set(group.id,{canvas,expand,caption});
    }
    if(!piEdition) {
      chartGrid.hidden=true;exportButton.hidden=true;panel.querySelector('.history-save-status').hidden=true;
      panel.querySelector('.history-data-note').textContent='Activity is kept for 12 months, up to 2,000 entries. This browser must stay open and awake for automation.';
    }
    function chartConfig(group) {
      const points=data.points || [];
      const start=Date.parse(`${data.month}-01T00:00:00Z`);
      const month=new Date(start),end=Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1)-1;
      const byTime=new Map(points.map(point=>[Date.parse(point.at),point.values]));
      const times=[...byTime.keys()].sort((a,b)=>a-b);
      const minimum=times.length?Math.max(start,times[0]-900000):start;
      const maximum=times.length?Math.min(end,times.at(-1)+900000):end;
      const ticks=[];
      if(times.length)for(let at=times[0];at<=times.at(-1);at+=900000)ticks.push(at);
      // Directional archives retain non-negative magnitudes. Apply chart signs only here;
      // CSV export, stored readings, and scheduler telemetry keep their original values.
      const datasets=group.fields.map(([field,label,color,direction=1])=>({label,borderColor:color,borderWidth:2,pointRadius:ticks.length<3?3:0,spanGaps:false,data:ticks.map(at=>{const value=byTime.get(at)?.[field];return {x:at,y:typeof value==='number' && Number.isFinite(value)?(value===0?0:value*direction):null};})}));
      const style=getComputedStyle(document.documentElement),muted=style.getPropertyValue('--text-muted');
      const signed=group.unit==='kW';
      const extent=Math.max(0.1,...datasets.flatMap(series=>series.data.map(point=>Math.abs(point.y ?? 0))));
      const signedValue=value=>`${value>0?'+':value<0?'−':''}${Math.abs(value).toFixed(2)}`;
      return {type:'line',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,
        interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{color:muted,usePointStyle:true,boxWidth:8,padding:18}},tooltip:{callbacks:{title:items=>items.length?new Date(items[0].parsed.x).toLocaleString():'',label:item=>`${item.dataset.label}: ${signed?signedValue(item.parsed.y):item.parsed.y.toFixed(2)} ${group.unit}`}}},
        scales:{x:{type:'linear',min:minimum,max:maximum,grid:{color:style.getPropertyValue('--border')},ticks:{maxTicksLimit:6,color:muted,callback:value=>maximum-minimum<=3*86400000?new Date(value).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}):new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short'})}},
          y:{beginAtZero:true,min:signed?undefined:0,max:signed?undefined:100,suggestedMin:signed?-extent:undefined,suggestedMax:signed?extent:undefined,title:{display:true,text:signed?'Average power (kW)':'Charge level (%)',color:muted},ticks:{color:muted,callback:value=>signed&&value>0?`+${value}`:String(value)},grid:{color:context=>context.tick.value===0?muted:style.getPropertyValue('--border'),lineWidth:context=>context.tick.value===0?2:1}}}}};
    }
    function drawExpanded() {
      if(!expandedGroup || !data)return;
      dialog.querySelector('h2').textContent=expandedGroup.title;
      dialog.querySelector('.history-expanded-month').textContent=`Recorded month: ${data.month}`;
      const canvas=dialog.querySelector('canvas');canvas.setAttribute('aria-label',`${expandedGroup.title} history for ${data.month}`);
      expandedChart?.destroy();expandedChart=new Chart(canvas,chartConfig(expandedGroup));
    }
    function drawActivity() {
      if(!data)return;
      const activity=panel.querySelector('#history-activity');activity.replaceChildren();
      const events=[...(data.events || [])].sort((a,b)=>b.at.localeCompare(a.at));
      activityPage=Math.max(0,Math.min(activityPage,Math.ceil(events.length/pageSize)-1));
      const start=activityPage*pageSize;
      pager.hidden=events.length<=pageSize;
      previous.disabled=activityPage===0;next.disabled=start+pageSize>=events.length;
      pager.querySelector('span').textContent=`${start+1}–${Math.min(start+pageSize,events.length)} of ${events.length}`;
      for(const event of events.slice(start,start+pageSize)) {
        const row=document.createElement('div');row.className='next-activity-row';
        const title=document.createElement('strong');title.textContent=({automation_paused:'Automation paused',automation_resumed:'Automation resumed',pause_expired:'Timed pause ended',service_enabled:'Pi service enabled',service_disabled:'Pi service disabled'})[event.type] || event.type;
        const detail=document.createElement('p');detail.textContent=`${new Date(event.at).toLocaleString()}${event.type==='automation_paused'?(event.until?` · Until ${new Date(event.until).toLocaleString()}`:' · Until manually resumed'):''}`;row.append(title,detail);activity.append(row);
      }
      if(!activity.children.length)activity.textContent='No automation activity recorded for this month.';
    }
    function draw() {
      if(!data)return;
      drawActivity();
      if(!piEdition){status.textContent='Pause and resume activity on this browser · 12-month retention';return;}
      for(const group of groups) {
        const card=cards.get(group.id),config=chartConfig(group);
        charts.get(group.id)?.destroy();charts.set(group.id,new Chart(card.canvas,config));
        const hasData=config.data.datasets.some(series=>series.data.some(point=>point.y!==null));
        card.expand.disabled=!hasData;
        card.caption.hidden=hasData;
        card.caption.textContent=hasData?'':'No readings recorded for this month.';
      }
      const bytes=data.allocatedBytes ?? data.storageBytes;
      panel.querySelector('.history-save-status').textContent=`Saves every ${data.saveIntervalMinutes || 60} minutes · ${data.bufferedIntervals || 0} ${(data.bufferedIntervals || 0)===1?'interval':'intervals'} waiting to save · Last saved: ${data.lastSavedAt?new Date(data.lastSavedAt).toLocaleString():'No readings saved yet'}`;
      status.textContent=`${data.points.length} recorded ${data.points.length===1?'interval':'intervals'} in ${data.month} · ${bytes<1048576?(bytes/1024).toFixed(1)+' KB':(bytes/1048576).toFixed(2)+' MB'} history files on disk · ${data.retentionMonths}-month retention`;
      if(dialog.open)drawExpanded();
    }
    async function load() {
      if((piEdition && !window.linuxRuntime) || !isVisible())return;
      const revision=++requestRevision,month=monthInput.value;
      loading=true;refresh.disabled=true;status.textContent='Loading recorded history…';
      try {
        const result=piEdition?await fetchJson(`/api/history?month=${encodeURIComponent(month)}`):{events:window.automationControl.events().filter(event=>event.at.slice(0,7)===month)};
        if(revision!==requestRevision)return;
        if(data?.month!==result.month || month!==data?.requestedMonth)activityPage=0;
        data={...result,requestedMonth:month};draw();
      } catch(error){if(revision===requestRevision)status.textContent=`History unavailable: ${error.message}`;}
      finally{if(revision===requestRevision){loading=false;refresh.disabled=false;}}
    }
    monthInput.addEventListener('change',load);refresh.addEventListener('click',load);
    exportButton.addEventListener('click',()=>{
      if(!data?.points?.length){status.textContent='Choose a month with recorded data before exporting.';return;}
      const fields=data.fields;
      const csv=['timestamp_utc,'+fields.map(field=>field+(field==='SoC'?'_percent':'_kW')).join(','),...data.points.map(point=>[point.at,...fields.map(field=>point.values[field]??'')].join(','))].join('\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download=`home-energy-${data.month}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    window.addEventListener('history-settings-change',()=>{data=null;if(isVisible())void load();});
    window.addEventListener('automation-control-change',()=>{if(isVisible())void load();});
    new MutationObserver(()=>{if(isVisible())draw();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    return {load,needsLoad:()=>data===null && !loading};
  };
})();
