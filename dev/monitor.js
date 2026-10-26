/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. Shared Overview update controls. */
(() => {
  const make=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
  const action=(text,handler)=>{const node=make('button',text);node.type='button';node.addEventListener('click',handler);return node;};
  const panel=make('section','','next-panel wide overview-updates');
  const heading=make('div','','overview-updates-heading');
  const copy=make('div');copy.append(make('h2','Data updates','next-panel-title'),make('p','Automatic refresh and retained connection problems.','next-muted'));
  const refresh=action('Update now',async()=>{await refreshOverviewNow();render();});
  heading.append(copy,refresh);panel.append(heading);
  const grid=make('div','','overview-update-grid');panel.append(grid);
  const views={};let selected=null;
  const dialog=make('dialog','','dev-review-dialog');
  const dialogTitle=make('h2');dialogTitle.id='overview-incident-title';dialog.setAttribute('aria-labelledby',dialogTitle.id);const details=make('div','','overview-incident-details');
  const feedback=make('p');feedback.setAttribute('role','status');
  const buttons=make('div','','dev-dialog-actions');
  const close=action('Close',()=>dialog.close());
  const clear=action('Clear alert',async()=>{
    clear.disabled=true;
    try {await window.integrationMonitor.acknowledge(selected);dialog.close();}
    catch(error){feedback.textContent=error.message;}
    finally {render();}
  });
  buttons.append(close,clear);dialog.append(dialogTitle,details,feedback,buttons);document.body.append(dialog);
  for(const [name,title] of [['octopus','Octopus Energy'],['foxess','FoxESS']]) {
    const card=make('section','','overview-update-card');
    const header=make('div','','overview-update-title');const status=make('span','','overview-update-status');header.append(make('h3',title),status);
    const timer=make('strong','','overview-update-clock');
    const description=make('p','','next-muted');const last=make('p','','overview-update-last');
    const incident=action('Review problem',()=>{selected=name;feedback.textContent='';render();dialog.showModal();});incident.className='overview-error-button';incident.hidden=true;
    card.append(header,timer,description,last,incident);grid.append(card);views[name]={title,status,timer,description,last,incident};
  }
  panel.append(make('p','Refreshing data does not cancel a pause.','overview-update-note'));
  document.querySelector('#dev-shell [data-page="overview"] .next-power').after(panel);
  const formatTime=value=>value?new Date(value).toLocaleString():'No successful update recorded yet';
  const seconds=value=>{const remaining=Math.max(0,Math.ceil((value-Date.now())/1000));return `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;};
  function summary(snapshot,name) {
    const sources=[snapshot.local.services[name],snapshot.remote?.services[name]].filter(Boolean);
    return {sources,failures:sources.flatMap(source=>source.failures),alerts:sources.filter(source=>source.alert).map(source=>source.alert),active:sources.some(source=>source.state==='error'),last:sources.map(source=>source.lastSuccessAt).filter(Boolean).sort().at(-1)};
  }
  function render() {
    const snapshot=window.integrationMonitor.snapshot();const timing=getOverviewRefreshStatus();
    refresh.disabled=timing.running || Object.values(snapshot.busy).some(Boolean);
    refresh.textContent=timing.running?'Updating…':'Update now';
    for(const [name,view] of Object.entries(views)) {
      const info=summary(snapshot,name);const running=Boolean(snapshot.busy[name] || timing.workerBusy[name]);
      const next=name==='octopus'?timing.octopusNextAt:timing.foxessNextAt;
      view.status.textContent=info.active?'Update failed':running?'Updating':info.last?'Connected':'Waiting';
      view.status.dataset.state=info.active?'error':running?'updating':info.last?'ok':'waiting';
      view.timer.textContent=running?'Updating…':next?seconds(next):'—';
      view.description.textContent=timing.workerTiming?'Next Pi worker API refresh':window.linuxRuntime?'Next dashboard API refresh':'Next API refresh';
      view.last.textContent=`Last success: ${formatTime(info.last)}`;
      view.incident.hidden=info.alerts.length===0;
      view.incident.textContent=info.active?'Review update problem':'Recovered · clear alert';
      if(dialog.open && selected===name) renderDialog(info,view.title);
    }
    if(selected && !dialog.open)renderDialog(summary(snapshot,selected),views[selected].title);
  }
  function renderDialog(info,title) {
    dialogTitle.textContent=`${title} update problem`;
    details.replaceChildren();
    const unique=new Map();
    for(const alert of info.alerts)unique.set(alert.message,alert);
    for(const alert of unique.values()) {
      const row=make('section');row.append(make('strong',alert.message),make('p',`First reported: ${formatTime(alert.firstAt)}`),make('p',`Last reported: ${formatTime(alert.lastAt)} · ${alert.count} failed ${alert.count===1?'check':'checks'}`));details.append(row);
    }
    if(info.active) {
      const current=new Set(info.failures.map(failure=>failure.message));
      for(const message of current)details.append(make('p',`Current problem: ${message}`));
    }
    details.append(make('p',info.active?'The service still has a problem. Use Update now to retry. This alert stays until the service recovers and you clear it.':'Updates have recovered. The saved alert remains until you select Clear alert.'));
    clear.disabled=info.active || info.alerts.length===0;
  }
  window.addEventListener('integration-status-change',render);
  new MutationObserver(()=>{render();void window.integrationMonitor.pollPi();}).observe(document.getElementById('dashboard'),{attributes:true,attributeFilter:['class']});
  render();setInterval(render,1000);
})();
