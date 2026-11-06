// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile('dev/setup.js','utf8');
for(const skip of [true,false]){
 const nodes=new Map();
 const make=()=>({hidden:true,dataset:{},classList:{toggle(){}},append(){},addEventListener(){},setAttribute(){},cloneNode:make});
 const node=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id);};
 let saved=skip;
 const D={$:node,state:()=>({rules:{},lan_access_enabled:true})};
 const context={window:{esp32Dashboard:D},document:{documentElement:{dataset:{devEdition:'esp32-dashboard'}},createElement:make,body:make(),querySelector:s=>s.includes('meta')?{content:'test'}:s.includes('aria-current')?{textContent:'Overview'}:make()},localStorage:{getItem:()=>String(saved),setItem:(key,value)=>saved=value==='true'}};
 vm.runInNewContext(source,context);
 assert.equal(node('esp-welcome').hidden,skip,'Direct entry must not reveal Welcome during the first pending state read');
 assert.equal(node('esp-startup').hidden,!skip);assert.equal(node('dashboard').hidden,true);
 D.showDashboard();assert.equal(node('dashboard').hidden,!skip);assert.equal(node('esp-welcome').hidden,skip);
 D.showLogin();assert.equal(node('esp-login').hidden,false);assert.equal(node('dashboard').hidden,true,'Direct entry must not bypass LAN authentication');
 assert(D.saveStartPage(true));D.showDashboard();assert.equal(node('dashboard').hidden,false);
}
console.log('Start page: pending direct-entry loads never reveal Welcome, ordinary entry retains Welcome, LAN login remains required.');
