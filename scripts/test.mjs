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
  ${extractFunction('scheduleFingerprint')}
  ${extractFunction('prepareFoxSchedulePayload')}
  return { scheduleFingerprint, prepareFoxSchedulePayload };
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

assert.equal(
  utilities.scheduleFingerprint([{ ...sampleGroups[0], extraParam: undefined }]),
  utilities.scheduleFingerprint([{ ...sampleGroups[0], fdSoc: 100, extraParam: undefined }]),
  'Default ForceCharge SOC should compare as 100%'
);

assert.doesNotMatch(source, /localStorage\.setItem\(['"](?:octoAcc|octoApi|foxSn|foxToken|gasUrl)['"]/);
assert.match(source, /if \(refreshTimerId !== null\) clearInterval\(refreshTimerId\)/);
assert.match(source, /async function fetchJson/);

console.log('Scheduler, storage, timer, and request-safety checks passed.');
