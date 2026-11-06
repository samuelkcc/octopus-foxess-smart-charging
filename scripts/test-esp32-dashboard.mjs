// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const nodes=new Map(),requests=[];
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'14',dataset:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
let state={schema:1,csrf:'test-csrf',revision:1,now:123,rules:{paused:true},dispatch_valid:true,octopus_http:200,foxess_http:200};
const context={document:{addEventListener(){},getElementById:node,querySelectorAll:()=>[]},window:{addEventListener(){}},setTimeout(){},clearTimeout(){},AbortController,fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>url==='/api/state'?state:{queued:true}};}};
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
