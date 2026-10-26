# Maintenance guide

## Versions

The public release is v2026.10.26.5.
The current development version is 2.0.0.
New versions use MAJOR.MINOR.PATCH.
Legacy calendar versions remain in the release history.
The development branch is `codex/ui-ux-preview`.
A development commit does not publish GitHub Pages or create a release.

## Code boundaries

| File | Responsibility |
|---|---|
| `src/app.js` | Shared account, tariff, scheduler, storage, and dashboard behaviour. |
| `src/index.html` | Shared interface elements and their stable IDs. |
| `src/styles.css` | Existing interface appearance. |
| `linux/server.mjs` | Authentication, protected APIs, credential storage, and service integration. |
| `linux/foxess-live.mjs` | Live telemetry and REST fallback. |
| `linux/remote-access.mjs` | Public tunnel, remote keys, and browser sessions. |
| `src/automation-control.js` | Shared pause transport and browser command guard. |
| `linux/automation-pause.mjs` | Persistent pause state, command barrier, expiry, and activity journal. |
| `dev/controls.js` | Pause controls, hardware-limit dialog, and history retention interface. |
| `linux/integration-state.mjs` | Shared service health, retained alerts, and acknowledgement rules. |
| `src/refresh-preferences.js` | Validates and saves API intervals through existing browser and encrypted Pi configuration. |
| `src/integration-monitor.js` | Browser health storage, Pi status polling, and worker refresh requests. |
| `dev/history.js` | History overview charts, expansion, month queries, CSV export, and activity. |
| `dev/monitor.js` | Shared Overview countdowns, manual refresh, and problem dialogs. |
| `linux/history.mjs` | Compact history files, averages, queries, and expiry. |
| `linux/tray.py` | Native Pi settings, remote access, status icon, and graphical update action. |
| `dev/ui.js` | Development navigation, control layout, review, and History view. |
| `dev/about.js` | About panel and complete licence notices. |
| `dev/setup.js` | Edition-specific welcome, guided login, and setup guide. |
| `dev/settings.js` | Settings cards and existing preference controls. |
| `dev/views.js` | New visible views and the shared-engine element adapter. |
| `dev/viewport.js` | Desktop media selection. Native text sizes and flexible CSS regions fill one frame without page scaling. |
| `dev/ui.css` | Appearance of the development interface. |
| `scripts/build-dev.mjs` | Separate Pi and web development builds. |

## Shared interface contract

The shared engine uses existing element IDs and event handlers.
The new views reuse original controls instead of copying their state.
The visible cards and sign-in screen use new markup.
Unused presentation elements remain in one hidden host for engine compatibility.
The adapter reports a missing required element as an error.
A new interface must retain the original input IDs.
The original engine remains responsible for validation, encryption, and scheduler commands.
This adapter is a migration boundary.
A later engine extraction must keep the same safety tests and behaviour.

The Pi build always uses dashboard mode.
It must never start a second unattended scheduler.
The web build retains the original browser automation behaviour.
It must not receive the Pi-only automatic-write restriction.

The two editions have different login requirements.
The web edition requires account credentials and a Google Apps Script relay.
The Pi dashboard requires only the configured access code or remote key.
Pi service credentials must remain in the native settings app.

## History contract

The history module accepts telemetry from the existing service requests.
It does not make an upstream request.
It accepts no more than one fresh observation in each minute.
Each stored interval contains averages and observation counts.
Missing data remains missing.

Routine observations stay in RAM until an hourly batch save.
The user can select a 30-minute interval.
Monthly power archives use atomic gzip replacement and merge records by interval.
The current checkpoint retains sums and sample counts for restart recovery.
The reader accepts previous plain JSONL archives.
Normal shutdown saves the pending buffer.
Sudden power loss can discard the unsaved buffer.
Pause events and preference changes remain durable immediately.

Below 4 GB free space, oldest history expires early.
The newest 24 hours remain protected from automatic space cleanup.
The warning remains active when history cleanup cannot resolve pressure from unrelated files.
Explicit clear removes only recognised history files and buffered readings.
It preserves preferences and unrelated files.

History files use owner-only permissions.
They contain no account credentials or remote keys.
Records expire after 12 calendar months by default.
The administrator can select 1 to 24 months in dashboard Settings.
The service erases expired records every hour and when history is read.
The server keeps automation available if a history write fails.

## Change a feature

1. Read `AGENTS.md`.
2. Identify the module that owns the behaviour.
3. Read the related tests.
4. Change the source files.
5. Add a behaviour test if the change affects safety, authentication, storage, or recovery.
6. Run `npm run check`.
7. Run `npm run build:dev`.
8. Check both editions in a browser.
9. Update the current user guide.
10. Record the verification limits.

Do not change scheduler rules to solve a layout problem.
Do not use a live inverter as a test fixture.
Do not add a new dependency without a concrete need.

## Updates

The native updater installs the latest public GitHub release.
It preserves the Pi configuration directory.
The history directory is inside that configuration directory.

The public updater currently installs v2026.10.26.5.
On DEV, that action returns the Pi to the public edition.
The DEV interface states this difference in Settings.

The DEV installer accepts a complete Git commit ID.
It creates a private configuration backup before the service change.
It retains the previous runtime and creates a rollback command.
The UI-only updater does not restart the service or the tunnel.
The About panel shows the UI commit when the build receives that value.

## Release checks

The [feature review](FEATURE-PARITY.md) records completed checks and open release work.
A successful mock test does not prove real inverter behaviour.
A matching REST readback confirms the written schedule, not measured battery power.

Before a public release, test an update from the last public version on a spare Pi.
Check configuration, access settings, history files, launchers, and rollback.
Publish the redesigned default interface only after the user approves it.

## Browser fixtures

The local fixtures do not forward requests to energy services.
They use dummy account data.

1. Build both DEV editions.
2. Run `node scripts/dev-fixtures.mjs` for Pi checks.
3. Run `node scripts/dev-fixtures.mjs --web` for web checks.
4. Use the URLs printed by the fixture.
5. Use dummy credentials only.

The web relay test URL is `http://127.0.0.1:65524/mock-foxess`.
The fixture path `/test/viewport?width=320` provides a narrow browser frame.
Widths 390, 768, and 1024 are also available.
The Pi frame uses the remote-key login mode.
The path `/test/state` reports mock scheduler writes.

Browser checks must include login, navigation, rule review, setup help, and the full licence text.
The checks must also confirm that each required element ID exists once.

## Operator pause

Pause is an explicit exception to automatic dispatch reconciliation.
The server blocks every FoxESS schedule mutation while paused.
The block applies to the worker and manual dashboard requests.
Pause waits for an already-sent command before it reports completion.
It does not erase the existing inverter schedule.
The user can change that schedule through the FoxESS app.
Monitoring and compact history collection continue.
Timed pauses expire after 6, 12, or 24 hours.
An indefinite pause survives service and device restarts.
After resume, the worker fetches current dispatches and schedules before reconciliation.
The pause journal retains activity that a history write could not save.
History retries must not duplicate the activity entry.
The web edition stores its pause and activity in the current browser.
Its activity limit is 12 months or 2,000 entries.
Use only one active automation browser.

## GAS relay regression checks

`test-web-relay.mjs` runs the shared browser transport against the bundled GAS handler.
The mock handler returns in-memory FoxESS data.
It never sends an upstream request.
The browser fixture uses separate site and relay origins.
It includes a ContentService-style redirect before the JSON response.
These checks cannot prove the permissions or quota of a user deployment.

## Service updates and retained alerts

The shared monitor separates service health from a retained problem alert.
A failed channel remains unhealthy until that channel succeeds.
A successful tariff request must not hide a failed dispatch request.
Recovery keeps the alert until the user acknowledges it.
An active failure cannot be acknowledged as healthy.
The acknowledgement includes an alert ID to protect a newer incident.

The Pi stores alerts in `integration-status.json` with owner-only permissions.
It stores only sanitised problem text, timestamps, and channel state.
The web edition stores its alerts in the current browser.
Pi dashboards combine local transport problems with shared server alerts.

Only the loopback worker can publish authoritative refresh timing.
Dashboard refresh requests advance a server request ID.
The worker receives that request during its normal status exchange.
It then uses the existing refresh and reconciliation path.
A visible client does not become an unattended scheduler.
The pause command barrier remains active during data refresh.

The web telemetry request includes grid import/export and battery charge/discharge power.
Measured zero is valid data.
Missing directional measurements remain unavailable.
Tests use mock upstream responses for outages, recovery, restart persistence, and GAS transport.

## History format rollback

The development installer backs up history before a runtime change.
Older runtimes cannot read gzip archives.
A runtime rollback retains the new files but may not display their archived readings.
The private backup preserves the history format used before the update.
Restoring that backup is a separate recovery action.

## Welcome and desktop layout

Both editions show Welcome when a document opens, including restored sessions.
The entry action changes presentation only.
It does not start a second worker or change authentication.
Desktop pages use native text sizes and flexible card regions.
Small windows can scroll inside a card instead of shrinking its text.
Phone pages retain document scrolling.

Page exit can cancel a pending browser request.
The monitor ignores failures after `pagehide` and resumes normal reporting after `pageshow`.
It does not ignore failures while a page is merely in the background.
Retained alerts identify browser requests separately from Pi service requests.
