/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * Operator controls and compact dialogs. No inverter commands originate here.
 */
(() => {
  const shell = document.getElementById('dev-shell');
  const pi = document.documentElement.dataset.devEdition !== 'web';
  const make = (tag, text = '', className = '') => { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; };
  const button = (text, handler) => { const node = make('button', text); node.type = 'button'; node.addEventListener('click', handler); return node; };
  const dialog = (title, description) => {
    const node = make('dialog', '', 'dev-review-dialog');
    const header = make('header', '', 'next-dialog-header');
    const heading = make('h2', title); heading.id = `dialog-title-${document.querySelectorAll('dialog').length}`;
    node.setAttribute('aria-labelledby', heading.id);
    const close = button('×', () => node.close()); close.setAttribute('aria-label', `Close ${title}`);
    header.append(heading, close); node.append(header, make('p', description)); document.body.append(node); return node;
  };
  const actions = (node, cancelLabel, confirmLabel, confirm) => {
    const footer = make('div', '', 'dev-dialog-actions');
    footer.append(button(cancelLabel, () => node.close()), button(confirmLabel, confirm)); node.append(footer); return footer.lastChild;
  };
  document.querySelectorAll('.dev-review-dialog').forEach(node => {
    if (node.querySelector('.next-dialog-header')) return;
    const heading = node.querySelector('h2'); if (!heading) return;
    const header = make('header', '', 'next-dialog-header');
    heading.before(header); header.append(heading);
    const close = button('×', () => node.close()); close.setAttribute('aria-label', 'Close dialog'); header.append(close);
    heading.id ||= `dialog-title-${document.querySelectorAll('[id^=dialog-title]').length}`; node.setAttribute('aria-labelledby', heading.id);
  });
  const banner = make('section', '', 'next-pause-banner'); banner.hidden = true; banner.setAttribute('role', 'status');
  const bannerCopy = make('div'); banner.append(bannerCopy);
  shell.querySelector('.dev-appbar').after(banner);
  const overviewHeading = shell.querySelector('[data-page="overview"] .dev-page-heading');
  const pauseButton = button('Pause automation', () => { duration.value = '6'; message.textContent = ''; pauseDialog.showModal(); });
  pauseButton.className = 'next-button secondary'; overviewHeading.append(pauseButton);
  const pauseDialog = dialog('Pause automation', 'Pause all app schedule control. Monitoring continues. The current FoxESS schedule stays in place.');
  pauseDialog.append(make('p', 'After pausing, use the FoxESS app to set temporary charging. When automation resumes, saved app rules can replace those settings.'));
  const label = make('label', 'Pause for', 'next-field');
  const duration = make('select'); duration.id = 'pause-duration'; label.htmlFor = duration.id;
  for (const [value, text] of [['6', '6 hours'], ['12', '12 hours'], ['24', '24 hours'], ['forever', 'Forever — until you resume']]) {
    const option = make('option', text); option.value = value; duration.append(option);
  }
  label.append(duration); pauseDialog.append(label);
  const message = make('p'); message.setAttribute('role', 'status'); pauseDialog.append(message);
  const confirmPause = actions(pauseDialog, 'Cancel', 'Pause automation', async () => {
    confirmPause.disabled = true; message.textContent = 'Waiting for any current command to finish…';
    try { await window.automationControl.update('pause', duration.value === 'forever' ? null : Number(duration.value)); pauseDialog.close(); }
    catch (error) { message.textContent = error.message; }
    finally { confirmPause.disabled = false; }
  });
  const resumeDialog = dialog('Resume automation?', 'The app will fetch current Octopus dispatches and FoxESS schedules, then apply your saved automation rules.');
  const resumeStatus = make('p'); resumeStatus.setAttribute('role', 'status'); resumeDialog.append(resumeStatus);
  const confirmResume = actions(resumeDialog, 'Cancel', 'Resume automation', async () => {
    confirmResume.disabled = true;
    try { await window.automationControl.update('resume'); resumeDialog.close(); }
    catch (error) { resumeStatus.textContent = error.message; }
    finally { confirmResume.disabled = false; }
  });
  const resume = button('Resume automation', () => { resumeStatus.textContent = ''; resumeDialog.showModal(); }); banner.append(resume);
  const syncPause = () => {
    const state = window.automationControl.snapshot();
    const connected = document.getElementById('dashboard').classList.contains('visible');
    banner.hidden = !connected || (!state.paused && !state.pending && state.available);
    banner.dataset.unavailable = String(!state.available && !state.paused);
    bannerCopy.replaceChildren(make('strong', state.paused ? 'Automation paused' : state.pending ? 'Updating automation control…' : 'Schedule control unavailable'));
    bannerCopy.append(make('p', state.paused
      ? `${state.until ? `Paused until ${new Date(state.until).toLocaleString()}.` : 'Paused until you resume.'} App schedule commands are blocked. Monitoring continues. Use the FoxESS app for temporary settings.`
      : 'The app will not send schedule commands until the control state is confirmed.'));
    if (state.auditWarning) bannerCopy.append(make('p', 'The pause state is saved, but History could not record this change. Check Pi storage.'));
    resume.hidden = !state.paused; resume.disabled = state.pending || !state.available;
    pauseButton.textContent = state.paused ? 'Change pause duration' : 'Pause automation';
    pauseButton.disabled = !state.available || state.pending;
    if (typeof renderProtectionOverview === 'function') renderProtectionOverview();
  };
  window.addEventListener('automation-control-change', syncPause);
  new MutationObserver(syncPause).observe(document.getElementById('dashboard'), { attributes: true, attributeFilter: ['class'] });
  syncPause();

  // Preserve the engine-owned modal ID and fields while replacing its presentation.
  const legacy = document.getElementById('adv-v3-modal');
  const minSoc = document.getElementById('adv-min-soc');
  const maxPower = document.getElementById('adv-fd-pwr');
  const hardware = dialog('Scheduler hardware limits', 'These limits apply to app-generated charging and discharging schedules. Review and apply the automation rules to save them.');
  for (const [input, title] of [[minSoc, 'Minimum charge level on grid (%)'], [maxPower, 'Maximum forced-mode power (W)']]) {
    const field = make('label', title, 'next-field'); field.htmlFor = input.id; field.append(input); hardware.append(field); input.step = '1'; input.required = true;
  }
  minSoc.min = '11'; minSoc.max = '100'; maxPower.min = '1';
  const hardwareError = make('p'); hardwareError.setAttribute('role', 'status'); hardware.append(hardwareError);
  let previous = []; let staged = false;
  actions(hardware, 'Cancel', 'Done', () => {
    if (![minSoc, maxPower].every(input => input.reportValidity())) return;
    staged = true; markAutomationsDirty(); hardware.close();
  });
  hardware.addEventListener('close', () => { if (!staged) [minSoc, maxPower].forEach((input, index) => { input.value = previous[index]; }); });
  const openHardware = () => {
    if (legacy.style.display !== 'flex') return;
    legacy.style.display = 'none'; previous = [minSoc.value, maxPower.value]; staged = false; hardwareError.textContent = ''; hardware.showModal();
  };
  new MutationObserver(openHardware).observe(legacy, { attributes: true, attributeFilter: ['style'] });

  if (pi) {
    const grid = shell.querySelector('[data-page="settings"] .dev-page-grid');
    const storageWarning=make('section','','next-storage-warning wide');storageWarning.hidden=true;storageWarning.setAttribute('role','status');
    const storageCopy=make('div');storageWarning.append(storageCopy);
    const storageLink=button('Storage settings',()=>{shell.querySelector('nav button[data-page="settings"]').click();card.scrollIntoView({block:'center'});});storageWarning.append(storageLink);
    shell.querySelector('[data-page="overview"] .next-protection').after(storageWarning);
    const card = make('section', '', 'next-panel'); card.id = 'history-settings';
    card.append(make('h2', 'History storage', 'next-panel-title'), make('p', 'Keep compact power averages and activity records on this Pi. Older records are erased automatically.', 'next-muted'));
    const retentionLabel = make('label', 'Keep history for', 'next-field');
    const retention = make('select'); retention.id = 'history-retention'; retentionLabel.htmlFor = retention.id;
    for (let months = 1; months <= 24; months++) { const option = make('option', `${months} ${months === 1 ? 'month' : 'months'}${months === 12 ? ' (default)' : ''}`); option.value = String(months); retention.append(option); }
    retention.value = '12'; retentionLabel.append(retention); card.append(retentionLabel);
    const intervalLabel=make('label','Save readings to disk','next-field');
    const interval=make('select');interval.id='history-save-interval';intervalLabel.htmlFor=interval.id;
    for(const minutes of [30,60]){const option=make('option',minutes===60?'Every hour (default)':'Every 30 minutes');option.value=String(minutes);interval.append(option);}
    interval.value='60';intervalLabel.append(interval);card.append(intervalLabel);
    card.append(make('p','Routine readings stay in memory between saves. A power failure can lose unsaved readings. Pause activity and settings save immediately.','next-muted'));
    const usage=make('p','','next-muted');usage.id='history-storage-usage';card.append(usage);
    const status = make('p', 'Loading history settings…', 'next-muted'); status.setAttribute('role', 'status'); card.append(status);
    const save = button('Save history settings', () => {
      if (!saved || (Number(retention.value) === saved.retentionMonths && Number(interval.value) === saved.saveIntervalMinutes)) return;
      confirmCopy.textContent = Number(retention.value) < saved.retentionMonths
        ? `Keep ${retention.value} months. Older power readings and activity records will be permanently erased. Increasing this setting later cannot restore them.`
        : `Keep ${retention.value} months. Automatic cleanup stays on. Previously erased records cannot be restored.`;
      confirmCopy.textContent += ` Save routine readings every ${interval.value} minutes. Unsaved readings can be lost after a power failure.`;
      confirmation.showModal();
    }); card.append(save); save.disabled = true; grid.prepend(card);
    card.append(make('p','Below 4 GB free space, the Pi removes the oldest saved history before the selected retention period. It keeps the newest 24 hours.','next-muted'));
    const cleanupActions=make('div','','next-settings-actions');
    const keepThree=button('Keep recent 3 months',()=>{retention.value='3';dirty=true;save.click();});
    const clearAll=button('Clear all history',()=>{clearMessage.textContent='';clearDialog.showModal();});clearAll.className='history-clear-button';
    cleanupActions.append(keepThree,clearAll);card.append(cleanupActions);
    const clearDialog=dialog('Clear all history?','All saved power readings, automation activity, and unsaved readings will be permanently erased. Account settings and automation rules stay unchanged.');
    const clearMessage=make('p');clearDialog.append(clearMessage);
    const clearConfirm=actions(clearDialog,'Cancel','Clear all history',async()=>{
      clearConfirm.disabled=true;
      try{saved=await fetchJson('/api/history/clear',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'clear'})});showSettings();clearDialog.close();window.dispatchEvent(new CustomEvent('history-settings-change'));}
      catch(error){clearMessage.textContent=error.message;}finally{clearConfirm.disabled=false;}
    });
    const confirmation = dialog('Change history settings?', 'This setting applies to every dashboard that uses this Pi.');
    const confirmCopy = make('p'); confirmation.append(confirmCopy);
    const apply = actions(confirmation, 'Cancel', 'Save settings', async () => {
      apply.disabled = true;
      try {
        saved = await fetchJson('/api/history/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retentionMonths: Number(retention.value), saveIntervalMinutes: Number(interval.value) }) });
        dirty=false;showSettings(); confirmation.close(); window.dispatchEvent(new CustomEvent('history-settings-change'));
      } catch (error) { status.textContent = error.message; confirmation.close(); }
      finally { apply.disabled = false; }
    });
    let saved = null; let loading = false;let dirty=false;
    retention.addEventListener('change',()=>{dirty=true;});interval.addEventListener('change',()=>{dirty=true;});
    const showSettings = () => {
      if(!dirty){retention.value=String(saved.retentionMonths);interval.value=String(saved.saveIntervalMinutes || 60);}
      save.disabled=false;
      const bytes=saved.allocatedBytes ?? saved.storageBytes ?? 0;
      storageWarning.hidden=!saved.lowStorage;
      const free=Number.isFinite(saved.freeBytes)?(saved.freeBytes/1e9).toFixed(2)+' GB':'Unknown';
      storageCopy.replaceChildren(make('strong','Low storage'),make('p',`${free} free on the Pi. The oldest saved history is removed early; the newest 24 hours are retained. Other files may still need cleanup.`));
      const used=bytes<1048576?(bytes/1024).toFixed(1)+' KB':(bytes/1048576).toFixed(2)+' MB';
      usage.textContent=`History files on disk: ${used} · ${saved.bufferedIntervals || 0} ${(saved.bufferedIntervals || 0)===1?'interval':'intervals'} waiting to save · ${free} free. Last saved: ${saved.lastSavedAt?new Date(saved.lastSavedAt).toLocaleString():'No readings saved yet'}.`;
      status.textContent=`${saved.retentionMonths}-month retention. Saves every ${saved.saveIntervalMinutes || 60} minutes. Automatic cleanup is on.${saved.cleanupPending?' Cleanup is pending and will retry automatically.':''}`;
    };
    const load = async () => {
      if (loading || !document.getElementById('dashboard').classList.contains('visible')) return;
      loading = true;
      try { saved = await fetchJson('/api/history/settings'); showSettings(); }
      catch (error) { status.textContent = `History settings unavailable: ${error.message}`; }
      finally { loading = false; }
    };
    new MutationObserver(() => { if (!saved) void load(); }).observe(document.getElementById('dashboard'), { attributes: true, attributeFilter: ['class'] });
    void load();setInterval(()=>void load(),60000);
  }
})();
