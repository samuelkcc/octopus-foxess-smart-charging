import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { IntegrationState } from '../linux/integration-state.mjs';
let clock=Date.parse('2026-10-26T15:00:00Z');
let state=new IntegrationState(null,()=>clock);
assert.equal(state.snapshot().services.octopus.state,'waiting');
state.failure('octopus','dispatch','Octopus update failed');
const first=state.snapshot().services.octopus.alert.id;
assert.throws(()=>state.acknowledge('octopus',first),{statusCode:409},'An active error cannot be cleared as healthy');
clock+=1000;state.failure('octopus','dispatch','Octopus update failed');
assert.equal(state.snapshot().services.octopus.alert.count,2);
assert.equal(state.snapshot().services.octopus.alert.id,first);
state.success('octopus','tariff');
assert.equal(state.snapshot().services.octopus.state,'error','A successful tariff query must not hide a dispatch failure');
state.success('octopus','dispatch');
assert.equal(state.snapshot().services.octopus.state,'ok');
assert.equal(state.snapshot().services.octopus.alert.id,first,'Recovery must retain the incident until explicit acknowledgement');
state=new IntegrationState(JSON.parse(JSON.stringify(state.data)),()=>clock);
assert.equal(state.snapshot().services.octopus.alert.id,first,'Retained incidents survive restart/storage reload');
assert.throws(()=>state.acknowledge('octopus',first+1),{statusCode:409});
state.acknowledge('octopus',first);
assert.equal(state.snapshot().services.octopus.alert,null);
const lastGood=state.snapshot().services.octopus.lastSuccessAt;
state.failure('octopus','dispatch','New failure');
assert.equal(state.snapshot().services.octopus.lastSuccessAt,lastGood,'A failed update retains the last successful timestamp');
assert.notEqual(state.snapshot().services.octopus.alert.id,first);
assert.throws(()=>state.acknowledge('octopus',first),{statusCode:409},'Stale acknowledgements must not erase a newer incident');
assert.throws(()=>state.success('unknown'),{statusCode:400});

const context=vm.createContext({console,Date,setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},
 window:{addEventListener(){}},document:{addEventListener(){},getElementById:()=>null},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null}});
vm.runInContext(await readFile(new URL('../src/app.js',import.meta.url),'utf8'),context);
const power=(a,b)=>JSON.parse(vm.runInContext(`JSON.stringify(getDirectionalPower(${a},${b},'import','export','balanced'))`,context));
assert.deepEqual(power(0,0),{power:0,direction:'balanced'},'Measured zero is available data');
assert.deepEqual(power('undefined','undefined'),{power:null,direction:''},'Missing values must not become zero');
assert.deepEqual(power(0,'null'),{power:null,direction:''});
assert.deepEqual(power(0,0.7),{power:0.7,direction:'export'});
assert.deepEqual(power(0.4,0),{power:0.4,direction:'import'});
for(const pi of [false,true]) {
 vm.runInContext(`window.linuxRuntime=${pi};window.linuxRole='${pi?'dashboard':'web'}';globalFoxSN='dummy';globalGasUrl='mock';globalThis.calls=[];fetchJson=async()=>({});initDashboard=async()=>calls.push('octopus');fetchFoxSchedules=async()=>calls.push('schedules');fetchCurrentWorkMode=async()=>calls.push('mode');fetchLinuxLiveTelemetry=async force=>calls.push('telemetry:'+force);`,context);
 const promises=vm.runInContext('[refreshOverviewNow(),refreshOverviewNow()]',context);
 assert.equal(promises[0],promises[1],'Repeated refresh actions share one in-flight update');
 await promises[0];
 assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(calls)',context)),pi?['octopus','schedules','mode','telemetry:true']:['octopus','schedules','mode']);
 assert.equal(vm.runInContext('getOverviewRefreshStatus().running',context),false);
}
vm.runInContext("window.linuxRuntime=true;window.linuxRole='dashboard';window.nextOctoTime=123;requestWorkerDataRefresh()",context);
assert.equal(vm.runInContext('window.nextOctoTime',context),123,'Visible clients cannot trigger the worker timer directly');
vm.runInContext("window.linuxRole='worker';requestWorkerDataRefresh()",context);
assert.ok(vm.runInContext('window.nextOctoTime',context)>123);
console.log('Integration incident retention, recovery, explicit acknowledgement, restart, stale-ack protection, zero/missing power, and coalesced web/Pi refresh passed.');

const {readRuntimeReport}=await import('../linux/inspect-runtime.mjs');
const report=await readRuntimeReport(async()=>({ok:true,json:async()=>({version:'2.0.0',key:'private-key',credentials:{api:'secret-api'},values:{SoC:50},url:'https://example.trycloudflare.com',services:{octopus:{state:'ok',lastError:'secret-api'},foxess:{state:'ok'}}})}));
assert.equal(JSON.stringify(report).includes('private-key'),false);
assert.equal(JSON.stringify(report).includes('secret-api'),false);
assert.equal(report.telemetry.values.SoC,50);

// A page exit can abort an in-flight request. It is not an upstream outage.
const lifecycleHandlers={};
const lifecycleWindow={IntegrationState,addEventListener:(name,handler)=>{lifecycleHandlers[name]=handler;},dispatchEvent(){}};
const lifecycle=vm.createContext({window:lifecycleWindow,document:{getElementById:()=>null},localStorage:{getItem:()=>null,setItem(){}},CustomEvent:class {},setInterval:()=>1,Date});
vm.runInContext(await readFile(new URL('../src/integration-monitor.js',import.meta.url),'utf8'),lifecycle);
lifecycleHandlers.pagehide();
lifecycleWindow.integrationMonitor.failure('octopus','dispatch',new Error('Load failed'));
assert.equal(lifecycleWindow.integrationMonitor.snapshot().local.services.octopus.alert,null,'Page-exit cancellation must not create an outage alert');
lifecycleHandlers.pageshow();
lifecycleWindow.integrationMonitor.failure('octopus','dispatch',new Error('Service unavailable'));
assert.equal(lifecycleWindow.integrationMonitor.snapshot().local.services.octopus.state,'error','Real failures after a restored page remain visible');
console.log('Page-exit cancellation is ignored; resumed-page service failures remain retained.');

// Expiry applies only to recovered alerts. Time is measured from the last failure.
clock=Date.parse('2026-10-27T00:00:00Z');
state=new IntegrationState(null,()=>clock);
assert.equal(state.snapshot().autoClearHours,24);
state.failure('octopus','dispatch','Temporary failure');
clock+=25*3600000;
assert.equal(state.expireAlerts(),false,'An active failure cannot expire as healthy');
state.success('octopus','dispatch');
assert.equal(state.expireAlerts(),true);
assert.equal(state.snapshot().services.octopus.alert,null);
state.setAutoClearHours(0);state.failure('foxess','api','Temporary failure');state.success('foxess');
clock+=48*3600000;
assert.equal(state.expireAlerts(),false,'Manual-only preference retains recovered alerts');
state.setAutoClearHours(48);
state=new IntegrationState(JSON.parse(JSON.stringify(state.data)),()=>clock);
assert.equal(state.expireAlerts(),true,'Preference and timestamps survive restart');
state.setAutoClearHours(24);state.failure('foxess','api','Another failure');state.success('foxess');
clock+=24*3600000-1;assert.equal(state.expireAlerts(),false);
clock++;assert.equal(state.expireAlerts(),true,'Expiry includes the exact boundary');
for(const value of [-1,721,1.5,'24',null])assert.throws(()=>state.setAutoClearHours(value),{statusCode:400});
console.log('Configurable recovered-alert expiry, active failure protection, manual-only mode, restart and boundary checks passed.');

// Exercise actual badge handlers without making an API call.
class TestNode {
 constructor(tag='div'){this.tag=tag;this.children=[];this.handlers={};this.style={};this.dataset={};this.classList={toggle(){},contains(){return false;}};}
 append(...nodes){this.children.push(...nodes);} setAttribute(){} after(){} replaceChildren(){this.children=[];}
 addEventListener(type,fn){this.handlers[type]=fn;} querySelector(){return new TestNode();}
 showModal(){this.open=true;}close(){this.open=false;}
}
const nodes=[];let refreshes=0;
const health=new IntegrationState();health.success('octopus');health.success('foxess');
const badgeContext=vm.createContext({document:{createElement:tag=>{const node=new TestNode(tag);nodes.push(node);return node;},body:new TestNode(),querySelector:()=>new TestNode(),getElementById:()=>new TestNode()},window:{integrationMonitor:{snapshot:()=>({local:health.snapshot(),remote:null,busy:{}})},addEventListener(){}},MutationObserver:class{observe(){}},Date,setInterval(){},getEffectiveOctopusRefreshInterval:()=>60,foxRefreshInterval:600,getOverviewRefreshStatus:()=>({workerBusy:{}}),refreshOverviewNow:async()=>{refreshes++;}});
vm.runInContext(await readFile(new URL('../dev/monitor.js',import.meta.url),'utf8'),badgeContext);
const badges=nodes.filter(node=>node.className==='overview-service-refresh');
await badges[0].handlers.click();assert.equal(refreshes,1);
health.failure('octopus','api','Unavailable');
await badges[0].handlers.click();assert.equal(refreshes,1,'Warning badge must open details without refreshing or resetting intervals');
assert.equal(nodes.find(node=>node.tag==='dialog').open,true);
health.success('octopus');await badges[0].handlers.click();assert.equal(refreshes,1,'Recovered retained warning must also open details only');
console.log('Healthy badge refresh and warning/recovered badge review-only interactions passed.');

// A Safari network failure must identify its service, rather than implicating GAS.
const networkFields={error:{dataset:{},style:{}}};
const networkContext=vm.createContext({URL,AbortController,setTimeout,clearTimeout,setInterval(){},Date,console,
 fetch:async()=>{throw new TypeError('Load failed');},
 window:{linuxRuntime:false,location:{href:'https://example.test/app/'},addEventListener(){}},
 document:{addEventListener(){},getElementById:id=>networkFields[id]||null},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null}});
vm.runInContext(await readFile(new URL('../src/app.js',import.meta.url),'utf8'),networkContext);
await assert.rejects(vm.runInContext(`fetchJsonUnblocked('https://api.octopus.energy/v1/graphql/',{method:'POST',body:JSON.stringify({query:'mutation { obtainKrakenToken(input:{APIKey:"dummy-private-key"}) {token} }'})})`,networkContext),error=>{
 assert.match(error.message,/Octopus sign-in could not connect/);
 assert.equal(error.service,'octopus');assert.equal(error.networkFailure,true);
 assert.equal(error.message.includes('dummy-private-key'),false);return true;
});
vm.runInContext(`showError('Example network problem','octopus')`,networkContext);
assert.equal(networkFields.error.dataset.service,'octopus');
console.log('Service-specific browser network errors and secret-free sign-in diagnostics passed.');
let bodyReads=0,deferrals=0;
networkContext.fetch=async()=>({ok:true,status:200,headers:{get:()=>null},json:async()=>{bodyReads++;return {errors:[{message:'Too many requests.'}]};},clone:()=>{throw new Error('Response cloning must not be needed');}});
networkContext.window.requestPolicy={octopus:{defer:async()=>{deferrals++;}}};
networkContext.window.retryDelay=()=>60000;
await vm.runInContext(`fetchJsonUnblocked('https://api.octopus.energy/v1/graphql/')`,networkContext);
assert.equal(bodyReads,1);assert.equal(deferrals,1,'Single-read responses still enforce actual rate limits');
console.log('Browser response bodies are read once; rate-limit deferral remains active.');
