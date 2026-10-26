/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. Pi DEV layout. */
(() => {
  'use strict';
  const piEdition = document.documentElement.dataset.devEdition !== 'web';
  document.body.classList.add(piEdition ? 'dev-pi-edition' : 'dev-web-edition');
  // A DEV view must never acquire the worker's automatic-write role, even if
  // runtime detection fails. Deliberate Apply still uses the existing engine.
  if (piEdition) canRunAutomaticActions = () => false;
  else {
    const originalAutoConnect = startAutoConnect;
    startAutoConnect = () => { if (new URLSearchParams(location.search).get('setup') !== '1') originalAutoConnect(); };
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
  const nav = Object.entries({overview:'Overview',schedules:'Schedules',rules:'Automations',history:'History',connections:'Connections',settings:'Settings'}).map(([page,label]) => `<button type="button" data-page="${page}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[page]}</svg><span>${label}</span></button>`).join('');
  shell.innerHTML = `<aside class="dev-rail"><div class="dev-brand"><img src="/octopus-foxess.svg" alt="" width="42" height="42"><div><strong>Smart Charging</strong><small>for Octopus Energy &amp; FoxESS</small></div></div><span class="dev-tag">HOME ENERGY</span><nav aria-label="Main navigation">${nav}</nav><div class="dev-rail-bottom"><button id="dev-about">About &amp; licences</button><small>Independent software by SCKC</small></div></aside><div class="dev-workspace"><header class="dev-appbar"><div><span class="dev-breadcrumb">Smart Charging</span><span aria-hidden="true">/</span><strong id="dev-page-name">Overview</strong></div><div class="dev-app-actions"><span class="dev-service">Pi service</span><button id="dev-theme" aria-label="Toggle light and dark appearance">◐</button></div></header><div class="dev-announcement">Automation runs on your Pi. You can close this dashboard.</div><div id="dev-content"></div></div>`;
  wrapper.before(shell);
  shell.querySelector('#dev-content').append(wrapper);
  if (!piEdition) {
    shell.querySelector('.dev-tag').textContent = 'HOME ENERGY';
    shell.querySelector('.dev-service').textContent = 'Browser must stay awake';
    shell.querySelector('.dev-announcement').textContent = 'Automation runs in this browser. Keep it open and awake.';

  }
  const sections = {};
  const titles = { overview:'Overview', schedules:'Schedules', rules:'Automations', history:'History', connections:'Connections', settings:'Settings' };
  const descriptions = {
    overview:'Your current power flow, dispatch windows, and FoxESS confirmation.',
    schedules:'The current inverter schedule and manual controls. Actions here affect real hardware.',
    rules:'Review charging and discharging preferences before applying them to the Pi worker.',
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
    sections.history.querySelector('header p').textContent = 'Pause and resume activity stored in this browser. The Pi edition also records power history.';
    sections.settings.querySelector('header p').textContent = 'Appearance, visible panels, configuration backups and browser data.';
    sections.connections.querySelector('header p').textContent = 'Account setup, Google relay, saved configuration and browser requirements.';
    sections.overview.querySelector('header p').textContent = 'Current power flow, Octopus dispatches and FoxESS schedules in this browser.';
    sections.rules.querySelector('header p').textContent = 'Review charging and discharging preferences before sending changes through your Google relay.';
  }
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
  inspector.innerHTML = `<h2>Worker &amp; safety</h2><div id="dev-worker-state" role="status">Waiting for the Pi worker…</div><dl><div><dt>Dispatch fetched</dt><dd id="dev-fetched">—</dd></div><div><dt>FoxESS confirmed</dt><dd id="dev-confirmed">—</dd></div><div><dt>Schedule periods</dt><dd id="dev-periods">—</dd></div><div><dt>Telemetry updated</dt><dd id="dev-telemetry-at">—</dd></div></dl><p>Smart Dispatch takes priority. The worker retains the last valid dispatch when an upstream check fails.</p><p>REST readback confirms schedule programming. Power readings show actual measured behaviour.</p><button id="dev-inspect-schedules">View schedules</button>`;
  move(inspector, 'overview');
  if (!piEdition) {
    inspector.querySelector('h2').textContent = 'Browser automation & safety';
    inspector.querySelector('dl').hidden = true;
    inspector.querySelector('p').textContent = 'The browser must remain open and awake to detect dispatches and maintain automation. Use the Pi edition for unattended operation.';
  }
  const integrations = document.createElement('section');
  integrations.className = 'card dev-integrations';
  integrations.innerHTML = '<h2>Pi administration</h2><p>Use the charger icon in the Pi taskbar to manage Octopus and FoxESS accounts, remote access and application updates.</p><p>This browser uses the settings stored on your Pi.</p><button id="dev-connection-menu">Open Settings</button>';
  move(integrations, 'connections');
  if (piEdition) {
    const updateInfo = document.createElement('section');
    updateInfo.className = 'card dev-integrations';
    updateInfo.innerHTML = '<h2>Updates &amp; recovery</h2><p>The existing graphical updater remains in the Pi taskbar → <strong>Configuration… → Update Raspberry Pi Edition</strong>. It installs the latest public GitHub release.</p><p>The current public update installs an earlier interface. This Pi receives updates separately while you review the new design.</p><p>Updates preserve encrypted configuration. History stays in the Pi data directory.</p>';
    move(updateInfo, 'settings');
  } else {
    integrations.innerHTML = '<h2>Account setup</h2><p>The web edition uses account details stored in this browser and your Google Apps Script relay for FoxESS.</p><div class="next-settings-actions"><button id="dev-edit-web-setup">Edit account setup</button><button id="dev-web-guide">Open web setup guide</button></div><h3>Browser operation</h3><p>Keep this browser open and awake. Use Settings to manage configuration backups, display preferences and saved browser data.</p><button id="dev-connection-menu">Open Settings</button>';
    document.getElementById('dev-edit-web-setup').addEventListener('click', () => { const url = new URL(location.href); url.searchParams.set('setup', '1'); location.assign(url); });
    document.getElementById('dev-web-guide').addEventListener('click', () => toggleDrawer('setup-guide-panel'));
  }
  const historyPanel = document.createElement('section');
  historyPanel.className = 'card dev-history';
  historyPanel.innerHTML = `<div class="dev-history-controls"><label>Month<input type="month" id="dev-history-month"></label><label>Measure<select id="dev-history-metric"><option value="loadsPower">Home demand</option><option value="pvPower">Solar generation</option><option value="gridConsumptionPower">Grid import</option><option value="feedinPower">Grid export</option><option value="batChargePower">Battery charge</option><option value="batDischargePower">Battery discharge</option><option value="SoC">Battery charge level</option></select></label><button id="dev-history-refresh">Refresh history</button><button id="dev-history-export">Download month CSV</button></div><p id="dev-history-status" role="status">History is collected by the Pi from existing telemetry. Open this page to load it.</p><div class="dev-history-chart"><canvas id="dev-history-chart" role="img" aria-label="Historical telemetry averages for the selected month and measure"></canvas></div><p class="dev-muted">Observed averages, not billing-grade energy totals. Missing readings stay as gaps. Recording starts when history storage is installed.</p>`;
  historyPanel.insertAdjacentHTML('beforeend', '<h2>Automation activity</h2><div id="history-activity" aria-live="polite"></div>');
  if (!piEdition) { historyPanel.querySelector('.dev-history-chart').hidden = true; configureWebHistory(); }
  function configureWebHistory() { historyPanel.querySelector('#dev-history-metric').closest('label').hidden = true; historyPanel.querySelector('.dev-muted').textContent = 'Activity is kept for 12 months, up to 2,000 entries. This browser must stay open and awake for automation.'; historyPanel.querySelector('#dev-history-export').hidden = true; }
  move(historyPanel, 'history');
  // Apply uses the unchanged scheduler engine, after an explicit review step.
  const reviewDialog = document.createElement('dialog');
  reviewDialog.className = 'dev-review-dialog';
  reviewDialog.innerHTML = `<h2>Apply automation changes?</h2><p>These are real Pi settings. Applying saves your rules and asks the existing worker to reconcile the inverter schedule.</p><dl id="dev-review-facts"></dl><p>Confirmation remains pending until the worker receives a matching official FoxESS REST readback.</p><div class="dev-dialog-actions"><button id="dev-review-cancel">Cancel</button><button id="dev-review-apply">Apply to Pi</button></div>`;
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
    viewUrl.searchParams.set('view', name);
    history.replaceState(null, '', viewUrl);
    if (name === 'history') void loadHistory();
    schedulePriceChartResize();
  }
  shell.querySelectorAll('nav button[data-page]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.page)));
  document.getElementById('dev-inspect-schedules').addEventListener('click', () => navigate('schedules'));
  document.getElementById('dev-theme').addEventListener('click', toggleDarkMode);
  // Legacy controls use the same Settings page instead of a second menu.
  toggleAppMenu = () => navigate('settings');
  document.getElementById('dev-connection-menu').addEventListener('click', () => navigate('settings'));
  document.getElementById('dev-about').addEventListener('click', () => openLicenseModal(false));
  function updateWorkerView() {
    const snapshot = window.linuxDispatchSnapshot;
    const state = document.getElementById('dev-worker-state');
    const messages = { waiting:'Waiting for worker', syncing:'Writing schedule · awaiting REST readback', confirmed:'Schedule confirmed by FoxESS REST', failed:'Schedule confirmation failed', disabled:'Dispatch sync disabled' };
    state.textContent = piEdition
      ? (snapshot ? (messages[snapshot.status] || 'Unknown worker state') : 'Waiting for authenticated Pi data')
      : (dashboard.classList.contains('visible') ? 'Automation runs in this browser. Keep it open and awake.' : 'Connect your accounts to start.');
    if (window.automationControl?.isPaused()) state.textContent = 'App schedule control is paused or unavailable. Monitoring continues.';
    state.dataset.status = window.automationControl?.isPaused() ? 'paused' : snapshot?.status || 'waiting';
    if (snapshot?.error) state.textContent += `: ${snapshot.error}`;
    const format = value => value ? new Date(value).toLocaleString() : '—';
    document.getElementById('dev-fetched').textContent = format(snapshot?.fetchedAt);
    document.getElementById('dev-confirmed').textContent = format(snapshot?.confirmedAt);
    document.getElementById('dev-periods').textContent = `${(window.activeFoxGroups || []).length} / 5`;
    document.getElementById('dev-telemetry-at').textContent = format(window.lastFoxTelemetryUpdate);
    if (currentPage === 'history' && historyData === null && piEdition && window.linuxRuntime) void loadHistory();
  }
  let historyData = null;
  let historyChart = null;
  let historyLoading = false;
  const monthInput = document.getElementById('dev-history-month');
  monthInput.value = new Date().toISOString().slice(0, 7);
  monthInput.max = monthInput.value;
  const metricInput = document.getElementById('dev-history-metric');
  const historyStatus = document.getElementById('dev-history-status');
  function drawHistory() {
    if (!historyData) return;
    const activity = document.getElementById('history-activity'); activity.replaceChildren();
    for (const event of historyData.events || []) {
      const row = document.createElement('div'); row.className = 'next-activity-row';
      const title = document.createElement('strong'); title.textContent = ({ automation_paused: 'Automation paused', automation_resumed: 'Automation resumed', pause_expired: 'Timed pause ended' })[event.type] || event.type;
      const detail = document.createElement('p'); detail.textContent = `${new Date(event.at).toLocaleString()}${event.type === 'automation_paused' ? (event.until ? ` · Until ${new Date(event.until).toLocaleString()}` : ' · Until manually resumed') : ''}`; row.append(title, detail); activity.append(row);
    }
    if (!activity.children.length) activity.textContent = 'No automation activity recorded for this month.';
    if (!piEdition) { historyStatus.textContent = 'Pause and resume activity on this browser · 12-month retention'; return; }
    const metric = metricInput.value;
    const metricName = metricInput.selectedOptions[0].textContent;
    const points = historyData.points;
    const monthStart = Date.parse(`${historyData.month}-01T00:00:00Z`);
    const monthDate = new Date(monthStart);
    const monthEnd = Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1);
    const byTime = new Map(points.map(point => [Date.parse(point.at), point.values[metric]]));
    const times = [...byTime.keys()];
    const chartStart = times.length ? Math.max(monthStart, times[0] - 15 * 60_000) : monthStart;
    const chartEnd = times.length ? Math.min(monthEnd - 1, times[times.length - 1] + 15 * 60_000) : monthEnd - 1;
    const values = [];
    if (times.length) {
      for (let time = times[0]; time <= times[times.length - 1]; time += 15 * 60_000) {
        values.push({ x:time, y:byTime.get(time) ?? null });
      }
    }
    const style = getComputedStyle(document.documentElement);
    historyChart?.destroy();
    historyChart = new Chart(document.getElementById('dev-history-chart'), {
      type:'line', data:{ datasets:[{ label:metricName, data:values, borderColor:style.getPropertyValue('--accent').trim(), borderWidth:2, pointRadius:values.length < 3 ? 3 : 0, spanGaps:false }] },
      options:{ responsive:true, maintainAspectRatio:false, animation:false, parsing:false,
        interaction:{mode:'nearest',intersect:false}, plugins:{legend:{display:false}, tooltip:{callbacks:{title:items=>items.length?new Date(items[0].parsed.x).toLocaleString():''}}},
        scales:{ x:{type:'linear',min:chartStart,max:chartEnd,ticks:{maxTicksLimit:7,color:style.getPropertyValue('--text-muted'),callback:value=>chartEnd-chartStart<=3*86400000?new Date(value).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}):new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short'})}},
          y:{beginAtZero:true,max:metric==='SoC'?100:undefined,title:{display:true,text:metric==='SoC'?'Charge level (%)':'Average power (kW)',color:style.getPropertyValue('--text-muted')},ticks:{color:style.getPropertyValue('--text-muted')}} }
      }
    });
    const bytes = historyData.storageBytes;
    historyStatus.textContent = `${points.length} recorded ${points.length === 1 ? 'interval' : 'intervals'} in ${historyData.month} · ${bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1)+' KB' : (bytes / 1024 / 1024).toFixed(2)+' MB'} used on Pi · ${historyData.retentionMonths}-month retention` + (points.length ? '' : ' · No readings recorded for this month yet.');
  }
  async function loadHistory() {
    if (historyLoading || (piEdition && !window.linuxRuntime) || !dashboard.classList.contains('visible')) return;
    historyLoading = true;
    historyStatus.textContent = 'Loading recorded telemetry…';
    try {
      historyData = piEdition ? await fetchJson(`/api/history?month=${encodeURIComponent(monthInput.value)}`) : { events: window.automationControl.events().filter(event => event.at.slice(0, 7) === monthInput.value) };
      drawHistory();
    } catch (error) { historyStatus.textContent = `History unavailable: ${error.message}`; }
    finally { historyLoading = false; }
  }
  window.addEventListener('history-settings-change', () => { historyData = null; if (currentPage === 'history') void loadHistory(); });
  window.addEventListener('automation-control-change', () => { if (currentPage === 'history') void loadHistory(); });
  monthInput.addEventListener('change', loadHistory);
  metricInput.addEventListener('change', drawHistory);
  document.getElementById('dev-history-refresh').addEventListener('click', loadHistory);
  document.getElementById('dev-history-export').addEventListener('click', () => {
    if (!historyData?.points.length) { historyStatus.textContent = 'Choose a month with recorded data before exporting.'; return; }
    const fields = historyData.fields;
    const csv = ['timestamp_utc,' + fields.map(field => field + (field === 'SoC' ? '_percent' : '_kW')).join(','), ...historyData.points.map(point => [point.at, ...fields.map(field => point.values[field] ?? '')].join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = `home-energy-${historyData.month}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  new MutationObserver(() => { if (currentPage === 'history') drawHistory(); }).observe(document.documentElement, {attributes:true,attributeFilter:['data-theme']});
  updateWorkerView(); setInterval(updateWorkerView, 5000);
  const initialView = new URLSearchParams(location.search).get('view');
  navigate(Object.hasOwn(titles, initialView) ? initialView : 'overview');
})();
