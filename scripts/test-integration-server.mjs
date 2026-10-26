import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm,stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const root=await mkdtemp(path.join(os.tmpdir(),'charging-health-'));
const port=30000+Math.floor(Math.random()*15000);
const origin=`http://127.0.0.1:${port}`;
const toggle=path.join(root,'upstream-mode');const hook=path.join(root,'mock-fetch.mjs');
await writeFile(toggle,'fail');
await writeFile(hook,`import {readFile} from 'node:fs/promises';
const original=globalThis.fetch;
globalThis.fetch=async (url,options)=>{
 if(String(url).startsWith('https://www.foxesscloud.com')){
  const mode=await readFile(${JSON.stringify(toggle)},'utf8');
  return new Response(JSON.stringify(mode==='fail'?{errno:999,msg:'mock failure'}:{errno:0,result:{groups:[]}}),{status:mode==='fail'?503:200,headers:{'Content-Type':'application/json'}});
 }
 return original(url,options);
};`);
let child;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function start(){
 child=spawn(process.execPath,['--import',hook,'linux/server.mjs'],{env:{...process.env,OCTOPUS_HOST:'127.0.0.1',OCTOPUS_PORT:String(port),OCTOPUS_REMOTE_PORT:String(port+1),OCTOPUS_STATE_DIR:root,OCTOPUS_WEB_ROOT:path.resolve('src')},stdio:['ignore','pipe','pipe']});
 let output='';child.stderr.on('data',data=>{output+=data;});
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/api/health')).ok)return;}catch{}await sleep(50);}
 throw new Error('Mock server did not start: '+output);
}
async function stop(){if(child && child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}}
const put=body=>({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const status=()=>fetch(origin+'/api/integration-status').then(response=>response.json());
const request=()=>fetch(origin+'/api/foxess',{method:'POST',body:JSON.stringify({url:'https://www.foxesscloud.com/op/v3/device/scheduler/get',body:{deviceSN:'dummy'}})});
try {
 await start();
 await fetch(origin+'/api/native-config',put({accessRequired:false,credentials:{foxSN:'dummy-device',foxToken:'dummy-secret-token'}}));
 assert.equal((await request()).status,503);
 let current=await status();const id=current.services.foxess.alert.id;
 assert.equal(current.services.foxess.state,'error');
 assert.equal((await fetch(origin+'/api/integration-status',put({service:'foxess',alertId:id}))).status,409);
 await writeFile(toggle,'ok');assert.equal((await request()).status,200);
 current=await status();assert.equal(current.services.foxess.state,'ok');assert.equal(current.services.foxess.alert.id,id);
 await stop();await start();
 current=await status();assert.equal(current.services.foxess.alert.id,id,'Pi incident survives restart after API recovery');
 assert.equal((await fetch(origin+'/api/integration-status',{...put({service:'foxess',alertId:id}),headers:{'Content-Type':'application/json',Origin:'https://attacker.invalid'}})).status,403);
 assert.equal((await fetch(origin+'/api/integration-status',put({service:'foxess',alertId:id}))).status,200);
 assert.equal((await status()).services.foxess.alert,null);
 const refresh=await fetch(origin+'/api/integration-status',put({action:'refresh'}));
 assert.equal(refresh.status,202);
 const requestId=(await refresh.json()).refreshRequestId;
 assert.ok(requestId>0);
 const timing={requestSeen:requestId,octopusNextAt:Date.now()+60000,foxessNextAt:Date.now()+600000,octopusBusy:false,foxessBusy:true};
 const publish=body=>({method:'POST',headers:{'Content-Type':'application/json','X-Octopus-Worker':'1'},body:JSON.stringify(body)});
 assert.equal((await fetch(origin+'/api/integration-status',{...publish(timing),headers:{'Content-Type':'application/json'}})).status,403);
 assert.equal((await fetch(origin+'/api/integration-status',publish({...timing,unexpected:true}))).status,400);
 assert.equal((await fetch(origin+'/api/integration-status',publish(timing))).status,200);
 assert.equal((await status()).worker.requestSeen,requestId);
 assert.equal((await status()).worker.foxessBusy,true);
 const file=path.join(root,'integration-status.json');const contents=await readFile(file,'utf8');
 assert.equal(contents.includes('dummy-secret-token'),false);
 assert.equal((await stat(file)).mode&0o777,0o600);
 console.log('Pi integration incident persistence, recovery, explicit clear, active-incident rejection, CSRF and secret-free owner-only storage passed (mock upstream).');
} finally {await stop();await rm(root,{recursive:true,force:true});}
