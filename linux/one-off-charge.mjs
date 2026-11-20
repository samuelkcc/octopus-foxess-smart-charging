// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import { open, readFile, rename } from 'node:fs/promises';
import path from 'node:path';

const ukTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

function validClockWindow(start, end) {
  const label = seconds => ukTime.format(seconds * 1000);
  if ([start, end].some(value => label(value) === label(value - 3600) || label(value) === label(value + 3600))) {
    return false;
  }
  const wallTime = seconds => {
    const p = Object.fromEntries(ukTime.formatToParts(seconds * 1000).map(part => [part.type, part.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  };
  return wallTime(end) - wallTime(start) <= 86400000;
}

export class OneOffCharges {
  #queue = Promise.resolve();

  constructor(file) {
    this.file = file;
  }

  async read(now) {
    try {
      const state = JSON.parse(await readFile(this.file, 'utf8'));
      return { ...state, slots: state.slots.filter(slot => slot.end > now) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { slots: [], revision: 0, cleanup: false };
    }
  }

  change(update, worker) {
    const result = this.#queue.then(async () => {
      const now = Math.floor(Date.now() / 1000);
      const state = await this.read(now);
      const { action, start, end, revision } = update || {};
      const fail = (status, error) => ({ status, error });
      if (action === 'track' || action === 'settled') {
        if (!worker) return fail(403, 'Only the Pi worker can update schedule confirmation.');
        const active = state.slots.some(slot => slot.start <= now);
        if (revision !== state.revision || active !== (action === 'track')) {
          return fail(409, 'The one-off schedule changed. Read the current schedule.');
        }
        if (state.cleanup === active) return { state };
        state.cleanup = active;
      } else if (action === 'add') {
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start % 60 || end % 60 ||
            start < now || end <= start || end - start > 86400 || end >= 4133980800 || !validClockWindow(start, end)) {
          return fail(400, 'Select an unambiguous future UK time and a duration of up to 24 hours.');
        }
        if (state.slots.length >= 8 || state.slots.some(slot => start < slot.end && slot.start < end)) {
          return fail(409, 'Save up to eight periods with no overlaps.');
        }
        state.slots.push({ start, end });
        state.slots.sort((a, b) => a.start - b.start);
        state.revision++;
      } else if (action === 'cancel') {
        const index = state.slots.findIndex(slot => slot.start === start && slot.end === end);
        if (index === -1) return fail(409, 'This period is no longer scheduled.');
        state.slots.splice(index, 1);
        state.revision++;
      } else {
        return fail(400, 'Select a one-off schedule action.');
      }
      const temporary = this.file + '.tmp';
      const file = await open(temporary, 'w', 0o600);
      try {
        await file.writeFile(JSON.stringify(state));
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, this.file);
      const directory = await open(path.dirname(this.file), 'r');
      try { await directory.sync(); } finally { await directory.close(); }
      return { state };
    });
    this.#queue = result.catch(() => {});
    return result;
  }
}
