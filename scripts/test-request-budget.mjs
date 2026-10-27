import assert from 'node:assert/strict';
import { RequestBudget, retryDelay } from '../linux/request-budget.mjs';

let now = 1_000_000;
let stored = 0;
const starts = [];
const clock = { now: () => now, sleep: async ms => { now += ms; }, readNext: () => stored, saveNext: value => { stored = value; } };
const budget = new RequestBudget(clock);
const operation = label => async () => { starts.push([label, now]); return label; };
const first = budget.run('dispatch', operation('dispatch'), { ttl: 60_000 });
const duplicate = budget.run('dispatch', operation('duplicate'), { ttl: 60_000 });
assert.equal(first, duplicate, 'Concurrent clients share one pending request');
await Promise.all([first, duplicate, budget.run('account', operation('account')), budget.run('tariff', operation('tariff'))]);
assert.deepEqual(starts.map(row => row[0]), ['dispatch', 'account', 'tariff']);
for (let i = 1; i < starts.length; i++) assert.ok(starts[i][1] - starts[i - 1][1] >= 60_000);
const restarted = new RequestBudget(clock);
await restarted.run('after-restart', operation('after-restart'));
assert.equal(starts.at(-1)[1] - starts.at(-2)[1], 60_000, 'Restart retains the request floor');
await restarted.defer(180_000);
await restarted.run('after-rate-limit', operation('after-rate-limit'));
assert.equal(starts.at(-1)[1] - starts.at(-2)[1], 180_000);
await assert.rejects(restarted.run('failure', async () => { starts.push(['failure', now]); throw new Error('offline'); }));
await restarted.run('retry', operation('retry'));
assert.equal(starts.at(-1)[1] - starts.at(-2)[1], 60_000, 'Network failure consumes a request slot');
assert.equal(retryDelay(new Response('', { status: 429, headers: { 'Retry-After': '120' } })), 120_000);
assert.equal(retryDelay(new Response('{}'), { errors: [{ extensions: { errorCode: 'KT-CT-1199' } }] }), 60_000);
assert.equal(retryDelay(new Response('{}'), { errors: [{ message: 'Too many requests.' }] }), 60_000);
assert.equal(retryDelay(new Response('{}'), {}), 0);
const fox = new RequestBudget({ ...clock, interval: 0, readNext: () => 0, saveNext() {} });
let reads = 0;
await fox.run('schedule', async () => ++reads, { ttl: 600_000 });
await fox.run('schedule', async () => ++reads, { ttl: 600_000 });
assert.equal(reads, 1);
now += 600_000;
await fox.run('schedule', async () => ++reads, { ttl: 600_000 });
assert.equal(reads, 2);
console.log('Shared outbound spacing, concurrent deduplication, restart guard, rate-limit cooldown, failed-request spacing and FoxESS cache expiry passed.');

// A slow durable reservation must not shorten the gap between real operations.
let slowNow=1000000,slowStored=0;const slowStarts=[];
const slow=new RequestBudget({now:()=>slowNow,sleep:async ms=>{slowNow+=ms;},readNext:()=>slowStored,
 saveNext:async value=>{slowStored=value;slowNow+=slowStarts.length===0?20:1;}});
await slow.run('first',async()=>slowStarts.push(slowNow));
await slow.run('next',async()=>slowStarts.push(slowNow));
assert.ok(slowStarts[1]-slowStarts[0]>=60000,'Persistence latency cannot shorten the send gap');
console.log('Slow reservation storage preserves the full request interval.');
