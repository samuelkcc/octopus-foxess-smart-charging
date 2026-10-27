import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { RequestBudget } from '../linux/request-budget.mjs';

let now = 1_000_000;
const sleeps = [];
const values = new Map([['octopusOutboundNextAtV1', String(now + 600_000)]]);
class ClockBudget extends RequestBudget {
  constructor(options) { super({ ...options, now: () => now, sleep: async ms => { sleeps.push(ms); now += ms; } }); }
}
const context = vm.createContext({ window: { RequestBudget: ClockBudget }, navigator: {},
  localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) } });
vm.runInContext(await readFile('src/request-policy.js', 'utf8'), context);
const policy = context.window.requestPolicy;
const url = 'https://api.octopus.energy/v1/graphql/';
const auth = { body: JSON.stringify({ query: 'mutation { obtainKrakenToken { token } }' }) };
let calls = 0;
await policy.run(url, auth, async () => ++calls);
await policy.run(url, auth, async () => ++calls);
await policy.run(url, { body: '{"query":"query getGoData"}' }, async () => ++calls);
assert.equal(calls, 2, 'Cached authentication still avoids a repeated request');
assert.deepEqual(sleeps, [], 'Web login ignores the obsolete artificial 60-second request clock');
await policy.octopus.defer(120_000);
await policy.run(url, { body: '{"query":"query afterLimit"}' }, async () => ++calls);
assert.deepEqual(sleeps, [120_000], 'A real API cooldown is still honoured');
context.window.linuxRuntime = true;
await policy.run(url, auth, async () => ++calls);
assert.equal(calls, 4, 'Pi and desktop calls continue to use their server policy');
context.window.linuxRuntime = false;
const proxiedAuth = {body:JSON.stringify({url,body:{query:'mutation { obtainKrakenToken { token } }'}})};
await policy.run('https://script.google.com/macros/s/example/exec',proxiedAuth,async()=>++calls);
await policy.run('https://script.google.com/macros/s/example/exec',proxiedAuth,async()=>++calls);
assert.equal(calls,5,'Relayed authentication is also coalesced and cached');
console.log('Web login has no artificial wait, preserves auth caching and real cooldowns, and leaves Pi transport unchanged.');
