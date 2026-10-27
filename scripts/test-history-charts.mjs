// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Exercise the real history view with recorded directional magnitudes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

class Element {
  children=[]; listeners=new Map(); selectors=new Map(); hidden=false;
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(name,value){this[name]=value;}
  addEventListener(name,handler){this.listeners.set(name,handler);}
  querySelector(selector){
    if(!this.selectors.has(selector))this.selectors.set(selector,new Element());
    return this.selectors.get(selector);
  }
  showModal(){this.open=true;}
  close(){this.open=false;this.listeners.get('close')?.();}
  click(){return this.listeners.get('click')?.();}
}
const panel=new Element(),body=new Element(),charts=[];
const values={pvPower:3.2,loadsPower:0.8,gridConsumptionPower:1.5,feedinPower:2.4,batChargePower:4.5,batDischargePower:0.6,SoC:73};
const report={month:'2026-10',storageBytes:100,retentionMonths:12,fields:Object.keys(values),points:[
  {at:'2026-10-27T10:00:00Z',values},
  // The missing interval must remain a gap.
  {at:'2026-10-27T10:30:00Z',values:{pvPower:0,loadsPower:0,gridConsumptionPower:0,feedinPower:0,batChargePower:0,batDischargePower:0,SoC:0}},
  {at:'2026-10-27T10:45:00Z',values:{pvPower:null,loadsPower:NaN,gridConsumptionPower:Infinity}}
]};
const original=structuredClone(report);
let csvBlob;
const window={linuxRuntime:true,addEventListener(){}};
const context=vm.createContext({window,document:{body,documentElement:{},createElement:()=>new Element()},Date,Map,
  Chart:class {constructor(canvas,config){this.canvas=canvas;this.config=config;charts.push(this);}destroy(){}},
  getComputedStyle:()=>({getPropertyValue:name=>name==='--text-muted'?'#aaa':'#333'}),
  MutationObserver:class {observe(){}},fetchJson:async()=>report,Blob,
  URL:{createObjectURL:blob=>(csvBlob=blob,'blob:history'),revokeObjectURL(){}},setTimeout:()=>0});
vm.runInContext(await readFile(new URL('../dev/history.js',import.meta.url),'utf8'),context);
const view=window.installHistoryView(panel,{piEdition:true,isVisible:()=>true});
panel.querySelector('#dev-history-month').value='2026-10';
await view.load();
assert.equal(charts.length,4);
const configs=charts.map(chart=>chart.config);
const expected=[
  [['Solar generation (+)',3.2],['Home demand (−)',-0.8]],
  [['Import (+)',1.5],['Export (−)',-2.4]],
  [['Charge (+)',4.5],['Discharge (−)',-0.6]],
  [['Charge level',73]]
];
for(const [index,config] of configs.entries()){
  for(const [seriesIndex,series] of config.data.datasets.entries()){
    const [label,value]=expected[index][seriesIndex];
    assert.equal(series.label,label,'Labels must stay paired with their source field.');
    assert.equal(series.data[0].y,value);
    assert.equal(series.data[1].y,null,'Absent intervals must stay gaps.');
    assert.equal(series.data[2].y,0,'Measured zero must remain zero, without a negative sign.');
    assert.equal(series.data[3].y,null,'Missing or non-finite readings must stay unavailable.');
    const tooltip=config.options.plugins.tooltip.callbacks.label({dataset:series,parsed:{y:value}});
    assert(tooltip.includes(`${value>0&&index<3?'+':value<0?'−':''}${Math.abs(value).toFixed(2)}`));
  }
  const axis=config.options.scales.y;
  if(index<3){
    assert(axis.suggestedMin<0 && axis.suggestedMax>0,'Both directions must be visible even with one-sided data.');
    assert.equal(axis.suggestedMin,-axis.suggestedMax);
    assert.equal(axis.ticks.callback(2),'+2');
    assert.equal(axis.grid.lineWidth({tick:{value:0}}),2,'Zero must be a clear reference line.');
  }else{
    assert.equal(axis.min,0);assert.equal(axis.max,100,'Charge level stays a percentage.');
  }
}
const grid=panel.querySelector('.history-chart-grid');
for(const [index,card] of grid.children.entries()){
  await card.children[0].children[1].click();
  assert.deepEqual(charts.at(-1).config.data,configs[index].data,'Expanded charts must use the same signs and labels.');
  for(const key of ['min','max','suggestedMin','suggestedMax'])assert.equal(charts.at(-1).config.options.scales.y[key],configs[index].options.scales.y[key]);
  body.children[0].close();
}
await panel.querySelector('#dev-history-export').click();
assert((await csvBlob.text()).includes('2026-10-27T10:00:00Z,3.2,0.8,1.5,2.4,4.5,0.6,73'),'CSV must retain original recorded magnitudes.');
assert.deepEqual(report,original,'Plotting and exporting must not change history records.');
console.log('History source labels, signed directions, zero/gaps, percentage axis, expanded parity, and unchanged CSV passed.');
