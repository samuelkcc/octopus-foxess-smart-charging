import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { ServiceControl } from '../linux/service-control.mjs';
const directory=await mkdtemp(path.join(tmpdir(),'charging-service-control-'));
const unit=new ServiceControl(path.join(directory,'unit.json'));await unit.load();unit.assertEnabled();
const initial=unit.revision;await unit.change(false);assert.throws(()=>unit.assertEnabled(),/disabled/);
const restored=new ServiceControl(unit.file);await restored.load();assert.equal(restored.enabled,false);
await restored.change(true);assert.throws(()=>restored.assertEnabled(initial),/disabled/,'Old queued jobs stay cancelled after re-enable');
const log=path.join(directory,'upstream-count.txt');await writeFile(log,'0');
const hook=path.join(directory,'mock-upstream.mjs');
await writeFile(hook,`import {readFile,writeFile} from 'node:fs/promises';
globalThis.fetch=async()=>{const n=Number(await readFile(${JSON.stringify(log)},'utf8'));await writeFile(${JSON.stringify(log)},String(n+1));return new Response(JSON.stringify({errno:0,result:{groups:[]}}));};`);
const port=47000+Math.floor(Math.random()*3000),origin=`http://127.0.0.1:${port}`;let child;
async function start(){
 child=spawn(process.execPath,['--import',hook,'linux/server.mjs'],{env:{...process.env,OCTOPUS_HOST:'127.0.0.1',OCTOPUS_PORT:String(port),OCTOPUS_REMOTE_PORT:String(port+1),OCTOPUS_STATE_DIR:directory},stdio:['ignore','ignore','pipe']});
 let stderr='';child.stderr.on('data',d=>{stderr+=d;});
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,25));}throw new Error(stderr);
}
async function stop(){if(child?.exitCode===null){const exit=once(child,'exit');child.kill('SIGTERM');await exit;}}
const send=(route,body,method='POST',headers={})=>fetch(origin+route,{method,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
try{
 await start();
 assert.equal((await send('/api/native-config',{accessRequired:true,accessKey:'test-local-code',liveWsEnabled:false,credentials:{acc:'A-MOCK',api:'mock-key',foxSN:'mock-device',foxToken:'mock-token',foxLiveMode:'rest'}},'PUT')).status,200);
 assert.equal((await send('/api/service-control',{enabled:false},'PUT',{Origin:'https://attacker.invalid'})).status,403);
 const spoofed=await new Promise(resolve=>{const request=http.request({host:'127.0.0.1',port,path:'/api/service-control',headers:{Host:'public.example'}},response=>{response.resume();resolve(response.statusCode);});request.end();});
 assert.equal(spoofed,403);
 assert.equal((await send('/api/service-control',{enabled:'false'},'PUT')).status,400);
 assert.equal((await send('/api/service-control',{enabled:false},'PUT')).status,200);
 const before=Number(await readFile(log,'utf8'));
 for(const endpoint of ['graphql/','accounts/A-MOCK/','products/TEST/electricity-tariffs/TEST/standard-unit-rates/'])assert.equal((await send('/api/octopus',{url:'https://api.octopus.energy/v1/'+endpoint,authMode:'graphql'})).status,423);
 for(const endpoint of ['scheduler/enable','scheduler/get'])assert.equal((await send('/api/foxess',{url:'https://www.foxesscloud.com/op/v3/device/'+endpoint,body:{deviceSN:'mock'}})).status,423);
 assert.equal((await fetch(origin+'/api/foxess/live')).status,423);
 assert.equal((await send('/api/foxess/live/test',{})).status,423);
 assert.equal((await fetch(origin+'/api/foxess/live/status')).status,200);
 assert.equal((await fetch(origin+'/api/native-config').then(r=>r.json())).serviceEnabled,false);
 assert.equal((await fetch(origin+'/api/service-status').then(r=>r.json())).octopus.state,'disabled');
 assert.equal((await fetch(origin+'/api/integration-status').then(r=>r.json())).serviceEnabled,false);
 assert.equal(Number(await readFile(log,'utf8')),before,'Disabled service sends no upstream requests of any kind');
 await stop();await start();
 assert.equal((await fetch(origin+'/api/service-control').then(r=>r.json())).enabled,false,'Disable survives restart');
 assert.equal((await fetch(origin+'/api/foxess/live')).status,423);
 assert.equal(Number(await readFile(log,'utf8')),before,'Restart does not reconnect disabled APIs');
 assert.equal((await send('/api/service-control',{enabled:true},'PUT')).status,200);
 assert.equal((await fetch(origin+'/api/service-control').then(r=>r.json())).enabled,true);
 const history=await fetch(origin+'/api/history').then(r=>r.json());
 assert.deepEqual(history.events.map(event=>event.type).sort(),['service_disabled','service_enabled']);
 assert.equal((await fetch(`http://127.0.0.1:${port+1}/api/service-control`)).status,503);
 console.log('Local-only service enable/disable: no Octopus/REST/WS requests, no commands, restart persistence, stale-job rejection, CSRF/remote blocking, and activity history passed.');
}finally{await stop();await rm(directory,{recursive:true,force:true});}
