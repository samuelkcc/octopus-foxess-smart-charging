/* Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later */
(() => {
    const clock = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const display = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short',
        year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const civil = seconds => {
        const p = Object.fromEntries(clock.formatToParts(seconds * 1000).map(part => [part.type, part.value]));
        return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, minute: Number(p.hour) * 60 + Number(p.minute) };
    };
    function parse(date, time) {
        const utc = Date.parse(`${date}T${time}:00Z`) / 1000;
        if (!Number.isFinite(utc)) return null;
        const candidates = [utc, utc - 3600].filter(seconds => {
            const local = civil(seconds);
            return local.date === date && local.time === time;
        });
        return candidates.length === 1 ? candidates[0] : null;
    }
    const nextDay = date => new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);

    function ranges(slot, now) {
        const first = civil(slot.start), last = civil(slot.end), today = civil(now);
        const start = first.date === today.date ? first.minute : 0;
        if (last.date === today.date) return [[start, last.minute]];
        return [[start, 1440], [0, last.minute]];
    }

    function formatSlot(slot) {
        const sameDay = civil(slot.start).date === civil(slot.end).date;
        return `${display.format(slot.start * 1000)} – ${sameDay ? civil(slot.end).time : display.format(slot.end * 1000)} UK`;
    }

    function mount(host, request, renderOverview) {
        if (!host) return null;
        host.innerHTML = `
            <h2 class="next-panel-title">One-off Force Charge</h2>
            <div class="one-off-charge-rows"></div>
            <button type="button" class="next-button secondary one-off-charge-add">Add one-off charge</button>
            <p class="one-off-charge-message" role="status"></p>
            <dialog class="dev-review-dialog" aria-label="Add one-off charge">
                <form>
                    <h2>Add one-off charge</h2>
                    <p>Use UK time. The period runs once while automation is enabled.</p>
                    <label class="next-field">Date<input type="date" name="chargeDate" required></label>
                    <div class="one-off-charge-times">
                        <label class="next-field">Start time<input type="time" name="chargeStart" required></label>
                        <label class="next-field">End time<input type="time" name="chargeEnd" required></label>
                    </div>
                    <p class="one-off-charge-overnight" hidden>The end time is on the next day.</p>
                    <p class="one-off-charge-message" role="status"></p>
                    <div class="dev-dialog-actions">
                        <button type="button" class="next-button secondary">Back</button>
                        <button type="submit" class="next-button">Confirm &amp; save</button>
                    </div>
                </form>
            </dialog>`;
        const list = host.querySelector('.one-off-charge-rows');
        const add = host.querySelector('.one-off-charge-add');
        const message = host.querySelector('.one-off-charge-message');
        const dialog = host.querySelector('dialog');
        const form = dialog.querySelector('form');
        const feedback = form.querySelector('[role="status"]');
        const overnight = form.querySelector('.one-off-charge-overnight');
        const [back, submit] = form.querySelectorAll('button');
        const { chargeDate, chargeStart, chargeEnd } = form.elements;
        let lastKey, latestRevision = -1, lastUptime, busy = false, readFailed = false;
        const instant = () => Math.floor(Date.now() / 1000);
        const isOvernight = () => chargeStart.value && chargeEnd.value && chargeEnd.value < chargeStart.value;
        async function change(update, status) {
            if (busy) return;
            busy = true;
            submit.disabled = back.disabled = true;
            status.textContent = 'Saving…';
            try {
                render(await request(update));
                status.textContent = '';
                message.textContent = update.action === 'add' ? 'One-off charge saved.' : 'One-off charge cancelled.';
                if (update.action === 'add') dialog.close();
            } catch (error) {
                status.textContent = error.message;
            } finally {
                busy = false;
                submit.disabled = back.disabled = false;
            }
        }
        function render(state) {
            if (!state || !Array.isArray(state.slots)) return;
            if (Number.isFinite(state.uptime)) {
                if (state.uptime < lastUptime) latestRevision = -1;
                lastUptime = state.uptime;
            }
            if (Number.isInteger(state.revision)) {
                if (state.revision < latestRevision) return;
                latestRevision = state.revision;
            }
            if (readFailed) {
                readFailed = false;
                message.textContent = '';
            }
            const now = instant(), slots = state.slots.filter(slot => slot.end > now).sort((a, b) => a.start - b.start);
            renderOverview?.(slots, now);
            const key = JSON.stringify([slots, slots.map(slot => slot.start <= now), state.cleanup]);
            if (key === lastKey) return;
            lastKey = key;
            list.replaceChildren();
            if (!slots.length) list.textContent = 'No one-off charges scheduled.';
            for (const slot of slots) {
                const row = document.createElement('div'), details = document.createElement('span');
                const type = document.createElement('strong'), times = document.createElement('small');
                const cancel = document.createElement('button');
                row.className = 'overview-schedule-row';
                type.textContent = slot.start <= now ? 'One-off · Window open' : 'One-off · Scheduled';
                times.textContent = formatSlot(slot);
                cancel.type = 'button';
                cancel.className = 'next-button secondary';
                cancel.textContent = 'Cancel';
                cancel.setAttribute('aria-label', 'Cancel one-off charge on ' + times.textContent);
                cancel.addEventListener('click', () => void change({ action: 'cancel', ...slot }, message));
                details.append(type, times);
                row.append(details, cancel);
                list.append(row);
            }
            if (state.cleanup && !slots.some(slot => slot.start <= now)) {
                const pending = document.createElement('p');
                pending.textContent = 'Waiting for FoxESS schedule cleanup.';
                list.append(pending);
            }
        }
        add.addEventListener('click', () => {
            form.reset();
            chargeDate.min = civil(instant()).date;
            chargeDate.max = '2100-12-31';
            feedback.textContent = '';
            overnight.hidden = true;
            dialog.showModal();
        });
        back.addEventListener('click', () => dialog.close());
        dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
        form.addEventListener('input', () => { overnight.hidden = !isOvernight(); });
        form.addEventListener('submit', event => {
            event.preventDefault();
            const date = chargeDate.value;
            const start = parse(date, chargeStart.value);
            const end = parse(isOvernight() ? nextDay(date) : date, chargeEnd.value);
            if (start === null || end === null) {
                feedback.textContent = 'Choose an unambiguous UK time outside the clock-change hour.';
            } else if (start < instant() || end <= start || end - start > 86400) {
                feedback.textContent = 'Select a future start and different end time, up to 24 hours apart.';
            } else {
                void change({ action: 'add', start, end }, feedback);
            }
        });
        list.textContent = 'Loading saved charges…';
        host.hidden = false;
        return { render, unavailable: () => { readFailed = true; message.textContent = 'Could not read saved charges.'; } };
    }
    window.oneOffCharge = { civil, parse, ranges, formatSlot, mount };
})();
