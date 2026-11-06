/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * One Settings view. Engine-owned controls keep their IDs and event handlers.
 */
/* Shared settings navigation. Account editors remain owned by each host. */
window.installSettingsSections=({page,generalContent,accountCards=[]})=>{
  const make=(tag,className='')=>{const node=document.createElement(tag);node.className=className;return node;};
  const tabs=make('div','settings-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Settings sections');
  const panels=make('div','settings-panels'),general=make('section','settings-pane'),account=make('section','settings-pane');
  const accountGrid=make('div','dev-page-grid settings-account-grid');account.append(accountGrid);
  const buttons=[];
  [general,account].forEach((pane,index)=>{const key=index?'account':'general',button=make('button','settings-tab');button.type='button';button.id='settings-tab-'+key;button.textContent=index?'Account setup':'General settings';button.setAttribute('role','tab');button.setAttribute('aria-controls','settings-'+key+'-panel');pane.id='settings-'+key+'-panel';pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);buttons.push(button);tabs.append(button);button.addEventListener('click',()=>select(index));button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight'||event.key==='ArrowLeft')next=index===0?1:0;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons[1].hidden?0:1;else return;if(buttons[next].hidden)next=0;event.preventDefault();select(next);buttons[next].focus();});});
  function select(index){[general,account].forEach((pane,i)=>{pane.hidden=i!==index;buttons[i].setAttribute('aria-selected',String(i===index));buttons[i].tabIndex=i===index?0:-1;});}
  general.append(generalContent);panels.append(general,account);page.append(tabs,panels);page.classList.add('settings-with-tabs');buttons[1].hidden=true;select(0);
  const addAccountCard=node=>{accountGrid.append(node);buttons[1].hidden=false;};accountCards.forEach(addAccountCard);
  return {addAccountCard,select,general,account};
};
(() => {
  if(document.documentElement.dataset.devEdition==='esp32-dashboard'){
    const D=window.esp32Dashboard,$=D.$;
    const page=document.querySelector('.dev-page[data-page="settings"]');
    const accountCards=[...page.querySelectorAll('[data-setting]')].filter(node=>['device-setup','service-octopus','service-foxess','service-websocket','foxess-live','lan-access'].includes(node.dataset.setting));
    window.settingsSections=window.installSettingsSections({page,generalContent:$('esp-settings-form'),accountCards:accountCards.sort((a,b)=>(a.dataset.setting==='device-setup')-(b.dataset.setting==='device-setup'))});
    let accessEditing=false;
    $('esp-skip-welcome').addEventListener('change',()=>{
      const enabled=$('esp-skip-welcome').checked;
      if(D.saveStartPage(enabled))$('esp-start-page-status').textContent=enabled?'This browser will open Dashboard directly.':'This browser will show Welcome.';
      else{$('esp-skip-welcome').checked=!enabled;$('esp-start-page-status').textContent='Browser storage is unavailable. The start-page choice was not saved.';}
    });
    $('esp-show-welcome').addEventListener('click',()=>D.showWelcome());
    const accessFields=()=>{$('esp-lan-code-fields').hidden=!$('esp-lan-enabled').checked;};
    D.syncAccess=state=>{
      if(!accessEditing){$('esp-lan-enabled').checked=state.lan_access_enabled===true;accessFields();}
      $('esp-logout').hidden=state.lan_access_enabled!==true;
    };
    for(const id of ['esp-lan-enabled','esp-lan-new-code','esp-lan-confirm-code'])$(id).addEventListener('input',()=>{accessEditing=true;accessFields();});
    $('esp-lan-save').addEventListener('click',()=>{
      const enabled=$('esp-lan-enabled').checked,code=$('esp-lan-new-code').value;
      if(enabled&&(code.length<6||code.length>128||code!==$('esp-lan-confirm-code').value)){$('esp-lan-status').textContent='Enter matching access codes with 6 to 128 characters.';return;}
      D.review(enabled?'Enable LAN access protection?':'Disable LAN access protection?',enabled?'Other browsers will need this access code. Physical USB setup can reset LAN protection.':'Devices on your trusted local network can open and control this dashboard without an access code.',enabled?'The access code stays private and is stored as a salted hash. Existing browser sessions will be revoked.':'LAN access code: Off',async()=>{
        await D.request('/api/lan-access',{enabled,access_code:enabled?code:''});
        $('esp-lan-new-code').value='';$('esp-lan-confirm-code').value='';accessEditing=false;
        await D.refresh();$('esp-lan-status').textContent=enabled?'LAN access protection is on.':'LAN access protection is off.';
      });
    });
    const display=window.priceDisplay.read();for(const key of ['enabled','code','symbol','fx']){const input=$('price-display-'+key);if(key==='enabled')input.checked=display[key];else input.value=display[key];}
    $('esp-save-price-display').addEventListener('click',()=>{
      try{window.priceDisplay.save({enabled:$('price-display-enabled').checked,code:$('price-display-code').value.trim().toUpperCase(),symbol:$('price-display-symbol').value.trim(),fx:Number($('price-display-fx').value)});$('esp-price-status').textContent='Saved on this browser. Exchange rates are not updated automatically.';}
      catch(error){$('esp-price-status').textContent=error.message;}
    });
    window.addEventListener('pagehide',()=>{$('esp-lan-new-code').value='';$('esp-lan-confirm-code').value='';});
    const clock=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
    D.fillRules=rules=>{
      document.querySelectorAll('[data-rule]').forEach(input=>{if(input.type==='checkbox')input.checked=rules[input.dataset.rule]===true;else input.value=rules[input.dataset.rule];});
      document.querySelectorAll('[data-rule-time]').forEach(input=>input.value=clock(rules[input.dataset.ruleTime]));
      document.querySelectorAll('[data-days]').forEach(input=>input.checked=!!(rules[input.dataset.days]&(1<<Number(input.value))));
    };
    const collect=()=>{
      const rules=structuredClone(D.state().rules);
      document.querySelectorAll('[data-rule]').forEach(input=>rules[input.dataset.rule]=input.type==='checkbox'?input.checked:Number(input.value));
      document.querySelectorAll('[data-rule-time]').forEach(input=>{const [h,m]=input.value.split(':').map(Number);rules[input.dataset.ruleTime]=h*60+m;});
      for(const key of ['charge_days','discharge_days']){rules[key]=0;document.querySelectorAll('[data-days="'+key+'"]').forEach(input=>{if(input.checked)rules[key]|=1<<Number(input.value);});}
      return rules;
    };
    document.querySelectorAll('[data-rule],[data-rule-time],[data-days]').forEach(input=>input.addEventListener('input',()=>D.setDirty(true)));
    const ruleSummary=rules=>{
      const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const days=mask=>mask===127?'Every day':dayNames.filter((_,i)=>mask&(1<<i)).join(', ');
      const schedule=prefix=>clock(rules[prefix+'_start'])+'–'+clock(rules[prefix+'_end'])+' · '+days(rules[prefix+'_days'])+(rules[prefix+'_end']<rules[prefix+'_start']?' · overnight':'');
      return [
        'Automation: '+(rules.enabled?'Enabled':'Disabled'),
        'Pause: '+(rules.paused?(rules.pause_until?'Until '+new Date(rules.pause_until*1000).toLocaleString('en-GB',{timeZone:'Europe/London'}):'Until resumed'):'Off'),
        'Follow Smart Dispatch: '+(rules.follow_dispatch?'On':'Off'),
        'Dispatch charge target: '+(rules.dispatch_soc_enabled?rules.dispatch_soc+'%':'100%'),
        'Charge at import price: '+(rules.charge_price_enabled?'At or below '+rules.charge_price_p+' p/kWh':'Off'),
        'Weekly charge: '+(rules.weekly_charge?schedule('charge'):'Off'),
        'Ordinary charge target: '+(rules.charge_soc_enabled?rules.target_soc+'%':'100%'),
        'Auto-Resume Self-Use: '+(rules.auto_resume?'On':'Off'),
        'Pause discharging during Smart Dispatch: '+(rules.pause_discharge_dispatch?'On':'Off'),
        'Discharging overrides ordinary charging: '+(rules.discharge_overrides_charge?'On':'Off'),
        'Discharge at export price: '+(rules.discharge_price_enabled?'At or above '+rules.discharge_price_p+' p/kWh':'Off'),
        'Weekly discharge: '+(rules.weekly_discharge?schedule('discharge'):'Off'),
        'Minimum battery SOC: '+rules.min_soc+'%',
        'Discharge power: '+rules.power_w+' W',
        'Octopus interval: '+rules.octopus_seconds+' seconds',
        'FoxESS interval: '+rules.foxess_seconds+' seconds',
        'RAM History retention: '+rules.history_days+' days',
        'Hourly Flash History: '+(rules.history_flash_enabled?'On · one hourly record · 60 days':'Off · RAM only'),
        'All schedule times: Europe/London'
      ].join('\n');
    };
    for(const id of ['esp-rules-form','esp-settings-form'])$(id).addEventListener('submit',event=>{
      event.preventDefault();const rules=collect();
      const details=ruleSummary(rules);
      D.review('Apply ESP32 settings?',rules.enabled?'These rules can replace the real inverter schedule. Keep other automation workers stopped. Confirmation requires fresh FoxESS REST readback.':'Save these settings on the ESP32. Automation will remain disabled.',details,()=>D.applyRules(rules));
    });
    $('esp-pause').addEventListener('click',async()=>{
      if(!D.state())return;const rules=structuredClone(D.state().rules),hours=Number($('esp-pause-hours').value);rules.paused=true;rules.pause_until=hours?Math.floor(Date.now()/1000)+hours*3600:0;
      $('esp-pause').disabled=true;
      try{await D.applyRules(rules);$('esp-pause-dialog').close();D.notice('Pause saved. Any command already sent must finish before pause is complete.');}
      catch(error){$('esp-pause-status').textContent=error.message;D.notice(error.message,true);}
      finally{$('esp-pause').disabled=false;}
    });
    $('esp-resume').addEventListener('click',()=>{if(!D.state())return;const rules=structuredClone(D.state().rules);rules.paused=false;rules.pause_until=0;D.review('Resume automation?','The ESP32 will read fresh dispatches and the current FoxESS schedule before reconciling.','Other automation workers must remain stopped.',()=>D.applyRules(rules));});
    $('esp-manual-form').addEventListener('submit',event=>{
      event.preventDefault();const minute=id=>{const [h,m]=$(id).value.split(':').map(Number);return h*60+m;};
      const start=minute('v3-start'),end=minute('v3-end'),date=new Date();date.setHours(Math.floor(end/60),end%60,0,0);if(date.getTime()<=Date.now())date.setDate(date.getDate()+1);
      const period={start,end,mode:Number($('esp-manual-mode').value),expires:Math.floor(date.getTime()/1000)};
      D.review('Apply temporary inverter mode?','This writes a real schedule. Smart Dispatch keeps priority. Pause blocks this command.',$('esp-manual-mode').selectedOptions[0].textContent+' · '+$('v3-start').value+'–'+$('v3-end').value,async()=>{await D.request('/api/manual',{period,acknowledge_control:true});D.notice('Temporary period saved. Await official REST confirmation.');await D.refresh();});
    });
    return;
  }

  const hostName = document.documentElement.dataset.devEdition === 'desktop' ? 'computer' : 'Pi';
  const pi = document.documentElement.dataset.devEdition !== 'web';
  const shell = document.getElementById('dev-shell');
  const grid = shell.querySelector('[data-page="settings"] .dev-page-grid');
  const make = (tag, className = '', text = '') => {
    const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  const action = (label, handler, danger = false) => {
    const node = make('button', `next-button secondary${danger ? ' is-danger' : ''}`, label);
    node.type = 'button'; node.addEventListener('click', handler); return node;
  };
  const card = (title, description) => {
    const node = make('section', 'next-panel');
    node.dataset.setting=title.toLowerCase().replace(/[^a-z]+/g,'-').replace(/-$/,'');
    node.append(make('h2', 'next-panel-title', title), make('p', 'next-muted', description));
    grid.append(node); return node;
  };
  window.settingsSections=window.installSettingsSections({page:shell.querySelector('.dev-page[data-page="settings"]'),generalContent:grid});
  const previous = [...grid.children];
  grid.replaceChildren();

  const appearance = card('Appearance', 'Choose the appearance for this browser.');
  const choices = make('div', 'next-segmented'); choices.setAttribute('aria-label', 'Appearance');
  for (const [value, label] of [['light', 'Light'], ['dark', 'Dark']]) {
    const button = action(label, () => {
      if ((document.documentElement.dataset.theme || 'dark') !== value) toggleDarkMode();
    });
    button.dataset.themeChoice = value; choices.append(button);
  }
  appearance.append(choices);
  const syncAppearance = () => choices.querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === (document.documentElement.dataset.theme || 'dark')));
  });
  new MutationObserver(syncAppearance).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  syncAppearance();
  const displayActions = make('div', 'next-settings-actions');
  displayActions.append(action('Full screen', toggleFullScreen), action('Screen saver', toggleScreenSaver));
  appearance.append(displayActions);

  const currency=card('Price display','Convert UK prices for display on this browser. This does not add support for other Octopus countries.');
  const currencyValues=window.priceDisplay.read();
  const currencyFields={};
  for(const [name,title,type] of [['enabled','Use a custom display currency','checkbox'],['code','Currency code','text'],['symbol','Currency symbol','text'],['fx','Exchange rate: 1 GBP equals','number']]){
    const row=make('label',type==='checkbox'?'next-toggle':'next-field');
    const input=make('input');input.id=`price-display-${name}`;input.type=type;
    if(type==='checkbox')input.checked=currencyValues[name];else input.value=currencyValues[name];
    if(name==='code')input.maxLength=3;
    if(name==='symbol')input.maxLength=12;
    if(name==='fx'){input.min='0.000001';input.max='1000000';input.step='any';}
    row.htmlFor=input.id;row.append(make('span','',title),input);currency.append(row);currencyFields[name]=input;
  }
  const currencyFeedback=make('p','next-muted');currencyFeedback.setAttribute('role','status');
  currency.append(make('p','next-muted','Manual rate. Example: HKD, HK$, 10 means 1 GBP = 10 HKD. Rule inputs stay in UK p/kWh.'),action('Save price display',()=>{
    try{window.priceDisplay.save({enabled:currencyFields.enabled.checked,code:currencyFields.code.value.trim().toUpperCase(),symbol:currencyFields.symbol.value.trim(),fx:Number(currencyFields.fx.value)});currencyFeedback.textContent='Saved on this browser. Exchange rates are not updated automatically.';}
    catch(error){currencyFeedback.textContent=error.message;}
  }),currencyFeedback);
  const thresholdHints=[];
  for(const id of ['price-threshold','export-threshold']){
    const input=document.getElementById(id);const hint=make('small','next-muted');input.after(hint);
    const sync=()=>{hint.textContent=window.priceDisplay.read().enabled && input.value!==''?`Display equivalent: ${window.priceDisplay.format(Number(input.value))}. Control value stays in UK p/kWh.`:'';};
    input.addEventListener('input',sync);thresholdHints.push(sync);
  }
  const syncThresholdHints=()=>thresholdHints.forEach(sync=>sync());
  window.addEventListener('price-display-change',syncThresholdHints);
  window.addEventListener('dashboard-visibility-change',syncThresholdHints);syncThresholdHints();

  const refreshSettings=card('API refresh intervals', pi
    ? `These intervals apply to the ${hostName} worker. Routine Octopus refresh has a 60-second minimum.`
    : 'Set how often this browser reads each API. Keep this browser open and awake.');
  for(const [name,id,buttonId,title] of [['octopus','octo-interval-input','btn-apply-octo','Octopus Energy'],['foxess','fox-interval-input','btn-apply-fox','FoxESS']]) {
    const row=make('div','next-refresh-setting');
    const label=make('label','next-field',`${title} interval (seconds)`);label.htmlFor=id;
    const input=document.getElementById(id);input.min=name==='octopus'?'60':'600';input.max='86400';input.step='1';
    label.append(input);const save=document.getElementById(buttonId);save.textContent='Save';
    row.append(label,save);refreshSettings.append(row);
  }
  refreshSettings.append(make('p','next-muted','Minimum intervals: Octopus 60 seconds. FoxESS 600 seconds. Smart Dispatch commands apply immediately.'));

  const alerts=make('details','next-api-diagnostics');
  alerts.append(make('summary','','API problem alerts'),make('p','next-muted','Recovered problems clear automatically after the selected period. Active failures keep their red border.'));
  refreshSettings.append(alerts);
  const alertLabel=make('label','next-field','Automatically clear recovered alerts');
  const alertSelect=make('select');alertSelect.id='api-alert-clear-hours';
  for(const [value,label] of [[24,'After 24 hours'],[6,'After 6 hours'],[12,'After 12 hours'],[48,'After 48 hours'],[0,'Only when I clear them']]) {
    const option=make('option','',label);option.value=String(value);alertSelect.append(option);
  }
  alertLabel.htmlFor=alertSelect.id;alertLabel.append(alertSelect);
  const alertFeedback=make('p','next-muted');alertFeedback.setAttribute('role','status');
  const alertSave=action('Save',async()=>{
    alertSave.disabled=true;
    try{await window.integrationMonitor.setAutoClearHours(Number(alertSelect.value));alertFeedback.textContent='Alert preference saved.';}
    catch(error){alertFeedback.textContent=error.message;}
    finally{alertSave.disabled=false;}
  });
  const syncAlerts=()=>{const snapshot=window.integrationMonitor.snapshot();alertSelect.value=String(snapshot.remote?.autoClearHours ?? snapshot.local.autoClearHours);};
  // Do not replace an unsaved choice on each health update.
  let alertEditing=false;alertSelect.addEventListener('change',()=>{alertEditing=true;});
  alertSave.addEventListener('click',()=>{alertEditing=false;});
  window.addEventListener('integration-status-change',()=>{if(!alertEditing)syncAlerts();});
  syncAlerts();alerts.append(alertLabel,alertSave,alertFeedback,make('p','next-muted','The period starts at the last failure. Viewing or clearing an alert does not request API data.'));
  alerts.append(action('Save diagnostic log',()=>{
    const report=window.integrationMonitor.diagnosticReport();
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`smart-charging-diagnostics-${new Date().toISOString().slice(0,10)}.json`;
    link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    alertFeedback.textContent='Diagnostic log saved. Account details, keys, serial numbers, and private URLs are excluded.';
  }),make('p','next-muted','Only errors are recorded, up to 100 entries. Repeated failures are grouped. Healthy polling does not add log entries.'));

  const priceDiagnostics=make('details','next-api-diagnostics');priceDiagnostics.append(make('summary','','Electricity price diagnostics'));
  const priceHealth=make('p','next-muted');priceHealth.setAttribute('role','status');
  const time=value=>value?new Date(value).toLocaleString():'Waiting';
  const syncPriceHealth=()=>{
    const report=window.integrationMonitor.diagnosticReport().prices;
    const client=report.client;
    priceHealth.textContent=`Prices checked: ${time(report.checkedAt)}. Host received: ${time(client.receivedAt)}. Display rendered: ${time(client.renderedAt)}. Import/export records: ${report.importRateCount}/${report.exportRateCount}. ${client.readError?'Host snapshot read failed. ':''}${client.renderError?'Price rendering failed. ':''}`;
  };
  const reloadPrices=action('Reload host prices',async()=>{if(window.linuxRuntime && window.linuxRole!=='worker'){await refreshOctopusTariffs();syncPriceHealth();}});
  const syncPriceVisibility=()=>{reloadPrices.hidden=!window.linuxRuntime;syncPriceHealth();};
  window.addEventListener('host-runtime-ready',syncPriceVisibility);
  window.addEventListener('integration-status-change',syncPriceHealth);
  priceDiagnostics.append(priceHealth,reloadPrices,make('p','next-muted','Reload host prices reads the existing Pi or Windows snapshot. It does not request Octopus data.'));
  refreshSettings.append(priceDiagnostics);syncPriceVisibility();

  const visibleStates = [];
  const visibility = card('Visible panels', 'Choose which panels to show on this device. This does not disable automation.');
  for (const [key, label] of [
    ['intelligentOctopus', 'Electricity prices'], ['foxessMode', 'Inverter schedule'],
    ['deviceSettings', 'Account and device'], ['smartCharging', 'Charging rules'], ['smartDischarging', 'Discharging rules']
  ]) {
    const input = document.getElementById(`show-section-${key}`);
    const row = make('label', 'next-toggle'); row.htmlFor = input.id;
    const state = make('span', 'next-visible-state'); state.setAttribute('aria-hidden', 'true');
    const control = make('span', 'next-visible-control'); control.append(state, input);
    const sync = () => { state.textContent = input.checked ? 'On' : 'Off'; state.dataset.on = String(input.checked); };
    visibleStates.push(sync); input.addEventListener('change', sync);
    row.append(make('span', '', label), control); visibility.append(row);
  }

  const syncVisibleStates = () => visibleStates.forEach(sync => sync());
  syncVisibleStates();
  new MutationObserver(syncVisibleStates).observe(document.getElementById('dashboard'), { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('dashboard-visibility-change', syncVisibleStates);

  if (pi) {
    const telemetry = card('FoxESS telemetry', 'Choose the power-data source. Commands use official REST.');
    const selector = document.getElementById('live-ws-policy');
    const label = make('label', 'next-field', 'Power-data source'); label.htmlFor = selector.id;
    label.append(selector); telemetry.append(label, document.getElementById('live-ws-policy-state'));
    const access = card('Access on this device', `Sign out of this dashboard. Your ${hostName} continues to run the automation.`);
    const signOut = action('Sign out', removeSavedAccessCode, true);
    signOut.classList.add('remove-access-button'); access.append(signOut);
  } else {
    const connection = card('Octopus connection', 'Safari compatibility mode uses your own Google relay. Google processes your Octopus account, API key, and data.');
    const transportLabel = make('label', 'next-field', 'Octopus connection method');
    const transport = document.getElementById('octopus-transport').cloneNode(true);
    transport.id = 'settings-octopus-transport';
    transport.value = document.getElementById('octopus-transport').value;
    transport.removeAttribute('aria-describedby');
    transportLabel.htmlFor = transport.id; transportLabel.append(transport);
    const transportFeedback = make('p', 'next-muted'); transportFeedback.setAttribute('role', 'status');
    window.addEventListener('web-setup-restored', () => { transport.value = document.getElementById('octopus-transport').value; });
    document.getElementById('octopus-transport').addEventListener('change', () => { transport.value = document.getElementById('octopus-transport').value; });
    connection.append(transportLabel, action('Save connection method', async () => {
      const source = document.getElementById('octopus-transport');
      const previous = source.value;
      if (transport.value === 'gas' && !document.getElementById('gas-url').value.trim()) {
        transportFeedback.textContent = 'Add your Google relay URL in the setup form first.'; return;
      }
      source.value = transport.value;
      try { await saveCredentials(getCredentialInputs()); transportFeedback.textContent = 'Saved. This method applies on the next refresh.'; }
      catch { source.value = previous; transportFeedback.textContent = 'Could not save the connection method.'; }
    }), action('Relay update instructions', () => { closeAllDrawers(); document.getElementById('proxy-modal').style.display = 'flex'; }), transportFeedback);
    const storage = card('Configuration backup', 'Save an encrypted copy of your setup, or load an existing configuration file.');
    const actions = make('div', 'next-settings-actions');
    actions.append(
      action('Save configuration', () => { document.getElementById('disclaimer-modal').style.display = 'flex'; }),
      action('Load configuration', () => document.getElementById('import-file').click())
    );
    storage.append(actions);
    const access = card('Saved browser data', 'Remove saved account data through the confirmation dialog. Export a backup before you continue.');
    access.append(action('Wipe saved data', () => { document.getElementById('wipe-modal').style.display = 'flex'; }, true));
  }
  const help = card('Help and application information', 'Read the setup guide, application licence and component notices.');
  const helpActions = make('div', 'next-settings-actions');
  helpActions.append(
    action(pi ? 'Access guide' : 'Web setup guide', () => toggleDrawer('setup-guide-panel')),
    action('About and licences', () => openLicenseModal(false))
  );
  help.append(helpActions);
  previous.forEach(node => { node.dataset.setting='updates'; node.className = 'next-panel'; node.querySelector('h2')?.classList.add('next-panel-title'); grid.append(node); });

  // The old menu stays out of the layout. Remaining engine references remain valid.
  document.getElementById('dev-engine-elements').append(document.getElementById('app-menu-panel'));
})();
