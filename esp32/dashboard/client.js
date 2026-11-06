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
  dirty=false;filledRevision=0;await D.refresh();D.notice(`Settings saved on ESP32 (revision ${saved.revision}). Wait for fresh dispatch data and REST confirmation.`);
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
 D.serviceError=name=>name==='octopus'?(state?.octopus_http&&state.octopus_http!==200||state?.dispatch_error_code):state?.foxess_http&&state.foxess_http!==200;
 for(const name of ['octopus','foxess'])$('esp-service-'+name).addEventListener('click',()=>{
  if(D.serviceError(name)){
   D.review((name==='octopus'?'Octopus Energy':'FoxESS')+' update problem',state?.[name+'_status']||'The API update failed.',
    (name==='octopus'&&state?.dispatch_error_code?'Error code: '+state.dispatch_error_code+'\n':'')+'The worker retains valid data. Automatic checks continue. Refresh requests respect service cooldowns.',()=>D.requestApiRefresh(name),'Refresh now');
  }else void D.requestApiRefresh(name);
 });
 $('esp-telemetry-save').addEventListener('click',async()=>{
  const button=$('esp-telemetry-save');button.disabled=true;
  try{await D.request('/api/telemetry-mode',{mode:$('esp-telemetry-mode').value});await D.refresh();D.notice('Telemetry mode saved. Automation settings are unchanged.');}
  catch(error){D.notice(error.message,true);}finally{button.disabled=false;}
 });

 let setupBusy=false;
 const setupInputs=['octopus-account','octopus-key','foxess-serial','foxess-key','websocket-username','websocket-password'];
 document.querySelectorAll('[data-esp-eye]').forEach(button=>button.addEventListener('click',()=>{const input=$(button.dataset.espEye),show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-pressed',String(show));}));
 document.querySelectorAll('[data-service-setup]').forEach(button=>button.addEventListener('click',async()=>{
  if(setupBusy)return;setupBusy=true;
  const action=button.dataset.serviceSetup,service=action.replace(/^(test|save)_/,''),target=$('esp-setup-'+service+'-status');
  const config={action};let savedSetup=false;
  for(const field of service==='octopus'?['account','key']:service==='foxess'?['serial','key']:['username','password'])config[field]=$('esp-setup-'+service+'-'+field).value;
  if(service==='websocket')config.mode=$('esp-telemetry-mode').value;
  document.querySelectorAll('[data-service-setup]').forEach(item=>item.disabled=true);
  try{
   const job=await D.request('/api/setup-job',config);
   let completed=false;const setupStarted=Date.now();
   for(let i=0;i<180&&Date.now()-setupStarted<180000;i++){
    const current=await D.request('/api/setup-job?id='+job.id);
    if(current.phase==='done'){target.textContent=current.result?.status||'Test completed.';savedSetup=current.result?.saved===true;completed=true;break;}
    target.textContent=current.phase==='queued'?'Waiting for a service request slot…':current.progress||'Testing on the ESP32…';
    await new Promise(resolve=>setTimeout(resolve,1000));
   }
   if(!completed)throw Error('Test still pending. Check device status before retrying.');
   await D.refresh();
  }catch(error){target.textContent=error.message.includes('not found')?'The ESP32 restarted or the test expired. Nothing was confirmed saved. Retry after the device reconnects.':error.message;}
  finally{for(const key of Object.keys(config))config[key]='';if(savedSetup)setupInputs.filter(id=>id.startsWith(service+'-')).forEach(id=>{$('esp-setup-'+id).value='';$('esp-setup-'+id).type='password';});setupBusy=false;document.querySelectorAll('[data-service-setup]').forEach(item=>item.disabled=false);}
 }));
 window.addEventListener('pagehide',()=>setupInputs.forEach(id=>{$('esp-setup-'+id).value='';}));
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
