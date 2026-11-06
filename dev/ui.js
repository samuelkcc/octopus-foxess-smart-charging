/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. Pi DEV layout. */
// Shared presentation; edition adapters own data and mutations.
window.installPauseSwitch = button => {
  button.type='button';button.className='next-pause-switch';button.setAttribute('role','switch');
  button.setAttribute('aria-label','Automation control');
  button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v9"/><path d="M7 5.5a8 8 0 1 0 10 0"/></svg>';
  const sync=({paused=false,pending=false,available=true,enabled=true}={})=>{
    const running=available && enabled && !paused;
    button.setAttribute('aria-checked',String(running));
    button.dataset.state=pending?'pending':!available?'unavailable':running?'running':'stopped';
    button.disabled=pending || !available || !enabled;
    button.title=pending?'Updating automation…':!available?'Device status unavailable':!enabled?'Enable automation in Settings':paused?'Automation paused. Select to resume.':'Automation running. Select to pause.';
  };
  sync({available:false});return sync;
};
window.installReviewHeader = node => {
  if(node.querySelector('.next-dialog-header'))return;
  const heading=node.querySelector('h2');if(!heading)return;
  const header=document.createElement('header');header.className='next-dialog-header';heading.before(header);header.append(heading);
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close dialog');close.addEventListener('click',()=>node.close());header.append(close);
  heading.id ||= `dialog-title-${document.querySelectorAll('[id^="dialog-title"]').length}`;
  node.setAttribute('aria-labelledby',heading.id);
};
window.installPauseBanner = (shell,onResume) => {
  const banner=document.createElement('section');banner.className='next-pause-banner';banner.hidden=true;banner.setAttribute('role','status');
  const copy=document.createElement('div'),resume=document.createElement('button');resume.type='button';resume.textContent='Resume automation';resume.addEventListener('click',onResume);
  banner.append(copy,resume);shell.querySelector('.dev-appbar').after(banner);
  return (state,connected=true)=>{
    banner.hidden=!connected || (!state.paused && !state.pending && state.available);
    banner.dataset.unavailable=String(!state.available && !state.paused);
    const title=document.createElement('strong'),message=document.createElement('p');
    title.textContent=state.paused?'Automation paused':state.pending?'Updating automation control…':'Schedule control unavailable';
    message.textContent=state.paused
      ? `${state.until?`Paused until ${new Date(state.until).toLocaleString()}.`:'Paused until you resume.'} App schedule commands are blocked. Monitoring continues. Use the FoxESS app for temporary settings.`
      : 'The app will not send schedule commands until the control state is confirmed.';
    copy.replaceChildren(title,message);
    if(state.auditWarning){const warning=document.createElement('p');warning.textContent='The pause state is saved, but History could not record this change. Check host storage.';copy.append(warning);}
    resume.hidden=!state.paused;resume.disabled=state.pending || !state.available;
  };
};
window.installDashboardAbout = (shell,button) => {
  let footer=shell.querySelector('.dev-rail-bottom');
  if(!footer){footer=document.createElement('div');footer.className='dev-rail-bottom';shell.querySelector('.dev-rail').append(footer);}
  button.type='button';button.setAttribute('aria-haspopup','dialog');
  button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></svg><span>About &amp; licence</span>';
  footer.append(button);
};
window.dashboardPageCopy = {
  overview:['Home energy','Current power, charging windows and inverter confirmation.'],
  schedules:['Schedules','The current inverter schedule and manual controls. Actions here affect real hardware.'],
  rules:['Automations','Review charging and discharging preferences before applying them.'],
  history:['History','Browse recorded power averages and automation activity. Manage retention in Settings.'],
  connections:['Connections','Account, device and service connection status.']
};
window.installDashboardHeadings = shell => {
  for(const [page,[title,description]] of Object.entries(window.dashboardPageCopy)){
    const heading=shell.querySelector(`[data-page="${page}"] .dev-page-heading`);
    heading.querySelector('h1').textContent=title;heading.querySelector('p').textContent=description;
    heading.querySelector(':scope>span')?.remove();
  }
};
(() => {
  if(document.documentElement.dataset.devEdition==='esp32-dashboard'){
    const D=window.esp32Dashboard;
    document.querySelectorAll('.dev-review-dialog:not(.history-expanded)').forEach(window.installReviewHeader);
    window.installDashboardAbout(document.getElementById('dev-shell'),document.getElementById('open-about'));
    window.installDashboardHeadings(document.getElementById('dev-shell'));
    D.syncPauseSwitch=window.installPauseSwitch(document.getElementById('esp-header-pause'));
    D.syncPauseBanner=window.installPauseBanner(document.getElementById('dev-shell'),()=>document.getElementById('esp-resume').click());
    document.querySelector('.esp-manual-details').open=matchMedia('(min-width:761px) and (hover:hover)').matches;
    document.querySelectorAll('.dev-rail nav button').forEach(button=>button.addEventListener('click',()=>D.navigate(button.dataset.page)));
    const theme=value=>{
      document.documentElement.dataset.theme=value;
      try{localStorage.setItem('smartChargingTheme',value);}catch{}
      document.querySelectorAll('[data-esp-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.espTheme===value)));
      if(D.state())D.render(D.state());
      if(D.page==='history')D.renderHistory(D.history());
    };
    try{theme(localStorage.getItem('smartChargingTheme')==='light'?'light':'dark');}catch{theme('dark');}
    document.getElementById('dev-theme').addEventListener('click',()=>theme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
    document.querySelectorAll('[data-esp-theme]').forEach(button=>button.addEventListener('click',()=>theme(button.dataset.espTheme)));
    document.getElementById('esp-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{D.notice('Full screen is unavailable in this browser.');}});
    document.getElementById('esp-refresh').addEventListener('click',()=>void D.refresh().catch(error=>D.notice(error.message,true)));
    return;
  }

  'use strict';
  const hostName = document.documentElement.dataset.devEdition === 'desktop' ? 'PC' : 'Pi';
  const piEdition = document.documentElement.dataset.devEdition !== 'web';
  document.body.classList.add(piEdition ? 'dev-pi-edition' : 'dev-web-edition');
  // A DEV view must never acquire the worker's automatic-write role, even if
  // runtime detection fails. Deliberate Apply still uses the existing engine.
  if (piEdition) canRunAutomaticActions = () => false;
  else {
    // Restored web credentials prepare Welcome. Only Connect starts API access.
    startAutoConnect = () => {};
  }
  const wrapper = document.querySelector('.app-wrapper');
  const dashboard = document.getElementById('dashboard');
  const overview = dashboard.querySelector('.energy-overview-card');
  const shell = document.createElement('div');
  shell.id = 'dev-shell';
  const navIcons = {
    overview:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    schedules:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    rules:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
    history:'<path d="M4 4v16h17M8 15l4-5 4 3 5-8"/>',
    connections:'<path d="m9 15 6-6m-7 9-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 8a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1"/>',
    settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>'
  };
  const nav = Object.entries({overview:'Overview',schedules:'Schedules',rules:'Automations',history:piEdition?'History':'Activity',connections:'Connections',settings:'Settings'}).map(([page,label]) => `<button type="button" data-page="${page}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[page]}</svg><span>${label}</span></button>`).join('');
  shell.innerHTML = `<aside class="dev-rail"><div class="dev-brand"><img src="/octopus-foxess.svg" alt="" width="42" height="42"><div><strong>Smart Charging</strong><small>for Octopus Energy &amp; FoxESS</small></div></div><span class="dev-tag">HOME ENERGY</span><nav aria-label="Main navigation">${nav}</nav><div class="dev-rail-bottom"><button id="dev-about">About &amp; licences</button></div></aside><div class="dev-workspace"><header class="dev-appbar"><div><span class="dev-breadcrumb">Smart Charging</span><span class="dev-breadcrumb-separator" aria-hidden="true">/</span><strong id="dev-page-name">Overview</strong></div><div class="dev-app-actions"><span class="dev-service" hidden></span><button id="dev-theme" aria-label="Toggle light and dark appearance">◐</button></div></header><div class="dev-announcement">Automation runs on your ${hostName}. You can close this dashboard.</div><div id="dev-content"></div></div>`;
  // The app theme selects both brand and browser-tab artwork.
  const syncBrandTheme = () => {
    const key = document.documentElement.dataset.theme === 'light' ? 'iconLight' : 'iconDark';
    document.querySelectorAll('[data-icon-light][data-icon-dark]').forEach(element => {
      const attribute = element.tagName === 'LINK' ? 'href' : 'src';
      const source = element.dataset[key];
      if (element.getAttribute(attribute) !== source) element.setAttribute(attribute, source);
    });
  };
  new MutationObserver(syncBrandTheme).observe(document.documentElement, {attributes:true,attributeFilter:['data-theme']});
  wrapper.before(shell);
  syncBrandTheme();
  window.installDashboardAbout(shell,document.getElementById('dev-about'));
  shell.querySelector('#dev-content').append(wrapper);
  // Credits, licence terms, and build details remain in About.
  wrapper.querySelector('.app-footer')?.remove();
  if (!piEdition) {
    shell.querySelector('.dev-tag').textContent = 'HOME ENERGY';
    shell.querySelector('.dev-service').textContent = 'Browser must stay awake';
    shell.querySelector('.dev-announcement').textContent = 'Automation runs in this browser. Keep it open and awake.';

  }
  const sections = {};
  const titles = { overview:'Overview', schedules:'Schedules', rules:'Automations', history:piEdition?'History':'Activity', connections:'Connections', settings:'Settings' };
  const descriptions = {
    overview:'Your current power flow, dispatch windows, and FoxESS confirmation.',
    schedules:'The current inverter schedule and manual controls. Actions here affect real hardware.',
    rules:`Review charging and discharging preferences before applying them to the ${hostName} worker.`,
    history:'Browse recorded power averages and automation activity. Manage retention in Settings.',
    connections:'Account, device and service connection status.',
    settings:'Appearance, visible panels, telemetry and access on this device.'
  };
  for (const name of Object.keys(titles)) {
    const section = document.createElement('section');
    section.className = 'dev-page';
    section.dataset.page = name;
    section.innerHTML = `<header class="dev-page-heading"><h1>${titles[name]}</h1><p>${descriptions[name]}</p></header><div class="dev-page-grid"></div>`;
    dashboard.append(section);
    sections[name] = section;
  }
  if (!piEdition) {
    sections.history.querySelector('header p').textContent = 'Review, export, or import pause and resume activity stored in this browser.';
    sections.settings.querySelector('header p').textContent = 'Appearance, visible panels, configuration backups and browser data.';
    sections.connections.querySelector('header p').textContent = 'Account setup, Google relay, saved configuration and browser requirements.';
    sections.overview.querySelector('header p').textContent = 'Current power flow, Octopus dispatches and FoxESS schedules in this browser.';
    sections.rules.querySelector('header p').textContent = 'Review charging and discharging preferences before sending changes through your Google relay.';
  }
  window.installDashboardHeadings(shell);
  const move = (element, page) => { if (element) sections[page].querySelector('.dev-page-grid').append(element); };
  move(overview, 'overview');
  move(document.getElementById('section-intelligent-octopus'), 'overview');
  move(document.getElementById('section-foxess-mode'), 'schedules');
  move(document.getElementById('section-smart-charging'), 'rules');
  move(document.getElementById('section-smart-discharging'), 'rules');
  move(document.getElementById('section-device-settings'), 'connections');
  dashboard.querySelectorAll('.dashboard-column').forEach(column => column.remove());
  const inspector = document.createElement('aside');
  inspector.className = 'dev-inspector card';
  inspector.innerHTML = `<h2>Worker &amp; safety</h2><div id="dev-worker-state" role="status">Waiting for the ${hostName} worker…</div><dl><div><dt>Dispatch fetched</dt><dd id="dev-fetched">—</dd></div><div><dt>FoxESS confirmed</dt><dd id="dev-confirmed">—</dd></div><div><dt>Schedule periods</dt><dd id="dev-periods">—</dd></div><div><dt>Telemetry updated</dt><dd id="dev-telemetry-at">—</dd></div></dl><p>Smart Dispatch takes priority. The worker retains the last valid dispatch when an upstream check fails.</p><p>REST readback confirms schedule programming. Power readings show actual measured behaviour.</p><button id="dev-inspect-schedules">View schedules</button>`;
  move(inspector, 'overview');
  if (!piEdition) {
    inspector.querySelector('h2').textContent = 'Browser automation & safety';
    inspector.querySelector('dl').hidden = true;
    inspector.querySelector('p').textContent = 'The browser must remain open and awake to detect dispatches and maintain automation. Use the Pi edition for unattended operation.';
  }
  const integrations = document.createElement('section');
  integrations.className = 'card dev-integrations';
  if (!piEdition) move(integrations, 'connections');
  if (piEdition) {
    const updateInfo = document.createElement('section');
    updateInfo.className = 'card dev-integrations';
    updateInfo.innerHTML = '<h2>Updates &amp; recovery</h2><p>Update the Pi from the taskbar → <strong>Configuration… → Update Raspberry Pi Edition</strong>.</p><p>The updater installs the latest public release from GitHub.</p><p>Updates preserve encrypted configuration. History stays in the Pi data directory.</p>';
    if(hostName==='PC')updateInfo.innerHTML='<h2>Updates &amp; recovery</h2><p>Close Smart Charging before replacing the portable EXE. Settings and history remain in your Windows user profile.</p>';
    move(updateInfo, 'settings');
  } else {
    integrations.innerHTML = '<h2>Account setup</h2><p>The web edition uses account details stored in this browser and your Google Apps Script relay for FoxESS.</p><div class="next-settings-actions"><button id="dev-edit-web-setup">Edit account setup</button><button id="dev-web-guide">Open web setup guide</button></div><h3>Browser operation</h3><p>Keep this browser open and awake. Use Settings to manage configuration backups, display preferences and saved browser data.</p><button id="dev-connection-menu">Open Settings</button>';
    document.getElementById('dev-edit-web-setup').addEventListener('click', () => { const url = new URL(location.href); url.searchParams.set('setup', '1'); location.assign(url); });
    document.getElementById('dev-web-guide').addEventListener('click', () => toggleDrawer('setup-guide-panel'));
  }
  const historyPanel = document.createElement('section');
  historyPanel.className = 'card dev-history';
  const historyView = piEdition
    ? window.installHistoryView(historyPanel, {piEdition,isVisible:()=>currentPage === 'history' && dashboard.classList.contains('visible')})
    : window.installActivityView(historyPanel, {isVisible:()=>currentPage === 'history' && dashboard.classList.contains('visible')});
  const loadHistory = () => historyView.load();
  move(historyPanel, 'history');
  // Apply uses the unchanged scheduler engine, after an explicit review step.
  const reviewDialog = document.createElement('dialog');
  reviewDialog.className = 'dev-review-dialog';
  reviewDialog.innerHTML = `<h2>Apply automation changes?</h2><p>These are real ${hostName} settings. Applying saves your rules and asks the existing worker to reconcile the inverter schedule.</p><dl id="dev-review-facts"></dl><p>Confirmation remains pending until the worker receives a matching official FoxESS REST readback.</p><div class="dev-dialog-actions"><button id="dev-review-cancel">Cancel</button><button id="dev-review-apply">Apply to ${hostName}</button></div>`;
  document.body.append(reviewDialog);
  if (!piEdition) {
    reviewDialog.querySelector('p').textContent = 'These are real inverter settings. Applying saves your browser rules and sends the schedule through your configured Google relay.';
    reviewDialog.querySelectorAll('p')[1].textContent = 'Confirmation remains pending until this browser receives a matching FoxESS REST readback through your Google relay.';
    document.getElementById('dev-review-apply').textContent = 'Apply changes';
  }
  let pendingApply = null;
  for (const id of ['btn-save-unified', 'btn-save-discharge']) {
    const button = document.getElementById(id);
    button.removeAttribute('onclick');
    button.dataset.defaultLabel = 'Review & apply';
    button.textContent = 'Review & apply';
    button.addEventListener('click', () => {
      if (!dashboard.classList.contains('visible') || (piEdition && (!window.linuxRuntime || window.linuxRole !== 'dashboard'))) { showToast('Connect to the dashboard before applying changes.'); return; }
      if (window.automationControl?.isPaused()) { showToast('Resume automation before applying schedules.'); return; }
      pendingApply = button;
      const facts = document.getElementById('dev-review-facts');
      facts.replaceChildren();
      const read = id => document.getElementById(id);
      const entries = [
        ['Smart Dispatch', read('toggle-auto-dispatch').checked ? 'Enabled' : 'Disabled'],
        ['Dispatch target SOC', read('toggle-dispatch-soc-limit').checked ? `${read('dispatch-soc-limit').value}%` : 'Inverter default'],
        ['Weekly forced charge', read('toggle-weekly-force').checked ? `${read('weekly-force-start').value}–${read('weekly-force-end').value}` : 'Disabled'],
        ['Target-price charge', read('toggle-auto-price').checked ? `At or below ${read('price-threshold').value} p/kWh` : 'Disabled'],
        ['Export-price discharge', read('toggle-auto-export').checked ? `At or above ${read('export-threshold').value} p/kWh` : 'Disabled'],
        ['Weekly discharge', read('toggle-weekly-discharge').checked ? `${read('weekly-discharge-start').value}–${read('weekly-discharge-end').value}` : 'Disabled'],
        ['Dispatch discharge protection', read('toggle-discharge-pause-dispatch').checked ? 'Enabled' : 'Disabled'],
        ['Minimum charge level on grid', `${read('adv-min-soc').value}%`],
        ['Maximum forced-mode power', `${read('adv-fd-pwr').value} W`]
      ];
      entries.forEach(([label, value]) => {
        const row = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd');
        dt.textContent = label; dd.textContent = value; row.append(dt, dd); facts.append(row);
      });
      reviewDialog.showModal();
    });
  }
  document.getElementById('dev-review-cancel').addEventListener('click', () => reviewDialog.close());
  document.getElementById('dev-review-apply').addEventListener('click', async () => {
    reviewDialog.close();
    if (pendingApply) {
      try { await evaluateLocalAutomations(pendingApply); }
      catch (error) { showToast(`Unable to apply: ${error.message}`); resetAutomationApplyButton(pendingApply); }
    }
  });
  window.dashboardNavigation = {
    navigate: name => navigate(name),
    register(name, title, description) {
      if (sections[name]) throw new Error('Dashboard page already exists');
      titles[name] = title;
      const section = document.createElement('section');
      section.className = 'dev-page'; section.dataset.page = name; section.hidden = true;
      const heading = document.createElement('header'); heading.className = 'dev-page-heading';
      const label = document.createElement('h1'); label.textContent = title;
      const copy = document.createElement('p'); copy.textContent = description;
      heading.append(label, copy);
      const grid = document.createElement('div'); grid.className = 'dev-page-grid';
      section.append(heading, grid); dashboard.append(section); sections[name] = section;
      const button = document.createElement('button'); button.type = 'button'; button.dataset.page = name;
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg>';
      const caption = document.createElement('span'); caption.textContent = title; button.append(caption);
      button.addEventListener('click', () => navigate(name));
      const settings = shell.querySelector('nav button[data-page="settings"]'); settings.before(button);
      return grid;
    }
  };
  let currentPage = 'overview';
  function navigate(name) {

    if (!sections[name]) return;
    currentPage = name;
    closeAllDrawers();
    window.scrollTo({top:0,left:0});
    Object.entries(sections).forEach(([key, section]) => { section.hidden = key !== name; });
    shell.querySelectorAll('[data-page]').forEach(button => {
      if (button.tagName !== 'BUTTON') return;
      button.setAttribute('aria-current', button.dataset.page === name ? 'page' : 'false');
    });
    document.getElementById('dev-page-name').textContent = titles[name];
    const viewUrl = new URL(location.href);
    viewUrl.searchParams.set('view', !piEdition && name==='history'?'activity':name);
    history.replaceState(null, '', viewUrl);
    if (name === 'history') void loadHistory();
    schedulePriceChartResize();
  }
  shell.querySelectorAll('nav button[data-page]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.page)));
  document.getElementById('dev-inspect-schedules').addEventListener('click', () => navigate('schedules'));
  document.getElementById('dev-theme').addEventListener('click', toggleDarkMode);
  // Legacy controls use the same Settings page instead of a second menu.
  toggleAppMenu = () => navigate('settings');
  document.getElementById('dev-connection-menu')?.addEventListener('click', () => navigate('settings'));
  document.getElementById('dev-about').addEventListener('click', () => openLicenseModal(false));
  function updateWorkerView() {
    const snapshot = window.linuxDispatchSnapshot;
    const state = document.getElementById('dev-worker-state');
    const messages = { waiting:'Waiting for worker', syncing:'Writing schedule · awaiting REST readback', confirmed:'Schedule confirmed by FoxESS REST', failed:'Schedule confirmation failed', disabled:'Dispatch sync disabled' };
    state.textContent = piEdition
      ? (snapshot ? (messages[snapshot.status] || 'Unknown worker state') : `Waiting for authenticated ${hostName} data`)
      : (dashboard.classList.contains('visible') ? 'Automation runs in this browser. Keep it open and awake.' : 'Connect your accounts to start.');
    if (window.automationControl?.isPaused()) state.textContent = 'App schedule control is paused or unavailable. Monitoring continues.';
    state.dataset.status = window.automationControl?.isPaused() ? 'paused' : snapshot?.status || 'waiting';
    if (snapshot?.error) state.textContent += `: ${snapshot.error}`;
    const format = value => value ? new Date(value).toLocaleString() : '—';
    document.getElementById('dev-fetched').textContent = format(snapshot?.fetchedAt);
    document.getElementById('dev-confirmed').textContent = format(snapshot?.confirmedAt);
    document.getElementById('dev-periods').textContent = `${(window.activeFoxGroups || []).length} / 5`;
    document.getElementById('dev-telemetry-at').textContent = format(window.lastFoxTelemetryUpdate);
    if (currentPage === 'history' && historyView.needsLoad() && (!piEdition || window.linuxRuntime)) void loadHistory();
  }
  updateWorkerView(); setInterval(updateWorkerView, 5000);
  const requestedView = new URLSearchParams(location.search).get('view');
  const initialView = !piEdition && requestedView==='activity'?'history':requestedView;
  navigate(Object.hasOwn(titles, initialView) ? initialView : 'overview');
})();
