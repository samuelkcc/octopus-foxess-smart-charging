/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. Shared Overview update controls. */
(() => {
  const make=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
  const action=(text,handler)=>{const node=make('button',text);node.type='button';node.addEventListener('click',handler);return node;};
  const panel=make('section','','overview-updates');
  panel.setAttribute('aria-label','API refresh status');
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
    const refresh=action('',async()=>{await refreshOverviewNow();render();});refresh.className='overview-service-refresh';
    const ring=make('span','','overview-api-ring');ring.setAttribute('aria-hidden','true');
    ring.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17"/></svg>';
    refresh.append(ring,make('span',name==='octopus'?'Octopus':'FoxESS','overview-update-name'));
    const incident=action('!',()=>{selected=name;feedback.textContent='';render();dialog.showModal();});incident.className='overview-error-button';incident.hidden=true;
    card.append(refresh,incident);grid.append(card);views[name]={title,refresh,ring,incident,card};
  }
  document.querySelector('#dev-shell .dev-app-actions').append(panel);
  const formatTime=value=>value?new Date(value).toLocaleString():'No successful update recorded yet';
  function summary(snapshot,name) {
    const sources=[snapshot.local.services[name],snapshot.remote?.services[name]].filter(Boolean);
    return {sources,failures:sources.flatMap(source=>source.failures),alerts:sources.filter(source=>source.alert).map(source=>source.alert),active:sources.some(source=>source.state==='error'),last:sources.map(source=>source.lastSuccessAt).filter(Boolean).sort().at(-1)};
  }
  function render() {
    const snapshot=window.integrationMonitor.snapshot();const timing=getOverviewRefreshStatus();
    for(const [name,view] of Object.entries(views)) {
      const info=summary(snapshot,name);
      // Pi countdowns describe the worker, not frequent cached dashboard reads.
      const running=Boolean(timing.workerTiming?timing.workerBusy[name]:snapshot.busy[name]);
      const stateText=info.active?'Connection problem':running?'Reading API':info.last?'Connected':'Waiting';
      view.refresh.disabled=timing.running;
      view.refresh.setAttribute('aria-busy',String(running));
      view.ring.dataset.state=info.active?'error':running?'updating':info.last?'ok':'waiting';
      view.refresh.title=`${view.title}: ${stateText}. Last success: ${formatTime(info.last)}. Select to reload API data.`;
      view.refresh.setAttribute('aria-label',`${view.title}: ${stateText}. Reload API data`);
      view.incident.hidden=info.alerts.length===0;
      view.incident.title=info.active?'Review connection problem':'Recovered. Review and clear saved alert.';
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
    details.append(make('p',info.active?'The service still has a problem. Select the API refresh button to retry. This alert stays until the service recovers and you clear it.':'Updates have recovered. The saved alert remains until you select Clear alert.'));
    clear.disabled=info.active || info.alerts.length===0;
  }
  window.addEventListener('integration-status-change',render);
  new MutationObserver(()=>{render();void window.integrationMonitor.pollPi();}).observe(document.getElementById('dashboard'),{attributes:true,attributeFilter:['class']});
  render();setInterval(render,1000);
})();
