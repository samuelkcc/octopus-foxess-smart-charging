// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// One serialized barrier for every FoxESS schedule mutation, including manual requests.
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const failure = (message, statusCode) => Object.assign(new Error(message), { statusCode });
export function validatePauseUpdate(update) {
  if (!update || Array.isArray(update) || typeof update !== 'object') throw failure('Invalid pause request', 400);
  const keys = Object.keys(update);
  if (keys.some(key => !['action', 'hours'].includes(key))) throw failure('Unknown pause setting', 400);
  if (update.action === 'resume' && keys.length === 1) return update;
  if (update.action === 'pause' && keys.length === 2 && [6, 12, 24, null].includes(update.hours)) return update;
  throw failure('Choose 6, 12, 24 hours, or forever', 400);
}
export class AutomationPause {
  constructor({ file, now = Date.now, onEvent = async () => {} }) {
    this.file = file; this.now = now; this.onEvent = onEvent;
    this.state = null; this.queue = Promise.resolve(); this.pendingPauses = 0; this.auditWarning = false;
  }
  enqueue(operation) {
    const task = this.queue.then(operation);
    this.queue = task.catch(() => {});
    return task;
  }
  async initialize() {
    if (this.state) return;
    try {
      const state = JSON.parse(await readFile(this.file, 'utf8'));
      if (state.v !== 1 || typeof state.paused !== 'boolean' || !Number.isSafeInteger(state.revision)
          || (state.paused && !Number.isFinite(Date.parse(state.startedAt)))
          || (state.until !== null && !Number.isFinite(Date.parse(state.until)))) throw new Error('Invalid saved pause state');
      this.state = state;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error; // Fail closed: never treat unreadable pause state as active automation.
      this.state = { v: 1, paused: false, startedAt: null, until: null, revision: 0 };
    }
  }
  snapshot() { const { pendingEvents, ...state } = this.state; return { ...state, auditWarning: this.auditWarning }; }
  async save(next) {
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    await writeFile(`${this.file}.tmp`, JSON.stringify(next), { mode: 0o600 });
    await rename(`${this.file}.tmp`, this.file);
    await chmod(this.file, 0o600);
    this.state = next;
  }
  async flushEvents() {
    try {
      for (const event of this.state.pendingEvents || []) await this.onEvent(event);
      if (this.state.pendingEvents?.length) await this.save({ ...this.state, pendingEvents: [] });
      this.auditWarning = false;
    } catch { this.auditWarning = true; }
  }
  async transition(paused, hours, type) {
    const at = new Date(this.now()).toISOString();
    const next = { v: 1, paused, startedAt: paused ? at : null,
      until: paused && hours !== null ? new Date(this.now() + hours * 3600_000).toISOString() : null,
      revision: this.state.revision + 1 };
    next.pendingEvents = [...(this.state.pendingEvents || []), { at, type, until: next.until, revision: next.revision }];
    await this.save(next);
    // Keep unsaved activity with the pause state. Retry it after a storage failure or restart.
    await this.flushEvents();
    return this.snapshot();
  }
  async refresh() {
    await this.initialize();
    if (this.state.pendingEvents?.length) await this.flushEvents();
    if (this.state.paused && this.state.until && Date.parse(this.state.until) <= this.now()) {
      await this.transition(false, null, 'pause_expired');
    }
  }
  getState() { return this.enqueue(async () => { await this.refresh(); return this.snapshot(); }); }
  update(update) {
    try { validatePauseUpdate(update); } catch (error) { return Promise.reject(error); }
    // Block new writes immediately, before waiting for an already-sent request to finish.
    if (update.action === 'pause') this.pendingPauses++;
    return this.enqueue(async () => {
      await this.refresh();
      if (update.action === 'resume' && !this.state.paused) return this.snapshot();
      return this.transition(update.action === 'pause', update.hours, update.action === 'pause' ? 'automation_paused' : 'automation_resumed');
    }).finally(() => { if (update.action === 'pause') this.pendingPauses--; });
  }
  runWrite(operation) {
    return this.enqueue(async () => {
      await this.refresh();
      if (this.pendingPauses || this.state.paused) throw failure('Automation is paused. Use the FoxESS app, or resume automation first.', 423);
      return operation();
    });
  }
}
