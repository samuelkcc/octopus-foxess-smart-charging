# 2.5.3 — 6 November 2026

HTML Welcome keeps its existing setup, restore, and connection actions without links to other editions.
Each account step now provides expandable setup instructions.

The ESP32 setup video is available beside Web Deploy in the README.
The 4-minute-48-second tutorial includes English narration, captions, and chapter navigation.

Fix the diagnostics listener for IPv4 clients represented as mapped IPv6 peers by ESP-IDF.
Private IPv4 restrictions, Host checks, proxy rejection, and independent Bearer authentication remain required.
Global IPv6 and public IPv4 peers remain blocked.

Read the existing FoxESS schedule after startup, independently of the first Octopus request.
Monitoring does not wait for tariff discovery or enable schedule writes without fresh dispatch data.
Native regressions cover both socket representations and startup monitoring before any Octopus call.

Physical Wi-Fi OTA from 2.5.2 to 2.5.3 preserved every saved rule and restored official REST confirmation.
The schedule appeared before the first Octopus request. The startup GitHub check completed once.
Authenticated diagnostics returned safe RAM data. Anonymous access was denied. The temporary key was revoked.
Native Windows execution remains unverified. The user approved publication of the setup tutorial.

# 2.5.2 — 6 November 2026

ESP32 direct entry keeps Welcome hidden while the first authenticated state request is pending.
Optional account metadata now follows pending tariff discovery. Octopus requests remain at least 60 seconds apart.
Dashboard status includes tariff stages, cache counts, attempt times, completion times, and failure counts.
Empty FoxESS schedules explain when no dispatch or ordinary rule requires a period.
Schedule commits retry fresh REST readback without repeating the write or waiting for telemetry polling.
Successful saves use a short confirmation without revision details.
ESP32 checks GitHub after startup, then every 24 hours. A header badge links to available updates.
Settings can disable automatic checks. This choice survives restart. Dashboard opening sends no update request.
Automatic checks never install firmware or change automation enablement.

Settings adds optional read-only LAN diagnostics on a separate port, with 8788 as the default.
A random 256-bit Bearer key expires after one hour. Disable, rotation, and restart revoke access.
The connection details keep the key outside the URL. LAN HTTP is unencrypted.
Structured numeric events use RAM for up to 24 hours, with a 512-event limit.
Diagnostic responses exclude account details, credentials, browser sessions, and raw cloud responses.
No diagnostic route sends upstream requests or changes settings or inverter schedules.

Native mocks verify authentication, expiry, revocation, rate limits, bounded retention, redaction, and blocked mutations.
The user confirmed a physical OTA update from 2.5.0 to 2.5.1 succeeded.
The new diagnostic listener and native Windows runtime still require physical verification.
The tutorial remains a private preview pending approval.

# 2.5.1 — 6 November 2026

New ESP32 deployments start automation after verified Wi-Fi and IP settings are saved.
Existing disabled rules and operator Pause remain unchanged through edits, restarts, and OTA.
OTA uses a temporary control hold without rewriting saved enablement or Pause.
Failed updates restore control with fresh dispatch and REST reads. Successful updates resume the saved state after boot verification.
Clean update still requires setup again. Firmware 2.5.0 requires manual Pause for its first OTA update.
Settings cards use independent columns to remove empty row gaps. Mobile uses one column.
Native regression tests cover activation persistence, storage failure, existing Pause, update suspension, failed downloads, and boot verification.
Physical OTA and native Windows execution remain unverified.

# Smart Charging 2.5.0

ESP32 can update firmware from this project’s GitHub release through local Dashboard General settings.
An initial USB installation is required for older firmware. No Cloudflare or remote relay is involved.
Updates verify TLS, the release manifest, application size, SHA-256, model, project name, and version before selecting the inactive slot.
The bootloader retains a new OTA image only after startup checks and a working local connection.
Default updates keep settings. Optional Clean update requires exact ERASE confirmation and requires USB setup again after deletion.
No unattended automatic firmware installation is enabled.

ESP32 deployment verifies Wi-Fi and IP before saving. API and optional cloud-login validation no longer block deployment.
Dashboard Account setup provides Save accounts and one sequential Test all APIs action. Failed checks retain entered fields.
API badges report HTTP errors and semantic failures, including service errors returned with HTTP 200.
Failed-service badges prompt users to correct credentials in Account setup.

FoxESS preparation instructions explain Mode Scheduler, low-cost Force Charge, and Remaining Time Mode → Self-Use.
Tests use mock serial devices, cloud responses, storage, and inverter schedules. No live board is erased, flashed, or updated over the air for verification.
Native Windows execution and physical hardware behaviour remain verification limits. The tutorial remains unpublished pending the revised flow.

# Smart Charging 2.4.4

The deployment tool now has two entries: New setup / Reinstall and Edit settings.
New boards install firmware before the setup connection becomes available.
Verified installation continues directly to connection and configuration.

New setup and reinstall erase all board settings and History after explicit consent and exact ERASE confirmation.
They do not change the schedule stored on the inverter. New firmware starts with automation disabled.
Use Edit settings to read and modify the existing configuration without erasing the board.

Verification uses mock serial devices and bootloaders. No real board is erased for release testing.
The tutorial remains withheld until its instructions match this flow.

# Smart Charging 2.4.3

ESP32 Account setup uses SVG eye buttons with separate space beside each input.
The controls retain entered text when visibility changes. Page exit clears and masks these fields.
Desktop and narrow-screen layout checks cover all six fields.

The README restores ESP32 details, donation links, and a short credentials checklist.
A separate preparation guide explains Octopus API access, FoxESS API tokens, and optional WebSocket login.

The tutorial remains private for narration review. Physical iPhone Home Screen icon display was confirmed by the user.
Native Windows execution and long-term Flash endurance remain verification limits.

# Smart Charging 2.4.2

The README starts with HTML Dashboard and ESP32 Web Deploy. Each edition has a separate setup guide.
Installation details no longer form one long README.
All interface screenshots use dark appearance and demonstration data.

The installer lists each unmet condition beside its button.
Normal reinstall keeps saved settings. Optional Clean install erases the ESP32 settings and History.
Clean install requires explicit deletion consent and the exact word ERASE.
All downloads and target hardware are verified before erasure starts.
The inverter's existing schedule remains unchanged. New firmware starts with automation disabled after Clean install.

Installation flows are verified with mock hardware. No live board was erased during release testing.
Native Windows execution and long-running Flash endurance remain verification limits.

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
