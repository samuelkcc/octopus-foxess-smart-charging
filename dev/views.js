/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * Visible views for the shared engine. Original control nodes keep their IDs,
 * values and handlers. Old presentation nodes are retained in one hidden host.
 */
(() => {
  const hostName = document.documentElement.dataset.devEdition === 'desktop' ? 'PC' : 'Pi';
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
    const row=make('div','next-days');
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
  const status=make('section','next-protection wide'); status.append(byId('protection-state'),byId('protection-message'));overview.append(status);
  const power=make('section','next-power wide');
  for(const [label,id,detail] of [['Solar','overview-solar-power','Generating'],['Home','overview-home-load','Current demand'],['Grid','overview-grid-power','Import / export'],['Battery','overview-battery-power','overview-battery-soc']]) {
    const cell=make('div','next-power-item');cell.append(make('span','next-kicker',label),byId(id));
    const caption=make('small');if(detail.startsWith('overview-'))caption.append(make('span','','Charge level '),byId(detail));else caption.textContent=detail;
    cell.append(caption);power.append(cell);
  }
  overview.append(power);
  const octopusSchedule=panel('Octopus charging windows');octopusSchedule.classList.add('next-schedule-summary');octopusSchedule.append(byId('overview-dynamic-schedules'));
  const foxSchedule=panel('FoxESS programmed schedule');foxSchedule.classList.add('next-schedule-summary');foxSchedule.append(byId('overview-fox-schedules'));
  overview.append(octopusSchedule,foxSchedule);
  const prices=adoptId('section-intelligent-octopus',panel('Electricity prices',true));
  const priceRow=make('div','next-price-row');
  for(const [label,id] of [['Import now','next-import-price'],['Export now','next-export-price']]) {const item=make('div');item.append(make('span','next-kicker',label),make('strong','', '—'));item.lastChild.id=id;item.append(make('small','','p/kWh'));priceRow.append(item);}
  prices.append(priceRow);
  const charts=make('div','next-chart-grid');
  for(const [title,canvas,empty] of [['Import tariff','importPriceChart','import-chart-empty'],['SEG export tariff','exportPriceChart','export-chart-empty']]) {
    const figure=make('section','next-tariff');figure.append(make('h3','',title));
    const frame=make('div','tariff-chart-frame');frame.append(byId(canvas),byId(empty));figure.append(frame);charts.append(figure);
  }
  prices.append(charts);overview.append(prices);
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
  account.append(byId('ui-device-status'),byId('ui-account-details'),byId('ui-device-prefs'));connections.append(account);
  const service=panel(pi?'Service connections':'Browser connections');
  for(const [label,badge] of [['Octopus API','octo-api-badge'],['FoxESS REST / telemetry','fox-api-badge']]) {const row=make('div','next-service-row');row.append(make('strong','',label),byId(badge));service.append(row);}
  const tracking=make('p','next-muted');tracking.append(make('span','','FoxESS API calls today: '),byId('fox-api-counter'));service.append(tracking);
  // The existing worker state fields remain live. They appear once, in Connections.
  const inspector=parking.querySelector('.dev-inspector');if(inspector)service.append(inspector);
  connections.append(service);
  parking.querySelectorAll('.dev-integrations').forEach(node=>{node.className='next-panel wide';node.querySelector('h2')?.classList.add('next-panel-title');connections.append(node);});

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
    if(pi && !window.desktopHost) byId('login-layout').querySelector('.launch-setup>.next-auth-copy').textContent=window.linuxRemoteAccess?`Enter the separate Remote Access Key shown in your ${hostName} Configuration.`:'Enter your LAN access code if protection is enabled.';
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
    const importPrice=window.currentLivePrice;
    byId('next-import-price').textContent=Number.isFinite(importPrice)?Number(importPrice).toFixed(2):'—';
    const exportRate=getRateAtTime(window.exportRates || [],Date.now());
    byId('next-export-price').textContent=exportRate?Number(exportRate.value_inc_vat).toFixed(2):'—';
    if(!dashboard.classList.contains('visible'))syncAuth();
  };
  refreshView();setInterval(refreshView,1000);
})();
