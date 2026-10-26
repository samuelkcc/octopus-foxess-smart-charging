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
  shell.innerHTML = `<aside class="dev-rail"><div class="dev-brand"><img src="/octopus-foxess.svg" alt="" width="38" height="38"><div><strong>Smart Charging</strong><small>for Octopus Energy &amp; FoxESS</small></div></div><span class="dev-tag">PI DEV · REAL DATA</span><nav aria-label="Main navigation"><button data-page="overview">Overview</button><button data-page="schedules">Schedules</button><button data-page="rules">Automations</button><button data-page="history">History</button><button data-page="connections">Connections</button></nav><div class="dev-rail-bottom"><button id="dev-about">About &amp; licenses</button><a href="/?client=1">Open original dashboard ↗</a><small>Independent software by SCKC</small></div></aside><div class="dev-workspace"><header class="dev-appbar"><div>Smart Charging <span>/</span> <strong id="dev-page-name">Overview</strong></div><div class="dev-app-actions"><span class="dev-service">Existing Pi worker</span><button id="dev-theme" aria-label="Toggle light and dark appearance">◐</button><button id="dev-menu">Menu</button></div></header><div class="dev-announcement">DEV interface · connected to your real Pi · existing automation worker remains in control.</div><div id="dev-content"></div></div>`;
  wrapper.before(shell);
  shell.querySelector('#dev-content').append(wrapper);
  if (!piEdition) {
    shell.querySelector('.dev-tag').textContent = 'WEB DEV · BROWSER EDITION';
    shell.querySelector('.dev-service').textContent = 'Browser must stay awake';
    shell.querySelector('.dev-announcement').textContent = 'Web DEV · automation runs in this browser · keep it open and awake · Google relay required for FoxESS.';
    shell.querySelector('[data-page="history"]').hidden = true;
    const fallback = shell.querySelector('.dev-rail-bottom a');
    fallback.href = 'https://samuelkcc.github.io/octopus-foxess-smart-charging/';
    fallback.target = '_blank'; fallback.rel = 'noopener noreferrer';
  }
  const sections = {};
  const titles = { overview:'Overview', schedules:'Schedules', rules:'Automations', history:'History', connections:'Connections' };
  const descriptions = {
    overview:'Your current power flow, dispatch windows, and FoxESS confirmation.',
    schedules:'The current inverter schedule and manual controls. Actions here affect real hardware.',
    rules:'Review charging and discharging preferences before applying them to the Pi worker.',
    history:'Browse compact 15-minute averages retained on this Pi for up to 24 months.',
    connections:'Live connection status. Manage service credentials in the Pi taskbar’s Server Configuration.'
  };
  for (const name of Object.keys(titles)) {
    const section = document.createElement('section');
    section.className = 'dev-page';
    section.dataset.page = name;
    section.innerHTML = `<header class="dev-page-heading"><span>HOME ENERGY · ${piEdition ? 'PI' : 'WEB'} DEV</span><h1>${titles[name]}</h1><p>${descriptions[name]}</p></header><div class="dev-page-grid"></div>`;
    dashboard.append(section);
    sections[name] = section;
  }
  if (!piEdition) {
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
    inspector.querySelector('p').textContent = 'The browser must remain open and awake to detect dispatches and maintain automation. Use the Pi edition for unattended operation.';
  }
  const integrations = document.createElement('section');
  integrations.className = 'card dev-integrations';
  integrations.innerHTML = `<h2>Pi connection settings</h2><p>The Pi manages Octopus and FoxESS credentials. Use its charger icon → <strong>Server Configuration…</strong> to edit them.</p><h3>Remote access</h3><p>Use the charger icon → <strong>Remote Access…</strong> for the current public URL and key.</p><ul><li>The URL stays the same while the tunnel runs. Reboots, app updates, or tunnel restarts generate a new address.</li><li>Remote browser login lasts up to 12 hours. Sign in again with the same key.</li><li>The remote key remains valid until you replace it.</li></ul><h3>Copying through Pi Connect</h3><p>First press the app’s <strong>Copy Key</strong> button; then choose Pi Connect’s <strong>Copy from remote</strong>. Copying the hidden field can give you dots.</p><h3>iPhone Home Screen</h3><p>In Safari, use Share → Add to Home Screen. The shortcut saves this URL; update it after a Quick Tunnel URL changes.</p><button id="dev-connection-menu">Telemetry &amp; display settings</button>`;
  move(integrations, 'connections');
  if (piEdition) {
    const updateInfo = document.createElement('section');
    updateInfo.className = 'card dev-integrations';
    updateInfo.innerHTML = '<h2>Updates &amp; recovery</h2><p>The existing graphical updater remains in the Pi taskbar → <strong>Server Configuration… → Update Raspberry Pi Edition</strong>. It installs the latest public GitHub release.</p><p><strong>DEV channel:</strong> the public updater installs the latest published release. Until this redesign is published, that action can replace DEV with the previous public interface. DEV updates use a separate process.</p><p>Your original dashboard remains available. Runtime rollback: <code>sudo /opt/octopus-foxess/rollback-dev.sh</code>. Updates preserve encrypted configuration; history stays in the Pi data directory.</p>';
    move(updateInfo, 'connections');
  } else {
    integrations.innerHTML = '<h2>Web connection setup</h2><p>This edition needs your Octopus account number/API key, FoxESS inverter serial/API token, and your own Google Apps Script relay URL. Credentials are encrypted in this browser; they are not stored on GitHub Pages.</p><div class="dev-connection-actions"><button id="dev-edit-web-setup">Edit account setup</button><button id="dev-web-guide">Open web setup guide</button></div><h3>Saved configuration</h3><p>Use Menu → Save Config to download an encrypted backup. Load Config on the setup screen restores it. Wipe Local Data and Remove Access Code remain separate edition-specific actions.</p><h3>Updates</h3><p>The hosted web app updates when the approved GitHub Pages version is published. Downloaded HTML files must be replaced with a newer download. Export an encrypted backup before moving to another browser or device.</p><h3>History</h3><p>The 24-month history store belongs to the Pi service. Standalone web mode does not collect history when the browser is closed.</p><button id="dev-connection-menu">Display &amp; configuration menu</button>';
    document.getElementById('dev-edit-web-setup').addEventListener('click', () => { const url = new URL(location.href); url.searchParams.set('setup', '1'); location.assign(url); });
    document.getElementById('dev-web-guide').addEventListener('click', () => toggleDrawer('setup-guide-panel'));
  }
  const historyPanel = document.createElement('section');
  historyPanel.className = 'card dev-history';
  historyPanel.innerHTML = `<div class="dev-history-controls"><label>Month<input type="month" id="dev-history-month"></label><label>Measure<select id="dev-history-metric"><option value="loadsPower">Home demand</option><option value="pvPower">Solar generation</option><option value="gridConsumptionPower">Grid import</option><option value="feedinPower">Grid export</option><option value="batChargePower">Battery charge</option><option value="batDischargePower">Battery discharge</option><option value="SoC">Battery charge level</option></select></label><button id="dev-history-refresh">Refresh history</button><button id="dev-history-export">Download month CSV</button></div><p id="dev-history-status" role="status">History is collected by the Pi from existing telemetry. Open this page to load it.</p><div class="dev-history-chart"><canvas id="dev-history-chart" role="img" aria-label="Historical telemetry averages for the selected month and measure"></canvas></div><p class="dev-muted">Observed averages, not billing-grade energy totals. Missing readings stay as gaps. Data begins when this DEV version is installed.</p>`;
  move(historyPanel, 'history');
  // Apply uses the unchanged scheduler engine, after an explicit review step.
  const reviewDialog = document.createElement('dialog');
  reviewDialog.className = 'dev-review-dialog';
  reviewDialog.innerHTML = `<h2>Apply automation changes?</h2><p>These are real Pi settings. Applying saves your rules and asks the existing worker to reconcile the inverter schedule.</p><dl id="dev-review-facts"></dl><p>Confirmation remains pending until the worker receives a matching official FoxESS REST readback.</p><div class="dev-dialog-actions"><button id="dev-review-cancel">Back</button><button id="dev-review-apply">Apply to Pi</button></div>`;
  document.body.append(reviewDialog);
  if (!piEdition) {
    reviewDialog.querySelector('p').textContent = 'These are real inverter settings. Applying saves your browser rules and sends the schedule through your configured Google relay.';
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
        ['Dispatch discharge protection', read('toggle-discharge-pause-dispatch').checked ? 'Enabled' : 'Disabled']
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
    if (!piEdition && name === 'history') name = 'connections';
    if (!sections[name]) return;
    currentPage = name;
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
  document.getElementById('dev-menu').addEventListener('click', toggleAppMenu);
  document.getElementById('dev-connection-menu').addEventListener('click', toggleAppMenu);
  document.getElementById('dev-about').addEventListener('click', () => openLicenseModal(false));
  function updateWorkerView() {
    const snapshot = window.linuxDispatchSnapshot;
    const state = document.getElementById('dev-worker-state');
    const messages = { waiting:'Waiting for worker', syncing:'Writing schedule · awaiting REST readback', confirmed:'Schedule confirmed by FoxESS REST', failed:'Schedule confirmation failed', disabled:'Dispatch sync disabled' };
    state.textContent = piEdition
      ? (snapshot ? (messages[snapshot.status] || 'Unknown worker state') : 'Waiting for authenticated Pi data')
      : (dashboard.classList.contains('visible') ? 'Automation runs in this browser. Keep it open and awake.' : 'Connect your accounts to start.');
    state.dataset.status = snapshot?.status || 'waiting';
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
    const metric = metricInput.value;
    const metricName = metricInput.selectedOptions[0].textContent;
    const points = historyData.points;
    const monthStart = Date.parse(`${historyData.month}-01T00:00:00Z`);
    const monthDate = new Date(monthStart);
    const monthEnd = Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 1);
    const byTime = new Map(points.map(point => [Date.parse(point.at), point.values[metric]]));
    const times = [...byTime.keys()];
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
        scales:{ x:{type:'linear',min:monthStart,max:monthEnd-1,ticks:{maxTicksLimit:7,color:style.getPropertyValue('--text-muted'),callback:value=>new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short'})}},
          y:{beginAtZero:true,max:metric==='SoC'?100:undefined,title:{display:true,text:metric==='SoC'?'Charge level (%)':'Average power (kW)',color:style.getPropertyValue('--text-muted')},ticks:{color:style.getPropertyValue('--text-muted')}} }
      }
    });
    const bytes = historyData.storageBytes;
    historyStatus.textContent = `${points.length} recorded ${points.length === 1 ? 'interval' : 'intervals'} in ${historyData.month} · ${bytes < 1024 * 1024 ? (bytes / 1024).toFixed(1)+' KB' : (bytes / 1024 / 1024).toFixed(2)+' MB'} used on Pi · 24-month retention` + (points.length ? '' : ' · No readings recorded for this month yet.');
  }
  async function loadHistory() {
    if (historyLoading || !piEdition || !window.linuxRuntime || !dashboard.classList.contains('visible')) return;
    historyLoading = true;
    historyStatus.textContent = 'Loading recorded telemetry…';
    try {
      historyData = await fetchJson(`/api/history?month=${encodeURIComponent(monthInput.value)}`);
      drawHistory();
    } catch (error) { historyStatus.textContent = `History unavailable: ${error.message}`; }
    finally { historyLoading = false; }
  }
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
