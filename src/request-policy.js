/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. */
(() => {
  // Web login has no artificial request gap. Persist only an actual API cooldown.
  // Do not reuse the old per-request 60-second clock from earlier HTML builds.
  const key = 'octopusWebRetryAfterV2';
  const readNext = () => { try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; } };
  const saveNext = value => { try { localStorage.setItem(key, String(value)); } catch { /* Memory timing remains active. */ } };
  const lock = task => navigator.locks ? navigator.locks.request('smart-charging-octopus-api', task) : task();
  const octopus = new window.RequestBudget({ interval: 0, readNext, saveNext, lock });
  const foxess = new window.RequestBudget({ interval: 0 });
  let foxRevision = 0;
  let verification = 0;
  window.requestPolicy = {
    octopus,
    async run(url, options, operation) {
      let payload = {};
      try { payload = JSON.parse(options.body || '{}'); } catch { /* GET or non-JSON request. */ }
      const target = String(payload.url || url);
      // Pi requests share the service queue across every desktop and phone.
      if (!window.linuxRuntime && target.startsWith('https://api.octopus.energy/')) {
        const auth = /obtainKrakenToken/.test(payload.query || '');
        const ttl = auth ? 10 * 60_000 : target.includes('/graphql') ? 0 : 30 * 60_000;
        return octopus.run(JSON.stringify([url, options.body, options.headers]), operation, { ttl });
      }
      if (!window.linuxRuntime && target.startsWith('https://www.foxesscloud.com/')) {
        if (target.endsWith('/scheduler/enable')) {
          const result = await operation();
          if (result.errno === 0) {
            foxRevision++;
            foxess.cache.clear();
            window.nextFoxTime = Date.now() + Math.max(600, foxRefreshInterval) * 1000;
          }
          return result;
        }
        const fresh = payload.readback === true && target.endsWith('/scheduler/get');
        return foxess.run(JSON.stringify([foxRevision, target, payload.body, fresh ? ++verification : 0]), operation,
          { ttl: fresh ? 0 : Math.max(600, foxRefreshInterval) * 1000, errorTtl: fresh ? 0 : 600_000 });
      }
      return operation();
    }
  };
})();
