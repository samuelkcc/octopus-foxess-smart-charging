# Smart Charging 2.3.0 Preview

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
