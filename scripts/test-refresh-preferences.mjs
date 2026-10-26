import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const saved=new Map();const nodes=new Map();let toast='';let state={automations:{dispatchCheck:true,targetSoc:90,refreshIntervals:{octopus:60,foxess:600}}};let writes=[];let fail=false;
const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',style:{}});return nodes.get(id);};
const sandbox={console,Date,Event:class {},setTimeout,clearTimeout,setInterval:()=>1,clearInterval(){},
 window:{addEventListener(){},dispatchEvent(){}},document:{activeElement:null,addEventListener(){},getElementById:node},
 localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},sessionStorage:{getItem:()=>null}};
const context=vm.createContext(sandbox);
vm.runInContext(await readFile(new URL('../src/app.js',import.meta.url),'utf8'),context);
vm.runInContext(await readFile(new URL('../src/refresh-preferences.js',import.meta.url),'utf8'),context);
context.captureToast=text=>{toast=text;};context.loadFixture=async()=>structuredClone(state);context.saveFixture=async update=>{if(fail)throw new Error('offline');writes.push(structuredClone(update));state={automations:update.automations};};
vm.runInContext('showToast=captureToast;loadLinuxState=loadFixture;updateLinuxState=saveFixture;',context);
const run=code=>vm.runInContext(code,context);
const values=()=>JSON.parse(run('JSON.stringify(window.refreshPreferences.values())'));
run('window.refreshPreferences.load()');assert.deepEqual(values(),{octopus:300,foxess:600});
node('fox-interval-input').value='900';await run("applyFoxInterval()");
assert.equal(values().foxess,900);assert.equal(writes.length,0);assert.equal(JSON.parse(saved.get('foxAutomations')).refreshIntervals.foxess,900);
run('window.linuxRuntime=true;window.linuxRole="dashboard";window.refreshPreferences.load({octopus:60,foxess:600})');
node('fox-interval-input').value='1200';await run('applyFoxInterval()');
assert.equal(writes.length,1);assert.equal(state.automations.dispatchCheck,true);assert.equal(state.automations.targetSoc,90);assert.equal(state.automations.refreshIntervals.foxess,1200);
fail=true;node('fox-interval-input').value='1800';await run('applyFoxInterval()');assert.equal(values().foxess,1200);assert.match(toast,/Could not save/);fail=false;
node('octo-interval-input').value='300';await run('applyOctoInterval()');assert.equal(writes.length,1);assert.match(toast,/10 to 60/);
node('fox-interval-input').value='60';run('applyFoxInterval()');assert.equal(writes.length,1);assert.equal(node('fox-warning-modal').style.display,'flex');
node('cancel-fox-btn').onclick();assert.equal(writes.length,1);
node('fox-interval-input').value='60';run('applyFoxInterval()');node('confirm-fox-btn').onclick();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(writes.length,2);assert.equal(values().foxess,60);
run('window.linuxRole="worker";window.refreshPreferences.load({octopus:86400,foxess:"bad"})');assert.deepEqual(values(),{octopus:60,foxess:600});
run('window.refreshPreferences.load({octopus:30,foxess:900})');assert.deepEqual(values(),{octopus:30,foxess:900});
console.log('Refresh interval validation, browser persistence, Pi worker restore, existing-rule preservation, failed-save safety, and short-interval confirmation passed.');
