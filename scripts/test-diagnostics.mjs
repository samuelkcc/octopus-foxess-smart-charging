// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {IntegrationState} from '../linux/integration-state.mjs';
let clock=Date.parse('2026-10-27T12:00:00Z');
let state=new IntegrationState(null,()=>clock);
for(let index=0;index<1000;index++)state.success('octopus','dispatch');
assert.equal(state.diagnostics().errors.length,0,'Healthy polling must not create error records.');
const secret='sk_live_PRIVATE_KEY_123456789';
state.failure('octopus','account-data',`HTTP 503 ${secret} A-PRIVATE SERIAL123 https://private.trycloudflare.com/key`);
clock+=1000;state.failure('octopus','account-data',`HTTP 503 ${secret}`);
assert.equal(state.diagnostics().errors.length,1,'Repeated failures must be grouped.');
assert.equal(state.diagnostics().errors[0].count,2);
assert.equal(state.diagnostics().errors[0].category,'prices');
state.success('octopus','account-data');
const recovered=JSON.stringify(state.diagnostics());
state.acknowledge('octopus',state.snapshot().services.octopus.alert.id);
assert.equal(JSON.stringify(state.diagnostics()),recovered,'Acknowledging a badge must not erase diagnostic evidence.');
state=new IntegrationState(JSON.parse(JSON.stringify(state.data)),()=>clock);
assert.equal(JSON.stringify(state.diagnostics()),recovered,'Error records survive normal host or browser restarts.');
for(let index=0;index<110;index++){
 clock+=1000;state.success('foxess','api');state.failure('foxess','api',`Authentication failed ${secret} ${index}`);
}
assert.equal(state.diagnostics().errors.length,100,'The journal must stay bounded.');
assert(!/PRIVATE|SERIAL|https?:|sk_live/.test(JSON.stringify(state.diagnostics())),'Diagnostic records must contain no raw upstream text or identifiers.');
const stored=new Map();
const window={IntegrationState,linuxRuntime:false,addEventListener(){},dispatchEvent(){}};
const context=vm.createContext({window,document:{getElementById:()=>null,addEventListener(){},querySelector:()=>({content:'2.0.4'})},
 localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},sessionStorage:{getItem:()=>null},
 setInterval(){},setTimeout(){},clearTimeout(){},CustomEvent:class {},Date,console});
vm.runInContext(await readFile(new URL('../src/app.js',import.meta.url),'utf8'),context);
vm.runInContext(await readFile(new URL('../src/integration-monitor.js',import.meta.url),'utf8'),context);
window.integrationMonitor.failure('octopus','import-tariff',`HTTP 429 ${secret} https://private.trycloudflare.com`);
const report=window.integrationMonitor.diagnosticReport();
assert.equal(report.appVersion,'2.0.4');
assert.equal(report.browser.errors[0].message,'Request failed (HTTP 429).');
assert.equal(report.prices.loading,false);
assert(!/PRIVATE|trycloudflare|sk_live|credentials/.test(JSON.stringify(report)));
assert.equal(JSON.parse([...stored.values()][0]).errors.length,1,'Browser errors are persisted without waiting for another failure.');
console.log('Error-only journal, duplicate grouping, 100-entry cap, restart persistence, acknowledgement retention, private-data exclusion, and safe browser export passed.');
