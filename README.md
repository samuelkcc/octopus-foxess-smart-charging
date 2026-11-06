# Smart Charging for Octopus Energy and FoxESS

**Your EV, charging. Your home, protected.**

[![Buy me a coffee](docs/assets/buy-me-a-coffee.svg)](https://buymeacoffee.com/samuelchen)

A free hobby project by **SCKC**. Use a compact ESP32 to protect your FoxESS home battery during Intelligent Octopus Go charging.
Your phone or computer provides the dashboard. The ESP32 keeps working when you close it.

## Open a tool

| | Start here |
|---|---|
| [**HTML Dashboard**](https://samuelkcc.github.io/octopus-foxess-smart-charging/app/) | The simplest entry: no app installation. The built-in guide explains account and Google relay setup. Keep the browser open and awake. |
| [**ESP32 Web Deploy**](https://samuelkcc.github.io/octopus-foxess-smart-charging/esp32/) | Install firmware and configure your board over USB. **Use desktop Chrome.** Mac and Windows setup apps are also available. |

## ESP32: a small controller for everyday use

Intelligent Octopus Go can change EV charging windows throughout the day.
In Self-Use mode, your home battery can supply the EV instead of preserving energy for your house.
Smart Charging follows valid Octopus windows and requests the corresponding FoxESS charging schedule.

- **Works independently:** keep the ESP32 powered after USB setup. Your setup computer can disconnect.
- **One dashboard across devices:** view power, battery level, schedules, and electricity prices on your local network.
- **Rules you control:** follow Smart Dispatch, set weekly periods, apply price rules, and pause automation deliberately.
- **Check the result:** official FoxESS REST readback confirms schedule programming. Measured power shows actual battery behaviour.

![ESP32 dashboard in dark appearance with demonstration data](docs/screenshots/esp32-dashboard.png)

**Supported board: ESP32-S3 N16R8 — 16 MB Flash and 8 MB Octal PSRAM.** Other ESP32 models are unsupported.
Use a USB data cable and 2.4 GHz Wi-Fi.
ESP32 is local-network only. **Cloudflare remote access and Bluetooth setup are not supported.**

[**ESP32 setup guide →**](docs/editions/ESP32.md) · [Mac and Windows deployment apps](docs/editions/ESP32.md#choose-a-deployment-tool) · [View more screenshots](docs/INTERFACE.md)

## Before you start

Prepare these account details before opening setup. All editions need the Octopus and FoxESS REST credentials.

| Prepare | Where to get it |
|---|---|
| **Octopus account number and API key** | Sign in to your [Octopus account](https://octopus.energy/dashboard/). Open **Personal details → Developer settings → API access**. Copy your API key and account number. [Detailed instructions](docs/ACCOUNT-PREPARATION.md#octopus-account-and-api-key). |
| **FoxESS inverter serial number and API token** | Sign in to [FoxESS Cloud](https://www.foxesscloud.com/). Open **User profile / Personal centre → API management**. Generate or copy your API key. Use the inverter serial from your device details. [Detailed instructions](docs/ACCOUNT-PREPARATION.md#foxess-inverter-and-rest-api-token). |
| **Optional FoxESS cloud username and password** | Use your normal FoxESS Cloud web-login details. These enable optional WebSocket telemetry on ESP32, Pi, and Portable. They do not replace the REST API token. [When to use this](docs/ACCOUNT-PREPARATION.md#optional-foxess-websocket-login). |

Keep keys and passwords private. Enter them only in your chosen setup tool.
If another worker controls this inverter, disable it before enabling the new host.
[Prepare the inverter](docs/PREPARE-INVERTER.md) before enabling automation.

## Choose your setup guide

Each guide covers one edition. You do not need to read every installation method.

| Edition | Choose this when | Setup |
|---|---|---|
| **ESP32 — recommended local controller** | You want a small independent host, with USB deployment and a phone dashboard | [ESP32 guide](docs/editions/ESP32.md) |
| Raspberry Pi | You want an always-on service with optional protected Cloudflare remote access | [Pi guide](linux/README-RASPBERRY-PI.md) |
| Windows Portable | You want a computer-hosted app that stays open | [Portable guide](desktop/README.md) |
| HTML Dashboard | You want browser-based use without installing an app | [HTML guide](docs/WEB-GUIDE.md) |

[Compare the editions](docs/USER-GUIDE.md#1-choose-an-edition) · [User guide](docs/USER-GUIDE.md) · [Downloads](https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/tag/esp32-2.4.2)

## Support this hobby project

Smart Charging is free to use. If it helps your setup, you can support development with a coffee.

[![Buy me a coffee](docs/assets/buy-me-a-coffee.svg)](https://buymeacoffee.com/samuelchen)

Independent software by **SCKC**, under **GPL-3.0-or-later**.
Octopus Energy and FoxESS do not endorse or support this project.

[Licence](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Verification record](docs/FEATURE-PARITY.md) · [Architecture](docs/ARCHITECTURE.md)
