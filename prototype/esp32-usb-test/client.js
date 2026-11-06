// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const supported = window.isSecureContext && 'serial' in navigator;
  const form = $('config-form');
  const staticInputs = [...$('static-fields').querySelectorAll('input')];
  let port = null, reader = null, readerTask = null, ready = false, busy = false, configured = false;
  let nextId = 0, safeSave = false, networkTrial = false, runtimeTrial = false, suggestion = null, lanResetSupported=false, lanAccessEnabled=false, controllerEnabled=false;
  let activeStep=0,furthestStep=0,liveSupported=false,webConfigured=false,scanWhileRunning=false,networkSetupSupported=false;
  let dashboardPort=80,configuredDashboardPort=8787,portSupported=false;
  let setupMode='auto',installationReady=false;
  const needsInstallation=()=>setupMode==='new'&&!installationReady;
  const pending = new Map();
  let readbackSupported=false,configProtected=false,configUnlocked=false,unlockPassword="",loadedSettings=false,savedConfig=null;
  const secretIds=["ssid","wifi-password","octopus-account","octopus-key","foxess-serial","foxess-key","fox-web-user","fox-web-password","fox-web-hash","config-current-password","config-new-password","config-confirm-password"];
  for(const id of secretIds)$("eye-"+id).addEventListener("click",()=>{const input=$(id),show=input.type==="password";input.type=show?"text":"password";$("eye-"+id).setAttribute("aria-pressed",String(show));$("eye-"+id).setAttribute("aria-label",(show?"Hide ":"Show ")+id.replaceAll("-"," "));});
  const hex = value => Number.isInteger(value) ? '0x' + value.toString(16).padStart(4, '0').toUpperCase() : 'Not provided';

  function unchangedSavedConfiguration(){
    if(!savedConfig||!configured||runtimeTrial)return false;
    const values={ssid:$('ssid').value,password:$('wifi-password').value,ip_mode:$('network-mode').value,account:$('octopus-account').value.trim(),octopus_key:$('octopus-key').value.trim(),foxess_sn:$('foxess-serial').value.trim(),foxess_key:$('foxess-key').value.trim()};
    if(values.ip_mode==='static')for(const id of ['ip','gateway','netmask','dns'])values[id]=$(id).value.trim();
    return Object.keys(values).every(key=>values[key]===savedConfig[key]);
  }
  function controls() {
    const locked = busy || window.esp32Flashing === true;
    for(const mode of ['new','edit'])$('mode-'+mode).disabled=locked;
    $('dashboard-port').disabled=!ready||locked||!portSupported;
    $('dashboard-port-save').disabled=!ready||locked||!portSupported;
    $('connect').disabled = !supported || !!port || locked || setupMode==='auto' || needsInstallation();
    $('connect').hidden=setupMode==='auto'||needsInstallation();
    $('firmware-note').hidden=!ready;
    $('flow-mode').hidden=activeStep!==0;
    $('setup-connection').hidden=setupMode==='auto'||(needsInstallation()&&!port);
    $('firmware-install-panel').hidden=setupMode!=='new'||installationReady;
    $('firmware-install-panel').open=setupMode==='new'&&!installationReady;
    $('usb-title').textContent=setupMode==='new'?'Install firmware, then configure':setupMode==='edit'?'Connect to edit saved settings':'Choose how to set up this board';
    $('connection-title').textContent=setupMode==='new'?'2. Connect and configure':'Connect to edit settings';
    $('connection-instructions').textContent=needsInstallation()?'Disconnect the setup connection before installation. Keep the cable attached.':setupMode==='new'?'Firmware installed and verified. Select Connect ESP32, then choose the USB serial port again.':'Use existing Smart Charging firmware to read and modify saved settings. This does not erase the board.';
    $('disconnect').disabled = !port || busy;
    ['scan-wifi','device-status','restart'].forEach(id => $(id).disabled = !ready || locked || (id==='scan-wifi'&&controllerEnabled&&!scanWhileRunning));
    $('scan-wifi').title=controllerEnabled&&!scanWhileRunning?'Update firmware to scan while automation runs.':'Find nearby 2.4 GHz networks without changing saved settings.';
    $('lan-recovery').hidden=!ready||!lanResetSupported||!lanAccessEnabled;
    $('reset-lan-access').disabled=!ready||locked||!lanResetSupported||!$('reset-lan-consent').checked;
    const savedOnly=unchangedSavedConfiguration();
    $('save').disabled = !ready || locked || !safeSave || controllerEnabled&&!savedOnly;
    $('save-requirements').textContent=!ready?'Connect ESP32 before saving.':!safeSave?'Update firmware to support network-verified saving.':controllerEnabled&&!savedOnly?'Disable automation before replacing settings. Use Test Wi-Fi to start network setup.':'Wi-Fi and IP must pass. API credentials are saved without tests. Check them in Dashboard Settings → Account setup.';
    $('network-test').disabled = !ready || locked || !safeSave;
    $('network-setup-accept').disabled=!ready||locked||!networkSetupSupported;
    $('network-setup-cancel').disabled=locked;
    $('suggest-ip').disabled = !ready || locked || !networkTrial;
    $('use-suggestion').disabled = !ready || locked || !suggestion;
    $('test').disabled = !ready || locked || !configured || runtimeTrial || controllerEnabled;
    $('wifi-networks').disabled = !ready || busy || $('wifi-networks').options.length < 2;
    ['ssid','wifi-password','octopus-account','octopus-key','foxess-serial','foxess-key','network-mode','ip-review','clear','show-preview'].forEach(id => $(id).disabled=locked);
    for(const id of ['fox-web-user','fox-web-password','fox-web-mode'])$(id).disabled=!ready||locked||!liveSupported;
    for(const id of ['config-password-save','config-password-remove','config-unlock-button','config-skip','review-accounts'])$(id).disabled=!ready||locked||!readbackSupported;
    staticInputs.forEach(input=>{input.disabled=locked || $('network-mode').value!=='static';});
    steps.forEach((name,index)=>$('nav-'+name).setAttribute('aria-disabled',String(index>furthestStep||(needsInstallation()&&index>0))));
    $('wizard-back').disabled=locked;
    $('wizard-next').hidden=activeStep===3||needsInstallation()||setupMode==='auto';
    $('wizard-progress').textContent=needsInstallation()?'Step 1 of 4 · Install firmware first':`Step ${activeStep+1} of 4 · ${['Device','Network','Accounts','Review & save'][activeStep]}`;
    $('wizard-next').disabled=locked || (activeStep===0 && (!ready || !safeSave || needsInstallation()));
    window.dispatchEvent?.(new Event('esp32-controls'));
  }
  function status(state, label, message = '') {
    $('status').dataset.state = state;
    $('status-text').textContent = label;
    $('message').textContent = message;
    $('message').dataset.error = String(state === 'error');
    controls();
  }
  function clearPreview() { $('preview-text').textContent = ''; $('preview').hidden = true; }
  function modeChanged() {
    const fixed = $('network-mode').value === 'static';
    $('static-fields').hidden = !fixed;
    $('static-review').hidden = !fixed;
    $('ip-review').checked = false;
    staticInputs.forEach(input => { input.disabled = !fixed; input.required = fixed; input.setCustomValidity(''); });
    clearPreview();
  }
  function clearForm() {
    form.reset();
    [...form.querySelectorAll('input')].forEach(input => { input.value = ''; input.setCustomValidity(''); });
    $("dashboard-port").value=String(configuredDashboardPort);
    unlockPassword="";configUnlocked=false;loadedSettings=false;savedConfig=null;
    for(const id of secretIds){$(id).type="password";$("eye-"+id).setAttribute("aria-pressed","false");}
    modeChanged();
  }
  function rejectPending() {
    for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('USB connection closed.')); }
    pending.clear();
  }
  function receiveLine(line) {
    if (!line.startsWith('SCESP1 ')) return; // Never log or render raw console output.
    try {
      const frame = JSON.parse(line.slice(7));
      if (frame.protocol !== 'sc-esp32' || frame.version !== 1 || !Number.isSafeInteger(frame.id)) return;
      const waiter = pending.get(frame.id);
      if (!waiter) return;
      pending.delete(frame.id);
      clearTimeout(waiter.timer);
      if (frame.ok === true) waiter.resolve(frame.result);
      else waiter.reject(new Error(typeof frame.error === 'string' ? frame.error.slice(0,180) : 'Device rejected the command.'));
    } catch { /* Ignore unrecognised serial frames without printing their contents. */ }
  }
  async function readLoop(activePort) {
    const activeReader = activePort.readable.getReader();
    reader = activeReader;
    const decoder = new TextDecoder();
    let text = '';
    try {
      while (port === activePort) {
        const {value, done} = await activeReader.read();
        if (done) break;
        text += decoder.decode(value, {stream:true});
        let end;
        while ((end = text.indexOf('\n')) !== -1) { receiveLine(text.slice(0,end).trim()); text = text.slice(end+1); }
        if (text.length > 65536) text = '';
      }
    } catch { /* Port errors are reported without serial data. */ }
    finally {
      activeReader.releaseLock();
      if (reader === activeReader) reader = null;
      if (port === activePort) {
        ready = false;
        rejectPending();
        status('error','USB stream closed','Disconnect and reconnect the device.');
      }
    }
  }
  async function send(command, extra = {}, timeout = 10000) {
    const activePort = port;
    if (!activePort?.writable) throw new Error('Connect the USB device first.');
    const id = ++nextId;
    let rejectRequest;
    const response = new Promise((resolve,reject) => {
      rejectRequest = reject;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Device response timed out.')); },timeout);
      pending.set(id,{resolve,reject,timer});
    });
    // Attach a handler before the USB write, so disconnects cannot create an unhandled rejection.
    response.catch(() => {});
    let writer;
    try {
      writer = activePort.writable.getWriter();
      const bytes = new TextEncoder().encode(JSON.stringify({protocol:'sc-esp32',version:1,id,command,...extra})+'\n');
      try { await writer.write(bytes); } finally { bytes.fill(0); }
    } catch {
      const waiter = pending.get(id);
      if (waiter) { clearTimeout(waiter.timer); pending.delete(id); }
      rejectRequest(new Error('USB command could not be sent.'));
    } finally { writer?.releaseLock(); }
    return response;
  }
  function renderResult(result) {
    // Only safe status objects reach this renderer. Config readback is populated directly into masked inputs.
    $('device-result').textContent = JSON.stringify(result,null,2);
    $('device-link').replaceChildren();
    const ip = result?.ip || result?.checks?.network?.ip || result?.network?.ip;
    if (typeof ip === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      const link = document.createElement('a');
      link.href = 'http://' + ip + (dashboardPort===80?'':':'+dashboardPort) + '/';
      link.textContent = 'Open ESP32 dashboard: ' + link.href;
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      $('device-link').append(link);
    }
  }
  function renderChecks(checks, state) {
    const values = {wifi:checks?.wifi_connected,ip:checks?.ip_valid};
    for (const [name, value] of Object.entries(values)) {
      const row = $('check-'+name);
      const result = state || checks?.states?.[name] || (value === true ? 'passed' : value === false ? 'failed' : 'untested');
      row.dataset.result = result;
      row.querySelector('strong').textContent = {passed:'Passed',failed:'Failed',running:'Testing…',queued:'Waiting',blocked:'Not run',untested:'Pending save check'}[result];
    }
  }
  function invalidateNetwork() {
    networkTrial = false; suggestion = null;loadedSettings=false;
    $('suggestion-result').hidden = true;
    controls();
  }
  async function disconnect() {
    ready = false;
    clearForm();
    const active = port;
    port = null;
    rejectPending();
    if (reader) await reader.cancel().catch(() => {});
    await readerTask?.catch(() => {});
    if (active) await active.close().catch(() => {});
    readerTask = null; busy = false;
    $('vendor').textContent = '—'; $('product').textContent = '—'; $('handshake').textContent = 'Not checked';
    status('idle','Disconnected');
  }
  async function operation(label, action) {
    if (!ready || busy) return;
    busy = true; status('busy',label);
    $('step-feedback').textContent=label;$('step-feedback').dataset.error='false';
    try { await action(); if (port) status('connected','Firmware connected');$('step-feedback').textContent=''; }
    catch (error) { $('step-feedback').textContent=error.message;$('step-feedback').dataset.error='true';if (port) status('error','Operation failed',error.message); }
    finally { busy = false; controls(); }
  }

  $('compatibility').textContent = supported
    ? 'Web Serial is available. Choose New setup / Reinstall or Edit settings.'
    : 'Open this page in desktop Chrome or Edge to configure USB. Use the ESP32 local-IP dashboard on iPhone.';
  $('connect').addEventListener('click', async () => {
    if (!supported || busy || port || window.esp32Flashing || setupMode==='auto' || needsInstallation()) return;
    busy = true; status('busy','Select your device…');
    let candidate;
    try {
      candidate = await navigator.serial.requestPort({filters:[{usbVendorId:0x1a86},{usbVendorId:0x303a},{usbVendorId:0x10c4},{usbVendorId:0x0403}]});
      await candidate.open({baudRate:115200,flowControl:'none'});
      port = candidate;
      const info = candidate.getInfo();
      $('vendor').textContent = hex(info.usbVendorId); $('product').textContent = hex(info.usbProductId);
      readerTask = readLoop(candidate);
      let hello;
      for (let attempt=0;attempt<2;attempt++) {
        try { hello = await send('hello',{},4000); break; } catch (error) { if (attempt===1) throw error; }
      }
      if (!['Smart Charging ESP32','Smart Charging ESP32 connection test'].includes(hello?.firmware) || (hello.automation_enabled !== false && hello.capabilities?.production_controller !== true)) throw new Error('Compatible connection-test firmware was not detected.');
      ready = true;updateDeviceState(hello);
      safeSave = hello.capabilities?.network_only_save === true && hello.capabilities?.network_trial === true && hello.capabilities?.ip_suggestion === true;
      networkTrial = false; suggestion = null;
      $('handshake').textContent = 'Verified'; renderResult(hello);
      if(setupMode==='auto')selectMode(configured?'edit':'new');
      if(configured&&readbackSupported&&setupMode==='edit'){
        $('config-readback').hidden=false;$('config-unlock').hidden=!configProtected;
        if(!configProtected)await readSavedSettings('');
        else $('config-read-status').textContent='Saved settings are protected. Unlock to read them, or skip and enter replacement values.';
      }
      status('connected','Firmware connected',safeSave ? (controllerEnabled?'Account tests remain available. Pause before saving API credentials. Disable control before Wi-Fi or IP changes.':'Ready for Wi-Fi scan and verified setup.') : 'Install the updated firmware to enable network-verified saving. Read-only checks remain available.');
    } catch (error) {
      await disconnect();
      if (candidate && candidate !== port) await candidate.close().catch(() => {});
      status(error?.name === 'NotFoundError' ? 'idle' : 'error','Not connected',error?.name === 'NotFoundError' ? 'No device selected.' : 'Smart Charging firmware was not detected. For a new board, select New setup / Reinstall and install firmware first.');
    } finally { busy = false; controls(); }
  });
  function updateDeviceState(device){
    configured=device.configured===true;controllerEnabled=device.automation_enabled===true;
    networkSetupSupported=device.capabilities?.usb_network_setup===true;
    scanWhileRunning=device.capabilities?.wifi_scan_while_running===true;
    portSupported=device.capabilities?.dashboard_port_configuration===true;
    dashboardPort=Number.isInteger(device.dashboard_port)?device.dashboard_port:80;
    const saved=Number.isInteger(device.configured_dashboard_port)?device.configured_dashboard_port:dashboardPort;
    if(configuredDashboardPort!==saved||!ready)$('dashboard-port').value=String(saved);
    configuredDashboardPort=saved;
    $('dashboard-port-status').textContent=!portSupported?'Update firmware to configure the dashboard port.':device.dashboard_restart_required?'Port saved. Restart ESP32 from Device checks & diagnostics to apply it.':'Active dashboard port: '+dashboardPort+'. Changes apply after restart.';
    runtimeTrial=device.network_trial_active===true;lanResetSupported=device.capabilities?.lan_access_recovery===true;lanAccessEnabled=device.lan_access_enabled===true;
    liveSupported=device.capabilities?.optional_foxess_websocket===true;webConfigured=device.foxess_telemetry?.configured===true;
    readbackSupported=device.capabilities?.usb_config_readback===true;configProtected=device.config_access?.enabled===true;
    $('fox-web-mode').value=device.foxess_telemetry?.mode||'rest';
    $('fox-web-saved').textContent=webConfigured?'Optional login is saved. Leave the password blank to keep it.':liveSupported?'Optional login is not configured. REST remains available.':'Install current firmware to use optional WebSocket telemetry.';
    $('firmware-note').textContent=device.capabilities?.production_controller===true?(controllerEnabled?'Dashboard & automation firmware · Automation enabled':'Dashboard & automation firmware · Enable automation in General settings'):'Connection-test firmware · Automatic charging control disabled';
  }
  async function readSavedSettings(password){
    const values=await send('config_read',{config_password:password},20000);
    const mapping={'ssid':'ssid','password':'wifi-password','account':'octopus-account','octopus_key':'octopus-key','foxess_sn':'foxess-serial','foxess_key':'foxess-key','foxess_username':'fox-web-user','foxess_password_hash':'fox-web-hash'};
    try{
      for(const [name,id] of Object.entries(mapping)){$(id).value=typeof values?.[name]==='string'?values[name]:'';$(id).type='password';$('eye-'+id).setAttribute('aria-pressed','false');}
      $('network-mode').value=values.ip_mode==='static'?'static':'dhcp';modeChanged();
      for(const name of ['ip','gateway','netmask','dns'])$(name).value=values[name]||'';
      $('fox-web-hash-field').hidden=!values.foxess_password_hash;
      $('fox-web-password').value='';
      savedConfig={};for(const key of ['ssid','password','account','octopus_key','foxess_sn','foxess_key','ip_mode','ip','gateway','netmask','dns'])savedConfig[key]=values[key]||'';
      loadedSettings=true;configUnlocked=true;unlockPassword=password;furthestStep=3;
      $('config-unlock').hidden=true;$('config-current-password').value='';
      $('config-read-status').textContent='Saved settings loaded. Sensitive fields are masked. Use an eye button to show one field.';
      $('network-info').textContent='Saved network settings loaded. Account-only tests do not change Wi-Fi or IP.';
    }finally{if(values)for(const key of Object.keys(values))values[key]='';}
  }
  $('config-unlock-button').addEventListener('click',()=>operation('Unlocking saved settings…',async()=>{
    try{await readSavedSettings($('config-current-password').value);}finally{$('config-current-password').value='';}
  }));
  $('config-skip').addEventListener('click',()=>{clearForm();$('config-unlock').hidden=true;furthestStep=3;$('config-read-status').textContent='Reading skipped. Enter replacement settings. Existing Config Password remains unchanged.';showStep(1);});
  $('review-accounts').addEventListener('click',()=>{furthestStep=Math.max(furthestStep,2);showStep(2);});
  async function changeProtection(remove){
    if(configProtected&&!configUnlocked)throw Error('Unlock the existing Config Password on the Device step first.');
    const next=remove?'':$('config-new-password').value;
    if(!remove&&(next.length<8||next.length>128||next!==$('config-confirm-password').value))throw Error('Enter matching passwords of 8–128 characters.');
    if(!configured)throw Error('Save the main configuration before setting a Config Password.');
    const result=await send('config_access_set',{config_password:unlockPassword,new_password:next},30000);
    configProtected=result.enabled===true;unlockPassword=next;configUnlocked=true;
    $('config-new-password').value='';$('config-confirm-password').value='';
    $('config-password-status').textContent=configProtected?'Config Password saved. Future USB reads require this password.':'Config Password removed. Future USB connections load settings automatically.';
  }
  $('config-password-save').addEventListener('click',()=>operation('Saving USB configuration protection…',()=>changeProtection(false)));
  $('config-password-remove').addEventListener('click',()=>operation('Removing USB configuration protection…',()=>changeProtection(true)));
  $('reset-lan-consent').addEventListener('change',controls);
  $('reset-lan-access').addEventListener('click',()=>operation('Resetting optional LAN protection…',async()=>{
    if(!$('reset-lan-consent').checked)throw Error('Confirm the LAN access reset first.');
    const result=await send('reset_lan_access',{confirmation:'RESET_LAN_ACCESS'});
    lanAccessEnabled=result.lan_access_enabled===true;$('reset-lan-consent').checked=false;renderResult(result);
    $('message').textContent='LAN protection is off. Open the ESP32 local IP directly.';
  }));
  $('disconnect').addEventListener('click',disconnect);
  if (supported) navigator.serial.addEventListener('disconnect',event => { if (event.target===port) void disconnect(); });
  $('scan-wifi').addEventListener('click',() => operation('Scanning Wi-Fi…',async () => {
    $('scan-result').textContent='Scanning nearby 2.4 GHz networks…';
    try {
    const networks = await send('scan',{},20000);
    if (!Array.isArray(networks)) throw new Error('Unexpected scan response.');
    $('wifi-networks').replaceChildren(new Option('Choose a network, or type the SSID manually',''));
    const seen = new Set();
    for (const network of networks) {
      if (typeof network.ssid !== 'string' || !network.ssid || seen.has(network.ssid)) continue;
      seen.add(network.ssid);
      $('wifi-networks').append(new Option(`${network.ssid} (${network.rssi} dBm, ${network.security})`,network.ssid));
    }
    $('scan-result').textContent = seen.size?`Found ${seen.size} networks. Select one below, or enter the SSID manually.`:'No networks found. Move the board closer to your router, or enter the SSID manually.';
    } catch(error) { $('scan-result').textContent=error.message;throw error; }
  }));
  $('wifi-networks').addEventListener('change',() => { if ($('wifi-networks').value) $('ssid').value=$('wifi-networks').value; clearPreview(); invalidateNetwork(); });
  $('network-mode').addEventListener('change',modeChanged);
  form.addEventListener('input',event => { event.target.setCustomValidity?.(''); clearPreview(); if (['ssid','wifi-password'].includes(event.target.id)) invalidateNetwork(); controls(); });
  form.addEventListener('change',()=>{clearPreview();controls();});
  $('clear').addEventListener('click',() => { clearForm(); invalidateNetwork(); renderChecks(null); });

  function collectConfig(requireAccounts) {
    $('ssid').setCustomValidity(new TextEncoder().encode($('ssid').value).length>32 ? 'The Wi-Fi name must be no more than 32 bytes.' : '');
    for (const id of ['octopus-account','octopus-key','foxess-serial','foxess-key']) $(id).required = requireAccounts;
    const fixed = $('network-mode').value==='static';
    if (fixed) staticInputs.forEach(input => {
      const value=input.value.trim();
      const valid=/^(\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split('.').every(part=>Number(part)<=255 && (part==='0'||!part.startsWith('0')));
      input.setCustomValidity(valid?'':'Enter a valid IPv4 address.');
    });
    const invalid=[...form.querySelectorAll('input')].find(input=>!input.disabled && input.checkValidity && !input.checkValidity());
    if(invalid){
      const index=steps.indexOf(invalid.closest('section')?.id);
      if(index>=0 && index<=furthestStep)showStep(index);
      invalid.reportValidity();return null;
    }
    if (!form.reportValidity()) return null;
    const config={ssid:$('ssid').value,password:$('wifi-password').value,ip_mode:$('network-mode').value,
      account:$('octopus-account').value.trim(),octopus_key:$('octopus-key').value.trim(),foxess_sn:$('foxess-serial').value.trim(),foxess_key:$('foxess-key').value.trim()};
    if (fixed) for (const input of staticInputs) config[input.id]=input.value.trim();
    return config;
  }
  async function testNetwork(disableControl=false) {
    if (!$('ssid').value || new TextEncoder().encode($('ssid').value).length > 32) {
      $('ssid').setCustomValidity('Enter a Wi-Fi name of 1–32 bytes.'); form.reportValidity(); return;
    }
    await operation('Testing Wi-Fi with DHCP…',async () => {
      if(controllerEnabled){
        if(!disableControl){
          $('network-setup-confirm').hidden=false;
          $('network-setup-result').textContent=networkSetupSupported?'':'Update firmware to disable automation through USB, or disable it in dashboard General settings.';
          return;
        }
        try {
          const device=await send('network_setup',{confirmation:'DISABLE_AUTOMATION_FOR_NETWORK_SETUP'},20000);
          updateDeviceState(device);
          if(controllerEnabled)throw new Error('Automation is still enabled. Network settings were not changed.');
          $('network-setup-confirm').hidden=true;
        }catch(error){$('network-setup-result').textContent=error.message;throw error;}
      }
      invalidateNetwork();
      $('network-info').textContent='Testing the entered Wi-Fi with DHCP… Keep USB connected.';
      const config={ssid:$('ssid').value,password:$('wifi-password').value,ip_mode:'dhcp'};
      try {
        const result=await send('network_trial',{config},90000);
        networkTrial=result?.connected===true;
        if(networkTrial)runtimeTrial=true;
        $('network-info').textContent=networkTrial ? `Temporary DHCP connection: ${result.ip} · Gateway ${result.gateway} · Mask ${result.netmask} · DNS ${result.dns || 'not provided'}. Nothing saved.` : 'Wi-Fi trial did not connect.';
        renderResult(result);
      } catch(error){$('network-info').textContent='Wi-Fi test failed: '+error.message;throw error;} finally { config.password=''; }
    });
  }
  $('network-test').addEventListener('click',()=>testNetwork());
  $('network-setup-accept').addEventListener('click',()=>testNetwork(true));
  $('network-setup-cancel').addEventListener('click',()=>{$('network-setup-confirm').hidden=true;});
  $('suggest-ip').addEventListener('click',() => operation('Checking fixed-IP candidates…',async () => {
    suggestion=null;
    const result=await send('suggest_ip',{},30000);
    suggestion=result?.candidate ? result : null;
    $('suggestion-result').hidden=false;
    $('suggestion-text').textContent=result.candidate ? `${result.candidate}: ${result.status}` : result.status;
    renderResult(result);
  }));
  $('use-suggestion').addEventListener('click',() => {
    if (!suggestion) return;
    $('network-mode').value='static';modeChanged();
    $('ip').value=suggestion.candidate;
    for(const name of ['gateway','netmask','dns']) $(name).value=suggestion.network?.[name] || '';
    $('network-info').textContent='Suggestion added to the form. Review the router DHCP pool before Save settings.';
  });
  $('show-preview').addEventListener('click',() => {
    const config=collectConfig(false); if (!config) return;
    for (const key of ['password','account','octopus_key','foxess_sn','foxess_key']) config[key]=config[key]?'Set (hidden)':'Not set';
    $('preview-text').textContent=JSON.stringify(config,null,2); $('preview').hidden=false;
  });
  form.addEventListener('submit',event => {
    event.preventDefault();
    if (!ready || busy || !safeSave) return;
    const config=collectConfig(true); if (!config) return;
    const savedOnly=unchangedSavedConfiguration();
    if(controllerEnabled&&!savedOnly){controls();return;}
    if(config.ip_mode==='static' && !savedOnly && !$('ip-review').checked) {
      $('save-status').textContent='Review the fixed IP against your router DHCP pool, then select the acknowledgement.'; return;
    }
    if(!networkTrial&&!loadedSettings){$('save-status').textContent='Run Test Wi-Fi with DHCP before saving.';showStep(1);return;}
    const optional={mode:$('fox-web-mode').value,username:$('fox-web-user').value.trim(),password:$('fox-web-password').value};
    const saveOptional=liveSupported&&(webConfigured||optional.username||optional.password||optional.mode==='live-ws');
    if((optional.username&&!optional.password&&!webConfigured)||(!optional.username&&optional.password)){$('save-status').textContent='Enter both the optional FoxESS username and password.';return;}
    void operation('Verifying Wi-Fi and IP, then saving settings…',async () => {
      renderChecks(null,'running');
      $('save-status').textContent='Checking Wi-Fi and IP. No API requests are sent by this save operation.';
      let coreSaved=false;
      try {
        if(savedOnly){
          const device=await send('status');
          const checks={wifi_connected:device.wifi_connected===true,ip_valid:typeof device.ip==='string'&&/^(\d{1,3}\.){3}\d{1,3}$/.test(device.ip)};
          renderChecks(checks);
          if(!checks.wifi_connected||!checks.ip_valid)throw Error('The saved Wi-Fi connection or IP is unavailable. Run Test Wi-Fi again.');
          coreSaved=true;
        }else{
          const result=await send('configure_network',{config,static_ip_reviewed:$('ip-review').checked===true},120000);
          configured=result?.saved===true || result?.previous_configuration_saved===true;
          renderResult(result);renderChecks(result?.checks);
          if(!result?.saved)throw Error(result?.status||'Network verification failed. Previous saved settings were retained.');
          coreSaved=true;runtimeTrial=false;savedConfig={...config};loadedSettings=true;
        }
        if(saveOptional){
          const result=await send('foxess_live_store',{config:optional},20000);
          if(!result?.saved)throw Error(result?.status||'Optional telemetry settings were not saved.');
        }
        networkTrial=false;
        $('save-status').textContent='Wi-Fi and IP verified. Settings saved. APIs have not been tested. Open Dashboard Settings → Account setup to test all APIs.';
        $('save-status').textContent+=' Entered values remain masked until you disconnect or clear the form.';
        updateDeviceState(await send('status'));
      } catch(error) {
        $('save-status').textContent=(coreSaved?'Main settings are saved. Optional saving did not complete: ':'Settings were not saved: ')+error.message;
        throw error;
      } finally { for (const key of Object.keys(config)) config[key]='';for(const key of Object.keys(optional))optional[key]=''; }
    });
  });
  $('test').addEventListener('click',() => operation('Testing connections…',async () => {
    $('device-result').textContent='Checking Wi-Fi, clock synchronization, Octopus account access and FoxESS telemetry. This can take up to two minutes.';
    renderResult(await send('test',{},120000));
    const device=await send('status');
    if (device?.ip) {
      $('device-link').textContent='ESP32 dashboard: http://'+device.ip+(dashboardPort===80?'':':'+dashboardPort)+'/';
    }
  }));
  $('dashboard-port-save').addEventListener('click',()=>operation('Saving dashboard port…',async()=>{
    const input=$('dashboard-port'),value=Number(input.value);
    if(!input.value.trim()||!Number.isInteger(value)||value<1||value>65535)throw new Error('Enter a port from 1 to 65535.');
    const result=await send('dashboard_port',{port:value});updateDeviceState(result);renderResult(result);
  }));
  $('device-status').addEventListener('click',() => operation('Reading status…',async () => {const current=await send('status');updateDeviceState(current);renderResult(current);}));
  $('restart').addEventListener('click',() => operation('Restarting ESP32…',async () => {
    await send('reboot'); await disconnect(); $('device-result').textContent='Device restarted. Reconnect to check that configuration was retained.';
  }));
  window.addEventListener('pagehide',() => { clearForm();void disconnect(); });
  $('theme-toggle').addEventListener('click',() => {
    document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
  });
  const steps=['device','network','accounts','verify'];
  const titles=['Choose a setup task','Set up your network','Connect your accounts','Review & save'];
  const descriptions=['Choose installation or editing. New boards need firmware before the setup connection.','Choose 2.4 GHz Wi-Fi and check the connection before continuing.','Enter credentials, then test them later in Dashboard Settings.','The ESP32 verifies Wi-Fi and IP before saving. API tests are available in Dashboard Settings.'];
  const guides=[
    ['Choose installation or editing','New setup / Reinstall erases the board and installs firmware first. Edit settings connects without erasing.'],
    ['Check your network','Run the temporary DHCP test. For a stable IP, prefer a router reservation. Review the DHCP pool before using a suggested address.'],
    ['Keep your credentials private','Credentials travel through USB. The browser does not upload or retain them. The final step saves account details without API tests.'],
    ['What happens next','Keep USB connected until confirmation. Saved settings survive restarts. History uses RAM by default. Optional hourly Flash saving is available in Dashboard Settings.']
  ];
  function showStep(index,focus=true){
    if(busy || window.esp32Flashing || index<0 || index>furthestStep || (needsInstallation()&&index>0))return;
    activeStep=index;
    $('step-feedback').textContent='';
    steps.forEach((name,i)=>{
      $(name).hidden=i!==index;
      const link=$('nav-'+name);
      if(i===index)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');
      link.setAttribute('aria-disabled',String(i>furthestStep));
    });
    form.hidden=index===0;
    $('wizard-title').textContent=index===0?({new:'New setup / Reinstall',edit:'Edit saved settings'}[setupMode]||titles[0]):titles[index];$('wizard-description').textContent=descriptions[index];
    $('guide-title').textContent='Help: '+guides[index][0];$('guide-text').textContent=guides[index][1];
    $('wizard-back').hidden=index===0;$('wizard-next').hidden=index===3;
    $('wizard-next').textContent=['Next: Network →','Next: Accounts →','Next: Review & save →',''][index];
    $('wizard-progress').textContent=`Step ${index+1} of 4 · ${['Device','Network','Accounts','Review & save'][index]}`;
    if(focus){window.scrollTo?.({top:0,behavior:'instant'});$('wizard-title').focus?.({preventScroll:true});}
    controls();
  }
  for(const [index,step] of steps.entries())$('nav-'+step).addEventListener('click',event=>{event.preventDefault();showStep(index);});
  $('wizard-back').addEventListener('click',()=>showStep(activeStep-1));
  $('wizard-next').addEventListener('click',()=>{
    if(busy || window.esp32Flashing || activeStep===0&&(!ready||!safeSave||needsInstallation()))return;
    if(activeStep===1){
      if(!networkTrial&&!loadedSettings){$('network-info').textContent='Wi-Fi is not verified. Select Test Wi-Fi with DHCP before continuing.';$('step-feedback').textContent='Network check required. Test the entered Wi-Fi before opening Accounts.';$('step-feedback').dataset.error='true';$('network-test').scrollIntoView?.({block:'center'});$('network-test').focus?.();return;}
      if(!collectConfig(false))return;
      if($('network-mode').value==='static'&&!unchangedSavedConfiguration()&&!$('ip-review').checked){$('network-info').textContent='Review the fixed IP against your router DHCP pool, then select the acknowledgement.';return;}
    }
    if(activeStep===2&&!collectConfig(true))return;
    furthestStep=Math.max(furthestStep,activeStep+1);showStep(activeStep+1);
  });
  function selectMode(mode){
    setupMode=mode;
    if(activeStep===0)$('wizard-title').textContent={new:'New setup / Reinstall',edit:'Edit saved settings'}[mode];
    for(const name of ['new','edit'])$('mode-'+name).setAttribute('aria-pressed',String(mode===name));
    $('flow-mode').textContent={new:installationReady?'Firmware verified · Connect ESP32, then complete network and account setup.':'New setup / Reinstall · Erase the board and install firmware first. Then connect to configure it.',edit:'Edit settings · Read saved values, then review your changes. No firmware installation or erasure.'}[mode];
    $('step-feedback').textContent='';
    controls();
  }
  $('mode-new').addEventListener('click',()=>{if(busy||window.esp32Flashing)return;installationReady=false;clearForm();invalidateNetwork();furthestStep=0;$('flash-consent').checked=false;$('flash-board').checked=false;$('flash-erase-confirmation').value='';$('flash-continue').hidden=true;$('flash-progress').hidden=true;$('flash-progress').value=0;$('flash-status').textContent='Clean install erases this board. Keep USB connected until verification finishes.';$('config-readback').hidden=true;selectMode('new');});
  $('mode-edit').addEventListener('click',async()=>{
    if(busy||window.esp32Flashing)return;selectMode('edit');
    if(!ready)return;
    if(!configured){$('step-feedback').textContent='No saved configuration was found. Select New setup.';return;}
    $('config-readback').hidden=false;$('config-unlock').hidden=!configProtected;
    if(!configProtected)await operation('Reading saved settings…',()=>readSavedSettings(''));
  });
  window.esp32Setup={disconnect,afterInstall(){clearForm();configured=false;$('config-readback').hidden=true;installationReady=true;furthestStep=0;selectMode('new');showStep(0);},isConnected:()=>!!port,isBusy:()=>busy,refreshControls:controls};
  modeChanged(); showStep(0,false);status('idle','Not connected');
})();
