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
