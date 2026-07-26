# 🐙🦊 Intelligent Octopus Go & FoxESS Smart Charging Detector

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Hosted on GitHub Pages](https://img.shields.io/badge/Web-GitHub%20Pages-success.svg)](https://samuelkcc.github.io/octopus-foxess-smart-charging/)
[![Raspberry Pi OS](https://img.shields.io/badge/Linux-Raspberry%20Pi%20OS-c51a4a.svg)](#raspberry-pi-os-edition-recommended-for-always-on-use)

An always-on automation bridge that protects a FoxESS home battery during
Intelligent Octopus Go EV charging slots.

## Choose an edition

| | Web edition | Raspberry Pi OS edition |
|---|---|---|
| Launch | [Open the live app](https://samuelkcc.github.io/octopus-foxess-smart-charging/) | Background server taskbar icon and LAN dashboard client |
| Google Apps Script | Required for the FoxESS browser relay | Not required |
| Always-on automation | Browser must remain open and awake | Supervised background worker |
| Start after reboot | No | Yes, through `systemd` |
| Local network GUI | No | Yes, responsive on phones, tablets, and computers |
| Best for | Quick use and existing browser setups | Reliable 24/7 operation |

Both editions use the same dashboard and automation logic. The GitHub Pages
edition remains available; installing the Raspberry Pi edition does not replace
or disable it.

![Smart Charging Detector Dashboard](Dashboard.png)

## What it does

When Intelligent Octopus Go opens a cheap EV charging slot, a FoxESS inverter in
Self-Use mode may treat the EV load as normal household demand and discharge the
home battery. This app reads Octopus dispatches and tariff rates, then maintains
FoxESS V3 schedules that can Force Charge or protect the battery during those
periods.

Features include:

- Intelligent Octopus Go dispatch synchronisation
- separate import and SEG export tariff detection and charts
- target-price charging and price-based export rules
- weekly forced-charge windows, including overnight periods
- target SOC, minimum SOC, charge/discharge power, and Auto-Resume controls
- FoxESS API quota tracking and request throttling
- optional approximately five-second FoxESS Live WebSocket telemetry with automatic REST fallback on Raspberry Pi
- encrypted configuration and password-protected manual backups
- responsive phone, tablet, desktop, dark-mode, full-screen, and Mini HUD views

## Credentials required during initial setup

The web edition asks for these details in its browser login. For the Raspberry
Pi edition, enter them once through native **Server Configuration…** from the
Pi taskbar icon. Mobile / LAN clients never ask for them.

### Octopus Energy

1. Sign in to the [Octopus dashboard](https://octopus.energy/dashboard/).
2. Copy the account number beginning with `A-`.
3. Open [API Access](https://octopus.energy/dashboard/new/accounts/personal-details/api-access)
   and generate the `sk_live_...` API key.

### FoxESS Cloud

1. Copy the inverter serial number from the device label or FoxCloud app.
2. Sign in to the [FoxCloud V1 website](https://www.foxesscloud.com/login).
3. Open **User Profile → API Management** and generate an API token.

The token cannot currently be generated from the V2 website or mobile app.

## Raspberry Pi OS edition (recommended for always-on use)

### Requirements

- Raspberry Pi 4 or 5
- current 32-bit or 64-bit Raspberry Pi OS with `systemd`
- internet access for Octopus and FoxESS Cloud APIs
- Pi and client device connected to the same trusted home network

Raspberry Pi OS Bookworm or newer is recommended. The installer adds Node.js,
Chromium, Python GTK/AppIndicator support, `curl`, CA certificates, and the Noto
colour emoji font through `apt`.

### Install

On the Raspberry Pi, run:

```bash
curl -fsSL https://raw.githubusercontent.com/samuelkcc/octopus-foxess-smart-charging/main/linux/install.sh | sudo sh
```

The installer:

1. downloads the latest Raspberry Pi release package;
2. creates a restricted `octopus-foxess` service account;
3. installs a LAN server on port `8787`;
4. installs an always-on Chromium automation worker;
5. enables the services at startup;
6. blocks system sleep while the worker is active; and
7. adds a native **Octopus FoxESS Server** taskbar status icon;
8. adds a separate **Octopus FoxESS Dashboard** desktop/application-menu client; and
9. prints the local URL and generated LAN access code.

The taskbar icon starts automatically at desktop login. Green means the server
and configured API connections are healthy, amber means a connection is waiting
or using an intentional fallback, and red indicates a configuration or
connection problem. Its menu shows individual **Octopus API**, **FoxESS REST**,
and **FoxESS Live WS** states.

Select **Server Configuration…** from the taskbar icon to open the native
Raspberry Pi configuration window. It is the only Pi integration editor and
contains the listen address, optional LAN access-code protection, Octopus
account/API key, FoxESS serial/API token, Live WS selector and optional
web-login, self-test, and all integration health states. The browser dashboard
never displays or edits these service credentials.

### FoxESS telemetry connection

The native Server Configuration screen offers:

- **Live WebSocket (default, REST fallback)** — optionally enter the same
  FoxESS Cloud web-login email/username and password used at
  `foxesscloud.com`, then select **Save & Test Live WS**. When a fresh
  self-test frame is received, supported telemetry updates approximately every
  five seconds.
- **Official REST API only** — disables the undocumented live stream and uses
  the FoxESS Open API.

The Pi requests a fresh Live WS frame every five seconds. If either optional
web-login field is empty, login fails, the stream closes, or no fresh frame
arrives within 30 seconds, the Pi automatically changes to
`REST FALLBACK`. REST telemetry is cached for at least one minute to respect
FoxESS's daily quota. The dashboard displays `LIVE WS`, `REST FALLBACK`, or
`OFFICIAL REST` so the active source is visible.

The live connection is an undocumented FoxESS web-portal interface and may
change without notice. It is used only for read-only telemetry. Scheduler
reads/writes, work-mode controls, and every deliberate inverter change continue
to use the official FoxESS REST API.

Open the address displayed in **Server Configuration** on any phone, tablet, or
computer connected to the same LAN, for example:

```text
http://192.168.1.42:8787
```

Enter the LAN access code if protection is enabled in Server Configuration. You
may turn protection off for a trusted private LAN; in that mode the client opens
without a password and anyone on that LAN can view and control the dashboard.
There is no Google Apps Script field in this edition,
and the client does not show Octopus or FoxESS credential fields,
configuration import, or wipe controls. After the one-key check, the Pi service
authenticates with Octopus and signs FoxESS requests on the client's behalf.
After the first successful Pi setup, the supervised worker reads the centrally
stored encrypted configuration and keeps running even after the Pi settings
window and every LAN browser are closed.

The Mobile / LAN view is not a pixel-by-pixel screen mirror. It is a responsive client of
the Pi service: it reads the same live dashboard state and sends deliberate
automation changes back to the Pi. Octopus and FoxESS service credentials can
only be viewed or changed in native Server Configuration on the Pi. The Pi
remains the source of truth and the only unattended automation worker.

The Raspberry Pi client login displays **Mobile / LAN access** followed by the
detected local URL, and the native taskbar configuration window shows it too.
Adding the page to an iOS or Android home screen uses the dedicated Octopus,
fox, and charging-bolt app icon.

If the IP address changes, try `http://raspberrypi.local:8787` or run
`hostname -I` on the Pi. The Mobile view uses safe-area spacing, 16 px form
controls to prevent browser zoom, large touch targets, single-column cards, and
responsive charts on iOS and Android.

### Service commands

```bash
sudo systemctl status octopus-foxess octopus-foxess-worker octopus-foxess-inhibit
sudo journalctl -u octopus-foxess -u octopus-foxess-worker -u octopus-foxess-inhibit -f
sudo systemctl restart octopus-foxess octopus-foxess-worker octopus-foxess-inhibit
```

All three services use `Restart=always`. A separate root-owned
`octopus-foxess-inhibit` service holds the sleep and idle inhibitor without
granting elevated privileges to the server or Chromium worker. Rebooting the Pi
automatically starts all three services again.

### Update

Run the install command again. It downloads the latest release and preserves the
encrypted configuration and access code.

### Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/samuelkcc/octopus-foxess-smart-charging/main/linux/uninstall.sh | sudo sh
```

Uninstalling stops and removes both services, the application, the generated
access code, and the encrypted configuration. This is intentionally a complete
removal.

## Web edition on GitHub Pages

Open the [live GitHub Pages app](https://samuelkcc.github.io/octopus-foxess-smart-charging/).
Because a static browser page cannot call FoxESS Cloud directly due to browser
CORS restrictions, this edition uses a personal Google Apps Script relay.

### Create the relay

1. Open [Google Apps Script](https://script.google.com/) and create a project.
2. Replace its contents with:

```javascript
function doPost(e) {
  try {
    var requestData = JSON.parse(e.postData.contents);
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: requestData.headers,
      payload: JSON.stringify(requestData.body),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(requestData.url, options);
    return ContentService.createTextOutput(response.getContentText())
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      errno: 999,
      msg: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Select **Deploy → New deployment → Web app**.
4. Set **Execute as** to **Me** and **Who has access** to **Anyone**.
5. Deploy and paste the Web App URL into the dashboard login screen.

Keep one active automation dashboard only. A sleeping or closed browser cannot
run the web edition's timers; use the Raspberry Pi edition for unattended use.

## Security and network guidance

- The project has no telemetry or third-party application server.
- Web-edition credentials use a non-exportable browser AES-GCM key when secure
  browser storage is available.
- Raspberry Pi credentials and automation settings are encrypted with AES-256-GCM
  in `/var/lib/octopus-foxess`.
- LAN clients receive only managed-configuration status; Octopus
  API keys, FoxESS tokens, and inverter serial numbers are not returned.
- Optional FoxESS web-login credentials for Live WS are also encrypted on the
  Pi and are never returned to a LAN client.
- The Pi authenticates Octopus requests and signs FoxESS requests server-side.
- The LAN access code is stored with service-only permissions in
  `/var/lib/octopus-foxess/access.key` and can only be viewed or changed through
  the settings screen opened locally on the Pi.
- The Pi relay accepts only HTTPS requests to `www.foxesscloud.com/op/...`.
- The optional read-only live stream connects from the Pi to the undocumented
  `wss://www.foxesscloud.com/dew/v0/wsmaitian` endpoint. It never carries
  scheduler or inverter-control commands.
- LAN API access requires the configured access code by default. Server
  Configuration can disable this protection only for a trusted private LAN;
  loopback access remains reserved for native configuration and the supervised
  worker.
- Port `8787` uses HTTP on the trusted home LAN. Do not expose it through router
  port forwarding, a public IP, or an untrusted Wi-Fi network.
- The complete uninstall command removes the encrypted Pi configuration.
  LAN clients cannot wipe or replace service credentials.

FoxESS enforces API limits. The Pi worker owns unattended automation; connected
clients do not perform duplicate automatic schedule writes. Deliberate manual
controls from a Mobile / LAN dashboard remain available.

## Development and release builds

The maintainable source is split by responsibility:

```text
src/                 Shared dashboard markup, styles, and behaviour
linux/               Raspberry Pi server, installer, and uninstaller
scripts/build.mjs    Standalone web build
scripts/build-linux.mjs
                     Raspberry Pi release package build
prototype/           Original single-file reference
dist/                Generated release output
```

Node.js 18 or newer is required. The Raspberry Pi package vendors the pinned
`ws` WebSocket client; the standalone GitHub Pages build has no npm runtime.

```bash
npm run check
```

The check produces:

- `dist/Octopus_IGO_Smart_Charging_Detector.html`
- `dist/Octopus_FoxESS_Raspberry_Pi.tar.gz`
- `dist/install.sh`
- `dist/uninstall.sh`

The optional FoxESS live implementation is adapted from
[`nicois/foxess-control`](https://github.com/nicois/foxess-control) under the
MIT License. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Pushes to `main` test and deploy the standalone HTML as the root GitHub Pages
app. Tags matching `v*` create a GitHub release with both editions and the
install/uninstall scripts.

## Legal disclaimer

This unofficial community utility is independent of Octopus Energy Ltd and
FoxESS Co., Ltd. Product names, trademarks, and branding belong to their
respective owners.

Controlling battery infrastructure and using third-party services creates risks,
including unexpected inverter behaviour, hardware degradation, API
rate-limiting, and billing differences. You are responsible for checking
schedules, limits, logs, and inverter behaviour.

## Support the project

If the project has been useful, you can
[buy Samuel a coffee](https://buymeacoffee.com/samuelchen).
