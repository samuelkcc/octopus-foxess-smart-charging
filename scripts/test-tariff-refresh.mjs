// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
let now=Date.parse('2026-10-27T12:00:00Z');
class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{style:{},dataset:{},getContext:()=>({id}),classList:{add(){}}});return elements.get(id);};
const charts=[],timers=[],events=[];
const context=vm.createContext({console,Date:Clock,URL,Map,Number,
 window:{linuxRuntime:true,linuxRole:'worker',location:{href:'http://127.0.0.1/'},addEventListener(){},integrationMonitor:{success:(...args)=>events.push(['success',...args]),failure:(...args)=>events.push(['failure',...args])}},
 document:{addEventListener(){},documentElement:{getAttribute:()=> 'dark'},getElementById:element},
 localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},
 btoa:value=>Buffer.from(value).toString('base64'),
 setTimeout:(fn,ms)=>(timers.push({fn,ms}),timers.length),clearTimeout(){},setInterval:()=>1,clearInterval(){},
 Chart:class {constructor(canvas,config){charts.push({canvas,config});}destroy(){}}
});
vm.runInContext(await readFile(new URL('../src/app.js',import.meta.url),'utf8'),context);
const run=code=>vm.runInContext(code,context);
const agreement=code=>({agreements:[{tariff_code:code,valid_from:'2026-01-01T00:00:00Z',valid_to:null}]});
const account={properties:[{electricity_meter_points:[{...agreement('IMPORT'),is_export:false},{...agreement('EXPORT'),is_export:true}]}]};
let failAccount=false,failImport=false,failExport=false,importValue=29.82,exportValue=12;
let release;
context.loadAccount=async()=>{if(failAccount)throw Error('HTTP 503');return account;};
context.loadRates=async code=>{
 await new Promise(resolve=>{if(!release)release=[];release.push(resolve);});
 if(code==='IMPORT'&&failImport || code==='EXPORT'&&failExport)throw Error('HTTP 503');
 return [{valid_from:'2000-01-01T00:00:00Z',valid_to:null,value_inc_vat:code==='IMPORT'?importValue:exportValue}];
};
run("fetchOctopusJson=loadAccount;fetchTariffRates=loadRates;initDashboard=()=>{throw Error('A price redraw must not request dashboard APIs');};dashboardRefreshPromise=Promise.resolve('startup still pending');");
const finish=async promise=>{await new Promise(setImmediate);for(const resolve of release||[])resolve();release=null;await promise;};

let pending=run("refreshOctopusTariffs('A-DEMO','mock-key')");
assert.equal(charts.length,0,'Cold startup must not draw a synthetic zero tariff.');
assert.match(element('tariff-data-status').textContent,/Loading/);
assert.equal(element('importPriceChart').style.display,'none');
assert.equal(element('exportPriceChart').style.display,'none');
await finish(pending);
assert(charts.length >= 2,'Delayed rates must redraw without another dashboard refresh.');
assert.equal(run('window.currentLivePrice'),29.82);
assert.equal(charts.filter(row=>row.canvas.id==='importPriceChart').at(-1).config.data.datasets[0].data[0],29.82);
assert.equal(charts.filter(row=>row.canvas.id==='exportPriceChart').at(-1).config.data.datasets[0].data[0],12);
assert.equal(element('tariff-data-status').dataset.state,'ready');
const count=charts.length;
await run("refreshOctopusTariffs('A-DEMO','mock-key')");
assert.equal(charts.length,count,'A normal render cannot bypass the 30-minute tariff cache.');

now+=30*60000;failExport=true;importValue=30;
pending=run("refreshOctopusTariffs('A-DEMO','mock-key')");await finish(pending);
assert.equal(run('window.currentLivePrice'),30,'A successful direction updates independently.');
assert.equal(run('window.exportRates[0].value_inc_vat'),12,'A failed direction retains its previous valid price.');
assert.equal(element('tariff-data-status').dataset.state,'error');
assert.equal(timers.at(-1).ms,60000,'A failed update retries after one minute, not thirty minutes.');

now+=60000;failExport=false;importValue=0;exportValue=-2;
timers.at(-1).fn();await finish(run('octopusTariffPromise'));
assert.equal(run('window.currentLivePrice'),0,'A real zero price remains valid.');
assert.equal(run('window.exportRates[0].value_inc_vat'),-2,'Negative tariffs remain valid prices.');
assert.equal(element('tariff-data-status').dataset.state,'ready');
assert(events.some(row=>row[0]==='success'&&row[2]==='export-tariff'),'Recovery must clear the failed tariff channel.');

now+=30*60000;failAccount=true;
await run("refreshOctopusTariffs('A-DEMO','mock-key')");
assert.equal(run('window.exportRates[0].value_inc_vat'),-2,'An account fetch failure must not erase either tariff.');
assert.equal(timers.at(-1).ms,60000);
run('window.importRates=[];window.exportRates=[];octopusTariffPromise=null;octopusTariffProblem=true;window.lastChartState=null;drawPriceCharts(0,0,[{startDt:"2026-10-27T00:00:00Z",endDt:"2026-10-28T00:00:00Z"}])');
assert.equal(element('importPriceChart').style.display,'none','Smart Dispatch must not invent a price when rates are unavailable.');
assert.match(element('import-chart-empty').textContent,/unavailable/);
console.log('Cold/delayed tariff rendering, no synthetic zeros, independent recovery, automatic retry, cached reads, real zero/negative prices, and no dashboard API replay passed.');

// Exercise the actual fixed-IOG standard/day/night transport, with one direction
// queued while the other completes. The earlier cases intentionally inject rates.
now+=30*60000;
let finishNight;
context.actualTransport=async url=>{
 if(url.includes('/accounts/'))return {properties:[{electricity_meter_points:[
  {...agreement('E-1R-IOG-FIX-B'),is_export:false}, {...agreement('E-1R-OUTGOING-B'),is_export:true}]}]};
 if(url.includes('OUTGOING'))return {results:[{value_inc_vat:12,valid_from:'2000-01-01T00:00:00Z'}]};
 if(url.includes('standard-unit-rates'))return {results:[]};
 if(url.includes('night-unit-rates'))await new Promise(resolve=>{finishNight=resolve;});
 return {results:[{value_inc_vat:url.includes('night-')?7.62:29.82,valid_from:'2000-01-01T00:00:00Z'}]};
};
const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
run(source.slice(source.indexOf('async function fetchTariffRates('),source.indexOf('function buildIntelligentGoFixedRates(')));
run("window.linuxRuntime=true;window.linuxRole='worker';publishTariffSnapshot=async()=>{};fetchOctopusJson=actualTransport;octopusTariffState=null;window.importRates=[];window.exportRates=[];");
pending=run("refreshOctopusTariffs('A-DEMO','mock-key')");
await new Promise(setImmediate);
assert.equal(run('window.exportRates[0].value_inc_vat'),12,'Ready export is shown before queued fixed IOG import finishes.');
assert.equal(run('octopusTariffProgress'),1);
assert.equal(run('window.currentLivePrice'),null);
finishNight();await pending;
assert.equal(run('window.currentLivePrice'),29.82);
assert.equal(run('window.importRates.length'),144,'Real fixed IOG conversion completes all three days.');
console.log('Actual fixed IOG standard/day/night transport and partial direction rendering passed.');

context.snapshotRead=async url=>{assert.equal(url,'/api/tariff-snapshot');return {state:{importRates:[{value_inc_vat:29.82}],exportRates:[],minRate:29.82,maxRate:29.82,updatedAt:now}};};
run("window.linuxRole='dashboard';fetchJson=snapshotRead;fetchOctopusJson=()=>{throw Error('A dashboard must never request Octopus tariffs');};");
await run("refreshOctopusTariffs('ignored','ignored')");
assert.equal(run('window.currentLivePrice'),29.82);
console.log('Dashboard tariff refresh reads only the host snapshot.');

run("window.linuxRole='worker';");
const originalGet=context.document.getElementById;
context.document.getElementById=()=>{throw Error('Headless tariff calculation must not touch the interface');};
run('renderOctopusTariffs()');
context.document.getElementById=originalGet;
console.log('Headless tariff calculation is independent of DOM and chart rendering.');
