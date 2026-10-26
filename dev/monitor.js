/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. Shared Overview update controls. */
(() => {
  const make=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
  const action=(text,handler)=>{const node=make('button',text);node.type='button';node.addEventListener('click',handler);return node;};
  const panel=make('section','','overview-updates');
  panel.setAttribute('aria-label','API refresh status');
  panel.append(make('span','Next refresh','overview-update-label'));
  const refresh=action('Update now',async()=>{await refreshOverviewNow();render();});
  refresh.title='Refresh Octopus and FoxESS now. Refreshing does not cancel a pause.';
  const grid=make('div','','overview-update-grid');panel.append(grid,refresh);
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
    const status=make('span','','overview-update-status');
    const label=make('span',name==='octopus'?'Octopus':'FoxESS','overview-update-name');
    const timer=make('strong','','overview-update-clock');
    const incident=action('Review problem',()=>{selected=name;feedback.textContent='';render();dialog.showModal();});incident.className='overview-error-button';incident.hidden=true;
    card.append(status,label,timer,incident);grid.append(card);views[name]={title,status,timer,incident,card};
  }
  document.querySelector('#dev-shell [data-page="overview"] .dev-page-heading').append(panel);
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
      const stateText=info.active?'Update failed':running?'Updating':info.last?'Connected':'Waiting';
      view.status.setAttribute('aria-label',stateText);
      view.status.dataset.state=info.active?'error':running?'updating':info.last?'ok':'waiting';
      view.timer.textContent=running?'Updating…':next?seconds(next):'—';
      const source=timing.workerTiming?'Pi worker':window.linuxRuntime?'dashboard':'browser';
      view.card.title=`${view.title}: ${stateText}. Next ${source} API refresh: ${view.timer.textContent}. Last success: ${formatTime(info.last)}`;
      view.card.setAttribute('aria-label',view.card.title);
      view.incident.hidden=info.alerts.length===0;
      view.incident.textContent=info.active?'Problem':'Recovered · clear';
      view.incident.setAttribute('aria-label',`${view.title}: ${info.active?'Review update problem':'Recovered, review and clear alert'}`);
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
