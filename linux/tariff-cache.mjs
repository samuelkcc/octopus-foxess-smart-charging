// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import { readFile, writeFile, rename } from 'node:fs/promises';

// Only public unit-rate responses belong here. Account and authentication
// responses must never enter this restart cache.
const publicPath = /^\/v1\/products\/[^/]+\/electricity-tariffs\/[^/]+\/(standard|day|night)-unit-rates\/$/;
export class TariffCache {
  constructor(file, now = Date.now) { this.file = file; this.now = now; this.entries = new Map(); this.saving = Promise.resolve(); }
  valid(key, packet) {
    if (!publicPath.test(key) || packet?.status !== 200 || !Number.isFinite(packet.fetchedAt)) return false;
    if (packet.fetchedAt > this.now() || this.now() - packet.fetchedAt >= 30 * 60_000) return false;
    try { const data = JSON.parse(packet.text); return Array.isArray(data.results) && !data.errors; } catch { return false; }
  }
  async load() {
    try {
      const text = await readFile(this.file, 'utf8');
      if (text.length > 2_000_000) return;
      const rows = JSON.parse(text);
      if (Array.isArray(rows)) for (const [key, packet] of rows.slice(-64)) if (this.valid(key, packet)) this.entries.set(key, packet);
    } catch { /* Missing or damaged cache must not prevent service startup. */ }
  }
  get(key) { const packet = this.entries.get(key); return this.valid(key, packet) ? packet : null; }
  async put(key, packet) {
    if (!this.valid(key, packet)) return;
    this.entries.set(key, { fetchedAt: packet.fetchedAt, status: 200, text: packet.text, type: 'application/json', retryAfter: null });
    for (const [name, value] of this.entries) if (!this.valid(name, value)) this.entries.delete(name);
    while (this.entries.size > 64) this.entries.delete(this.entries.keys().next().value);
    this.saving = this.saving.catch(() => {}).then(async () => {
      await writeFile(this.file + '.tmp', JSON.stringify([...this.entries]), { mode: 0o600 });
      await rename(this.file + '.tmp', this.file);
    });
    try { await this.saving; } catch { /* A failed cache save cannot fail a successful API read. */ }
  }
}
