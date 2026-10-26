/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * Browser pause state. The Pi server remains the authoritative write barrier.
 */
(() => {
    const key = 'smartChargingPauseV1';
    const eventKey = 'smartChargingActivityV1';
    let state = { paused: false, until: null, revision: 0 };
    let ready = false;
    let authenticated = false;
    let pending = false;
    let inFlight = Promise.resolve();
    const notify = () => window.dispatchEvent(new CustomEvent('automation-control-change'));
    const localEvents = () => { try { return JSON.parse(localStorage.getItem(eventKey) || '[]'); } catch { return []; } };
    const log = type => {
        const at = new Date().toISOString();
        const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 12);
        const events = [{ at, type, until: state.until, revision: state.revision }, ...localEvents()]
            .filter(event => Date.parse(event.at) >= cutoff.getTime()).slice(0, 2000);
        localStorage.setItem(eventKey, JSON.stringify(events));
    };
    function accept(next) {
        if (authenticated && window.linuxRuntime && next.revision < state.revision) return;
        const wasPaused = state.paused;
        state = next; ready = true; authenticated = true;
        notify();
        if (wasPaused && !next.paused) window.dispatchEvent(new CustomEvent('automation-resumed'));
    }
    function localRefresh() {
        try {
            const saved = JSON.parse(localStorage.getItem(key) || 'null');
            if (saved && typeof saved.paused === 'boolean') state = saved;
            if (state.paused && state.until && Date.parse(state.until) <= Date.now()) {
                state = { paused: false, until: null, revision: (state.revision || 0) + 1 };
                localStorage.setItem(key, JSON.stringify(state)); log('pause_expired');
                window.dispatchEvent(new CustomEvent('automation-resumed'));
            }
            ready = true;
        } catch { ready = false; }
    }
    async function refresh() {
        if (!window.linuxRuntime) { localRefresh(); notify(); return; }
        if (!authenticated) return; // Initial state arrives only after authenticated configuration.
        try {
            const response = await fetch('/api/automation/pause', { cache: 'no-store', headers: { 'X-Octopus-Access-Key': typeof getLinuxAccessKey === 'function' ? getLinuxAccessKey() : '' } });
            if (!response.ok) throw new Error('Pause state unavailable');
            accept(await response.json());
        } catch { ready = false; notify(); }
    }
    window.automationControl = {
        accept,
        isPaused: () => pending || (window.linuxRuntime && !ready) || state.paused || !ready,
        snapshot: () => ({ ...state, pending, available: ready }),
        events: localEvents,
        refresh,
        async update(action, hours = null) {
            pending = true; notify();
            try {
                if (window.linuxRuntime) {
                    const response = await fetch('/api/automation/pause', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Octopus-Access-Key': getLinuxAccessKey() }, body: JSON.stringify(action === 'pause' ? { action, hours } : { action }) });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Unable to change pause state');
                    accept(result);
                } else {
                    await inFlight.catch(() => {});
                    const next = { paused: action === 'pause', startedAt: action === 'pause' ? new Date().toISOString() : null,
                        until: action === 'pause' && hours !== null ? new Date(Date.now() + hours * 3600000).toISOString() : null, revision: (state.revision || 0) + 1 };
                    localStorage.setItem(key, JSON.stringify(next)); accept(next);
                    log(action === 'pause' ? 'automation_paused' : 'automation_resumed');
                }
                return state;
            } finally { pending = false; notify(); }
        },
        write(operation) {
            const task = inFlight.catch(() => {}).then(() => {
                if (window.automationControl.isPaused()) throw new Error('Automation is paused. Use the FoxESS app, or resume automation first.');
                return operation();
            });
            inFlight = task;
            return task;
        }
    };
    // The Pi cannot use a browser-local pause as its authoritative state.
    localRefresh();
    window.addEventListener('storage', event => {
        if (!window.linuxRuntime && event.key === key) { const previous = state.paused; localRefresh(); notify(); if (previous && !state.paused) window.dispatchEvent(new CustomEvent('automation-resumed')); }
    });
    setInterval(() => { void refresh(); }, 5000);
})();
