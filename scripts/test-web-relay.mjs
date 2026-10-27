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
  const send = body => fetch(endpoint,{method:'POST',body:JSON.stringify(body)}).then(response=>response.json());
  const graph='https://api.octopus.energy/v1/graphql/';
  const beforeCapabilities=relay.stats.requests.length;
  assert.equal((await send({action:'capabilities'})).relayVersion,2);
  assert.equal(relay.stats.requests.length,beforeCapabilities,'Capability checks do not contact any upstream API');
  vm.runInContext(`globalOctopusTransport='gas'`,context);
  const authBody={query:'mutation { obtainKrakenToken(input:{APIKey:"dummy-private-key"}) {token} }'};
  context.testAuth=authBody;
  const authResult=await vm.runInContext(`fetchOctopusJson('${graph}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(testAuth)})`,context);
  assert.equal(authResult.data.obtainKrakenToken.token,'mock-octopus-token');
  await vm.runInContext(`fetchOctopusJson('${graph}',{method:'POST',headers:{Authorization:'mock-octopus-token'},body:'{"query":"query { plannedDispatches { startDt } }"}'})`,context);
  await vm.runInContext(`fetchOctopusJson('https://api.octopus.energy/v1/accounts/A-TEST/',{headers:{Authorization:'Basic dummy'}})`,context);
  await vm.runInContext(`fetchOctopusJson('https://api.octopus.energy/v1/products/TEST/electricity-tariffs/E-1R-TEST-A/standard-unit-rates/?period_from=2026-10-27')`,context);
  const upstream=relay.stats.requests.slice(beforeCapabilities);
  assert.deepEqual(upstream.map(row=>row.method),['post','post','get','get']);
  assert.equal(upstream[1].headers.Authorization,'mock-octopus-token');
  assert.equal(upstream[2].headers.Authorization,'Basic dummy');
  assert.ok(upstream.every(row=>!row.path.includes('dummy-private-key')),'Keys travel in POST bodies, never URL paths');
  let delay=0;
  context.window.retryDelay=(response)=>response.status===429?Number(response.headers.get('retry-after'))*1000:0;
  context.window.requestPolicy={run:(url,options,operation)=>operation(),octopus:{defer:async value=>{delay=value;}}};
  relay.octopusFailure({status:429,headers:{'Retry-After':'180'},body:{detail:'Too many requests.'}});
  await assert.rejects(vm.runInContext(`fetchOctopusJson('${graph}',{method:'POST',body:'{"query":"query example"}'})`,context),error=>error.statusCode===429);
  assert.equal(delay,180000,'Relaying preserves the real HTTP rate limit and Retry-After');
  relay.octopusFailure({status:200,body:{errors:[{message:'Invalid API key'}]}});
  const invalid=await vm.runInContext(`fetchOctopusJson('${graph}',{method:'POST',body:JSON.stringify(testAuth)})`,context);
  assert.equal(invalid.errors[0].message,'Invalid API key','GraphQL errors remain visible to the engine');
  relay.octopusFailure(null);
  const beforeBlocked=relay.stats.requests.length;
  for(const target of ['https://evil.example/','http://api.octopus.energy/v1/graphql/','https://api.octopus.energy.evil.example/v1/graphql/','https://api.octopus.energy/v1/accounts/A-TEST/','https://www.foxesscloud.com/op/v0/device/delete']) {
    assert.equal((await send({url:target,method:'post',body:{}})).errno,999);
  }
  assert.equal(relay.stats.requests.length,beforeBlocked,'Disallowed targets never reach UrlFetchApp');
  const originalFetch=context.fetch;
  let oldRelayCalls=0;
  context.fetch=async()=>{oldRelayCalls++;return new Response('{"errno":999,"msg":"old relay"}',{headers:{'Content-Type':'application/json'}});};
  vm.runInContext(`octopusRelayChecks.clear()`,context);
  await assert.rejects(vm.runInContext(`fetchOctopusJson('${graph}',{method:'POST',body:JSON.stringify(testAuth)})`,context),/Update your Google relay code/);
  assert.equal(oldRelayCalls,1,'An old deployment is detected before credentials are forwarded');
  let captured;
  context.fetch=async(url,options)=>{captured={url,options};return new Response('{"data":{}}',{headers:{'Content-Type':'application/json'}});};
  vm.runInContext(`globalOctopusTransport='direct'`,context);
  await vm.runInContext(`fetchOctopusJson('${graph}',{method:'POST',body:JSON.stringify(testAuth)})`,context);
  assert.equal(captured.url,graph,'Direct mode retains its original transport');
  context.window.linuxRuntime=true;
  vm.runInContext(`globalOctopusTransport='gas'`,context);
  await vm.runInContext(`fetchOctopusJson('${graph}',{method:'POST',body:'{"query":"query example"}'},'graphql')`,context);
  assert.equal(captured.url,'/api/octopus','Pi and Windows always retain the host transport');
  assert.equal(JSON.parse(captured.options.body).authMode,'graphql');
  context.window.linuxRuntime=false;context.fetch=originalFetch;
  const guide=await readFile(new URL('../docs/WEB-GUIDE.md',import.meta.url),'utf8');
  const normalize = code => code.replace(/'([a-zA-Z]+)'\s*:/g,'$1:').replace(/\s+/g,'');
  assert.equal(normalize(guide.match(/```javascript\n([\s\S]*?)\n```/)[1]),normalize(relay.code),'Guide and bundled relay code must stay aligned');
  console.log('GAS relay: signed FoxESS reads/writes, pause/readback, Octopus auth/GraphQL/account/tariffs, HTTP 429, upgrade detection, target allowlist, and unchanged direct/host transport passed. No live service used.');
} finally {server.close();server.closeAllConnections();await once(server,'close');}
