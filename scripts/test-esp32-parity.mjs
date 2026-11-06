// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import path from 'node:path';
import os from 'node:os';
process.env.TZ='Europe/London';
const root=path.resolve(import.meta.dirname,'..'),json=path.join(root,'.build/esp32-sdk/esp-idf-v5.5.2/components/json/cJSON');
const source=await readFile(path.join(root,'src/app.js'),'utf8');
const defaults={enabled:true,paused:false,pause_until:0,follow_dispatch:true,charge_price_enabled:false,charge_price_p:7,discharge_price_enabled:false,discharge_price_p:30,weekly_charge:true,charge_start:1410,charge_end:330,charge_days:127,weekly_discharge:false,discharge_start:960,discharge_end:1140,discharge_days:127,target_soc:80,charge_soc_enabled:true,dispatch_soc_enabled:true,dispatch_soc:90,min_soc:11,power_w:5000,auto_resume:false,octopus_seconds:60,foxess_seconds:600,history_days:14,history_flash_enabled:false,pause_discharge_dispatch:true,discharge_overrides_charge:true};
const fixtures=[];
for(const date of ['2026-03-28T23:45:00Z','2026-03-29T00:30:00Z','2026-03-29T01:30:00Z','2026-10-24T22:45:00Z','2026-10-25T00:30:00Z','2026-10-25T01:30:00Z','2026-11-06T02:15:00Z']){
 for(const weekly of [false,true]){
  const now=Date.parse(date)/1000;
  fixtures.push({now,rules:{...defaults,weekly_charge:weekly},dispatches:[],imports:[],exports:[]});
  fixtures.push({now,rules:{...defaults,weekly_charge:weekly},dispatches:[{startDt:new Date((now+900)*1000).toISOString(),endDt:new Date((now+4500)*1000).toISOString()}],imports:[],exports:[]});
 }
}
fixtures.push({now:Date.parse('2026-10-25T00:00:00Z')/1000,rules:{...defaults,weekly_charge:false},dispatches:[{startDt:'2026-10-25T00:30:00Z',endDt:'2026-10-25T01:30:00Z'}],imports:[],exports:[]});
for(const hour of [0,2,12,18,23]) for(const mask of [1,16,32,127]) for(const discharge of [false,true]){
 const now=Date.parse(`2026-11-06T${String(hour).padStart(2,'0')}:15:00Z`)/1000;
 fixtures.push({now,rules:{...defaults,charge_days:mask,weekly_discharge:discharge},dispatches:[],imports:[],exports:[]});
}
for(const type of ['imports','exports'])for(const offset of [-1800,1800,86400]){
 const now=Date.parse('2026-11-06T12:15:00Z')/1000;
 const item={now,rules:{...defaults,weekly_charge:false,charge_price_enabled:true,discharge_price_enabled:true},dispatches:[],imports:[],exports:[]};
 item[type]=[{start:now+offset,end:now+offset+3600,value:type==='imports'?2:40}];fixtures.push(item);
}
async function piPlan(input){
 const now=new Date(input.now*1000),rules=input.rules,fields=new Map();
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now.getTime()]));}static now(){return now.getTime();}}
 const field=id=>{if(!fields.has(id))fields.set(id,{checked:false,value:'',style:{},classList:{toggle(){}},dataset:{}});return fields.get(id);};
 const context=vm.createContext({console:{log(){},warn(){}},Date:Clock,window:{addEventListener(){},location:{href:'http://fixture.invalid/'}},document:{addEventListener(){},getElementById:field,querySelectorAll:()=>[],documentElement:{querySelector:selector=>field(selector.slice(1))}},localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
 vm.runInContext(source,context);
 const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');const days=mask=>[0,1,2,3,4,5,6].filter(day=>mask&(1<<day));
 const weekly={enabled:rules.weekly_charge,startTime:clock(rules.charge_start),endTime:clock(rules.charge_end),days:days(rules.charge_days)};
 const discharge={enabled:rules.weekly_discharge,startTime:clock(rules.discharge_start),endTime:clock(rules.discharge_end),days:days(rules.discharge_days)};
 vm.runInContext(`window.linuxRuntime=true;window.linuxRole='worker';globalFoxSN='fixture';globalGasUrl='https://fixture.invalid';canRunAutomaticActions=()=>true;showToast=()=>{};fetchCurrentWorkMode=async()=>{};publishLinuxDispatchSnapshot=async()=>{};pushGroupsToFoxESS=async groups=>{globalThis.result=groups;return{groups,droppedCount:0};};getWeeklyForceConfig=()=>(${JSON.stringify(weekly)});getWeeklyDischargeConfig=()=>(${JSON.stringify(discharge)});window.currentDispatches=${JSON.stringify(input.dispatches)};window.importRates=${JSON.stringify(input.imports.map(x=>({valid_from:new Date(x.start*1000).toISOString(),valid_to:new Date(x.end*1000).toISOString(),value_inc_vat:x.value})))};window.exportRates=${JSON.stringify(input.exports.map(x=>({valid_from:new Date(x.start*1000).toISOString(),valid_to:new Date(x.end*1000).toISOString(),value_inc_vat:x.value})))};`,context);
 for(const [id,value] of Object.entries({'toggle-auto-dispatch':true,'toggle-auto-price':rules.charge_price_enabled,'toggle-auto-export':rules.discharge_price_enabled,'toggle-soc-limit':true,'toggle-dispatch-soc-limit':true,'toggle-discharge-pause-dispatch':true,'toggle-discharge-overrides-charge':true}))field(id).checked=value;
 for(const [id,value] of Object.entries({'price-threshold':7,'export-threshold':30,'target-soc-limit':80,'dispatch-soc-limit':90,'adv-min-soc':11,'adv-fd-pwr':5000}))field(id).value=String(value);
 await vm.runInContext('evaluateLocalAutomations(null,true)',context);
 return JSON.parse(JSON.stringify(context.result||[]));
}
function minutes(groups){const out=new Array(1440).fill(null);for(const g of groups){const a=g.startHour*60+g.startMinute;let b=g.endHour*60+g.endMinute;if(b===1439)b=1440;for(let i=a;i<b;i++)out[i]=[g.workMode,g.extraParam.fdSoc,g.extraParam.minSocOnGrid,g.extraParam.fdPwr];}return out;}
const temp=await mkdtemp(path.join(os.tmpdir(),'sc-parity-'));
try{
 const output=path.join(temp,'parity');
 const compile=spawnSync('cc',['-std=c11','-D_DARWIN_C_SOURCE','-D_DEFAULT_SOURCE','-I'+path.join(root,'esp32/main'),'-I'+json,...['esp32/tests/parity_driver.c','esp32/main/automation_policy.c','esp32/main/schedule_policy.c'].map(file=>path.join(root,file)),path.join(json,'cJSON.c'),'-lm','-o',output],{encoding:'utf8'});
 assert.equal(compile.status,0,compile.stderr);
 const run=spawnSync(output,[],{input:fixtures.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const results=run.stdout.trim().split('\n').map(JSON.parse);
 for(let i=0;i<fixtures.length;i++){const actual=minutes(results[i].groups),expected=minutes(await piPlan(fixtures[i]));const difference=actual.findIndex((value,minute)=>JSON.stringify(value)!==JSON.stringify(expected[minute]));assert.equal(difference,-1,`ESP32/Pi case ${i}, minute ${difference}: ${JSON.stringify(actual[difference])} / ${JSON.stringify(expected[difference])}; ${JSON.stringify(fixtures[i])}`);}
 console.log(`${fixtures.length} ESP32/Pi differential cases passed: spring/autumn transitions, repeated hour, outward dispatch rounding, overnight charging and SOC parameters.`);
}finally{await rm(temp,{recursive:true,force:true});}
