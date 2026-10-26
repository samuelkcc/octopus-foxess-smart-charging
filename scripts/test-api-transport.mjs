// Real local Pi server, fake upstream services and an accelerated queue clock.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const directory = await mkdtemp(path.join(tmpdir(), 'charging-budget-'));
const log = path.join(directory, 'requests.jsonl');
const hook = path.join(directory, 'upstream.mjs');
const port = 31000 + Math.floor(Math.random() * 10000);
const origin = `http://127.0.0.1:${port}`;
await writeFile(hook, `import {appendFile} from 'node:fs/promises';
const realFetch=globalThis.fetch, realTimeout=globalThis.setTimeout, realNow=Date.now;
let offset=0,groups=[];
Date.now=()=>realNow()+offset;
globalThis.setTimeout=(fn,ms,...args)=>{if(ms>=10000 && ms<=1200000){offset+=ms;return realTimeout(fn,0,...args);}return realTimeout(fn,ms,...args);};
globalThis.fetch=async (target,options={})=>{
 const url=String(target);if(!url.startsWith('https://api.octopus.energy') && !url.startsWith('https://www.foxesscloud.com'))return realFetch(target,options);
 const body=JSON.parse(options.body||'{}');
 await appendFile(${JSON.stringify(log)},JSON.stringify({url,at:Date.now(),auth:/obtainKrakenToken/.test(body.query||''),query:body.query||''})+'\\n');
 let data={results:[]},status=200,headers={'Content-Type':'application/json'};
 if(url.includes('octopus.energy/v1/graphql'))data=/obtainKrakenToken/.test(body.query||'')?{data:{obtainKrakenToken:{token:'test-only-token'}}}:{data:{plannedDispatches:[],registeredKrakenflexDevice:{status:'LIVE'},vehicleChargingPreferences:{weekdayTargetSoc:80}}};
 if(url.includes('night-unit-rates')){status=429;headers['Retry-After']='180';data={error:'Too many requests.'};}
 if(url.includes('foxesscloud.com')){if(url.endsWith('scheduler/enable'))groups=body.groups;data={errno:0,result:{groups}};}
 return new Response(JSON.stringify(data),{status,headers});
};`);
const child = spawn(process.execPath, ['--import', hook, 'linux/server.mjs'], {
  env: { ...process.env, OCTOPUS_HOST:'127.0.0.1', OCTOPUS_PORT:String(port), OCTOPUS_REMOTE_PORT:String(port+1), OCTOPUS_STATE_DIR:directory, OCTOPUS_WEB_ROOT:path.resolve('src') },
  stdio:['ignore','pipe','pipe']
});
let stderr=''; child.stderr.on('data', data=>{stderr+=data;});
const send = (endpoint, body, method='POST') => fetch(origin+endpoint, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
const octopus = (authMode, pathname, body) => send('/api/octopus', {authMode,url:`https://api.octopus.energy/v1/${pathname}`,body});
const fox = (pathname, body={}, extra={}) => send('/api/foxess', {url:`https://www.foxesscloud.com/op/v3/device/scheduler/${pathname}`,body:{deviceSN:'test',...body},...extra});
try {
  let ready=false;
  for(let i=0;i<100;i++){try{ready=(await fetch(origin+'/api/health')).ok;if(ready)break;}catch{}await new Promise(resolve=>setTimeout(resolve,30));}
  assert.ok(ready,stderr);
  assert.equal((await send('/api/native-config',{accessRequired:false,credentials:{acc:'A-TEST',api:'test-octo',foxSN:'test',foxToken:'test-fox'}},'PUT')).status,200);
  assert.equal((await send('/api/config',{automations:{refreshIntervals:{octopus:30,foxess:600}}},'PUT')).status,400);
  assert.equal((await send('/api/config',{automations:{refreshIntervals:{octopus:60,foxess:599}}},'PUT')).status,400);
  const graph={query:'query getGoData($acc: String!) { plannedDispatches(accountNumber:$acc) {startDt endDt} }'};
  const clients=await Promise.all(Array.from({length:6},()=>octopus('graphql','graphql/',graph)));
  for(const response of clients)assert.equal(response.status,200);
  await octopus('basic','accounts/A-TEST/');
  await octopus('none','products/TEST/electricity-tariffs/TEST/standard-unit-rates/');
  const limited=await octopus('none','products/TEST/electricity-tariffs/TEST/night-unit-rates/');
  assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'180');
  await octopus('none','products/TEST/electricity-tariffs/TEST/day-unit-rates/');
  await Promise.all([fox('get'),fox('get'),fox('get')]);
  await fox('enable',{groups:[{workMode:'ForceCharge'}]});
  await fox('get',{}, {readback:true});
  await fox('get',{}, {readback:true});
  const records=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse);
  const octo=records.filter(row=>row.url.includes('octopus.energy'));
  assert.equal(octo.filter(row=>row.auth).length,1,'One authentication for concurrent Pi clients');
  assert.equal(octo.filter(row=>!row.auth && row.url.includes('graphql')).length,1,'One combined GraphQL read for all clients');
  for(let i=1;i<octo.length;i++)assert.ok(octo[i].at-octo[i-1].at>=60000,JSON.stringify(octo));
  assert.ok(octo.at(-1).at-octo.at(-2).at>=180000,'Retry-After applies to every Octopus endpoint');
  const foxRows=records.filter(row=>row.url.includes('foxesscloud.com'));
  assert.equal(foxRows.filter(row=>row.url.endsWith('/get')).length,3,'Routine reads coalesce, each post-write verification stays fresh');
  assert.equal(foxRows.filter(row=>row.url.endsWith('/enable')).length,1,'The new schedule bypasses routine read caching');
  const budget=await readFile(path.join(directory,'octopus-request-budget.json'),'utf8');
  assert.equal(/test-octo|test-only-token|A-TEST/.test(budget),false);
  console.log('Actual Pi proxy: shared authentication/query, all-endpoint 60-second spacing, Retry-After, server-side minimum validation, cached FoxESS reads and immediate fresh write verification passed.');
} finally {
  if(child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}
  await rm(directory,{recursive:true,force:true});
}
