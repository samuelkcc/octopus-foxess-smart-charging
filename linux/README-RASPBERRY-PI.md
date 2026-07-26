# Raspberry Pi OS edition

This edition runs the Smart Charging Detector continuously as three `systemd`
services:

- `octopus-foxess.service` serves the local web interface and replaces Google
  Apps Script with a restricted FoxESS relay.
- `octopus-foxess-worker.service` runs the automation as the restricted app
  user in a dedicated headless Chromium profile.
- `octopus-foxess-inhibit.service` holds the system sleep and idle inhibitor
  separately from the unprivileged application processes.

All three services restart automatically after failure or reboot.

The server binds to port `8787` on the local network. Configuration is encrypted
at rest on the Pi. A native **Octopus FoxESS Server** taskbar icon starts with
the desktop session and shows the server, Octopus API, FoxESS REST, and FoxESS
Live WS states. Green indicates healthy, amber indicates a waiting or intentional
fallback state, and red indicates a configuration or connection problem.

Choose **Server Configuration…** from the taskbar menu to view the LAN listen
address, enable or disable LAN access-code protection, enter the Octopus/FoxESS
credentials, select or test Live WS, and inspect all integration states. This
native window is the only Pi integration editor; the browser dashboard never
displays service credentials.

The Pi settings app also provides a FoxESS telemetry selector:

- **Live WebSocket (default, REST fallback)** uses optional FoxESS Cloud
  web-login credentials for approximately five-second read-only telemetry.
- **Official REST API only** disables the undocumented stream.

Leaving either Live WS credential empty automatically selects REST fallback.
While connected, the Pi requests a fresh frame every five seconds so a
successful connection does not become stale after its initial frame. The
**Save & Test Live WS** button waits for a fresh telemetry frame. Login,
self-test, stale-frame, or connection failures also fall back to REST
automatically. All schedule and inverter-control commands always use the
official FoxESS REST API.

The Pi is the central source of truth. Closing the settings window does not stop
the service. The separate **Octopus FoxESS Dashboard** desktop and
application-menu launcher opens the LAN client and asks only for its access
code when access protection is enabled. For a trusted private LAN, Server
Configuration can disable access-code protection and the client opens directly.
Phones, tablets, and other computers on the same network can open the listen
address directly. Every client reads the Pi's current state and sends
deliberate changes back to the Pi; it is not a pixel-by-pixel screen mirror.
Only the loopback worker performs unattended schedule writes.

Adding the dashboard to an iOS or Android home screen uses the supplied
Octopus/fox/charging app icon. The account-number row is kept on one line in the
narrow Mobile view.

Install:

```bash
curl -fsSL https://raw.githubusercontent.com/samuelkcc/octopus-foxess-smart-charging/main/linux/install.sh | sudo sh
```

Uninstall, including encrypted configuration:

```bash
curl -fsSL https://raw.githubusercontent.com/samuelkcc/octopus-foxess-smart-charging/main/linux/uninstall.sh | sudo sh
```

Useful commands:

```bash
sudo systemctl status octopus-foxess octopus-foxess-worker octopus-foxess-inhibit
sudo journalctl -u octopus-foxess -u octopus-foxess-worker -u octopus-foxess-inhibit -f
sudo systemctl restart octopus-foxess octopus-foxess-worker octopus-foxess-inhibit
```

Re-run the install command to update. The encrypted configuration and selected
access code are preserved. The uninstall command removes the services, launcher,
taskbar autostart entry, desktop client, encrypted configuration, and access
code.
