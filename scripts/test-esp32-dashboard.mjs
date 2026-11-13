// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const nodes=new Map(),requests=[];
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'14',dataset:{},listeners:{},attributes:{},setAttribute(name,value){this.attributes[name]=value;},getAttribute(name){return this.attributes[name];},addEventListener(type,fn){this.listeners[type]=fn;},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
const eye=node('test-visibility');eye.dataset.espEye='esp-setup-octopus-key';eye.setAttribute('aria-label','Show API key');node('esp-setup-octopus-key').type='password';
const windowEvents={};
let state={schema:1,csrf:'test-csrf',revision:1,now:123,rules:{paused:true},dispatch_valid:true,octopus_http:200,foxess_http:200};
const context={document:{addEventListener(){},getElementById:node,querySelectorAll:selector=>selector==='[data-esp-eye]'?[eye]:[]},window:{addEventListener(type,handler){(windowEvents[type]??=[]).push(handler);}},setTimeout(){},clearTimeout(){},AbortController,fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>url==='/api/state'?state:{queued:true}};}};
vm.runInNewContext(await readFile(new URL('../esp32/dashboard/client.js',import.meta.url),'utf8'),context);
const D=context.window.esp32Dashboard;await D.refresh();
for(const service of ['octopus','foxess']){
 requests.length=0;node('esp-service-'+service).listeners.click();await new Promise(resolve=>setImmediate(resolve));
 const request=requests.find(row=>row.url==='/api/refresh');assert(request,'Header control must request a worker API refresh');
 assert.equal(request.options.method,'POST');assert.equal(request.options.headers['X-SC-CSRF'],'test-csrf');assert.equal(JSON.parse(request.options.body).service,service);
 assert(!requests.some(row=>row.url==='/api/rules'||row.url==='/api/manual'));
 assert.equal(state.rules.paused,true);
}
state={...state,dispatch_error_code:'INVALID_DISPATCH_TIMESTAMP',octopus_status:'Last valid windows retained'};await D.refresh();requests.length=0;
node('esp-service-octopus').listeners.click();assert.equal(node('esp-review').open,true);assert.equal(requests.length,0);
assert(node('esp-review-details').textContent.includes('INVALID_DISPATCH_TIMESTAMP'));
node('esp-review-back').listeners.click();assert.equal(node('esp-review').open,false);assert.equal(requests.length,0);
console.log('ESP32 header controls: both worker refresh endpoints, CSRF, error review, cancellation and unchanged Pause passed.');

const secret=node('esp-setup-octopus-key');secret.value='mock-key';
eye.listeners.click();assert.equal(secret.type,'text');assert.equal(secret.value,'mock-key');assert.equal(eye.getAttribute('aria-label'),'Hide API key');assert.equal(eye.getAttribute('aria-pressed'),'true');
eye.listeners.click();assert.equal(secret.type,'password');assert.equal(secret.value,'mock-key');assert.equal(eye.getAttribute('aria-label'),'Show API key');
eye.listeners.click();windowEvents.pagehide.forEach(handler=>handler());assert.equal(secret.value,'');assert.equal(secret.type,'password');assert.equal(eye.getAttribute('aria-pressed'),'false');
console.log('ESP32 credential visibility: retained edits, descriptive labels and masked page-exit cleanup passed.');

// One Settings action checks all configured services sequentially and continues after a failed check.
let activeJobs=0,maxJobs=0,jobConfig,jobId=0;const actions=[];
for(const field of ['octopus-account','octopus-key','foxess-serial','foxess-key','websocket-username','websocket-password'])node('esp-setup-'+field).value='';
node('esp-telemetry-mode').value='live-ws';
state={...state,dispatch_error_code:'',foxess_telemetry:{configured:true,mode:'live-ws',status:'WebSocket saved; connection pending'},setup_checks:{}};
context.fetch=async(url,options)=>{
 requests.push({url,options});
 if(url==='/api/setup-job'){jobConfig=JSON.parse(options.body);actions.push(jobConfig.action);activeJobs++;maxJobs=Math.max(maxJobs,activeJobs);return{ok:true,json:async()=>({id:++jobId})};}
 if(url.startsWith('/api/setup-job?id=')){activeJobs--;return{ok:true,json:async()=>({phase:'done',result:{connected:jobConfig.action!=='test_octopus',saved:jobConfig.action.startsWith('store_'),status:'Mock result'}})};}
 return{ok:true,json:async()=>state};
};
await D.refresh();await node('esp-test-all-apis').listeners.click();
assert.deepEqual(actions,['test_octopus','test_foxess','test_websocket']);assert.equal(maxJobs,1);assert.match(node('esp-setup-all-status').textContent,/Some checks failed/);
actions.length=0;node('esp-setup-octopus-key').value='candidate-key';node('esp-setup-foxess-key').value='candidate-key';await node('esp-save-accounts').listeners.click();assert.deepEqual(actions,['store_octopus','store_foxess','store_websocket']);assert.match(node('esp-setup-all-status').textContent,/Accounts saved/);
state={...state,octopus_http:200,octopus_fault:true,foxess_fault:true};await D.refresh();assert(D.serviceError('octopus'));assert(D.serviceError('foxess'));
state={...state,octopus_fault:false,foxess_fault:false};await D.refresh();assert(!D.serviceError('foxess'),'Pending WebSocket setup is not a connection fault');
state={...state,setup_checks:{foxess:{connected:false,at:100}},telemetry_at:90};await D.refresh();assert(D.serviceError('foxess'));assert.match(D.serviceMessage('foxess'),/test failed/);
state={...state,telemetry_at:101};await D.refresh();assert(!D.serviceError('foxess'),'Fresh successful worker data supersedes an older failed test');
console.log('Account setup: one sequential test action, continuation after failure, independent store actions, HTTP-200 semantic faults and shared diagnostic freshness passed.');

actions.length=0;node('esp-setup-octopus-key').value='';node('esp-setup-foxess-key').value='';await node('esp-save-accounts').listeners.click();assert.deepEqual(actions,['store_websocket'],'Blank account edits must not reset valid worker state');

let otaRequests=[];
context.fetch=async(url,options)=>{
 if(url==='/api/ota'){
  const body=options.body?JSON.parse(options.body):null;if(body)otaRequests.push(body);
  return{ok:true,json:async()=>({current:'2.5.0',version:'2.5.1',available:true,newer:true,busy:false,phase:'ready',status:'Mock update ready'})};
 }
 return{ok:true,json:async()=>state};
};
await node('esp-ota-check').listeners.click();assert.equal(otaRequests[0].action,'check');assert.equal(node('esp-ota-install').disabled,false);
node('esp-ota-erase').checked=true;node('esp-ota-erase-confirmation').value='';node('esp-ota-install').listeners.click();assert.match(node('esp-ota-status').textContent,/Type ERASE/);assert.equal(otaRequests.length,1);
node('esp-ota-erase-confirmation').value='ERASE';node('esp-ota-install').listeners.click();assert.equal(node('esp-review').open,true);assert.equal(otaRequests.length,1,'Opening confirmation must not install');
await node('esp-review-apply').listeners.click();assert.equal(otaRequests[1].action,'install');assert.equal(otaRequests[1].version,'2.5.1');assert.equal(otaRequests[1].confirmation,'INSTALL_OTA_UPDATE');assert.equal(otaRequests[1].erase_confirmation,'ERASE');assert.equal(otaRequests[1].erase_settings,true);
console.log('OTA interface: explicit check, exact Clean consent, review before install, selected version and existing CSRF request path passed.');

D.syncFirmwareUpdate({available:true,newer:true,version:'2.5.3',auto_check:false});assert.equal(node('esp-update-available').hidden,false);assert.equal(node('esp-ota-auto-check').checked,false);
D.syncFirmwareUpdate({available:true,newer:false,auto_check:true});assert.equal(node('esp-update-available').hidden,true);
node('esp-ota-auto-check').checked=false;await node('esp-ota-auto-check').listeners.change();assert.equal(otaRequests.at(-1).action,'auto_settings');assert.equal(otaRequests.at(-1).enabled,false);
console.log('Firmware availability uses the ESP32 snapshot; saved automatic-check preference is independent of installation.');

// Flash cache restoration can finish after the first state response, without new telemetry.
let historyReads=0;
context.fetch=async url=>({ok:true,json:async()=>{
 if(url.startsWith('/api/history?')){historyReads++;return [];}
 return state;
}});
state={...state,history_saved_records:0,history_saved_through:100,history_records:0};
D.page='history';await D.refresh();await new Promise(resolve=>setImmediate(resolve));
assert.equal(historyReads,1);
state={...state,history_saved_records:168};await D.refresh();await new Promise(resolve=>setImmediate(resolve));
assert.equal(historyReads,2,'Loading restored Flash records must refresh History without waiting for new telemetry');
await D.refresh();await new Promise(resolve=>setImmediate(resolve));assert.equal(historyReads,2,'An unchanged snapshot must not repeat History reads');
console.log('History restoration refreshes the chart when the saved cache arrives, without new telemetry or repeated unchanged reads.');
