// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// A single outbound queue. Cache hits and duplicate callers consume no slot.
export class RequestBudget {
  constructor({ interval = 60_000, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), readNext = () => 0, saveNext = () => {}, lock = task => task() } = {}) {
    Object.assign(this, { interval, now, sleep, readNext, saveNext, lock });
    this.nextAt = 0;
    this.queue = [];
    this.pending = new Map();
    this.cache = new Map();
    this.running = false;
    this.activity = 'idle';
  }
  async defer(milliseconds) {
    this.nextAt = Math.max(this.nextAt, this.now() + milliseconds);
    await this.saveNext(this.nextAt);
  }
  run(key, operation, { ttl = 0, cacheWhen = () => true, errorTtl = 0 } = {}) {
    const cached = this.cache.get(key);
    if (cached?.until > this.now()) return cached.error ? Promise.reject(cached.error) : Promise.resolve(cached.value);
    if (this.pending.has(key)) return this.pending.get(key);
    const promise = new Promise((resolve, reject) => this.queue.push({ key, operation, ttl, cacheWhen, errorTtl, resolve, reject }));
    this.pending.set(key, promise);
    void this.drain();
    return promise;
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length) {
        const job = this.queue.shift();
        try {
          const value = await this.lock(async () => {
            // Re-read persistent timing inside the cross-tab lock, before each send.
            this.nextAt = Math.max(this.nextAt, Number(await this.readNext()) || 0);
            this.activity = 'waiting';
            while (this.nextAt > this.now()) await this.sleep(this.nextAt - this.now());
            job.startedAt = this.now();
            this.nextAt = job.startedAt + this.interval;
            await this.saveNext(this.nextAt);
            this.activity = 'requesting';
            return job.operation();
          });
          if (job.ttl && job.cacheWhen(value)) this.cache.set(job.key, { value, until: job.startedAt + job.ttl });
          if (this.cache.size > 128) this.cache.delete(this.cache.keys().next().value);
          job.resolve(value);
        } catch (error) {
          if (job.errorTtl) this.cache.set(job.key, { error, until: this.now() + job.errorTtl });
          job.reject(error);
        }
        finally { this.pending.delete(job.key); this.activity = 'idle'; }
      }
    } finally { this.running = false; }
  }
}

export function retryDelay(response, data, now = Date.now()) {
  const limited = response.status === 429 || data?.errors?.some(error =>
    error?.extensions?.errorCode === 'KT-CT-1199' || /too many requests|rate.?limit/i.test(error?.message || ''));
  if (!limited) return 0;
  const value = response.headers.get('retry-after');
  const seconds = Number(value);
  const delay = value && Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Math.max(60_000, Number.isFinite(delay) ? delay : 0);
}
