// Copyright (C) 2026 SCKC. GPL-3.0-or-later. Activity imports never restore control state.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const stored=new Map(),notifications=[];
const now=Date.parse('2026-10-28T12:00:00Z');
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const window={linuxRuntime:false,addEventListener(){},dispatchEvent:event=>notifications.push(event.type)};
const context=vm.createContext({window,Date:Clock,Map,Set,console,
  localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)},
  CustomEvent:class{constructor(type){this.type=type;}},setInterval(){},fetch(){throw Error('Activity import must never call an API');}});
vm.runInContext(await readFile('src/activity-store.js','utf8'),context);
vm.runInContext(await readFile('src/automation-control.js','utf8'),context);
const api=window.browserActivity,control=window.automationControl;
const event=(index=0)=>({at:new Date(now-index*60000).toISOString(),type:'automation_paused',until:null,revision:index});
stored.set('smartChargingActivityV1',JSON.stringify([event()]));
const pauseKey='smartChargingPauseV1';
await control.update('pause',6);
const pause=stored.get(pauseKey),state=JSON.stringify(control.snapshot());
const backup=api.export();
assert.equal(backup.events.length,2);
notifications.length=0;
const first=api.import(JSON.stringify({...backup,events:[...backup.events,event(1)]}));
assert.equal(first.added,1);assert.equal(first.total,3);
assert.equal(api.import(JSON.stringify(backup)).added,0,'Repeated imports deduplicate records');
assert.equal(stored.get(pauseKey),pause);
assert.equal(JSON.stringify(control.snapshot()),state,'Imported pause activity cannot change current pause state');
assert(!notifications.includes('automation-resumed') && !notifications.includes('automation-control-change'));
assert.equal(api.export().events.length,3);
await control.update('resume');
assert(api.events().some(row=>row.type==='automation_resumed'),'Normal recording continues after import');
const saved=stored.get('smartChargingActivityV1');
for(const bad of [null,{}, {...backup,version:2},{...backup,credentials:{api:'private'}},
  {...backup,events:[event(1),{...event(),type:'<script>'}]},
  {...backup,events:[{...event(),at:'not-a-date'}]},
  {...backup,events:[{...event(),at:'2030-01-01T00:00:00Z'}]},
  {...backup,events:[{...event(),revision:-1}]},
  {...backup,events:[{...event(),apiKey:'private'}]},
  {...backup,events:Array.from({length:2001},()=>event())}]){
  assert.throws(()=>api.import(JSON.stringify(bad)));
  assert.equal(stored.get('smartChargingActivityV1'),saved,'A rejected file must not partially write records');
}
assert.throws(()=>api.import('{broken'));
assert.throws(()=>api.import(' '.repeat(1024*1024+1)));
assert.equal(api.import(JSON.stringify({...backup,events:[{...event(),at:'2020-01-01T00:00:00Z'}]})).added,0,'Expired records remain outside retention');
stored.set('smartChargingActivityV1',JSON.stringify(Array.from({length:2000},(_,i)=>event(i))));
api.append({...event(),type:'automation_resumed',revision:3000});
assert.equal(api.events().length,2000);
assert(api.stats().estimatedBytes<1024*1024,'The current bounded event format remains below one megabyte');
assert(!JSON.stringify(api.export()).includes('credentials'));
window.linuxRuntime=true;assert.throws(()=>api.import(JSON.stringify(backup)));assert.throws(()=>api.export());
console.log('Activity backup round trip, deduplication, continuation, retention, size limits, validation and unchanged pause/API state passed.');
