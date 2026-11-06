/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * Visible views for the shared engine. Original control nodes keep their IDs,
 * values and handlers. Old presentation nodes are retained in one hidden host.
 */
// One Overview component for web, desktop, Pi and ESP32. Data adapters retain their existing engine IDs.
window.installSharedOverview = ({overview,byId,adoptId,make,panel}) => {
  const ids=['protection-state','protection-message','overview-solar-power','overview-home-load','overview-grid-power','overview-battery-power','overview-battery-soc','overview-dynamic-schedules','overview-fox-schedules','tariff-data-status','importPriceChart','exportPriceChart','import-chart-empty','export-chart-empty'];
  const nodes=new Map(ids.map(id=>[id,byId(id)]));
  const get=id=>nodes.get(id);
  overview.replaceChildren();
  const status=make('section','next-protection wide'); status.append(get('protection-state'),get('protection-message'));overview.append(status);
  const power=make('section','next-power wide');
  for(const [label,id,detail] of [['Solar','overview-solar-power','Generating'],['Home','overview-home-load','Current demand'],['Grid','overview-grid-power','Import / export'],['Battery','overview-battery-power','overview-battery-soc']]) {
    const cell=make('div','next-power-item');cell.append(make('span','next-kicker',label),get(id));
    const caption=make('small');if(detail.startsWith('overview-'))caption.append(make('span','','Charge level '),get(detail));else caption.textContent=detail;
    cell.append(caption);power.append(cell);
  }
  overview.append(power);
  const octopusSchedule=panel('Octopus charging windows');octopusSchedule.classList.add('next-schedule-summary');octopusSchedule.append(get('overview-dynamic-schedules'));
  const foxSchedule=panel('FoxESS programmed schedule');foxSchedule.classList.add('next-schedule-summary');foxSchedule.append(get('overview-fox-schedules'));
  overview.append(octopusSchedule,foxSchedule);
  const prices=adoptId('section-intelligent-octopus',panel('Electricity prices',true));
  const priceRow=make('div','next-price-row');
  for(const [label,id] of [['Import now','next-import-price'],['Export now','next-export-price']]) {const item=make('div');item.append(make('span','next-kicker',label),make('strong','', '—'));item.lastChild.id=id;const unit=make('small','','p/kWh');unit.dataset.priceUnit='';item.append(unit);priceRow.append(item);}
  prices.append(priceRow);
  prices.append(get('tariff-data-status'));
  const charts=make('div','next-chart-grid');
  for(const [title,canvas,empty] of [['Import tariff','importPriceChart','import-chart-empty'],['SEG export tariff','exportPriceChart','export-chart-empty']]) {
    const figure=make('section','next-tariff');figure.append(make('h3','',title));
    const frame=make('div','tariff-chart-frame');frame.append(get(canvas),get(empty));figure.append(frame);charts.append(figure);
  }
  prices.append(charts);overview.append(prices);
  return {prices,foxSchedule,priceRow};
};
window.installSharedConnections = ({grid,account,service,worker,extras=[]}) => {
  grid.replaceChildren(account,service,...extras);
  grid.classList.add('next-connections-grid');
  account.classList.add('next-account-panel');service.classList.add('next-service-panel');
  if(worker){worker.classList.add('dev-inspector');service.append(worker);}
};
(() => {
  if(document.documentElement.dataset.devEdition==='esp32-dashboard'){
    const D=window.esp32Dashboard,$=D.$;
    const make=(tag,className='',text='')=>{const node=document.createElement(tag);node.className=className;node.textContent=text;return node;};
    const panel=(title,wide=false)=>{const node=make('section','next-panel'+(wide?' wide':''));node.append(make('h2','next-panel-title',title));return node;};
    // Reuse the ordinary dashboard's paired charge-limit presentation. The
    // existing inputs retain their bindings, values and review handlers.
    const limitToggle=document.querySelector('[data-rule="dispatch_soc_enabled"]').closest('label');
    const limitField=document.querySelector('[data-rule="dispatch_soc"]').closest('label');
    const limitGroup=make('div','next-field-grid');limitToggle.before(limitGroup);limitGroup.append(limitToggle,limitField);
    const ordinaryToggle=document.querySelector('[data-rule="charge_soc_enabled"]').closest('label'),ordinaryField=document.querySelector('[data-rule="target_soc"]').closest('label'),ordinaryGroup=make('div','next-field-grid');ordinaryToggle.before(ordinaryGroup);ordinaryGroup.append(ordinaryToggle,ordinaryField);
    const historyPanel=document.querySelector('[data-page="history"]>.dev-history');
    const historyGrid=make('div','dev-page-grid');historyPanel.before(historyGrid);historyGrid.append(historyPanel);
    const metadata=make('div','history-metadata');$('esp-history-status').before(metadata);metadata.append($('esp-history-status'));
    const historyNote=make('p','dev-muted history-data-note','Observed averages, not billing-grade energy totals. Missing readings stay as gaps.');historyPanel.append(historyNote);
    const confirmedAt=$('esp-confirmed-at');
    const shared=window.installSharedOverview({overview:document.querySelector('[data-page="overview"] .dev-page-grid'),byId:$,make,panel,adoptId:(id,node)=>{node.id=id;return node;}});
    shared.foxSchedule.append(confirmedAt);
    const connections=document.querySelector('[data-page="connections"] .dev-page-grid');
    const account=panel('Account and device');account.id='section-device-settings';
    const status=make('span','badge neutral','Waiting for device details');status.id='ui-device-status';
    const details=make('ul','data-list'),prefs=make('ul','data-list');details.id='ui-account-details';prefs.id='ui-device-prefs';
    const values={};
    const row=(parent,label,key)=>{const li=make('li'),value=make('span','val','Not received');li.append(make('span','label',label),value);parent.append(li);values[key]=value;return li;};
    const accountRow=row(details,'Account Number','account');accountRow.className='account-number-row';
    const secret=make('span','account-secret-control'),show=make('button','inline-visibility-button','Show');show.type='button';show.id='dashboard-account-toggle';values.account.id='dashboard-account-number';values.account.textContent='••••••••';
    secret.append(values.account,show);accountRow.append(secret);
    row(details,'Linked Device','linked');values.linked.style.color='var(--accent)';
    row(details,'Import Tariff Code','import');values.import.id='dashboard-import-tariff';values.import.classList.add('next-account-tariff');
    row(details,'Export Tariff Code','export');values.export.id='dashboard-export-tariff';values.export.classList.add('next-account-tariff');
    for(const [label,key] of [['EV Info','vehicle'],['Charge Point','charger'],['Target Time','target'],['Charge Limit','limit']])row(prefs,label,key);
    account.append(status,details,prefs);
    let revealed=false,accountValue='';
    const mask=()=>{values.account.textContent=revealed&&accountValue?accountValue:'••••••••';show.textContent=revealed?'Hide':'Show';show.setAttribute('aria-pressed',String(revealed));};
    D.maskAccount=()=>{revealed=false;mask();};show.addEventListener('click',()=>{revealed=!revealed;mask();});
    D.renderAccount=data=>{
      accountValue=data.account_number||'';mask();show.disabled=!accountValue;
      const available=data.updated_at>0,missing=available?'Not reported':'Waiting for account data';
      status.textContent=data.status||(!available?'Waiting for device details':data.device_reported?'Device details available':'Not reported');
      status.className='badge '+(data.status==='LIVE'?'live':'neutral');
      values.linked.textContent=(data.provider||data.chargePointMake||data.vehicleMake||missing).toUpperCase();
      values.import.textContent=data.import_tariff||'Not reported';values.export.textContent=data.export_tariff||'Not reported';
      values.vehicle.textContent=[data.vehicleMake,data.vehicleModel].filter(Boolean).join(' ')||missing;
      values.charger.textContent=[data.chargePointMake,data.chargePointModel].filter(Boolean).join(' ')||missing;
      values.target.textContent=data.target_time||missing;values.limit.textContent=Number.isFinite(data.charge_limit)?data.charge_limit+'%':missing;
      accountStatus.textContent=data.update_error?'Account details could not be refreshed. Last received values remain visible.':available?'Account details updated from Octopus.':'Waiting for the first account-details update.';
    };
    const service=panel('Service connections');
    for(const [label,name] of [['Octopus API','octopus'],['FoxESS REST / telemetry','foxess']]){
      const row=make('div','next-service-row');row.append(make('strong','',label),$('esp-'+name+'-status'));service.append(row);
      service.append($('esp-'+name+'-next'));
    }
    service.append($('esp-updated'));
    const worker=make('section');worker.append(make('h3','','Worker & safety'),$('esp-worker-facts'),make('p','','Smart Dispatch takes priority. The worker retains the last valid dispatch when an upstream check fails.'),make('p','','REST readback confirms schedule programming. Power readings show actual measured behaviour.'));
    document.querySelector('[data-setting="device-setup"]').append($('esp-refresh'));
    const accountStatus=make('p','next-muted');accountStatus.id='esp-account-status';accountStatus.setAttribute('role','status');account.append(accountStatus);
    window.installSharedConnections({grid:connections,account,service,worker});
    const number=value=>Number.isFinite(value)?value.toFixed(2):'—';
    const time=value=>value?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value*1000)):'Not received';
    const clock=(h,m)=>String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
    const periodKeys=new Map();
    function periods(id,rows,dispatch,known){
      const key=JSON.stringify([rows,known,D.state()?.confirmed,D.state()?.revision,Math.floor(Date.now()/60000)]);
      if(periodKeys.get(id)===key)return;periodKeys.set(id,key);
      const parent=$(id);parent.replaceChildren();
      if(!rows?.length){const p=document.createElement('p');p.textContent=known?(dispatch?'No upcoming charging windows.':'No active programmed periods.'):'Waiting for the first official update.';parent.append(p);
        const state=D.state(),rules=state?.rules;
        if(known&&!dispatch&&rules?.enabled&&!rules.paused&&state.dispatch_valid&&!state.dispatches?.length&&!rules.weekly_charge&&!rules.charge_price_enabled&&!rules.weekly_discharge&&!rules.discharge_price_enabled){
          const reason=document.createElement('p');reason.className='next-muted';reason.textContent='No Smart Dispatch or ordinary charging or discharging rules currently require a scheduled period. Remaining Time Mode must be Self-Use.';parent.append(reason);
        }
        return;}
      for(const row of rows){
        const from=dispatch?Date.parse(row.startDt)/1000:0,to=dispatch?Date.parse(row.endDt)/1000:0;if(dispatch&&to<=Date.now()/1000)continue;
        const div=document.createElement('div');div.className='overview-schedule-row';const text=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small'),tag=document.createElement('span');tag.className='overview-schedule-tag';
        title.textContent=dispatch?'Smart Dispatch':({ForceCharge:'Force Charge',ForceDischarge:'Force Discharge',SelfUse:'Self-Use'}[row.workMode]||row.workMode);
        detail.textContent=dispatch?time(from)+' – '+time(to):clock(row.startHour,row.startMinute)+'–'+clock(row.endHour,row.endMinute);
        const minute=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(new Date()))*60+Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',minute:'2-digit'}).format(new Date()));
        const now=Date.now()/1000,start=row.startHour*60+row.startMinute,end=row.endHour*60+row.endMinute;const active=dispatch?from<=now&&now<to:(start<=end?minute>=start&&minute<=end:minute>=start||minute<=end);
        if(active)div.classList.add('active');tag.textContent=dispatch?(D.state()?.confirmed?'CONFIRMED':'WAITING'):(active?'NOW':'SET');
        text.append(title,detail);div.append(text,tag);parent.append(div);
      }
      if(!parent.childNodes.length){const p=document.createElement('p');p.textContent='No upcoming charging windows.';parent.append(p);}
    }
    D.renderHistory=rows=>{D.drawHistory(rows);const saved=rows.filter(row=>row.storage==='flash').length;$('esp-history-status').textContent=rows.length?rows.length+(rows.length===1?' record · ':' records · ')+(saved?saved+' hourly Flash records · ':'')+'live RAM averages'+(D.state()?.rules?.history_flash_enabled?' · hourly saving enabled':' · Flash saving off'):'No retained observations yet. The ESP32 collects readings through its normal telemetry requests.';};
    let liveModeSeen;
    D.render=state=>{
      document.getElementById('dev-shell').classList.toggle('esp-fixture',state.fixture===true);
      if(state.fixture)D.notice('Demonstration data · No inverter connected.');
      $('esp-connection').textContent=state.fixture?'DEMO DATA':'ESP32 connected';$('esp-connection').dataset.state=state.fixture?'waiting':'good';
      D.syncAccess?.(state);
      D.syncDebug?.(state.debug);
      D.syncFirmwareUpdate?.(state.firmware_update);
      const pauseState={paused:state.rules?.paused===true,pending:state.rules?.paused===true&&state.write_inflight===true,available:true,enabled:state.rules?.enabled!==false,until:state.rules?.pause_until?state.rules.pause_until*1000:null};
      D.syncPauseSwitch(pauseState);D.syncPauseBanner(pauseState);
      for(const name of ['octopus','foxess']){const interval=state.rules?.[name==='octopus'?'octopus_seconds':'foxess_seconds']||60,remaining=Math.max(0,(state[name+'_next']||state.now)-state.now);const pending=state[name+'_refresh_pending']===true,error=Boolean(D.serviceError(name)),button=$('esp-service-'+name);$('esp-ring-'+name).dataset.state=error?'error':pending?'updating':state[name+'_http']===200?'ok':'waiting';button.classList.toggle('has-warning',error);button.disabled=pending&&!error;button.setAttribute('aria-busy',String(pending));button.setAttribute('aria-label',(name==='octopus'?'Octopus Energy':'FoxESS')+': '+(error?'Review update problem':pending?'Reading API':'Reload API data'));button.title=error?D.serviceMessage(name):pending?'API refresh queued. Waiting for the service cooldown.':'Reload API data';$('esp-progress-'+name).style.strokeDashoffset=String(Math.min(100,remaining/interval*100));}
      const paused=state.rules?.paused,enabled=state.rules?.enabled;
      $('protection-state').textContent=paused?(state.write_inflight?'Pausing…':'Paused'):!enabled?'Automation disabled':state.confirmed?'REST confirmed':state.partial?'Partial schedule':'Confirmation pending';
      $('protection-state').dataset.state=paused||!enabled?'waiting':state.confirmed?'good':state.partial?'error':'waiting';
      $('protection-message').textContent=state.control_status||'Waiting for the background worker';
      $('esp-control-summary').textContent=state.control_status||'';
      let storageStatus='Hourly saving is off. No new History records are written to Flash.';
      if(state.history_flash_error)storageStatus='History storage error. RAM monitoring continues.';
      else if(state.rules?.history_flash_enabled){
        storageStatus=state.history_flash_available?'Hourly saving is on. '+(state.history_saved_through?'Saved through '+time(state.history_saved_through)+'.':'The next hourly batch will save completed observations.'):'Saved storage is unavailable. Install the current firmware through USB setup.';
      }
      $('esp-history-storage-status').textContent=storageStatus;
      const readings=state.telemetry||{};for(const [name,id] of [['solar','overview-solar-power'],['home','overview-home-load'],['grid','overview-grid-power'],['battery','overview-battery-power']])$(id).textContent=number(Number.isFinite(readings[name])?Math.abs(readings[name]):null)+(Number.isFinite(readings[name])?' kW'+(name==='grid'?(readings[name]>0?' import':readings[name]<0?' export':' balanced'):name==='battery'?(readings[name]>0?' charge':readings[name]<0?' discharge':' idle'):''):'');
      $('overview-battery-soc').textContent=Number.isFinite(readings.soc)?readings.soc.toFixed(0)+'%':'—';
      const active=(state.groups||[]).filter(row=>![false,0,'0'].includes(row.enable)&&!(row.workMode==='SelfUse'&&row.startHour===0&&row.startMinute===0&&row.endHour===0&&row.endMinute===0));
      periods('overview-dynamic-schedules',state.dispatches,true,state.dispatch_valid);periods('overview-fox-schedules',active,false,state.schedule_at>0);periods('esp-full-schedule',active,false,state.schedule_at>0);
      $('esp-confirmed-at').textContent='Official REST read: '+time(state.schedule_at)+(state.confirmed_at?' · Last confirmed: '+time(state.confirmed_at):'');
      const now=state.now||Date.now()/1000;
      for(const name of ['import','export']){const rows=state[name+'_rates']||[],rate=rows.find(row=>row.start<=now&&now<row.end);$('next-'+name+'-price').textContent=rate?window.priceDisplay.number(rate.value):'—';}
      document.querySelectorAll('[data-price-unit]').forEach(node=>node.textContent=window.priceDisplay.unit());D.drawTariffs(state);
      const cachedRates=Boolean(state.import_rates?.length||state.export_rates?.length);
      $('tariff-data-status').textContent=cachedRates?'Rates cached on ESP32. All dashboards read the same data. Missing or expired prices remain unavailable.':
        'Reading the ESP32 cache. '+(state.tariff_status||'Tariff requests are queued after charging-window reconciliation.')+
        (state.tariff_http>=400?' · Last tariff HTTP '+state.tariff_http:'')+' · Next worker request in '+Math.max(0,Math.ceil((state.octopus_next||state.now)-state.now))+
        ' s. Opening this dashboard sends no cloud requests. After an ESP32 restart, initial loading can take several minutes.';
      const live=state.foxess_telemetry||{mode:'rest',configured:false,status:'REST telemetry'};
      if(liveModeSeen!==live.mode){$('esp-telemetry-mode').value=live.mode;liveModeSeen=live.mode;}
      $('esp-telemetry-mode').querySelector('[value="live-ws"]').disabled=false;
      $('esp-telemetry-status').textContent=live.status+(live.configured?' · Optional login saved.':' · Enter optional login in Account setup, then select Save accounts.');
      $('esp-octopus-status').textContent=state.octopus_status||'Waiting';$('esp-foxess-status').textContent=(state.foxess_status||'Waiting')+(live.mode==='live-ws'&&live.source!=='live-ws'?' · '+live.status:'');
      for(const name of ['octopus','foxess'])$( 'esp-'+name+'-next').textContent='Next worker request in '+Math.max(0,Math.round((state[name+'_next']||now)-now))+' s';
      const stale=state.telemetry_at&&now-state.telemetry_at>(state.rules?.foxess_seconds||600)*2;
      $('esp-updated').textContent=state.telemetry_at?(stale?'Last-known telemetry: ':'Telemetry updated: ')+time(state.telemetry_at):'Waiting for the first telemetry reading.';
      const facts=[['Dispatch fetched',time(state.dispatch_at)],['FoxESS confirmed',time(state.confirmed_at)],['Schedule periods',active.length],['Telemetry updated',time(state.telemetry_at)]];
      $('esp-device-facts').textContent='Rules revision '+state.revision+' · Confirmed revision '+(state.confirmed_revision||'Pending')+' · RAM records '+(state.history_records||0)+' · Free PSRAM '+Math.round((state.free_psram_bytes||0)/1024)+' KiB · Europe/London';
      $('esp-worker-facts').replaceChildren();for(const [label,value] of facts){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);row.append(dt,dd);$('esp-worker-facts').append(row);}
      $('esp-pause').disabled=paused===true;$('esp-resume').disabled=paused!==true;
    };
    const required=['protection-state','protection-message','overview-solar-power','overview-home-load','overview-grid-power','overview-battery-power','overview-battery-soc','overview-dynamic-schedules','overview-fox-schedules','importPriceChart','exportPriceChart','v3-start','v3-end'];
    for(const id of required)if(document.querySelectorAll('[id="'+id+'"]').length!==1)throw Error('ESP32 view element is missing or duplicated: '+id);
    return;
  }

  const hostName = document.documentElement.dataset.devEdition === 'desktop' ? 'computer' : 'Pi';
  const pi = document.documentElement.dataset.devEdition !== 'web';
  const shell = document.getElementById('dev-shell');
  const dashboard = document.getElementById('dashboard');
  const parking = document.createElement('div'); parking.id = 'dev-engine-elements'; parking.hidden = true;
  document.body.append(parking);
  const byId = id => { const node=document.getElementById(id);if(!node)throw new Error(`Shared engine element is missing: ${id}`);return node; };
  const make = (tag,className='',text='') => { const element=document.createElement(tag);element.className=className;element.textContent=text;return element; };
  const button = (text, action, secondary=false) => { const node=make('button',secondary?'next-button secondary':'next-button',text);node.type='button';node.addEventListener('click',action);return node; };
  const grid = page => shell.querySelector(`.dev-page[data-page="${page}"] .dev-page-grid`);
  const panel = (title,wide=false) => { const node=make('section',`next-panel${wide?' wide':''}`);if(title)node.append(make('h2','next-panel-title',title));return node; };
  const adoptId = (id,node) => {
    const previous=byId(id); const hidden=previous?.classList.contains('dashboard-section-hidden');
    if(previous) previous.removeAttribute('id'); node.id=id;
    if(hidden) node.classList.add('dashboard-section-hidden'); return node;
  };
  const field = (id,label) => {const node=make('label','next-field');node.htmlFor=id;node.append(make('span','',label),byId(id));return node;};
  const toggle = (id,label,help='') => {
    const row=make('label','next-toggle');row.htmlFor=id;
    const text=make('span');text.append(make('strong','',label));if(help)text.append(make('small','',help));
    row.append(text,byId(id));return row;
  };
  const group = (...nodes) => { const row=make('div','next-field-grid');row.append(...nodes);return row; };
  const days = name => {
    const row=make('div','next-days');row.setAttribute('role','group');row.setAttribute('aria-label',name==='weekly-force-day'?'Charge weekdays':'Discharge weekdays');
    const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    document.querySelectorAll(`input[name="${name}"]`).forEach(input=>{const label=make('label');label.append(input,make('span','',names[Number(input.value)]));row.append(label);});
    return row;
  };
  // Drawers must remain available after the engine hides the login container.
  document.body.append(byId('setup-guide-panel'),byId('why-use-panel'));
  for(const id of ['setup-guide-panel','why-use-panel','app-menu-panel']) {
    const drawer=byId(id);const sync=()=>{drawer.inert=!drawer.classList.contains('open');};
    new MutationObserver(sync).observe(drawer,{attributes:true,attributeFilter:['class']});sync();
  }
  for (const page of ['overview','schedules','rules','connections']) {
    [...grid(page).children].forEach(node=>parking.append(node));
  }
  // Overview contains one protection summary, one power view and one schedule per source.
  const overview=grid('overview');
  const {priceRow}=window.installSharedOverview({overview,byId,adoptId,make,panel});
  shell.querySelector('.dev-page[data-page="overview"] h1').textContent='Home energy';
  shell.querySelector('.dev-page[data-page="overview"] header p').textContent='Current power, charging windows and inverter confirmation.';

  const schedules=grid('schedules');
  const programmed=adoptId('section-foxess-mode',panel('Inverter mode and schedule',true));
  const modeRow=make('div','next-mode-row');modeRow.append(make('span','','Current mode'),byId('current-work-mode'),button('Refresh schedule',()=>void fetchFoxSchedules(),true));
  programmed.append(modeRow,byId('fox-error'),byId('fox-success'),byId('fox-active-schedules'));schedules.append(programmed);
  const manual=panel('Manual controls',true);manual.classList.add('next-manual-panel');const manualDetails=make('details');
  if(matchMedia('(min-width:761px) and (hover:hover)').matches)manualDetails.open=true;
  manualDetails.append(make('summary','','Set a temporary mode'));
  const manualBody=make('div','next-details-body');manualBody.append(make('p','next-muted','These controls change the real inverter schedule.'));
  manualBody.append(group(field('v3-start','Start time'),field('v3-end','End time')));
  const manualActions=make('div','next-actions');
  const manualReview=make('dialog','dev-review-dialog');manualReview.setAttribute('aria-label','Review manual inverter change');
  manualReview.innerHTML='<h2>Review manual change</h2><p id="next-manual-description"></p><div class="dev-dialog-actions"></div>';
  let pendingMode=null;
  manualReview.lastChild.append(button('Back',()=>manualReview.close(),true),button('Apply to inverter',async()=>{manualReview.close();await setV3Schedule(pendingMode);}));
  document.body.append(manualReview);
  for(const [title,value] of [['Set Self-Use','SelfUse'],['Set Force Charge','ForceCharge']]) manualActions.append(button(title,()=>{pendingMode=value;byId('next-manual-description').textContent=`${title}: ${byId('v3-start').value || 'start time not set'} to ${byId('v3-end').value || 'end time not set'}. This sends a real command.`;manualReview.showModal();},true));
  manualBody.append(manualActions);manualDetails.append(manualBody);manual.append(manualDetails);schedules.append(manual);

  const rules=grid('rules');
  const charging=adoptId('section-smart-charging',panel('Charging rules'));
  const chargeBody=adoptId('block-unified-auto',make('div','next-rule-body'));
  chargeBody.append(toggle('toggle-auto-dispatch','Follow Smart Dispatch','Apply valid Octopus charging windows as soon as detected.'));
  chargeBody.append(group(toggle('toggle-dispatch-soc-limit','Set dispatch charge limit'),field('dispatch-soc-limit','Dispatch target SOC (%)')));
  chargeBody.append(toggle('toggle-auto-price','Charge at an import price','Uses the import tariff, not the export tariff.'),field('price-threshold','Maximum import price (p/kWh)'));
  chargeBody.append(byId('price-target-times'));
  chargeBody.append(toggle('toggle-weekly-force','Weekly charge schedule'),group(field('weekly-force-start','Start time'),field('weekly-force-end','End time')),days('weekly-force-day'));
  chargeBody.append(group(toggle('toggle-soc-limit','Set ordinary charge limit'),field('target-soc-limit','Ordinary target SOC (%)')));
  chargeBody.append(toggle('toggle-auto-resume','Auto-Resume Self-Use','End an ordinary charge at its target. Keep an active Smart Dispatch.'));
  charging.append(chargeBody);
  const chargeActions=make('div','next-actions');chargeActions.append(button('Hardware limits',()=>{byId('adv-v3-modal').style.display='flex';},true),byId('btn-save-unified'));charging.append(chargeActions);rules.append(charging);
  const discharging=adoptId('section-smart-discharging',panel('Discharging rules'));
  const dischargeBody=adoptId('block-discharge-auto',make('div','next-rule-body'));
  dischargeBody.append(toggle('toggle-auto-export','Discharge at an export price'),field('export-threshold','Minimum export price (p/kWh)'),byId('export-target-times'));
  dischargeBody.append(toggle('toggle-weekly-discharge','Weekly discharge schedule'),group(field('weekly-discharge-start','Start time'),field('weekly-discharge-end','End time')),days('weekly-discharge-day'));
  dischargeBody.append(toggle('toggle-discharge-pause-dispatch','Pause during Smart Dispatch','Keep EV charging protection active.'),toggle('toggle-discharge-overrides-charge','Replace overlapping ordinary charging','Do not charge and discharge in the same minute.'));
  const dischargeActions=make('div','next-actions');dischargeActions.append(byId('btn-save-discharge'));
  discharging.append(dischargeBody,dischargeActions);rules.append(discharging);
  for(const node of [charging,discharging,programmed]) {const hint=make('p','dev-hidden-panel-hint','This panel is hidden. Show it in Settings → Visible panels.');node.after(hint);}

  const connections=grid('connections');
  const account=adoptId('section-device-settings',panel('Account and device'));
  account.append(byId('ui-device-status'),byId('ui-account-details'),byId('ui-device-prefs'));
  const service=panel('Service connections');
  for(const [label,badge] of [['Octopus API','octo-api-badge'],['FoxESS REST / telemetry','fox-api-badge']]) {const row=make('div','next-service-row');row.append(make('strong','',label),byId(badge));service.append(row);}
  const tracking=make('p','next-muted');tracking.append(make('span','','FoxESS API calls today: '),byId('fox-api-counter'));service.append(tracking);
  // The existing worker state fields remain live. They appear once, in Connections.
  const inspector=parking.querySelector('.dev-inspector');
  const scheduleShortcut=byId('dev-inspect-schedules');
  if(scheduleShortcut)parking.append(scheduleShortcut);
  for(const node of parking.querySelectorAll('.dev-integrations')){
    node.className='next-panel wide';node.querySelector('h2')?.classList.add('next-panel-title');grid('settings').append(node);
  }
  window.installSharedConnections({grid:connections,account,service,worker:inspector});

  // Edition-specific launch presentation preserves the shared engine controls.
  let entered=false;
  const { session, updateConnection } = window.installLaunchScreen({ pi, login: byId('login-layout'), parking, byId, make, button, onEnter:()=>{entered=true;syncAuth();requestAnimationFrame(()=>window.scrollTo({top:0,left:0}));} });
  parking.querySelectorAll('label[for]').forEach(label=>label.removeAttribute('for'));
  let previousConnectionState=null;
  const syncAuth = () => {
    const connected=dashboard.classList.contains('visible');
    // Keep the user's entry request while authentication and queued API reads finish.
    // Restored background connections leave Welcome visible until a deliberate entry.
    const viewing=connected && entered;
    shell.classList.toggle('dev-auth-mode',!viewing);
    updateConnection(connected);
    if(previousConnectionState!==connected) { window.scrollTo({top:0,left:0});previousConnectionState=connected; }
    byId('dev-theme').hidden=viewing;
    byId('dev-page-name').textContent=connected?shell.querySelector('.dev-page:not([hidden]) h1')?.textContent || 'Overview':'Sign in';
    const editionLabel=shell.querySelector('.dev-service');
    editionLabel.hidden=pi || viewing;
    editionLabel.textContent=pi?'':'Web edition';
    if(pi && !window.desktopHost) byId('login-layout').querySelector('.launch-setup>.next-auth-copy').textContent=window.linuxRemoteAccess?(hostName==='computer'?'Enter the Remote Access Key from desktop app → Remote Access.':'Enter the separate Remote Access Key shown in Pi Configuration.'):'Enter your LAN access code if protection is enabled.';
    session.textContent=pi?(window.linuxRemoteAccess?'Browser login lasts up to 12 hours. Use the same remote key after expiry.':`Your ${hostName} stores the account setup and runs the automation.`):'Keep this browser open and awake while automation runs.';
  };
  new MutationObserver(syncAuth).observe(dashboard,{attributes:true,attributeFilter:['class']});
  syncAuth();
  const refreshView=()=>{
    const rows=Math.max(byId('overview-dynamic-schedules').children.length,byId('overview-fox-schedules').children.length);
    const summaryHeight=`${Math.max(2,Math.min(5,rows))*60+80}px`;
    if(shell.style.getPropertyValue('--schedule-summary-height')!==summaryHeight){
      shell.style.setProperty('--schedule-summary-height',summaryHeight);
      schedulePriceChartResize();
    }
    const importPrice=window.tariffPresentation?.importPrice ?? window.currentLivePrice;
    byId('next-import-price').textContent=window.priceDisplay.number(importPrice);
    const exportRate=getRateAtTime(window.exportRates || [],Date.now());
    byId('next-export-price').textContent=window.priceDisplay.number(window.tariffPresentation?.exportPrice ?? exportRate?.value_inc_vat);
    priceRow.querySelectorAll('small').forEach(node=>{node.textContent=window.priceDisplay.unit();});
    if(!dashboard.classList.contains('visible'))syncAuth();
  };
  refreshView();setInterval(refreshView,1000);
  window.addEventListener('price-display-change',()=>{renderTariffsSafely();refreshView();});
  const reloadHostPrices=()=>{if(window.linuxRuntime && window.linuxRole!=='worker')void refreshOctopusTariffs();};
  window.addEventListener('pageshow',reloadHostPrices);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reloadHostPrices();});
})();
