# ESP32 Setup for macOS and Windows

This app contains the same USB setup website and firmware as the GitHub Pages edition.
The app uses a local, loopback-only asset server and an isolated Electron window.
It does not run a charging worker or a public tunnel.
Closing setup does not stop the ESP32 worker.
No service credentials are stored by the desktop host.

## Supported board

Use **ESP32-S3 N16R8**, with **16 MB Flash** and **8 MB Octal PSRAM**.
Other ESP32 models are not supported by this firmware.
Before installing firmware, confirm the complete board specification.
The firmware installer also checks the chip and flash capacity.
The PSRAM specification requires operator confirmation.

## Open on macOS

1. Extract the macOS Universal ZIP.
2. Open **Smart Charging ESP32 Setup.app**.
3. Connect the supported board through its USB data port.
4. Select **Connect ESP32**.
5. Select the USB serial device.
6. Check that firmware shows **Verified**.

The Universal app includes Apple Silicon and Intel executables.
This local test build is ad-hoc signed and not Apple notarised.
USB selection excludes Bluetooth virtual ports.

## Open on Windows

1. Open the Windows x64 portable EXE.
2. Connect the supported board through its USB data port.
3. Select **Connect ESP32**.
4. Select the USB serial device.
5. Check that firmware shows **Verified**.

The EXE does not require installation or administrator access.
Native Windows USB behaviour requires verification on Windows.

## Setup and dashboard

Follow the same four setup steps in all three editions.
When ESP32 automation is enabled, disable it before changing network or service settings.
Reconnect USB setup after changing the automation state.
Configuration is saved only after the device tests pass.
Open the ESP32 local IP on your phone or computer to use the dashboard.
LAN protection defaults to off.
If required, enable **Settings → LAN access** in the dashboard.
There is no pairing code.
Physical USB recovery can reset forgotten optional LAN protection.

## Build

1. Build the firmware with `esp32/README.md`.
2. Run `npm ci`.
3. Run `npm ci --prefix desktop`.
4. For macOS, run `npm run build:esp32-setup:mac`.
5. For Windows, run `npm run build:esp32-setup:win`.

The retained downloads are in `.build/esp32-setup-vVERSION/`.
The web directory is `dist/esp32-deploy/`.
The manual GitHub Actions workflow builds web, macOS, and Windows artifacts.
The Pages workflow places the USB website at `/esp32/`.
Building locally does not publish anything.

Copyright (C) 2026 SCKC. GPL-3.0-or-later.
Independent software. Not endorsed or supported by Octopus Energy or FoxESS.
