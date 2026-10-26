// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Compact observed power averages, not billing-grade energy measurements.
import { appendFile, chmod, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const HISTORY_FIELDS = ['pvPower', 'loadsPower', 'gridConsumptionPower', 'feedinPower', 'batChargePower', 'batDischargePower', 'SoC'];
export const DEFAULT_RETENTION_MONTHS = 12;
export function validateRetentionMonths(value) {
  if (!Number.isInteger(value) || value < 1 || value > 24) {
    throw Object.assign(new Error('Keep history for 1 to 24 whole months'), { statusCode: 400 });
  }
  return value;
}
const MINUTE = 60_000;
const SLOT = 15;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthOf = time => new Date(time).toISOString().slice(0, 7);
const cutoffAt = (time, months) => {
  const date = new Date(time);
  // Calendar-month retention, including leap-year/day clamping.
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth();
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return Date.UTC(year, month, day, date.getUTCHours(), date.getUTCMinutes());
};

export class CompactHistory {
  constructor({ directory, now = Date.now }) {
    this.directory = directory;
    this.now = now;
    this.queue = Promise.resolve();
    this.current = null;
    this.loaded = false;
    this.lastFlush = 0;
    this.lastPruneDay = '';
    this.retentionMonths = DEFAULT_RETENTION_MONTHS;
    this.cleanupPending = false;
    this.lastCleanupAt = null;
  }
  async initialize() {
    if (this.loaded) return;
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
    try {
      const preferences = JSON.parse(await readFile(path.join(this.directory, 'preferences.json'), 'utf8'));
      if (preferences?.v !== 1) throw new Error('Invalid history preferences');
      this.retentionMonths = validateRetentionMonths(preferences.retentionMonths);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try {
      const value = JSON.parse(await readFile(path.join(this.directory, 'current.json'), 'utf8'));
      if (value?.v !== 1 || !Number.isInteger(value.slot) || !Number.isInteger(value.lastMinute)
          || !Array.isArray(value.sums) || !Array.isArray(value.counts)
          || value.sums.length !== 7 || value.counts.length !== 7
          || value.sums.some(n => !Number.isFinite(n))
          || value.counts.some(n => !Number.isInteger(n) || n < 0 || n > 15)) {
        throw new Error('Invalid history checkpoint');
      }
      this.current = value;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    this.loaded = true;
  }
  enqueue(operation) {
    const task = this.queue.then(operation);
    this.queue = task.catch(() => {});
    return task;
  }
  settings() {
    return { retentionMonths: this.retentionMonths, defaultMonths: DEFAULT_RETENTION_MONTHS,
      minimumMonths: 1, maximumMonths: 24, automaticCleanup: true,
      cutoff: new Date(cutoffAt(this.now(), this.retentionMonths)).toISOString(),
      lastCleanupAt: this.lastCleanupAt, cleanupPending: this.cleanupPending };
  }
  getSettings() {
    return this.enqueue(async () => { await this.initialize(); return this.settings(); });
  }
  setRetentionMonths(value) {
    return this.enqueue(async () => {
      validateRetentionMonths(value);
      await this.initialize();
      const target = path.join(this.directory, 'preferences.json');
      await writeFile(`${target}.tmp`, JSON.stringify({ v: 1, retentionMonths: value }), { mode: 0o600 });
      await rename(`${target}.tmp`, target);
      this.retentionMonths = value;
      // Save policy before deleting data. A failed cleanup is retried by the service.
      this.cleanupPending = true;
      try { await this.prune(); } catch { /* The saved policy remains authoritative. */ }
      return this.settings();
    });
  }
  cleanup() {
    return this.enqueue(async () => { await this.initialize(); await this.prune(); return this.settings(); });
  }
  record(telemetry) {
    return this.enqueue(async () => {
      await this.initialize();
      const timestamp = Date.parse(telemetry?.updatedAt || '');
      const now = this.now();
      // Do not turn old cached values into new samples or fill network outages.
      if (!Number.isFinite(timestamp) || timestamp > now + MINUTE || now - timestamp > 2 * MINUTE) return false;
      const minute = Math.floor(timestamp / MINUTE);
      const slot = Math.floor(minute / SLOT) * SLOT;
      if (this.current && minute <= this.current.lastMinute) return false;
      const values = HISTORY_FIELDS.map((key, index) => {
        const value = telemetry?.values?.[key];
        if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return null;
        const number = Number(value);
        if (number < 0 || number > (index === 6 ? 100 : 1000)) return null;
        return Math.round(number * (index === 6 ? 10 : 1000));
      });
      if (values.every(value => value === null)) return false;
      if (this.current && slot !== this.current.slot) await this.archiveCurrent();
      if (!this.current || slot !== this.current.slot) {
        this.current = { v: 1, slot, lastMinute: minute, sums: Array(7).fill(0), counts: Array(7).fill(0) };
      }
      this.current.lastMinute = minute;
      values.forEach((value, index) => {
        if (value !== null) { this.current.sums[index] += value; this.current.counts[index] += 1; }
      });
      // Checkpoint at most every five minutes; retain only one sample per minute.
      if (now - this.lastFlush >= 5 * MINUTE) await this.flushCurrent();
      if (new Date(now).toISOString().slice(0, 10) !== this.lastPruneDay) await this.prune();
      return true;
    });
  }
  row(current = this.current) {
    return [current.slot, ...current.sums.map((sum, index) => current.counts[index] ? Math.round(sum / current.counts[index]) : null), ...current.counts];
  }
  async archiveCurrent() {
    if (!this.current || !this.current.counts.some(Boolean)) return;
    const file = path.join(this.directory, `${monthOf(this.current.slot * MINUTE)}.jsonl`);
    // A restart between append and checkpoint may duplicate a slot; reads collapse it.
    await appendFile(file, `${JSON.stringify(this.row())}\n`, { mode: 0o600 });
  }
  async flushCurrent() {
    if (!this.current) return;
    const temporary = path.join(this.directory, 'current.json.tmp');
    await writeFile(temporary, JSON.stringify(this.current), { mode: 0o600 });
    await rename(temporary, path.join(this.directory, 'current.json'));
    this.lastFlush = this.now();
  }
  recordEvent(event) {
    return this.enqueue(async () => {
      await this.initialize();
      if (!['automation_paused', 'automation_resumed', 'pause_expired'].includes(event?.type)
          || !Number.isFinite(Date.parse(event.at)) || !Number.isSafeInteger(event.revision)) throw new Error('Invalid activity event');
      const row = [event.at, event.type, event.until || null, event.revision];
      const file = path.join(this.directory, `${monthOf(Date.parse(event.at))}.events.jsonl`);
      const encoded = JSON.stringify(row);
      let existing = '';
      try { existing = await readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      // The pause journal retries after a crash. Repeated events must not duplicate the activity log.
      if (!existing.split('\n').includes(encoded)) await appendFile(file, `${existing && !existing.endsWith('\n') ? '\n' : ''}${encoded}\n`, { mode: 0o600 });
      await this.prune();
    });
  }
  async prune() {
    this.cleanupPending = true;
    const cutoff = cutoffAt(this.now(), this.retentionMonths);
    const oldest = monthOf(cutoff);
    for (const name of await readdir(this.directory)) {
      if (!/^\d{4}-\d{2}(?:\.events)?\.jsonl$/.test(name)) continue;
      const file = path.join(this.directory, name);
      if (name.slice(0, 7) < oldest) { await unlink(file); continue; }
      if (name.slice(0, 7) !== oldest) continue;
      const data = await readFile(file, 'utf8');
      const kept = data.split('\n').filter(line => {
        try { const row = JSON.parse(line); return Array.isArray(row) && (name.includes('.events.') ? Date.parse(row[0]) : row[0] * MINUTE) >= cutoff; }
        catch { return false; }
      }).join('\n');
      const next = kept ? `${kept}\n` : '';
      if (next !== data) {
        await writeFile(`${file}.tmp`, next, { mode: 0o600 });
        await rename(`${file}.tmp`, file);
      }
    }
    if (this.current && this.current.slot * MINUTE < cutoff) {
      this.current = null;
      await unlink(path.join(this.directory, 'current.json')).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
    this.lastPruneDay = new Date(this.now()).toISOString().slice(0, 10);
    this.lastCleanupAt = new Date(this.now()).toISOString();
    this.cleanupPending = false;
  }
  readMonth(requestedMonth = monthOf(this.now())) {
    return this.enqueue(async () => {
      if (!MONTH_PATTERN.test(requestedMonth)) throw Object.assign(new Error('Use a month in YYYY-MM format'), { statusCode: 400 });
      await this.initialize();
      await this.prune();
      const now = this.now();
      const cutoff = cutoffAt(now, this.retentionMonths);
      const rows = new Map();
      try {
        const data = await readFile(path.join(this.directory, `${requestedMonth}.jsonl`), 'utf8');
        for (const line of data.split('\n')) {
          if (!line) continue;
          try {
            const row = JSON.parse(line);
            if (!Array.isArray(row) || row.length !== 15 || !Number.isInteger(row[0])
                || row.slice(1, 8).some(n => n !== null && !Number.isFinite(n))
                || row.slice(8).some(n => !Number.isInteger(n) || n < 0 || n > 15)) continue;
            if (monthOf(row[0] * MINUTE) === requestedMonth) rows.set(row[0], row);
          } catch { /* An incomplete final append is not a valid observation. */ }
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (this.current && monthOf(this.current.slot * MINUTE) === requestedMonth) rows.set(this.current.slot, this.row());
      const points = [...rows.values()].filter(row => row[0] * MINUTE >= cutoff && row[0] * MINUTE <= now)
        .sort((a, b) => a[0] - b[0]).map(row => ({
          at: new Date(row[0] * MINUTE).toISOString(),
          values: Object.fromEntries(HISTORY_FIELDS.map((key, index) => [key, row[index + 1] === null ? null : row[index + 1] / (index === 6 ? 10 : 1000)])),
          samples: Object.fromEntries(HISTORY_FIELDS.map((key, index) => [key, row[index + 8]]))
        }));
      let storageBytes = 0;
      const months = [];
      for (const name of await readdir(this.directory)) {
        if (['current.json', 'preferences.json'].includes(name) || /^\d{4}-\d{2}(?:\.events)?\.jsonl$/.test(name)) storageBytes += (await stat(path.join(this.directory, name))).size;
        if (/^\d{4}-\d{2}(?:\.events)?\.jsonl$/.test(name)) months.push(name.slice(0, 7));
      }
      if (this.current) months.push(monthOf(this.current.slot * MINUTE));
      const events = [];
      try {
        const data = await readFile(path.join(this.directory, `${requestedMonth}.events.jsonl`), 'utf8');
        for (const line of data.split('\n')) {
          try {
            const [at, type, until, revision] = JSON.parse(line);
            if (!['automation_paused', 'automation_resumed', 'pause_expired'].includes(type)) continue;
            if (Date.parse(at) >= cutoff && Date.parse(at) <= now && monthOf(Date.parse(at)) === requestedMonth) events.push({ at, type, until, revision });
          } catch { /* Ignore incomplete append. */ }
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      events.sort((a, b) => b.at.localeCompare(a.at));
      return { version: 1, month: requestedMonth, intervalMinutes: 15, retentionMonths: this.retentionMonths, storageBytes,
        months: [...new Set(months)].filter(month => month >= monthOf(cutoff) && month <= monthOf(now)).sort().reverse(),
        events, fields: HISTORY_FIELDS, units: { power: 'kW', SoC: '%' }, points,
        note: 'Observed 15-minute averages. Missing readings remain gaps; these are not billing-grade energy totals.' };
    });
  }
  close() { return this.enqueue(async () => { await this.initialize(); await this.flushCurrent(); }); }
}
