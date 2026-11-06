# Smart Charging for Octopus Energy and FoxESS

**Your EV, charging. Your home, protected.**

Smart Charging uses your Octopus charging windows to protect your FoxESS home battery while your EV charges.
The dashboard shows charging schedules, measured power, electricity prices, and automation controls.

| Open a tool | Use it for |
|---|---|
| [**HTML Dashboard**](https://samuelkcc.github.io/octopus-foxess-smart-charging/app/) | Run in your browser. An in-app guide explains account and relay setup. |
| [**ESP32 Web Deploy**](https://samuelkcc.github.io/octopus-foxess-smart-charging/esp32/) | Install and configure a supported ESP32 over USB. Use desktop Chrome. |

## Start with ESP32

Our recommended local controller runs independently on a powered **ESP32-S3 N16R8**.
Set it up over USB, then open the dashboard on your phone or computer.

Supported board: **16 MB Flash and 8 MB Octal PSRAM**. Other ESP32 models are unsupported.
The setup guide includes Mac and Windows deployment apps, account setup, reinstall, and Clean install.

![ESP32 dashboard in dark appearance with demonstration data](docs/screenshots/esp32-dashboard.png)

ESP32 is local-network only. Cloudflare remote access is not supported.
Closing your dashboard does not stop the ESP32 worker.

## Setup guides

Choose one host for each inverter. Each guide covers only its own edition.

| Edition | Choose this when | Setup |
|---|---|---|
| ESP32 | You want a compact, independent local controller | [ESP32 guide](docs/editions/ESP32.md) |
| Raspberry Pi | You want an always-on service with optional protected remote access | [Pi guide](linux/README-RASPBERRY-PI.md) |
| Windows Portable | You want a computer-hosted app that stays open | [Portable guide](desktop/README.md) |
| HTML Dashboard | You want browser-based use without installing an app | [HTML guide](docs/WEB-GUIDE.md) |

[Compare the editions](docs/USER-GUIDE.md#1-choose-an-edition) · [View the interface gallery](docs/INTERFACE.md)

## Help and downloads

[User guide](docs/USER-GUIDE.md) · [Downloads](https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/tag/esp32-2.4.2) · [Website](https://samuelkcc.github.io/octopus-foxess-smart-charging/)

[Prepare the inverter](docs/PREPARE-INVERTER.md) before enabling automation.
The edition guides explain credentials, updates, remote access, and troubleshooting.
The [feature review](docs/FEATURE-PARITY.md) records verified behaviour and remaining limits.

## Project information

Independent software by **SCKC**, under **GPL-3.0-or-later**.
Octopus Energy and FoxESS do not endorse or support this project.

[Licence](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [Architecture](docs/ARCHITECTURE.md) · [Support the project](https://buymeacoffee.com/samuelchen)
