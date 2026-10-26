import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const now = new Date(2026, 9, 26, 18, 11);
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [now.getTime()])); }
  static now() { return now.getTime(); }
}
const plain = value => JSON.parse(JSON.stringify(value));
for (const edition of ['web', 'pi']) {
  const fields = new Map();
  const field = id => {
    if (!fields.has(id)) fields.set(id, { checked: false, value: '', style: {}, classList: { toggle() {} }, dataset: {} });
    return fields.get(id);
  };
  const store = new Map();
  const context = vm.createContext({
    console: { log() {}, warn() {} }, Date: Clock,
    window: { addEventListener() {}, location: { href: 'https://test.invalid/' } },
    document: { addEventListener() {}, getElementById: field, querySelectorAll: () => [], documentElement: { querySelector: selector => field(selector.slice(1)) } },
    localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
    sessionStorage: { getItem: () => null },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  });
  vm.runInContext(source, context);
  vm.runInContext(`
    window.linuxRuntime = ${edition === 'pi'};
    window.linuxRole = '${edition === 'pi' ? 'worker' : 'web'}';
    globalFoxSN = 'dummy-device'; globalGasUrl = 'https://dummy-relay.invalid';
    globalThis.realPush = pushGroupsToFoxESS;
    globalThis.realReadback = fetchFoxSchedules;
    globalThis.sent = []; globalThis.published = [];
    canRunAutomaticActions = () => true;
    showToast = message => { globalThis.lastToast = message; };
    publishLinuxDispatchSnapshot = async (dispatches, status) => published.push({ dispatches, status });
    getWeeklyForceConfig = () => ({ enabled: true, startTime: '17:00', endTime: '21:00', days: [1] });
    getWeeklyDischargeConfig = () => ({ enabled: true, startTime: '17:30', endTime: '20:30', days: [1] });
    fetchCurrentWorkMode = async () => {};
    pushGroupsToFoxESS = async groups => { sent.push(groups); return { groups, droppedCount: 0 }; };
    window.currentDispatches = [{ startDt: new Date(2026, 9, 26, 18, 11).toISOString(), endDt: new Date(2026, 9, 26, 19).toISOString() }];
  `, context);
  field('toggle-auto-dispatch').checked = true;
  field('toggle-discharge-pause-dispatch').checked = true;
  field('toggle-discharge-overrides-charge').checked = true;
  field('toggle-dispatch-soc-limit').checked = true;
  field('dispatch-soc-limit').value = '80';
  await vm.runInContext('evaluateLocalAutomations(null, true)', context);
  const groups = plain(context.sent[0]);
  const dispatch = groups.find(g => g.extraParam.schSources.includes('dispatch'));
  assert.deepEqual([dispatch.startHour, dispatch.startMinute, dispatch.endHour, dispatch.endMinute, dispatch.workMode, dispatch.extraParam.fdSoc], [18, 0, 19, 0, 'ForceCharge', 80], `${edition}: active Smart Dispatch must immediately produce rounded ForceCharge with dispatch SOC priority`);
  assert.equal(groups.some(g => g.workMode === 'ForceDischarge' && g.startHour <= 18 && g.endHour >= 19), false, `${edition}: discharge must not overlap protected dispatch`);
  await vm.runInContext(`window.fulfilledSchedule = { source: 'weekly', until: new Date(2026, 9, 26, 21).getTime() }; evaluateLocalAutomations(null, true)`, context);
  assert.ok(plain(context.sent[1]).some(g => g.extraParam.schSources.includes('dispatch')), `${edition}: Auto-Resume must not suppress dispatch`);

  const limited = vm.runInContext(`prepareFoxSchedulePayload(prioritizeAutomationGroups([
    ...Array.from({length: 5}, (_, i) => ({startHour: i, startMinute: 0, endHour: i, endMinute: 30, workMode: 'ForceCharge', extraParam: {schSource: 'weekly'}})),
    {startHour: 18, startMinute: 0, endHour: 19, endMinute: 0, workMode: 'ForceCharge', extraParam: {schSource: 'dispatch'}}
  ]))`, context);
  assert.equal(limited.activeGroups[0].extraParam.schSource, 'dispatch', `${edition}: five-period limit must retain active dispatch`);

  // Keep a matching cache, then fail every fresh readback. Confirmation must fail.
  vm.runInContext(`window.activeFoxGroups = sent[0]; fetchJson = async () => { throw new Error('readback offline'); }; getFoxHeaders = () => ({}); incrementFoxApi = () => {};`, context);
  await assert.rejects(vm.runInContext('realReadback({expectedGroups: sent[0], attempts: 1})', context), /readback offline/);
  vm.runInContext(`fetchJson = async () => ({errno: 0, result: {groups: []}});`, context);
  await assert.rejects(vm.runInContext('realReadback({expectedGroups: sent[0], attempts: 1})', context), /did not confirm/);
  vm.runInContext(`fetchFoxSchedules = async () => { throw new Error('readback offline'); }; fetchJson = async () => ({errno: 0});`, context);
  await assert.rejects(vm.runInContext('realPush(sent[0], 1)', context), /readback offline/, `${edition}: command acceptance alone never confirms protection`);
  assert.equal(vm.runInContext('isCurrentlyUpdatingMode', context), false, 'Failed writes must release the queue');
  vm.runInContext('isCurrentlyUpdatingMode = true; pendingAutomationEvaluation = false;', context);
  assert.equal(await vm.runInContext('evaluateLocalAutomations(null, true)', context), false);
  assert.equal(vm.runInContext('pendingAutomationEvaluation', context), true, `${edition}: changed dispatch during a write must be queued`);
}
console.log('Shared HTML and Pi scheduler behavior passed: immediate rounded ForceCharge, dispatch SOC priority, discharge/Auto-Resume protection, hardware capacity priority, fresh readback failure, and queued revisions.');
