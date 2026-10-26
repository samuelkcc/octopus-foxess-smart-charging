import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { AutomationPause } from '../linux/automation-pause.mjs';

const directory = await mkdtemp(path.join(os.tmpdir(), 'charging-pause-'));
let clock = Date.parse('2026-10-26T14:00:00Z');
const events = []; const file = path.join(directory, 'pause.json');
const make = (onEvent = event => events.push(event)) => new AutomationPause({ file, now: () => clock, onEvent });
try {
  let pause = make(); let writes = 0;
  assert.equal((await pause.getState()).paused, false);
  await pause.runWrite(() => writes++);
  for (const invalid of [null, [], {}, {action:'pause'}, {action:'pause',hours:0}, {action:'pause',hours:'6'}, {action:'pause',hours:48}, {action:'resume',hours:null}, {action:'pause',hours:6,enabled:true}]) {
    await assert.rejects(pause.update(invalid), {statusCode:400});
  }
  let release; let started;
  const entered = new Promise(resolve => { started = resolve; });
  const currentWrite = pause.runWrite(async () => { writes++; started(); await new Promise(resolve => { release = resolve; }); });
  await entered;
  const queuedWrite = pause.runWrite(() => writes++);
  const blocked = assert.rejects(queuedWrite, {statusCode:423});
  let acknowledged = false;
  const pausing = pause.update({action:'pause',hours:6}).then(state => { acknowledged = true; return state; });
  await Promise.resolve(); assert.equal(acknowledged,false, 'Pause waits for an already-sent command');
  release(); await currentWrite; await blocked;
  const state = await pausing;
  assert.equal(state.until,'2026-10-26T20:00:00.000Z');
  assert.equal(writes,2,'Queued and subsequent schedule commands must not bypass pause');
  await assert.rejects(pause.runWrite(() => writes++),{statusCode:423});
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  pause = make(); assert.equal((await pause.getState()).paused,true,'Pause survives service restart');
  clock += 6 * 3600000 - 1;
  await assert.rejects(pause.runWrite(() => writes++),{statusCode:423});
  clock++;
  await pause.runWrite(() => writes++);
  assert.equal(events.at(-1).type,'pause_expired');
  assert.equal(events.filter(event => event.type === 'pause_expired').length,1);
  for (const hours of [12,24]) {
    const before = clock; const result = await pause.update({action:'pause',hours});
    assert.equal(Date.parse(result.until),before + hours*3600000);
    await pause.update({action:'resume'});
  }
  await pause.update({action:'pause',hours:null});
  clock += 365 * 86400000; pause = make();
  assert.equal((await pause.getState()).paused,true,'Forever stays paused after restart and elapsed time');
  await pause.update({action:'resume'});
  assert.equal(events.at(-1).type,'automation_resumed');
  const failure = make(async () => { throw new Error('Disk full'); });
  assert.equal((await failure.update({action:'pause',hours:null})).auditWarning,true,'Activity failure must not prevent pause');
  await assert.rejects(failure.runWrite(() => writes++),{statusCode:423});
  assert.equal((await make().getState()).paused,true,'Pause and its pending activity survive a failed history write');
  assert.equal(events.at(-1).type,'automation_paused','Pending activity is replayed after recovery');
  await writeFile(file,'invalid');
  await assert.rejects(make().runWrite(() => writes++), /Unexpected|JSON/,'Unreadable pause state blocks schedule writes');

  // Shared engine checks in both editions, using no real API transport.
  const source = await readFile(new URL('../src/app.js', import.meta.url),'utf8');
  for (const linux of [false,true]) {
    const context = vm.createContext({ console, window:{addEventListener(){}, automationControl:{isPaused:()=>true,write:()=>{throw new Error('paused');}}},
      document:{addEventListener(){},getElementById:()=>null},localStorage:{getItem:()=>null},setTimeout,clearTimeout });
    vm.runInContext(source,context);
    vm.runInContext(`window.linuxRuntime=${linux}; window.linuxRole='worker'; globalFoxSN='mock'; globalGasUrl='mock'; showToast=()=>{};`,context);
    assert.equal(vm.runInContext('canRunAutomaticActions()',context),false);
    assert.equal(await vm.runInContext('evaluateLocalAutomations(null,true)',context),false);
    await assert.rejects(vm.runInContext(`fetchJson('mock',{body:JSON.stringify({url:'https://www.foxesscloud.com/op/v3/device/scheduler/enable'})})`,context),/paused/);
  }
  console.log('Pause validation, all durations, write barrier, in-flight ordering, restart, expiry, audit failure and shared-engine guards passed.');
} finally { await rm(directory,{recursive:true,force:true}); }
