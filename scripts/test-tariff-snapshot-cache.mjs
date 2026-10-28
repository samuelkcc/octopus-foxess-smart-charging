// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {TariffSnapshotCache} from '../linux/tariff-snapshot-cache.mjs';
const dir=await mkdtemp(tmpdir()+'/tariff-display-');
try{
 let now=Date.parse('2026-10-28T10:00:00Z');const identity='a'.repeat(64),file=dir+'/display.json';
 const cache=new TariffSnapshotCache(file,()=>now);
 const payload={pending:false,problem:false,state:{importTariffCode:'IMPORT',exportTariffCode:'EXPORT',updatedAt:now,
 importRates:[{value_inc_vat:0,valid_from:'2026-10-28T00:00:00Z',valid_to:null}],exportRates:[{value_inc_vat:-2,valid_from:null,valid_to:null}],secret:'NEVER-SAVE'}};
 await cache.put(identity,payload);assert.equal((await stat(file)).mode&0o777,0o600);
 const restarted=new TariffSnapshotCache(file,()=>now);assert.equal((await restarted.load(identity)).payload.state.exportRates[0].value_inc_vat,-2);
 assert.equal(await restarted.load('b'.repeat(64)),null);assert(!/NEVER-SAVE|secret/.test(await readFile(file,'utf8')));
 await cache.put(identity,{...payload,pending:true});assert.equal((await cache.load(identity)).payload.pending,false);
 await cache.put(identity,{...payload,problem:true});assert.equal((await cache.load(identity)).payload.problem,false);
 now+=86400000;assert.equal(await restarted.load(identity),null);
 await writeFile(file,'broken');assert.equal(await restarted.load(identity),null);
 console.log('Display-only tariff cache restart, credentials isolation, permissions, expiry and incomplete-update exclusion passed.');
}finally{await rm(dir,{recursive:true,force:true});}

// Verify the actual server's restart path without contacting either energy API.
const {spawn}=await import('node:child_process');const {once}=await import('node:events');const path=await import('node:path');
const runtime=await mkdtemp(tmpdir()+'/tariff-restart-');let child;
const port=41000+Math.floor(Math.random()*5000),origin=`http://127.0.0.1:${port}`;
await writeFile(runtime+'/offline.mjs',"globalThis.fetch=()=>{throw Error('Upstream access is forbidden in this test');};");
async function start(){
 child=spawn(process.execPath,['--import',runtime+'/offline.mjs','linux/server.mjs'],{env:{...process.env,OCTOPUS_HOST:'127.0.0.1',OCTOPUS_PORT:String(port),OCTOPUS_REMOTE_PORT:String(port+1),OCTOPUS_STATE_DIR:runtime,OCTOPUS_WEB_ROOT:path.resolve('src')},stdio:'pipe'});
 let errors='';child.stderr.on('data',chunk=>errors+=chunk);
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,25));}
 throw Error(errors||'Server did not start');
}
async function stop(){if(child?.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}}
const publish=body=>fetch(origin+'/api/tariff-snapshot',{method:'POST',headers:{'Content-Type':'application/json','X-Octopus-Worker':'1'},body:JSON.stringify(body)});
try{
 await start();const body={accessRequired:false,credentials:{acc:'A-DEMO',api:'mock-api',foxSN:'demo',foxToken:'mock-fox'}};
 assert.equal((await fetch(origin+'/api/native-config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).status,200);
 const state={importTariffCode:'IMPORT',exportTariffCode:'EXPORT',importRates:[{value_inc_vat:29.82}],exportRates:[{value_inc_vat:12}],updatedAt:Date.now()};
 assert.equal((await publish({state,pending:false})).status,200);
 for(let i=0;i<50;i++){try{await stat(runtime+'/tariff-display-cache.json');break;}catch{}await new Promise(r=>setTimeout(r,10));}
 await stop();await start();let result=await fetch(origin+'/api/tariff-snapshot').then(r=>r.json());
 assert.equal(result.cached,true);assert.equal(result.pending,true);assert.equal(result.state.importRates[0].value_inc_vat,29.82);
 assert.equal((await publish({state:{...state,importRates:[]},pending:true,progress:1})).status,200);
 result=await fetch(origin+'/api/tariff-snapshot').then(r=>r.json());assert.equal(result.cached,true);assert.equal(result.state.importRates[0].value_inc_vat,29.82);
 await publish({state:{...state,importTariffCode:'CHANGED',importRates:[]},pending:true});
 result=await fetch(origin+'/api/tariff-snapshot').then(r=>r.json());assert.equal(result.state.importRates.length,0,'Never reuse rates for another agreement');
 await publish({state:{...state,importRates:[{value_inc_vat:30}]},pending:false});
 result=await fetch(origin+'/api/tariff-snapshot').then(r=>r.json());assert.equal(result.cached,undefined);assert.equal(result.state.importRates[0].value_inc_vat,30);
 console.log('Real server restart, pending-direction recovery, agreement isolation and fresh-worker replacement passed without upstream calls.');
}finally{await stop();await rm(runtime,{recursive:true,force:true});}
