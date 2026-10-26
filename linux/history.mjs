// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Compact observed power averages, not billing-grade energy measurements.
import { appendFile, chmod, mkdir, readFile, readdir, rename, stat, statfs, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {gzip,gunzip} from 'node:zlib';
import {promisify} from 'node:util';
const compress=promisify(gzip),decompress=promisify(gunzip);
const ARCHIVE_PATTERN=/^\d{4}-\d{2}(?:\.events)?\.jsonl(?:\.gz)?$/;
export const LOW_STORAGE_BYTES=4_000_000_000;

export const HISTORY_FIELDS = ['pvPower', 'loadsPower', 'gridConsumptionPower', 'feedinPower', 'batChargePower', 'batDischargePower', 'SoC'];
export const DEFAULT_RETENTION_MONTHS = 12;
export const DEFAULT_SAVE_INTERVAL_MINUTES = 60;
export function validateSaveInterval(value) {
  if (![30,60].includes(value)) throw Object.assign(new Error('Save history every 30 or 60 minutes'), {statusCode:400});
  return value;
}
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
  constructor({ directory, now = Date.now, diskSpace = async directory => {const info=await statfs(directory);return {freeBytes:info.bavail*info.bsize,totalBytes:info.blocks*info.bsize};} }) {
    this.directory = directory;
    this.diskSpace=diskSpace;this.space=null;this.lastSpaceCheck=0;this.lastSpaceCleanupAt=null;
    this.now = now;
    this.queue = Promise.resolve();
    this.current = null;
    this.loaded = false;
    this.lastFlush = this.now();
    this.lastSavedAt = null;
    this.saveIntervalMinutes = DEFAULT_SAVE_INTERVAL_MINUTES;
    this.pendingRows = new Map();
    this.currentDirty = false;
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
      this.saveIntervalMinutes = validateSaveInterval(preferences.saveIntervalMinutes ?? DEFAULT_SAVE_INTERVAL_MINUTES);
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
      this.lastSavedAt = (await stat(path.join(this.directory, 'current.json'))).mtime.toISOString();
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
      saveIntervalMinutes: this.saveIntervalMinutes, defaultSaveIntervalMinutes: DEFAULT_SAVE_INTERVAL_MINUTES,
      compression:'gzip', lowStorage:this.space?this.space.freeBytes<LOW_STORAGE_BYTES:false, freeBytes:this.space?.freeBytes ?? null, reserveBytes:LOW_STORAGE_BYTES, minimumHistoryHours:24, lastSpaceCleanupAt:this.lastSpaceCleanupAt,
      lastSavedAt: this.lastSavedAt, bufferedIntervals: this.pendingRows.size + (this.currentDirty ? 1 : 0),
      minimumMonths: 1, maximumMonths: 24, automaticCleanup: true,
      cutoff: new Date(cutoffAt(this.now(), this.retentionMonths)).toISOString(),
      lastCleanupAt: this.lastCleanupAt, cleanupPending: this.cleanupPending };
  }
  getSettings() {
    return this.enqueue(async () => { await this.initialize(); if(!this.space || this.now()-this.lastSpaceCheck>=MINUTE)await this.manageDiskSpace(); return {...this.settings(),...await this.storage()}; });
  }
  setRetentionMonths(value) { return this.setSettings({retentionMonths:value}); }
  setSettings(update) {
    return this.enqueue(async () => {
      await this.initialize();
      const retention = validateRetentionMonths(Object.hasOwn(update,'retentionMonths') ? update.retentionMonths : this.retentionMonths);
      const interval = validateSaveInterval(Object.hasOwn(update,'saveIntervalMinutes') ? update.saveIntervalMinutes : this.saveIntervalMinutes);
      const target = path.join(this.directory, 'preferences.json');
      await writeFile(`${target}.tmp`, JSON.stringify({ v:1, retentionMonths:retention, saveIntervalMinutes:interval }), {mode:0o600});
      await rename(`${target}.tmp`,target);
      this.retentionMonths=retention; this.saveIntervalMinutes=interval;
      this.cleanupPending=true;
      try { await this.prune(); } catch { /* Saved policy stays authoritative; cleanup retries. */ }
      return {...this.settings(),...await this.storage()};
    });
  }
  async storage() {
    let storageBytes=0,allocatedBytes=0;
    for(const name of await readdir(this.directory)) {
      if(!['current.json','preferences.json'].includes(name) && !ARCHIVE_PATTERN.test(name))continue;
      const info=await stat(path.join(this.directory,name));storageBytes+=info.size;allocatedBytes+=(info.blocks ?? Math.ceil(info.size/512))*512;
    }
    return {storageBytes,allocatedBytes};
  }
  flushIfDue() {
    return this.enqueue(async()=>{await this.initialize();await this.manageDiskSpace();if(this.now()-this.lastFlush>=this.saveIntervalMinutes*MINUTE)await this.flushCurrent();});
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
      this.currentDirty=true;
      // Keep routine readings in RAM; batch file writes every 30 or 60 minutes.
      if (now - this.lastFlush >= this.saveIntervalMinutes * MINUTE) await this.flushCurrent();
      if (new Date(now).toISOString().slice(0, 10) !== this.lastPruneDay) await this.prune();
      return true;
    });
  }
  row(current = this.current) {
    return [current.slot, ...current.sums.map((sum, index) => current.counts[index] ? Math.round(sum / current.counts[index]) : null), ...current.counts];
  }
  async archiveCurrent() {
    if (this.current?.counts.some(Boolean)) this.pendingRows.set(this.current.slot,this.row());
  }
  async flushCurrent() {
    if (!this.currentDirty && !this.pendingRows.size) return;
    await this.manageDiskSpace();
    if(this.space.freeBytes<16*1024*1024)throw new Error('Too little disk space to save history. Readings remain buffered.');
    const batches=new Map();
    for(const row of this.pendingRows.values()) {
      const month=monthOf(row[0]*MINUTE);
      if(!batches.has(month))batches.set(month,[]);
      batches.get(month).push(row);
    }
    if(this.current) {
      const month=monthOf(this.current.slot*MINUTE);
      if(!batches.has(month))batches.set(month,[]);
      batches.get(month).push(this.row());
    }
    // Replace each compressed month atomically. Old and pending rows merge by slot.
    for(const [month,rows] of batches) {
      const merged=await this.readArchive(month);
      for(const row of rows)merged.set(row[0],row);
      await this.writeArchive(month,[...merged.values()].sort((a,b)=>a[0]-b[0]));
    }
    if(this.current) {
      const temporary=path.join(this.directory,'current.json.tmp');
      await writeFile(temporary,JSON.stringify(this.current),{mode:0o600});
      await rename(temporary,path.join(this.directory,'current.json'));
    }
    this.pendingRows.clear();this.currentDirty=false;
    this.lastFlush=this.now();this.lastSavedAt=new Date(this.lastFlush).toISOString();
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
    await this.trimBefore(cutoff);
    await this.manageDiskSpace();
    this.lastPruneDay = new Date(this.now()).toISOString().slice(0, 10);
    this.lastCleanupAt = new Date(this.now()).toISOString();
    this.cleanupPending = false;
  }
  async readArchive(month) {
    const rows=new Map();
    for(const suffix of ['.jsonl','.jsonl.gz']) {
      let text;
      try {const raw=await readFile(path.join(this.directory,month+suffix));text=(suffix.endsWith('.gz')?await decompress(raw):raw).toString();}
      catch(error){if(error.code==='ENOENT')continue;throw error;}
      for(const line of text.split('\n')) {
        try {
          const row=JSON.parse(line);
          if(!Array.isArray(row) || row.length!==15 || !Number.isInteger(row[0]) || row.slice(1,8).some(n=>n!==null && !Number.isFinite(n)) || row.slice(8).some(n=>!Number.isInteger(n) || n<0 || n>15))continue;
          if(monthOf(row[0]*MINUTE)===month)rows.set(row[0],row);
        }catch{/* Ignore incomplete legacy appends. Compressed files use atomic replacement. */}
      }
    }
    return rows;
  }
  async writeArchive(month,rows) {
    const file=path.join(this.directory,`${month}.jsonl.gz`);
    await writeFile(file+'.tmp',await compress(rows.map(row=>JSON.stringify(row)).join('\n')+'\n'),{mode:0o600});
    await rename(file+'.tmp',file);
    await unlink(path.join(this.directory,`${month}.jsonl`)).catch(error=>{if(error.code!=='ENOENT')throw error;});
  }
  async trimBefore(cutoff,{recoverSpace=false}={}) {
    const oldest=monthOf(cutoff);
    for(const name of (await readdir(this.directory)).filter(name=>ARCHIVE_PATTERN.test(name)).sort()) {
      if(recoverSpace && (await this.diskSpace(this.directory)).freeBytes>=LOW_STORAGE_BYTES)break;
      const file=path.join(this.directory,name);
      if(name.slice(0,7)<oldest){await unlink(file);continue;}
      if(name.slice(0,7)!==oldest)continue;
      const raw=await readFile(file),text=(name.endsWith('.gz')?await decompress(raw):raw).toString();
      const kept=text.split('\n').filter(line=>{try{const row=JSON.parse(line);return Array.isArray(row) && (name.includes('.events.')?Date.parse(row[0]):row[0]*MINUTE)>=cutoff;}catch{return false;}}).join('\n');
      const next=kept?kept+'\n':'';
      if(next!==text) {
        if(!next && recoverSpace){await unlink(file);continue;}
        await writeFile(file+'.tmp',name.endsWith('.gz')?await compress(next):next,{mode:0o600});await rename(file+'.tmp',file);
      }
    }
    for(const slot of this.pendingRows.keys())if(slot*MINUTE<cutoff)this.pendingRows.delete(slot);
    if(this.current && this.current.slot*MINUTE<cutoff) {
      this.current=null;this.currentDirty=false;
      await unlink(path.join(this.directory,'current.json')).catch(error=>{if(error.code!=='ENOENT')throw error;});
    }
  }
  async manageDiskSpace() {
    this.space=await this.diskSpace(this.directory);this.lastSpaceCheck=this.now();
    if(this.space.freeBytes<LOW_STORAGE_BYTES) {
      // A small history cannot resolve disk pressure caused by other files.
      // Preserve the latest day and keep the warning active if space stays low.
      await this.trimBefore(this.now()-24*60*MINUTE,{recoverSpace:true});
      this.space=await this.diskSpace(this.directory);this.lastSpaceCleanupAt=new Date(this.now()).toISOString();
    }
  }
  clearAll() {
    return this.enqueue(async()=>{
      await this.initialize();
      for(const name of await readdir(this.directory))if(ARCHIVE_PATTERN.test(name) || /^\d{4}-\d{2}(?:\.events)?\.jsonl(?:\.gz)?\.tmp$/.test(name) || ['current.json','current.json.tmp'].includes(name))await unlink(path.join(this.directory,name));
      this.current=null;this.currentDirty=false;this.pendingRows.clear();this.lastSavedAt=null;this.lastFlush=this.now();
      await this.manageDiskSpace();return {...this.settings(),...await this.storage()};
    });
  }
  readMonth(requestedMonth = monthOf(this.now())) {
    return this.enqueue(async () => {
      if (!MONTH_PATTERN.test(requestedMonth)) throw Object.assign(new Error('Use a month in YYYY-MM format'), { statusCode: 400 });
      await this.initialize();
      await this.prune();
      const now = this.now();
      const cutoff = cutoffAt(now, this.retentionMonths);
      const rows = await this.readArchive(requestedMonth);
      for(const [slot,row] of this.pendingRows)if(monthOf(slot*MINUTE)===requestedMonth)rows.set(slot,row);
      if (this.current && monthOf(this.current.slot * MINUTE) === requestedMonth) rows.set(this.current.slot, this.row());
      const points = [...rows.values()].filter(row => row[0] * MINUTE >= cutoff && row[0] * MINUTE <= now)
        .sort((a, b) => a[0] - b[0]).map(row => ({
          at: new Date(row[0] * MINUTE).toISOString(),
          values: Object.fromEntries(HISTORY_FIELDS.map((key, index) => [key, row[index + 1] === null ? null : row[index + 1] / (index === 6 ? 10 : 1000)])),
          samples: Object.fromEntries(HISTORY_FIELDS.map((key, index) => [key, row[index + 8]]))
        }));
      const storage = await this.storage();
      const months = [...this.pendingRows.keys()].map(slot=>monthOf(slot*MINUTE));
      for (const name of await readdir(this.directory)) {
        if (ARCHIVE_PATTERN.test(name)) months.push(name.slice(0, 7));
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
      return { version: 1, month: requestedMonth, intervalMinutes: 15, ...this.settings(), ...storage,
        months: [...new Set(months)].filter(month => month >= monthOf(cutoff) && month <= monthOf(now)).sort().reverse(),
        events, fields: HISTORY_FIELDS, units: { power: 'kW', SoC: '%' }, points,
        note: 'Observed 15-minute averages. Missing readings remain gaps; these are not billing-grade energy totals.' };
    });
  }
  close() { return this.enqueue(async () => { await this.initialize(); await this.flushCurrent(); }); }
}
