// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const storage=new Map(),charts=[];
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{style:{},dataset:{},classList:{add(){}},getContext:()=>({id})});return elements.get(id);};
const window={dispatchEvent(){},addEventListener(){}};
const context=vm.createContext({window,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  sessionStorage:{getItem:()=>null},Event:class {},console,URL,Date,setTimeout:()=>1,clearTimeout(){},setInterval(){},clearInterval(){},
  document:{addEventListener(){},getElementById:element,documentElement:{getAttribute:()=> 'dark'}},
  Chart:class {constructor(canvas,config){charts.push({canvas,config});}destroy(){}}});
const module=await readFile('src/price-display.js','utf8');
vm.runInContext(module,context);
let display=window.priceDisplay;
assert.equal(display.format(29.82),'29.82 p/kWh');
display.save({enabled:true,code:'HKD',symbol:'HK$',fx:10});
assert.equal(display.format(29.82),'2.9820 HK$/kWh (HKD)');
assert.equal(display.convert(0),0);assert.equal(display.convert(null),null);assert.equal(display.convert(-2),-.2);
for(const invalid of [{fx:0},{fx:-1},{fx:Infinity},{code:'EURO'},{symbol:'<img>'},{symbol:'\n'}])assert.throws(()=>display.save({...display.read(),...invalid}));
assert.equal(display.read().fx,10,'Invalid input must not replace a saved preference');
vm.runInContext(module,context);display=window.priceDisplay;assert.equal(display.read().code,'HKD','Display preference survives a browser reload');
vm.runInContext(await readFile('src/app.js','utf8'),context);
vm.runInContext('octopusTariffState={importRates:[{value_inc_vat:29.82}],exportRates:[{value_inc_vat:12}],minRate:29.82,maxRate:29.82};renderOctopusTariffs();',context);
assert.equal(window.currentLivePrice,29.82,'Automation price stays in original UK pence');
assert.equal(window.importRates[0].value_inc_vat,29.82,'Snapshot data is never rewritten by display conversion');
assert.equal(charts.find(row=>row.canvas.id==='importPriceChart').config.data.datasets[0].data[0],2.982);
assert.equal(charts.find(row=>row.canvas.id==='exportPriceChart').config.options.scales.y.title.text,'HK$/kWh (HKD)');
assert(element('ui-pricing').innerHTML.includes('2.9820 HK$/kWh (HKD)'));
display.save({enabled:false,code:'GBP',symbol:'£',fx:1});
vm.runInContext('renderOctopusTariffs();',context);
assert.equal(charts.filter(row=>row.canvas.id==='importPriceChart').at(-1).config.data.datasets[0].data[0],29.82);
console.log('Currency validation, persistence, conversion, zero/negative prices, chart units and unchanged scheduler prices passed.');
