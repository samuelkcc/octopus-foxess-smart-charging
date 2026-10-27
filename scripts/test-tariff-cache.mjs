// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TariffCache } from '../linux/tariff-cache.mjs';
const dir = await mkdtemp(path.join(tmpdir(), 'tariff-cache-'));
try {
  let now = 100000000;
  const file = path.join(dir, 'rates.json');
  const cache = new TariffCache(file, () => now);
  const key = '/v1/products/IOG/electricity-tariffs/TEST/day-unit-rates/';
  const packet = { fetchedAt: now, status: 200, text: JSON.stringify({ results: [{ value_inc_vat: 29.82 }] }) };
  await cache.put(key, packet);
  await cache.put('/v1/accounts/PRIVATE/', { ...packet, text: '{"results":[],"secret":"DO-NOT-SAVE"}' });
  await cache.put(key.replace('day-', 'night-'), { ...packet, status: 429 });
  const restarted = new TariffCache(file, () => now);
  await restarted.load();
  assert.equal(JSON.parse(restarted.get(key).text).results[0].value_inc_vat, 29.82);
  assert.equal(restarted.get(key.replace('day-', 'night-')), null);
  assert(!/PRIVATE|DO-NOT-SAVE/.test(await readFile(file, 'utf8')));
  now += 30 * 60000;
  assert.equal(restarted.get(key), null, 'Expired rates cannot bypass the outbound queue.');
  await writeFile(file, 'damaged');
  await new TariffCache(file).load();
  console.log('Public tariff cache: restart recovery, strict expiry, credential-path exclusion, failed-response exclusion, damaged-file recovery passed.');
} finally { await rm(dir, { recursive: true, force: true }); }
