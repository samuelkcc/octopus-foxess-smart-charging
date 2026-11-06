# Smart Charging 2.4.1

Mobile help buttons use fixed-size SVG icons with accessible labels.
The User guide uses a lightbulb icon. About uses an information icon.
Desktop sidebar entries retain their labels.

USB Wi-Fi scanning is available while automation runs on current firmware.
Scanning does not save settings or switch networks.
Scan progress and results appear beside the scan button.
Network tests and network replacement still require disabled automation.
Older firmware retains the scan restriction and shows an update hint.

The full check and native firmware build passed. USB scanning found 21 nearby access points without configuration writes.
Rules and operator state matched before and after the application update.

The website presents ESP32 Web Deploy and HTML web app as its two main entries.
Detailed downloads, edition guides, and the interface gallery use separate pages.
Native deployment downloads and chapter-based edition guides appear below.
Mobile toolbars omit the duplicate page name. API badges stay left and the operator switch stays right.

Windows runtime execution remains unverified. Physical inverter behaviour is not established by mock tests.

# Smart Charging 2.4.0 — Unreleased

ESP32 dashboard reads have deadlines and foreground recovery.
HTTP responses close their connections after transmission.
Dashboard reads only copy the worker's RAM snapshot.
They do not start cloud requests or clear tariff caches.
State diagnostics include uptime and successful tariff-read timestamps.

Mobile headers show compact User guide (?) and About (!) buttons.
Desktop layouts retain the sidebar entries.
The same controls open the existing drawers in dashboards and USB deployment tools.

The full check passed with a multiple-dashboard cache regression.
The native regression verifies cache retention after rate limiting.
Live reads confirmed matching import caches from independent clients.
Physical iPhone loading remains under investigation.
Safari Web Inspector is enabled on the connected iPhone.
The iPhone loaded a temporary Mac LAN page while ESP32 requests failed.
The connection failure has no confirmed cause yet.
The new ESP32 default is port 8787. USB deployment tools can save a different port for the next restart.
UK clock changes no longer cause a 24-hour programming blackout.
Auto-Resume remembers completed ordinary charging until its source ends.
Native and Pi differential checks cover these changes without live inverter test commands.
Stable publication and physical iPhone verification remain pending.

# Smart Charging 2.3.1 Preview

ESP32 now runs an independent local worker with a shared dashboard and USB deployment tools.
The public introduction presents ESP32, Pi, Portable app, and Web HTML in that order.

## ESP32 setup

- Supported board: ESP32-S3 N16R8, with 16 MB Flash and 8 MB Octal PSRAM.
- Deploy through the HTTPS USB website, Mac app, or Windows EXE.
- Complete Wi-Fi, IP, clock, and API validation before saving initial setup.
- Read saved USB configuration, with optional Config Password protection.
- Use local Settings → Account setup for Octopus, FoxESS REST, and optional WebSocket credentials.
- Use USB setup for Wi-Fi or IP changes.
- Add the charging icon to iPhone Home Screen through Safari.

## Interface changes

- Render secure HTTPS deployment and download links in the embedded User guide.

- Separate General settings from Account setup on ESP32 and the native portable host.
- Keep portable credential editing restricted to the native app.
- Add chapter navigation to the shared User guide.
- Use shared weekday tiles, Pause controls, and consistent rule separators.
- Refresh documentation screenshots with demonstration data.

## Data and request handling

- Octopus requests use one queue with a minimum 60-second interval.
- Startup tariff discovery can take several minutes.
- Read-only WebSocket tests require a fresh frame.
- Schedule commands and confirmation always use official FoxESS REST.
- History uses RAM by default on ESP32.
- Optional hourly Flash History retains up to 60 days.

## Supported differences and limits

- ESP32 does not support Cloudflare, Bluetooth setup, or OTA updates.
- Bluetooth is disabled at build time.
- ESP32 requires the same LAN for dashboard access.
- Complete Pi scheduler equivalence is not established.
- ESP32 retains the schedule during its UK clock-transition guard and blocks new programming.
- Advanced Auto-Resume handling has documented differences.
- Native Windows and Intel Mac execution require further verification for this build.
- The Mac setup app is ad-hoc signed and not notarized.
- Long-term Flash endurance and continuous WebSocket operation remain unverified.
- REST confirmation proves schedule programming, not measured battery behaviour.

The ESP32 Preview does not replace the stable Pi updater release.
See USER-GUIDE.md and FEATURE-PARITY.md for procedures and verification limits.

Copyright (C) 2026 SCKC. GPL-3.0-or-later.
Independent software. Octopus Energy and FoxESS do not endorse or support this project.

Verification includes the full check, DEV build, native ESP32 suites, and isolated browser layout checks.
New screenshots contain demonstration data only. Native Windows and physical iPhone installation remain unverified.

The USB network test now requests explicit confirmation before disabling automation.
It preserves other rules and Pause. The inverter retains its programmed schedule.
After network setup, enable automation in General settings.

The deployment tool separates New setup, Edit settings, and Reinstall firmware.
Network test errors appear beside the controls. Next explains any required check.
