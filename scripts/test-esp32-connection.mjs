// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../esp32/dashboard/client.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const reply=(revision=1)=>({ok:true,json:async()=>({schema:1,csrf:'test-only',revision,rules:{paused:true}})});
function fixture(fetcher){
 let clock=0,next=0;const timers=new Map(),nodes=new Map(),calls=[],events={window:{},document:{}};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'14',dataset:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},showModal(){},close(){}});return nodes.get(id);};
 const document={hidden:false,querySelectorAll:()=>[],getElementById:node,addEventListener:(type,fn)=>{events.document[type]=fn;}};
 const context={document,window:{addEventListener:(type,fn)=>{events.window[type]=fn;}},AbortController,
  setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:clock+ms});return id;},clearTimeout:id=>timers.delete(id),
  fetch:(url,options)=>{calls.push({url,options});return fetcher(url,options,calls.length);}};
 vm.runInNewContext(source,context);
 const advance=async ms=>{const until=clock+ms;for(;;){const due=[...timers].filter(([,v])=>v.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;clock=due[1].at;timers.delete(due[0]);due[1].fn();await flush();}clock=until;await flush();};
 return {D:context.window.esp32Dashboard,node,calls,events,document,advance};
}
// A fetch that ignores abort must still release the polling loop at its deadline.
{
 let recover=false;const f=fixture(()=>recover?Promise.resolve(reply(2)):new Promise(()=>{}));f.events.window.pagehide();
 const pending=f.D.refresh().catch(error=>error);await f.advance(12000);const error=await pending;
 assert.equal(error.code,'ESP32_REQUEST_TIMEOUT');assert(f.calls[0].options.signal.aborted);assert.equal(f.node('esp-reconnect').hidden,false);
 recover=true;await f.D.refresh();assert.equal(f.D.state().revision,2);assert.equal(f.node('esp-reconnect').hidden,true);assert.equal(f.calls.length,2);
}
// Receiving headers is insufficient: a stalled JSON body has the same deadline.
{
 const f=fixture(()=>Promise.resolve({ok:true,json:()=>new Promise(()=>{})}));f.events.window.pagehide();
 const pending=f.D.request('/api/state').catch(error=>error);await f.advance(12000);assert.equal((await pending).code,'ESP32_REQUEST_TIMEOUT');
}
// Repeated refresh actions share one state request.
{
 let resolve;const f=fixture(()=>new Promise(done=>{resolve=done;}));f.events.window.pagehide();
 const a=f.D.refresh(),b=f.D.refresh();assert.equal(a,b);assert.equal(f.calls.length,1);resolve(reply());await a;
}
// Foreground recovery abandons a stale read. A late 401 cannot replace fresh state or reopen login.
{
 let firstResolve,logins=0;const f=fixture((url,options,count)=>count===1?new Promise(resolve=>{firstResolve=resolve;}):Promise.resolve(reply(2)));f.D.showLogin=()=>logins++;
 await f.advance(0);f.document.hidden=true;f.events.document.visibilitychange();await flush();assert(f.calls[0].options.signal.aborted);
 f.document.hidden=false;f.events.document.visibilitychange();await f.advance(0);assert.equal(f.D.state().revision,2);
 firstResolve({ok:false,status:401,json:async()=>({error:'Old session'})});await flush();assert.equal(logins,0);assert.equal(f.D.state().revision,2);
 f.events.window.pageshow({persisted:true});await f.advance(0);assert.equal(f.calls.length,3);
 assert(f.calls.every(call=>!call.options.method));assert.equal(f.D.state().rules.paused,true);
}
// Background changes do not abort or replay a POST whose result could be ambiguous.
{
 const f=fixture(()=>new Promise(()=>{}));f.events.window.pagehide();
 const pending=f.D.request('/api/refresh',{service:'foxess'}).catch(error=>error);
 f.document.hidden=true;f.events.document.visibilitychange();await flush();assert(!f.calls[0].options.signal.aborted);
 await f.advance(12000);assert.equal((await pending).code,'ESP32_REQUEST_TIMEOUT');assert.equal(f.calls.length,1);
}
// The independent boot guard survives a main-bundle parse/init failure.
{
 const panel={hidden:true,querySelector:key=>key==='h1'?heading:copy},heading={},copy={},welcome={hidden:false},dashboard={hidden:false};let recover;
 const root={dataset:{}};vm.runInNewContext(await readFile(new URL('../esp32/dashboard/boot.js',import.meta.url),'utf8'),{
  document:{documentElement:root,getElementById:id=>({'esp-startup':panel,'esp-welcome':welcome,dashboard}[id])},
  window:{addEventListener:(name,fn)=>{recover=fn;}},setTimeout(){}});
 recover();assert(!panel.hidden&&welcome.hidden&&dashboard.hidden);assert.equal(heading.textContent,'Dashboard could not start');
 root.dataset.espUiReady='true';panel.hidden=true;recover();assert(panel.hidden);
}
console.log('ESP32 connection recovery: stalled fetch/body deadlines, coalesced reads, foreground/bfcache recovery, stale-response isolation, no POST replay and independent boot fallback passed.');
