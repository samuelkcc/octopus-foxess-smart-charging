// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 let state=null,csrf='',pendingReview=null,dirty=false,filledRevision=0,history=[],busy=false,loggedIn=false,historyVersion='',accountLoading=false;
 const D=window.esp32Dashboard={$,page:'overview',state:()=>state,dirty:()=>dirty,setDirty:value=>{dirty=value;},history:()=>history};
 D.notice=(message,error=false)=>{$('esp-notice').textContent=message;$('esp-notice').dataset.error=String(error);};
 const reads=new Set();
 D.cancelReads=()=>{for(const cancel of [...reads])cancel();};
 D.request=async(path,body)=>{
  const controller=typeof AbortController==='function'?new AbortController():null;
  const options={cache:'no-store',credentials:'same-origin',redirect:'error',headers:{},signal:controller?.signal};
  if(body!==undefined){options.method='POST';options.headers={'Content-Type':'application/json','X-SC-CSRF':csrf};options.body=JSON.stringify(body);}
  let timer,cancel;
  const deadline=new Promise((_,reject)=>{
   cancel=()=>{const error=new Error('Read cancelled while the dashboard was suspended.');error.code='ESP32_READ_CANCELLED';reject(error);controller?.abort();};
   timer=setTimeout(()=>{const error=new Error(body===undefined?'ESP32 did not respond within 12 seconds. Check Wi-Fi and retry.':'No confirmation from ESP32. Refresh device state before retrying this change.');error.code='ESP32_REQUEST_TIMEOUT';reject(error);controller?.abort();},12000);
  });
  if(body===undefined)reads.add(cancel);
  try{
   const {response,data}=await Promise.race([deadline,(async()=>{
    const response=await fetch(path,options);let data;
    try{data=await response.json();}catch{throw new Error('ESP32 returned an incomplete response. Retry the connection.');}
    return {response,data};
   })()]);
   if(!response.ok){if(response.status===401){loggedIn=false;D.showLogin?.();}const error=new Error(data.error||'The device request failed.');error.status=response.status;throw error;}
   return data;
  }finally{clearTimeout(timer);reads.delete(cancel);}
 };
 let refreshing=null,connectionLost=false;
 D.refresh=()=>{
  if(refreshing)return refreshing;
  refreshing=(async()=>{
   try{const value=await D.request('/api/state');if(value.schema!==1)throw Error('The ESP32 worker is starting.');state=value;csrf=value.csrf;loggedIn=true;D.showDashboard?.();D.render?.(value);$('esp-reconnect').hidden=true;if(connectionLost){D.notice('Connected to ESP32 again.');connectionLost=false;}if(!dirty&&filledRevision!==value.revision){D.fillRules?.(value.rules);filledRevision=value.revision;}if(D.page==='connections')void D.loadAccount();if(D.page==='history'&&historyVersion!==[value.telemetry_at,value.history_saved_through,value.history_records].join(':'))void D.loadHistory().catch(error=>D.notice(error.message,true));return value;}
   catch(error){if(error.status!==401&&error.code!=='ESP32_READ_CANCELLED'){
    connectionLost=true;D.syncPauseSwitch?.({paused:state?.rules?.paused===true,available:false});D.syncPauseBanner?.({paused:state?.rules?.paused===true,available:false});D.notice(error.message,true);D.connectionProblem?.();$('esp-connection').textContent='Device unavailable';$('esp-connection').dataset.state='error';$('esp-reconnect').hidden=false;
   }throw error;}
  })().finally(()=>{refreshing=null;});
  return refreshing;
 };
 D.login=async(code)=>{await D.request('/api/login',{access_code:code});filledRevision=0;dirty=false;await D.refresh();};
 D.logout=async()=>{await D.request('/api/logout',{});state=null;csrf='';loggedIn=false;D.showLogin?.();};
 D.review=(title,message,details,action,label='Apply to ESP32')=>{
  if(busy)return;$('esp-review-apply').textContent=label;$('esp-review-title').textContent=title;$('esp-review-text').textContent=message;$('esp-review-details').textContent=details;pendingReview=action;$('esp-review').showModal();
 };
 D.applyRules=async rules=>{
  if(!state)throw Error('Connect to the ESP32 first.');
  const saved=await D.request('/api/rules',{rules,revision:state.revision,acknowledge_control:true});
  dirty=false;filledRevision=0;await D.refresh();D.notice('Settings saved.');
 };
 D.loadHistory=async()=>{
  history=await D.request('/api/history?days='+Number($('esp-history-range').value));
  historyVersion=[state?.telemetry_at,state?.history_saved_through,state?.history_records].join(':');D.renderHistory?.(history);return history;
 };
 D.loadAccount=async()=>{if(accountLoading)return;accountLoading=true;try{D.renderAccount?.(await D.request('/api/account'));}catch(error){if(error.status!==401)D.notice('Account details are unavailable. '+error.message,true);}finally{accountLoading=false;}};
 D.navigate=page=>{
  if(page!=='connections')D.maskAccount?.();
  D.page=page;
  document.querySelectorAll('.dev-page').forEach(node=>node.hidden=node.dataset.page!==page);
  document.querySelectorAll('.dev-rail nav button').forEach(node=>{if(node.dataset.page===page)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});
  $('dev-page-name').textContent=document.querySelector('.dev-rail nav button[aria-current="page"] span').textContent;
  window.scrollTo({top:0,behavior:'instant'});
  if(page==='connections'&&loggedIn)void D.loadAccount();
  if(page==='history'&&loggedIn)void D.loadHistory().catch(error=>D.notice(error.message,true));
  if(state)D.render?.(state);
 };
 $('esp-review-back').addEventListener('click',()=>{$('esp-review').close();pendingReview=null;});
 $('esp-review-apply').addEventListener('click',async()=>{
  const action=pendingReview;if(!action||busy)return;busy=true;$('esp-review-apply').disabled=true;
  try{await action();$('esp-review').close();pendingReview=null;}catch(error){$('esp-review-text').textContent=error.message;D.notice(error.message,true);}finally{busy=false;$('esp-review-apply').disabled=false;}
 });
 $('esp-history-export').addEventListener('click',()=>{
  const rows=[['timestamp','solar_kw','home_kw','grid_import_kw','battery_charge_kw','soc_percent','interval_seconds','storage'],...history.map(row=>[new Date(row.at*1000).toISOString(),...['solar','home','grid','battery','soc'].map(key=>Number.isFinite(row[key])?row[key]:''),row.interval_seconds||900,row.storage||'ram'])];
  const url=URL.createObjectURL(new Blob([rows.map(row=>row.join(',')).join('\n')],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='Smart_Charging_ESP32_History.csv';a.click();URL.revokeObjectURL(url);
 });
 document.querySelectorAll('[data-expand-history]').forEach(button=>button.addEventListener('click',()=>D.expandHistory(D.historyGroups.find(group=>group.id===button.dataset.expandHistory))));
 $('esp-history-expanded-close').addEventListener('click',()=>$('esp-history-expanded').close());
 $('esp-header-pause').addEventListener('click',()=>{
  if(state?.rules?.paused)$('esp-resume').click();
  else {$('esp-pause-status').textContent='';$('esp-pause-dialog').showModal();}
 });
 $('esp-pause-cancel').addEventListener('click',()=>$('esp-pause-dialog').close());
 D.requestApiRefresh=async name=>{
  try{await D.request('/api/refresh',{service:name});D.notice('API refresh queued on the ESP32. Requests respect service cooldowns.');await D.refresh();}
  catch(error){D.notice(error.message,true);}
 };
 D.serviceError=name=>{
  const check=state?.setup_checks?.[name],observed=state?.[name==='octopus'?'dispatch_at':'telemetry_at']||0;
  const testedFailure=check?.connected===false&&check.at>=observed;
  const live=state?.foxess_telemetry,ws=state?.setup_checks?.websocket;
  const liveFailure=name==='foxess'&&live?.configured&&live.mode==='live-ws'&&(ws?.connected===false&&ws.at>=(live.updated_at||0)||/failed|disconnected|stale/i.test(live.status||''));
  return testedFailure||liveFailure||state?.[name+'_fault']===true||(name==='octopus'?(state?.octopus_http&&state.octopus_http!==200||state?.dispatch_error_code):state?.foxess_http&&state.foxess_http!==200);
 };
 D.serviceMessage=name=>{
  const checks=state?.setup_checks,observed=state?.[name==='octopus'?'dispatch_at':'telemetry_at']||0;
  if(checks?.[name]?.connected===false&&checks[name].at>=observed)return 'The most recent '+(name==='octopus'?'Octopus':'FoxESS REST')+' test failed. Correct the account details in Settings.';
  if(name==='foxess'&&state?.foxess_telemetry?.mode==='live-ws'&&(checks?.websocket?.connected===false||/failed|disconnected|stale/i.test(state.foxess_telemetry.status||'')))return 'Optional FoxESS WebSocket needs attention. REST remains available. Check the cloud login in Account setup.';
  return state?.[name+'_status']||'The API update failed.';
 };
 D.openAccountSetup=()=>{D.navigate('settings');window.settingsSections?.select(1);};
 for(const name of ['octopus','foxess'])$('esp-service-'+name).addEventListener('click',()=>{
  if(D.serviceError(name)){
   D.review((name==='octopus'?'Octopus Energy':'FoxESS')+' update problem',D.serviceMessage(name),
    (name==='octopus'&&state?.dispatch_error_code?'Error code: '+state.dispatch_error_code+'\n':'')+'Open Settings → Account setup to correct credentials. Select Test all APIs to check every service. Valid cached data is retained.',async()=>D.openAccountSetup(),'Open Account setup');
  }else void D.requestApiRefresh(name);
 });
 $('esp-telemetry-save').addEventListener('click',async()=>{
  const button=$('esp-telemetry-save');button.disabled=true;
  try{await D.request('/api/telemetry-mode',{mode:$('esp-telemetry-mode').value});await D.refresh();D.notice('Telemetry mode saved. Automation settings are unchanged.');}
  catch(error){D.notice(error.message,true);}finally{button.disabled=false;}
 });

 let otaState=null,otaPolling=false;
 function renderOta(value){
  otaState=value;D.syncFirmwareUpdate?.(value);$('esp-ota-status').textContent=(value.current?'Installed '+value.current+'. ':'')+(value.version?'GitHub '+value.version+'. ':'')+(value.status||'');
  $('esp-ota-check').disabled=value.busy===true;
  $('esp-ota-install').disabled=value.busy===true||value.available!==true;
  $('esp-ota-install').textContent=value.newer?'Install firmware':'Reinstall this version';
  $('esp-ota-progress').hidden=value.phase!=='updating';$('esp-ota-progress').value=value.progress||0;
 }
 async function pollOta(){
  if(otaPolling)return;otaPolling=true;
  try{for(let i=0;i<300;i++){
   const value=await D.request('/api/ota');renderOta(value);
   if(value.phase==='restarting'){D.notice(value.status);break;}
   if(!value.busy)break;
   await new Promise(resolve=>setTimeout(resolve,1000));
  }}catch(error){$('esp-ota-status').textContent='Connection interrupted. Reopen the dashboard to check the installed version. '+error.message;}
  finally{otaPolling=false;$('esp-ota-check').disabled=false;}
 }
 D.syncFirmwareUpdate=value=>{
  if(!value)return;
  $('esp-update-available').hidden=!(value.available&&value.newer);$('esp-update-available').disabled=value.busy===true;
  $('esp-update-available').title=value.version?'Firmware '+value.version+' is available':'Firmware update available';
  if(!autoSettingBusy)$('esp-ota-auto-check').checked=value.auto_check!==false;
 };
 let autoSettingBusy=false;
 $('esp-ota-auto-check').addEventListener('change',async()=>{
  const field=$('esp-ota-auto-check');autoSettingBusy=true;field.disabled=true;
  try{renderOta(await D.request('/api/ota',{action:'auto_settings',enabled:field.checked}));D.notice('Update preference saved.');}
  catch(error){field.checked=!field.checked;D.notice(error.message,true);}
  finally{autoSettingBusy=false;field.disabled=false;}
 });
 $('esp-update-available').addEventListener('click',()=>{
  D.navigate('settings');window.settingsSections?.select(0);
  document.querySelector('[data-setting="firmware-update"]')?.scrollIntoView({behavior:'smooth',block:'center'});
 });
 $('esp-ota-check').addEventListener('click',async()=>{
  $('esp-ota-check').disabled=true;
  try{renderOta(await D.request('/api/ota',{action:'check'}));await pollOta();}catch(error){$('esp-ota-status').textContent=error.message;$('esp-ota-check').disabled=false;}
 });
 $('esp-ota-install').addEventListener('click',()=>{
  if(!otaState?.available||otaState.busy)return;
  const erase=$('esp-ota-erase').checked;
  if(erase&&$('esp-ota-erase-confirmation').value!=='ERASE'){$('esp-ota-status').textContent='Type ERASE exactly to confirm Clean update.';return;}
  D.review('Install ESP32 firmware '+otaState.version+'?',erase?'Clean update permanently deletes settings and saved History after a successful boot. USB setup is required again.':'The ESP32 restarts after download and verification. Existing settings are kept.',
   'Automation suspends automatically and returns to its saved state after restart. Keep power connected. The inverter retains its existing schedule. Failed verification leaves the current firmware selected.',async()=>{
    renderOta(await D.request('/api/ota',{action:'install',version:otaState.version,confirmation:'INSTALL_OTA_UPDATE',erase_settings:erase,erase_confirmation:erase?'ERASE':''}));
    void pollOta();
   },erase?'Erase settings & update':'Install update');
 });
 let setupBusy=false;
 const setupInputs=['octopus-account','octopus-key','foxess-serial','foxess-key','websocket-username','websocket-password'];
 const setupEyes=[...document.querySelectorAll('[data-esp-eye]')];
 const setSetupVisibility=(button,show)=>{
  const input=$(button.dataset.espEye);
  const label=button.dataset.fieldLabel||(button.dataset.fieldLabel=button.getAttribute('aria-label').replace(/^(Show|Hide) /,''));
  input.type=show?'text':'password';button.setAttribute('aria-pressed',String(show));
  button.setAttribute('aria-label',(show?'Hide ':'Show ')+label);
 };
 setupEyes.forEach(button=>button.addEventListener('click',()=>setSetupVisibility(button,$(button.dataset.espEye).type==='password')));
 const accountActions=['esp-test-all-apis','esp-save-accounts'];
 async function runSetupJob(config,target){
  const job=await D.request('/api/setup-job',config),started=Date.now();
  for(let i=0;i<240&&Date.now()-started<240000;i++){
   const current=await D.request('/api/setup-job?id='+job.id);
   if(current.phase==='done'){target.textContent=current.result?.status||'Check completed.';return current.result;}
   target.textContent=current.phase==='queued'?'Waiting for the service cooldown…':current.progress||'Checking service on ESP32…';
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw Error('Check still pending. Wait before retrying.');
 }
 async function accountAction(save){
  if(setupBusy)return;setupBusy=true;accountActions.forEach(id=>$(id).disabled=true);
  const summary=$('esp-setup-all-status'),configs=[];let failed=false;
  try{
   summary.textContent=save?'Saving accounts without API tests…':'Checking services one at a time. Keep this page open.';
   for(const service of ['octopus','foxess','websocket']){
    const config={action:(save?'store_':'test_')+service};configs.push(config);
    for(const field of service==='octopus'?['account','key']:service==='foxess'?['serial','key']:['username','password'])config[field]=$('esp-setup-'+service+'-'+field).value;
    const target=$('esp-setup-'+service+'-status');
    if(save&&service!=='websocket'&&!Object.entries(config).some(([key,value])=>key!=='action'&&value.trim())){target.textContent='Unchanged. Saved account details kept.';continue;}
    if(service==='websocket'){
     config.mode=$('esp-telemetry-mode').value;
     if(!config.username&&!config.password&&!state?.foxess_telemetry?.configured){target.textContent='Optional login not configured. REST remains available.';continue;}
    }
    try{
     const result=await runSetupJob(config,target);
     if(save?!result?.saved:!result?.connected)failed=true;
    }catch(error){target.textContent=error.message;failed=true;}
   }
   summary.textContent=save?(failed?'Some account settings were not saved. Check each result above.':'Accounts saved. Use Test all APIs to check the connections.'):(failed?'Some checks failed. Correct the account details, save, then test again.':'All configured services passed. No settings or inverter schedules were changed.');
   await D.refresh();
  }catch(error){summary.textContent=error.message;}
  finally{configs.forEach(config=>Object.keys(config).forEach(key=>config[key]=''));setupBusy=false;accountActions.forEach(id=>$(id).disabled=false);}
 }
 $('esp-test-all-apis').addEventListener('click',()=>accountAction(false));
 $('esp-save-accounts').addEventListener('click',()=>accountAction(true));
 window.addEventListener('pagehide',()=>{setupInputs.forEach(id=>{$('esp-setup-'+id).value='';});setupEyes.forEach(button=>setSetupVisibility(button,false));});
 window.addEventListener('price-display-change',()=>{if(state)D.render?.(state);});
 $('esp-history-range').addEventListener('change',()=>void D.loadHistory().catch(error=>D.notice(error.message,true)));
 window.addEventListener('resize',()=>{if(state)D.render?.(state);if(D.page==='history')D.renderHistory?.(history);});
 window.addEventListener('pagehide',()=>{csrf='';pendingReview=null;D.maskAccount?.();});
 let pollTimer,pollEpoch=0,forcePoll=false;
 function schedule(delay){clearTimeout(pollTimer);const epoch=++pollEpoch;pollTimer=setTimeout(()=>poll(epoch),delay);}
 async function poll(epoch){
  if(!document.hidden&&(loggedIn||!state||forcePoll)){forcePoll=false;try{await D.refresh();}catch{}}
  if(epoch===pollEpoch)schedule(document.hidden?20000:5000);
 }
 const resume=()=>{if(document.hidden)return;D.cancelReads();forcePoll=true;schedule(0);};
 $('esp-reconnect').addEventListener('click',resume);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){D.cancelReads();schedule(20000);}else resume();});
 window.addEventListener('pageshow',event=>{if(event.persisted)resume();});
 window.addEventListener('online',resume);
 window.addEventListener('pagehide',()=>{D.cancelReads();clearTimeout(pollTimer);pollEpoch++;});
 schedule(0);
})();
