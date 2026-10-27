# Smart Charging v2.0.0

A new shared interface for Raspberry Pi, Windows portable, and standalone web use.
The app connects Intelligent Octopus Go charging windows to FoxESS battery schedules.

## New functions

- Windows portable app with an embedded dashboard, local server, and automation worker.
- Protected Cloudflare remote access with a separate 256-bit key and expiring browser sessions.
- Compact mobile Welcome and dashboard layouts, responsive desktop pages, and light/dark artwork.
- Four history charts, chart expansion, CSV export, and storage reporting on Pi and Windows.
- Compressed monthly history, hourly memory-buffer saves, 12-month default retention, and low-space cleanup below 4 GB.
- Operator pause for 6, 12, or 24 hours, or until resumed, with a red banner and history entry.
- Equal API health buttons with interval progress, individual refresh requests, and retained incident alerts.
- Native Pi service enable/disable for testing another host without competing API connections.
- Saved web setup returns directly to Connect. Windows includes account instructions and LAN-code visibility.
- About and licence drawer with project background, developer details, GPL text, and component notices.

## Reliability

- Pi dashboard clients read a protected host snapshot without another Octopus login or a 60-second queue.
- Pi outbound Octopus requests retain a shared, durable 60-second minimum gap.
- Web and Windows login have no artificial request gap. Real API rate-limit responses remain enforced.
- Routine refresh settings cannot go below 60 seconds for Octopus or 600 seconds for FoxESS.
- Changed valid Smart Dispatch schedules reconcile immediately, with a fresh official FoxESS REST confirmation.
- Operator pause blocks all app schedule writes. Invalid dispatch responses retain the last valid schedule.

## Downloads and updates

- The hosted web app uses the redesigned interface. Downloaded HTML still supports a personal Google Apps Script relay.
- Existing Pi updater asset names remain compatible. Pi updates preserve configuration and history.
- The Windows EXE targets x64 and is unsigned. Keep the app and PC running for automation.
- Quick Tunnel URLs change after a tunnel or host restart. Use Pi Connect to recover the new URL and key.

## Verification

The automated suite covers scheduler safety, authentication, request budgets, history, service control, GAS transport, and desktop IPC.
The user tested the web and Windows editions, including Windows 11 ARM through UTM.
Final interface changes use mock account data for browser checks and public screenshots.
Tests do not prove measured behaviour on every FoxESS model or independent Windows DPAPI certification.

[Setup and screenshots](https://github.com/samuelkcc/octopus-foxess-smart-charging#readme)
