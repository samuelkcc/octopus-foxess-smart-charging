import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import vm from 'node:vm';
import { createGasRelay } from './fixtures/gas-relay.mjs';

const relay = await createGasRelay();
const server = http.createServer((request,response)=>void relay.handle(request,response));
server.listen(0,'127.0.0.1');await once(server,'listening');
const endpoint=`http://127.0.0.1:${server.address().port}/exec`;
const fields=new Map();
const field=id=>{if(!fields.has(id))fields.set(id,{style:{},dataset:{},textContent:'',innerHTML:'',checked:false,value:'',classList:{toggle(){}}});return fields.get(id);};
const context=vm.createContext({
  console:{log(){},warn(){}},fetch,URL,AbortController,
  setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},
  window:{addEventListener(){},location:{href:'https://example.test/project/'},automationControl:{isPaused:()=>false,write:operation=>operation()}},
  document:{addEventListener(){},getElementById:field,querySelectorAll:()=>[],documentElement:{querySelector:selector=>field(selector.slice(1))}},
  localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null},
  CryptoJS:{MD5:text=>({toString:()=>createHash('md5').update(text).digest('hex')})}
});
try {
  vm.runInContext(await readFile(new URL('../src/app.js',import.meta.url),'utf8'),context);
  vm.runInContext(`globalFoxSN='dummy-device';globalFoxToken='dummy-token';globalGasUrl=${JSON.stringify(endpoint)};incrementFoxApi=()=>{};showToast=()=>{};updateModeBadge=()=>{};renderProtectionOverview=()=>{};`,context);
  assert.equal(vm.runInContext('canRunAutomaticActions()',context),true,'Standalone retains browser automation');
  assert.equal((await vm.runInContext('fetchFoxSchedules()',context)).length,0);
  assert.equal(await vm.runInContext('fetchCurrentWorkMode(true)',context),'SelfUse');
  const fields=vm.runInContext('window.lastFoxTelemetry',context);
  assert.equal(fields.gridConsumptionPower,0.2,'Standalone must request grid flow');
  assert.equal(fields.batDischargePower,0,'Standalone must request measured battery power, including zero');
  const group={enable:1,startHour:17,startMinute:0,endHour:18,endMinute:0,workMode:'ForceCharge',extraParam:{minSocOnGrid:11,fdSoc:80,fdPwr:5000}};
  context.mockGroup=group;
  const result=await vm.runInContext('pushGroupsToFoxESS([mockGroup],1)',context);
  assert.equal(result.groups.length,1);
  assert.equal(relay.stats.writes,1);
  assert.equal((await vm.runInContext('fetchFoxSchedules()',context))[0].workMode,'ForceCharge');
  assert.ok(relay.stats.requests.every(request=>request.signatureValid && request.method==='post' && request.contentType==='application/json'),'GAS receives correct FoxESS headers and JSON payload');
  assert.equal(relay.stats.redirects,relay.stats.requests.length,'ContentService redirect responses are followed');
  const before=relay.stats.writes;
  vm.runInContext(`window.automationControl={isPaused:()=>true,write:()=>Promise.reject(new Error('paused'))}`,context);
  await assert.rejects(vm.runInContext('pushGroupsToFoxESS([mockGroup],1)',context),/paused/);
  assert.equal(relay.stats.writes,before,'A paused browser sends no GAS schedule command');
  vm.runInContext(`window.automationControl={isPaused:()=>false,write:operation=>operation()}`,context);
  relay.reject('Mock FoxESS rejection');
  assert.equal((await vm.runInContext('fetchFoxSchedules()',context)).length,1,'A failed background read preserves the last schedule');
  await assert.rejects(vm.runInContext('fetchFoxSchedules({expectedGroups:[mockGroup],attempts:1})',context),/Mock FoxESS rejection/);
  relay.reject(null);relay.mismatch(true);
  await assert.rejects(vm.runInContext('fetchFoxSchedules({expectedGroups:[mockGroup],attempts:1})',context),/did not confirm/);
  const malformed=await fetch(endpoint,{method:'POST',body:'invalid-json'}).then(response=>response.json());
  assert.equal(malformed.errno,999,'The documented GAS handler reports malformed requests');
  const guide=await readFile(new URL('../docs/WEB-GUIDE.md',import.meta.url),'utf8');
  const normalize = code => code.replace(/'([a-zA-Z]+)'\s*:/g,'$1:').replace(/\s+/g,'');
  assert.equal(normalize(guide.match(/```javascript\n([\s\S]*?)\n```/)[1]),normalize(relay.code),'Guide and bundled relay code must stay aligned');
  console.log('Standalone → documented GAS doPost → mock FoxESS: signed reads, writes, fresh confirmation, redirects, pause blocking and rejection handling passed. No live service used.');
} finally {server.close();server.closeAllConnections();await once(server,'close');}
