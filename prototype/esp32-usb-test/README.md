# ESP32 Deploy

This development page installs and configures an ESP32-S3 N16R8 through USB.
Its English interface uses the existing Smart Charging visual style.
The wizard displays one step at a time and retains form data during Back/Next navigation.
The contextual guide changes with each step.
A top-bar About button opens complete licence information in a right-side drawer.
The setup website is separate from the LAN dashboard and firmware worker.
The LAN dashboard opens directly by default. There is no pairing code.
Optional LAN access protection is configured in the dashboard.
The macOS and Windows setup apps embed this website.
See `esp32/desktop/README.md` for native app instructions.

## Supported board

Use **ESP32-S3 N16R8**, with **16 MB Flash** and **8 MB Octal PSRAM**.
Other ESP32 models are not supported by this firmware.

## Local preview

1. Build the firmware with the instructions in `esp32/README.md`.
2. Run `npm run check`.
3. Run `npm run build:esp32-deploy`.
4. Run `node prototype/esp32-usb-test/serve.mjs`.
5. Open `http://127.0.0.1:8789` in desktop Chrome or Edge.

The server listens on loopback only.
It serves an explicit asset allowlist and accepts no configuration requests.
The generated GitHub Pages artifact is `dist/esp32-deploy/`.
It includes firmware, licences, installer code, and a checksum manifest.
Nothing is published automatically.

## Setup

1. Connect the board through its USB-UART data port.
2. Close other serial tools.
3. Select **Connect ESP32**.
4. Select the USB serial device.
5. Check that the firmware handshake shows **Verified**.
6. Select **Next: Network**.
7. Select **Scan Wi-Fi**.
8. Select a 2.4 GHz network.
9. Enter its password.
10. Select **Test Wi-Fi with DHCP**.
11. Select the required IP address mode.
12. Select **Next: Accounts**.
13. Enter the Octopus account and API key.
14. Enter the FoxESS serial number and API token.
15. Select **Next: Verify & save**.
16. Select **Test all & save**.
17. Keep USB connected until the result appears.
18. Return to **Device**.
19. Select **Disconnect**.

For a hidden network, enter its SSID manually.
The temporary Wi-Fi test uses RAM and does not save settings.
The final command checks Wi-Fi, IP, clock, Octopus account REST, and FoxESS telemetry REST.
The firmware commits configuration only after every check passes.
Failed checks preserve the previous persistent configuration.
A successful save clears the form.
Older firmware cannot enable the new save button.

## Optional firmware installation

1. Disconnect the setup session.
2. Expand **First installation or firmware recovery**.
3. Check the board model.
4. Select both acknowledgements.
5. Select **Install firmware**.
6. Select the USB-UART port.
7. Keep USB connected until flash verification finishes.
8. Select **Connect ESP32**.

If the bootloader does not connect, hold BOOT while pressing RESET.
The installer checks ESP32-S3 identity and 16 MB flash capacity.
The operator must confirm the 8 MB octal PSRAM board variant.
The firmware also runs a PSRAM memory test at boot.
The installer verifies every downloaded part with SHA-256 before writing.
It verifies written data through the bootloader's MD5 command.
It never requests a complete flash erase.
Separate images exclude the NVS configuration sectors.
The browser installer uses pinned, self-hosted esptool-js 0.7.1.
Its licences are included in `vendor/`.

## Optional fixed IP suggestion

A router DHCP reservation is the recommended stable-address option.
After the DHCP trial, **Suggest a fixed IP** probes candidates with ARP and ping.
The search starts at `.188` when that address belongs to the actual subnet.
It skips detected devices, the gateway, DNS, current IP, network, and broadcast addresses.
The search has a maximum of 16 candidates.
Smaller subnets use suitable addresses inside their actual range.
No response does not prove that an address is unused.
Sleeping devices and future DHCP allocations can cause conflicts.

1. Check the router's DHCP pool and reservations.
2. Select **Use this suggestion**.
3. Review the populated IP fields.
4. Select the router-review acknowledgement.
5. Select **Test all & save**.

The suggestion alone does not assign an address.
The firmware probes a requested static address again before testing both services.

## Data and access boundaries

Configuration travels only through USB.
The browser does not upload configuration or use persistent browser storage.
Firmware downloads use same-origin GET requests without account credentials.
The page discards unframed console output.
USB responses do not expose stored passwords or API keys.
Opening a serial port can restart the board.

All settings must survive power loss.
Only future History records will use RAM.
Retention can exceed 14 days within the reserved memory budget.
The development AES-GCM key is stored in device flash.
It does not protect against physical flash extraction.
No security eFuses are programmed.

## Dashboard requirements

The planned dashboard must retain the other editions' navigation, cards, controls, status terms, and mobile behaviour.
Shared interface components must remain separate from the ESP32 data transport and scheduler engine.
The ESP32 is not yet a replacement for the Pi worker.

| Interface | Configuration access |
|---|---|
| USB deployment website | Wi-Fi SSID/password, DHCP, fixed IP, and initial service credentials |
| Authenticated local-IP dashboard, planned | Octopus/FoxESS account credentials, Cloudflare URL, and Remote Access Key management |
| Remote dashboard, planned | Monitoring and explicitly permitted operating controls; no network, account, or key management |

A remote route must not gain local privileges through private source addresses or forwarded headers.
Cloudflare transport requires a separate implementation decision.
No tunnel is started by this page.
Bluetooth provisioning is a later phase.

Copyright (C) 2026 SCKC. GPL-3.0-or-later.
Independent software. Not endorsed or supported by Octopus Energy or FoxESS.
The page includes the full GPL and project notices.
