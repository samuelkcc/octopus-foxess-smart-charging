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
credentials, enable optional Live WS access, and inspect all integration
states. **Update Raspberry Pi Edition** opens the standard graphical
administrator prompt, installs the latest release, and restarts the services.
Enabling Live WS reveals the FoxESS web-login fields. This compact
native window is the only Pi integration editor; the browser dashboard never
displays service credentials.

The Pi settings app provides the FoxESS credentials and enables or disables the
Live WS capability. Once enabled, the dashboard menu selects one of three
telemetry policies:

- **Live WS on demand** opens the WebSocket only while an Octopus dynamic
  charge is active, then disconnects it when that charge ends.
- **Always Live WebSocket (REST fallback)** keeps live telemetry connected and
  automatically uses official REST when the stream is unavailable.
- **Official REST API only** disables Live WS.

Leaving either Live WS credential empty automatically uses REST. While an
active dynamic charge keeps Live WS connected, the Pi subscribes once to the
approximately five-second telemetry stream and keeps the transport alive with a
protocol heartbeat. It also reuses the current web-session token for up to 12
hours instead of logging in again on every reconnect. The **Save & Test Live
WS** button can explicitly test one
fresh frame outside a charge window. This diagnostic creates a FoxESS web login
and may sign the FoxESS mobile app out; merely opening or refreshing Server
Configuration does not perform that login. A successful on-demand test closes
its temporary socket immediately. Login, self-test, stale-frame, or connection
failures also fall back to REST automatically. All schedule and
inverter-control commands always use the official FoxESS REST API.

The Pi is the central source of truth. Closing the settings window does not stop
the service. The separate **Octopus FoxESS Dashboard** desktop and
application-menu launcher opens the LAN client and asks only for its access
code when access protection is enabled. A valid code is remembered on that
client so later visits open the dashboard directly; **Menu → Remove Access
Code** forgets it and returns to login. For a trusted private LAN, Server
Configuration can disable access-code protection and the client opens directly.
Phones, tablets, and other computers on the same network can open the listen
address directly. Every client reads the Pi's current state and sends
deliberate changes back to the Pi; it is not a pixel-by-pixel screen mirror.
Only the loopback worker performs unattended schedule writes.

The worker is also the single source of truth for Octopus Smart Dispatch. It
publishes every changed dispatch revision as syncing, immediately writes the
matching conflict-resolved FoxESS schedule, and publishes confirmed status only
after an exact official-REST scheduler readback. All dashboards display this
worker snapshot and refresh it every five seconds. A stale confirmation for an
older Octopus revision is rejected, and the dashboard clearly distinguishes
**SYNCING FOXESS**, **FOXESS CONFIRMED**, and **FOXESS SYNC FAILED**.

### Optional free remote URL

Choose **Remote Access…** from the Pi taskbar menu, then **Start Quick Tunnel**.
The app creates a random HTTPS address on `trycloudflare.com` without a
Cloudflare account, domain, or router port forwarding. Copy the separate
**Remote Access Key** from this window and enter it when opening the remote
URL. The LAN access code is not used for tunnel access. Remote access always
requires authentication, even if LAN protection is disabled.

The key contains 256 bits of cryptographic randomness and is encrypted with the
Pi configuration at rest. Browser login exchanges it for a Secure, HttpOnly,
SameSite session cookie, valid for 12 hours; the app never saves the remote key
in browser local storage. Keep the key private and never put it in a URL.
**New Key / Revoke Sessions** invalidates the previous key and all sessions.
**Sign Out** ends the current browser session. **Stop** closes public access.

The tunnel resumes after a service restart if previously enabled, with a new
random URL shown in this window. Disconnections retry automatically. Cloudflare
Quick Tunnels are intended for testing/development, have no uptime guarantee,
allow at most 200 concurrent requests, and do not support SSE. This dashboard
uses ordinary HTTP polling. See [Cloudflare's limitations](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

The installer obtains `cloudflared` from Cloudflare's signed APT repository.
Only the dedicated loopback listener (normally `8788`) is tunneled. It requires
remote authentication and blocks Pi administration, credentials, access-key
management, and worker publications. Never manually tunnel or forward the
LAN/admin HTTP port `8787`; it trusts native loopback traffic.

For API clients, pass the remote key in the `X-Octopus-Remote-Key` header over
HTTPS. The remote key is separate from Octopus/FoxESS credentials. A tunnel
secures transport through Cloudflare; Cloudflare terminates the public HTTPS
connection. Private VPN access is an alternative if you prefer no public URL.

**About & License…** in the native menu and **About & License** in the dashboard
show version, developer, GPL terms, source code, and independent-software
information. Full third-party notices are included in the dashboard and package.

Adding the dashboard to an iOS or Android home screen uses the supplied
Octopus/fox/charging app icon. The narrow Mobile view fits the viewport without
zooming out and presents the Octopus dynamic charge schedule, FoxESS mode
scheduler, and Home Energy Protection status before tariff and account detail.
On iPhone, open the dashboard in Safari, tap **Share**, then **Add to Home
Screen**. On Android, use **Add to Home screen** or **Install app** from the
browser menu.

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

Use **Update Raspberry Pi Edition** in Server Configuration for future updates.
An existing installation without this button must re-run the install command
once to add it. The encrypted configuration and selected access code are
preserved. The uninstall command removes the services, launcher, taskbar
autostart entry, desktop client, encrypted configuration, and access code.
