# Maintenance guide

## Versions

The current release version is 2.1.0.
New versions use MAJOR.MINOR.PATCH.
Legacy calendar versions remain in the release history.
The development branch is `codex/ui-ux-preview`.
A development commit does not publish GitHub Pages or create a release.

## Code boundaries

| File | Responsibility |
|---|---|
| `esp32/main/wifi_reconnect.c` | Independent ESP32 station reconnection, bounded backoff, and IP-acquisition watchdog. |
| `src/app.js` | Shared account, tariff, scheduler, storage, and dashboard behaviour. |
| `src/gas-relay.gs` | Canonical Google relay source. The HTML build embeds this code in setup help. |
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
| `src/price-display.js` | Browser-local manual currency conversion for presentation only. |
| `dev/lan-remote.js` | Code-protected LAN tunnel management without the desktop administration bridge. |
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

The public updater installs the latest published release.
Release staging repacks the Pi archive after the shared interface build.
Existing release asset names remain compatible.

Dashboard clients read `/api/dashboard-snapshot`.
This protected endpoint reads the last successful combined worker response from memory.
It never authenticates with Octopus or consumes an outbound request slot.
Before the first worker response, clients show pending server data.

The DEV installer accepts a complete Git commit ID.
It creates a private configuration backup before the service change.
It retains the previous runtime and creates a rollback command.
The UI-only updater does not restart the service or the tunnel.
The About panel shows the UI commit when the build receives that value.

## Release checks

The [feature review](FEATURE-PARITY.md) records completed checks and open release work.
A successful mock test does not prove real inverter behaviour.
A matching REST readback confirms the written schedule, not measured battery power.

Before each release, check update compatibility and preserve rollback information.
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
Recovery retains the alert until acknowledgement or the configured expiry period.
The default period is 24 hours from the last failure.
Expiry never removes an active failure.
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


## API request budgets

`linux/request-budget.mjs` provides the shared queue and duplicate-request cache.
The browser build embeds the same implementation.
`src/request-policy.js` connects standalone requests to that queue.
The Pi proxy owns one queue for all connected clients.

On Pi, every outbound Octopus request consumes one slot.
Its authentication, dispatch, account, and tariff requests remain at least 60 seconds apart.
The Pi persists only the next permitted send time.
A Pi restart waits at least one full interval, including a one-second safety margin.
The next in-memory slot is measured after reservation storage completes.
Browser storage and Web Locks coordinate tabs on the same origin where supported.
Independent browsers and other applications cannot share this local budget.

Web and Windows have no artificial gap between login requests.
Both retain request deduplication, authentication caching, and actual API rate-limit cooldowns.
Their routine refresh setting still has a 60-second minimum.
Saved web setup opens Welcome with Connect and Modify setup actions.
It does not automatically connect or repeat the setup wizard.

The first Pi connection can require several minutes.
Tariff loading runs separately from dispatch reconciliation.
A combined GraphQL response serves Pi worker and dashboard reads.
Visible clients still use the authoritative worker snapshot for dispatch confirmation.
Rate-limit responses delay the entire Octopus queue.
A failed dispatch response does not clear the last valid schedule.

Routine FoxESS endpoint reads share a cache for at least 600 seconds.
A successful schedule command invalidates that cache.
Fresh scheduler verification is allowed for 30 seconds after a successful command.
The normal worker countdown restarts after command acceptance.
Explicit pause still blocks schedule writes.


## Windows desktop host

`desktop/main.cjs` owns the desktop window, hidden automation worker, and utility service process.
The service reuses `linux/server.mjs` with explicit data and asset directories.
Windows does not depend on systemd, Python, or an external browser.
The desktop window uses isolated, sandboxed preload IPC.
Only its main frame can use administration operations.
LAN and tunnel clients have no desktop administration bridge.

`dev/desktop.js` provides desktop account setup and Remote Access controls.
The shared navigation module registers that additional page.
The Pi account administration remains unchanged.
The standalone web edition retains Google Apps Script transport.

Electron safeStorage protects the desktop AES key with Windows user encryption.
A private utility-process message transfers the key into service memory.
The service does not write that raw key to disk.
Windows user-profile storage retains history and configuration across EXE replacement.
The desktop build uses separate service staging so Pi output remains independent.

The app starts one worker and holds a single-instance lock.
Minimizing leaves that worker active.
A normal exit stops the worker, flushes history, and stops the local service and tunnel.
The Windows executable uses the same application name and version.
Native Windows verification remains pending.


## Native service control

`linux/service-control.mjs` owns persistent service enablement and a request generation.
Its independent state file avoids configuration-write races.
Native Configuration uses a loopback-only endpoint.
The remote listener and dashboard configuration API cannot change enablement.

Disabled services reject upstream requests before entering a transport queue.
Queued operations also check the generation immediately before sending.
Live WS stops and cannot start a new portal login while disabled.
The worker still checks local configuration so enablement can resume operation.
A disabled service keeps its local administration server available.
History records both service state changes.
Explicit automation pause remains separate and continues monitoring.

## Remote URL recovery

The host-only remote access endpoint accepts an explicit `renewUrl` operation.
It restarts the dedicated Quick Tunnel without changing the remote key.
Remote clients cannot invoke this operation.
The manager waits for a registered Cloudflare connection before publishing the URL as ready.
A startup that does not connect within two minutes restarts through the existing retry path.
Old process output cannot restore a replaced URL.

Alert expiry preferences use the integration state file on Pi and Windows.
Standalone web preferences use browser storage.
Authenticated dashboards can change the period through an explicit settings allowlist.
A warning badge opens its incident dialog without invoking the refresh path.

## Optional web Octopus relay

Direct Octopus access remains the default for existing browser configurations.
The operator can select Safari compatibility during setup or in Settings.
That choice sends Octopus credentials and API data through the operator's Google relay.
Pi and Windows always retain the local host transport.

A credential-free capability request checks the deployed relay before Octopus forwarding.
The relay permits listed Octopus reads, Octopus GraphQL POST, and the existing four FoxESS operations.
Redirects at the upstream boundary are disabled.
Octopus replies retain their HTTP status and Retry-After value in a JSON envelope.
The browser unwraps that envelope before the engine reads the data.
The normal request policy still handles authentication caching and actual rate limits.

## Tariff presentation and diagnostics

Tariff completion renders prices directly without another dashboard request.
Missing rates remain unavailable. The chart must not invent a zero price.
Failed updates retain available rates for the same agreement and retry after one minute.
Every retry still passes through the existing host or browser request policy.
Successful tariff reads retain the 30-minute cache.

Integration state retains the latest 100 error groups.
Healthy polling adds no diagnostic entries.
Repeated failures update their group through the existing persistence throttle.
Host records use the existing private integration-state file.
Browser records use the existing local integration-state storage.
Diagnostic exports contain generic error categories, timestamps, counts, and tariff loading metadata.
They contain no raw upstream messages, account identifiers, credentials, serial numbers, or private URLs.
Exporting a diagnostic file does not request upstream data.


## Shared tariff snapshot

Only the host worker reads account and tariff data for hosted dashboards.
The authenticated tariff snapshot endpoint performs no upstream request.
Only an explicit loopback worker can publish its allowlisted numeric rates and timestamps.
Publication is ordered. Each completed direction becomes visible while other requests remain queued.
The worker starts tariff work after dispatch reconciliation.
Public unit-rate responses have a private restart cache with a strict 30-minute expiry.
Account replies and authentication tokens are excluded.
The cache does not bypass service disablement or outbound spacing for expired data.

## Price transport diagnostics

Host snapshots include a host instance, revision, publication time, and delivery time.
Browser diagnostics record receipt, rendering, and separate read or rendering failures.
Snapshot failures retain available prices and retry through the existing five-second local poll.
Chart errors cannot cancel that poll.
Returning to a visible dashboard also reads its host snapshot.
These recovery reads do not request upstream data.
The host retains 40 sanitised request summaries in RAM.
Only categories, source, start time, completion time, and HTTP status are included.
The existing error journal remains separate and error-only.

## Display currency

Browser preferences store a manual currency code, symbol, and exchange rate against GBP.
Conversion uses UK pence divided by 100, multiplied by the selected rate.
The chart receives converted presentation values without modifying source rates.
Rule inputs and schedule comparisons remain in UK p/kWh.
Converted reference hints appear beside rule inputs.
This preference does not change API hosts, account regions, or tariff time zones.

## LAN remote management

The dedicated LAN management endpoint requires enabled LAN protection and the actual LAN code on every request.
Loopback privileges and remote sessions cannot replace that code.
The endpoint rejects public hosts, non-private source addresses, cross-site requests, and excess authentication failures.
The dedicated tunnel listener rejects the endpoint before authentication.
Only an explicit reveal request returns the remote key.
Status and mutation responses exclude the key.
The interface retains its management code in memory for at most five minutes.
Page exit or backgrounding clears its displayed key and code.
Native Pi and Windows administration remains available through existing interfaces.


## Browser activity backups

`src/activity-store.js` owns the existing browser activity key and validates backup files.
`dev/activity.js` provides the standalone Activity view and JSON export/import.
Imports merge records without restoring pause state, credentials, or automation settings.
Only pause, resume, and timed-pause expiry events are accepted.
The limit is 12 months or 2,000 records.
Import files have a one-megabyte limit.
Pi and Windows keep the host History view.

## Restart display recovery

`linux/tariff-snapshot-cache.mjs` stores the last complete tariff publication with owner-only permissions.
A credential fingerprint isolates accounts without storing their credentials in the display cache.
Display recovery expires after 24 hours.
Pending publications can retain cached rates only for the same agreement.
Clients label those prices as last-known data.
Cached display values remain separate from scheduler price arrays and live-price inputs.
The worker never reads this display recovery endpoint.
Fresh publications replace the cached display without changing the upstream request budget.

The Pi desktop launcher selects Wayland when its socket exists.
It otherwise uses an available X11 display.
It changes to the user's home directory before Chromium starts.


## macOS desktop host

The macOS Universal app reuses the desktop host and private administration bridge.
Electron safeStorage uses macOS Keychain instead of Windows encryption.
The Universal app and bundled cloudflared include arm64 and x86_64 machine code.
Build inputs use pinned Cloudflare archive hashes.
The macOS build has an ad-hoc signature and no Apple notarisation.
Both platforms stop their service and tunnel when the app closes.

## ESP32 dashboard boundary

The ESP32 uses the shared Overview component in `dev/views.js`.
The web, Pi, and desktop editions use that component with their existing engine IDs.
The shared CSS and `dev/viewport.js` control sizing and desktop layout.
The ESP32 adapter maps a worker snapshot to those elements.
It does not load or run the browser scheduler.

The existing Chart.js version is embedded in the firmware dashboard bundle.
Tariff series keep the shared green import and blue export styles.
Stable series and schedule rows do not rebuild during unchanged snapshot polls.
Interface changes do not add cloud API requests.

The firmware keeps transport, automation policy, persistent settings, and RAM History in separate modules.
The background worker owns unattended inverter writes.
Dashboard clients read snapshots and submit reviewed operator changes.
A complete scheduler rewrite is not required for these interface changes.

LAN protection is optional and disabled on a new deployment.
When enabled, its salted PBKDF2 access-code hash is separate from service credentials and browser-session hashes.
Physical USB can reset optional LAN protection without a pairing code.
Host, Origin, proxy rejection, and mutation CSRF checks also apply without LAN protection.
The operator deferred ESP32 remote access to keep shared-user installation simple.
This edition provides local-network access only. No relay service is deployed.
A future remote transport must have a separate authentication boundary.

## ESP32 setup hosts

The web, macOS, and Windows setup tools share `prototype/esp32-usb-test/`.
Native hosts embed the generated website and firmware manifest.
They do not run the desktop charging service or start a tunnel.
The desktop host serves an explicit asset allowlist on an ephemeral loopback port.
Its sandboxed renderer receives no Node.js or general IPC access.
Serial permission is restricted to the setup window and its exact origin.
A native dialog requires explicit USB selection and excludes Bluetooth virtual ports.
The supported firmware target is ESP32-S3 N16R8 with 16 MB Flash and 8 MB Octal PSRAM.

## Shared dashboard presentation

`dev/ui.js` owns common page headings, About navigation, and the Pause switch and banner.
`dev/views.js` composes Overview and Connections through shared functions.
Edition adapters supply existing data nodes and retain their original IDs.
Host-specific configuration stays in Settings.
ESP32 Settings includes its persistent enablement, USB network guidance, and RAM information.
Pause switches display confirmed state. Opening or cancelling a dialog does not change that state.
The existing control adapters perform mutations. They retain fresh-data requirements before resuming schedule reconciliation.

The circular automation control uses confirmed state. Green means running. Red means paused.
The control opens a confirmation dialog and does not shut down its host.
About uses one renderer for edition details and a searchable runtime-component inventory.
Firmware licence texts load from the local bundled SDK endpoint when an entry opens.

## ESP32 optional Flash History

`history_store.c` owns a dedicated, versioned 64-byte hourly journal.
`history_flash.c` restricts I/O to the appended 128 KiB History partition.
Existing configuration and firmware partition offsets stay unchanged.
The module scans storage without formatting or writing.
Checksums, commit markers, and readback separate committed observations from interrupted writes.
Sector rotation keeps a complete 60-day window, with additional sector headroom.
The API excludes expired observations. This is retention filtering, not a secure-erasure guarantee.

RAM still collects live 15-minute averages through existing telemetry requests.
The separate `history_flash_enabled` preference defaults to false.
Legacy settings receive that default without resetting automation, Pause, or existing rules.
When enabled, the worker saves a count-weighted hourly average after the hour completes.
The monotonic timer limits attempts to one batch per hour, including failures and preference toggles.
A reboot recovers committed observations. It cannot recover unsaved RAM readings.
History reads combine cached hourly records with recent RAM records without duplicate hourly points.
HTTP reads do not access Flash or request more upstream data.
The bounded local commit shares the settings lock, so disabling saving cannot acknowledge before an in-flight commit finishes.
History failures are reported separately from schedule-control persistence failures.

## ESP32 local presentation and read commands

The ESP32 dashboard uses the shared Welcome, Overview, Connections, Pause, and About composition helpers.
Its worker exposes cached account metadata separately from credential-free dashboard state.
The account response uses an explicit field allowlist.
Header refresh commands enqueue reads. HTTP handlers do not perform cloud calls or program schedules.
The worker coalesces repeated commands and respects service cooldowns.
Octopus timestamp normalization precedes dispatch comparison and publication.
A space separator never changes the explicit UTC offset.
Optional account queries cannot invalidate valid dispatch state.

## ESP32 USB configuration readback

Config Password is independent from LAN authentication.
The `config_access` module owns its salted PBKDF2 record and attempt delay.
A missing record preserves the legacy unprotected default.
Corruption blocks reads rather than disabling protection.
Only UART command handling calls credential readback.
HTTP state, account metadata, and service-job status never return service secrets.
Skipping unlock never resets an existing password.
The setup page populates masked inputs directly and never renders secret responses as diagnostics.

`docs/USER-GUIDE.md` is the canonical offline guide.
`dev/guide.js` renders safe text and creates the left-menu drawer.
Build scripts embed the guide in dashboard and setup artifacts.

## Settings categories and ESP32 home-screen assets

`dev/settings.js` owns the shared General settings and Account setup tabs. Existing controls retain their IDs and listeners.
ESP32 service cards move outside the general-preferences form. API saves remain separate from automation-rule submission.
`dev/desktop.js` adds its account editor only when the native administration bridge exists. Remote clients never receive that bridge.
ESP32 serves embedded PNG icons and a local web manifest before login. The same local Host and proxy checks protect asset routes.
Icon responses contain no credentials or application state. Bluetooth remains disabled.

## ESP32 HTTP recovery

Dashboard GET requests copy the worker's published RAM snapshot.
They do not reset tariff stages, invalidate cached rates, or enqueue cloud work.
Only explicit refresh actions use the refresh endpoint.
The state includes uptime and successful tariff-read timestamps for diagnostics.
After reboot, the worker rebuilds RAM caches through its serialized request queue.

Dashboard responses advertise Connection: close and finish before the server closes each session.
Idle mobile browser pools cannot retain the three HTTP slots. Cloud API transport is separate.
Local JSON reads have a 12-second deadline, including body decoding. Abort is supplemented by a deadline race.
State refreshes coalesce. Hidden-page reads are cancelled, while submitted changes are neither cancelled nor automatically replayed.
Foreground, online, and restored-page events request fresh state. Late abandoned replies cannot change authentication or device state.
A separate boot guard retains a reload screen if the application bundle cannot initialize.

## ESP32 GitHub OTA

`ota_update.c` owns download state, inactive-slot writes, boot selection, and startup confirmation.
`ota_policy.c` validates the fixed project manifest, semantic version, model, size, hash, and permitted HTTPS hosts.
The LAN API uses existing origin, session, and CSRF checks. It queues explicit check or install actions.
The worker runs OTA under the shared network lock. Installation sets a volatile control hold and requires no pending schedule recovery.
The hold blocks reconciliation, manual commands, and diagnostic recovery without rewriting persisted rules or operator Pause.
A healthy new boot restores the saved state. Failed installation requires fresh dispatch and REST data before control resumes.
No dashboard client downloads firmware or receives service credentials.

`esp32/ota-release.json` freezes the reviewed release binary digest. Pages copies this record rather than hashing its separately rebuilt USB artifact.
Download length, SHA-256, SDK image validation, application identity, and persistent intent must pass before boot selection.
The currently running partition is never used as the download target.

The bootloader uses pending-image rollback. Startup confirms the image after 30 seconds with a healthy server and local connection.
After 120 seconds without those conditions, it requests rollback.
Clean OTA records the intended partition and version. It erases settings only after that exact image is confirmed healthy.
A rollback image does not match the intent and does not erase configuration.
The default update retains configuration. USB recovery remains necessary for some hardware failures.
