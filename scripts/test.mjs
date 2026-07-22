import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}') depth--;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

const utilities = new Function(`
  ${extractFunction('isActiveFoxSchedule')}
  ${extractFunction('scheduleFingerprint')}
  ${extractFunction('prepareFoxSchedulePayload')}
  ${extractFunction('getWeeklyForcedChargePeriods')}
  ${extractFunction('buildScheduleGroupsFromTimeline')}
  ${extractFunction('getAutoResumeSource')}
  ${extractFunction('getAutoResumeUntil')}
  ${extractFunction('isScheduleMinuteSuppressed')}
  return { scheduleFingerprint, prepareFoxSchedulePayload, getWeeklyForcedChargePeriods, buildScheduleGroupsFromTimeline, getAutoResumeSource, getAutoResumeUntil, isScheduleMinuteSuppressed };
`)();

const sampleGroups = Array.from({ length: 7 }, (_, index) => ({
  startHour: index,
  startMinute: 0,
  endHour: index,
  endMinute: 30,
  workMode: 'ForceCharge',
  extraParam: { fdSoc: 80 }
}));

const prepared = utilities.prepareFoxSchedulePayload(sampleGroups);
assert.equal(prepared.activeGroups.length, 5);
assert.equal(prepared.paddedGroups.length, 5);
assert.equal(prepared.droppedCount, 2);
assert.ok(prepared.paddedGroups.every(group => group.enable === 1));

const sparse = utilities.prepareFoxSchedulePayload(sampleGroups.slice(0, 2));
assert.equal(sparse.activeGroups.length, 2);
assert.equal(sparse.paddedGroups.filter(group => group.enable === 0).length, 3);
const preparedAgain = utilities.prepareFoxSchedulePayload(sparse.paddedGroups);
assert.equal(preparedAgain.activeGroups.length, 2, 'Disabled padding must stay disabled on reuse');
const foxResponsePadding = sparse.paddedGroups.map(group => {
  const { enable, ...withoutEnable } = group;
  return withoutEnable;
});
const preparedFoxResponse = utilities.prepareFoxSchedulePayload(foxResponsePadding);
assert.equal(preparedFoxResponse.activeGroups.length, 2, '00:00 Self-Use padding without an enable flag must stay disabled');

assert.equal(
  utilities.scheduleFingerprint([{ ...sampleGroups[0], extraParam: undefined }]),
  utilities.scheduleFingerprint([{ ...sampleGroups[0], fdSoc: 100, extraParam: undefined }]),
  'Default ForceCharge SOC should compare as 100%'
);

const weeklyOvernight = utilities.getWeeklyForcedChargePeriods({
  enabled: true,
  startTime: '23:30',
  endTime: '05:30',
  days: [2, 3]
}, new Date(2026, 6, 22, 12, 0));
assert.deepEqual(weeklyOvernight.map(period => [period.startHour, period.startMinute, period.endHour, period.endMinute]), [
  [0, 0, 5, 30],
  [23, 30, 23, 59]
], 'An overnight rule must be split into the two periods FoxESS accepts');
assert.deepEqual(
  utilities.getWeeklyForcedChargePeriods({ enabled: true, startTime: '23:30', endTime: '05:30', days: [1] }, new Date(2026, 6, 21, 12, 0)).map(period => [period.startHour, period.startMinute, period.endHour, period.endMinute]),
  [[0, 0, 5, 30]],
  'Tuesday must retain Monday night only until the morning boundary'
);
assert.deepEqual(
  utilities.getWeeklyForcedChargePeriods({ enabled: true, startTime: '23:30', endTime: '05:30', days: [2] }, new Date(2026, 6, 21, 12, 0)).map(period => [period.startHour, period.startMinute, period.endHour, period.endMinute]),
  [[23, 30, 23, 59]],
  'Tuesday selection must not create an early Tuesday period from Monday night'
);
assert.deepEqual(utilities.getWeeklyForcedChargePeriods({ enabled: true, startTime: '05:30', endTime: '05:30', days: [1] }, new Date(2026, 6, 20, 12, 0)), []);

const mergedTimeline = new Array(1440).fill(null);
for (let minute = 0; minute < 330; minute++) {
  mergedTimeline[minute] = {
    workMode: 'ForceCharge',
    finalFdSoc: 100,
    source: minute >= 60 && minute < 180 ? 'dispatch' : 'weekly'
  };
}
const mergedGroups = utilities.buildScheduleGroupsFromTimeline(mergedTimeline, 11, 5000);
assert.equal(mergedGroups.length, 1, 'FoxESS-equivalent adjacent charge periods must stay merged despite different UI sources');
assert.deepEqual(
  [mergedGroups[0].startHour, mergedGroups[0].startMinute, mergedGroups[0].endHour, mergedGroups[0].endMinute],
  [0, 0, 5, 30]
);
assert.equal(mergedGroups[0].extraParam.schSource, 'weekly', 'The base weekly source must remain available for display and Auto-Resume');

assert.equal(utilities.getAutoResumeSource(['weekly'], false), 'weekly');
assert.equal(utilities.getAutoResumeSource(['price'], false), 'price');
assert.equal(utilities.getAutoResumeSource(['weekly', 'dispatch'], true), null, 'Auto-Resume must not cancel an active Smart Dispatch');
const weeklyConfig = { enabled: true, startTime: '23:30', endTime: '05:30', days: [3] };
const overnightResumeUntil = utilities.getAutoResumeUntil('weekly', mergedGroups[0], new Date(2026, 6, 22, 23, 45), weeklyConfig);
assert.equal(overnightResumeUntil.getTime(), new Date(2026, 6, 23, 5, 30).getTime(), 'Late-night Auto-Resume lock must end after midnight');
const fulfilledWeekly = { source: 'weekly', until: new Date(2026, 6, 23, 5, 30).getTime() };
assert.equal(utilities.isScheduleMinuteSuppressed(fulfilledWeekly, 'weekly', new Date(2026, 6, 23, 2, 0).getTime()), true);
assert.equal(utilities.isScheduleMinuteSuppressed(fulfilledWeekly, 'dispatch', new Date(2026, 6, 23, 2, 0).getTime()), false, 'Smart Dispatch must survive weekly Auto-Resume');
assert.equal(utilities.isScheduleMinuteSuppressed(fulfilledWeekly, 'weekly', new Date(2026, 6, 23, 23, 30).getTime()), false, 'The next nightly schedule must remain available');

assert.doesNotMatch(source, /localStorage\.setItem\(['"](?:octoAcc|octoApi|foxSn|foxToken|gasUrl)['"]/);
assert.match(source, /if \(refreshTimerId !== null\) clearInterval\(refreshTimerId\)/);
assert.match(source, /async function fetchJson/);
assert.match(source, /dispatchActiveNow/, 'Auto-Resume must not cancel an active Smart Dispatch');

console.log('Scheduler, storage, timer, and request-safety checks passed.');
