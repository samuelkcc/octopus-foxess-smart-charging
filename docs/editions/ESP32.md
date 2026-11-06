# ESP32 setup

[Back to the project](../../README.md) · [Other editions](../../README.md#choose-your-setup-guide)

[Prepare API keys and optional login](../ACCOUNT-PREPARATION.md).

ESP32 is the recommended compact local controller. The board runs independently while powered.
Your phone or computer displays its dashboard. The setup computer can be disconnected after configuration.

## Before you start

- Use **ESP32-S3 N16R8**, with 16 MB Flash and 8 MB Octal PSRAM.
- Use a USB data cable and 2.4 GHz Wi-Fi.
- Prepare your Octopus account/API key and FoxESS serial number/API token.
- [Prepare the inverter](../PREPARE-INVERTER.md).
- Disable any other automation host for this inverter.

## Choose a deployment tool

| Tool | Open or download |
|---|---|
| USB website | [ESP32 Web Deploy](https://samuelkcc.github.io/octopus-foxess-smart-charging/esp32/) — use desktop Chrome |
| Mac app | [Universal Mac ZIP](https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-2.4.4/SmartCharging-ESP32-Setup-2.4.4-macOS-universal.zip) |
| Windows app | [Windows x64 EXE](https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-2.4.4/SmartCharging-ESP32-Setup-2.4.4-Windows-x64.exe) |

Safari cannot deploy firmware through USB. Safari can display the configured Wi-Fi dashboard.
The Mac and Windows tools provide the same setup flow. They do not run the automation worker.

## Select your task

| Entry | Purpose |
|---|---|
| New setup / Reinstall | Erase settings and History, install firmware, then configure the board |
| Edit settings | Read saved settings, then change only what you need without erasing |

![ESP32 deployment tool in dark appearance](../screenshots/esp32-deploy.png)

A blank board cannot answer **Connect ESP32**. Select **New setup / Reinstall** to install firmware first.
For a configured board, select **Edit settings**, then **Connect ESP32**.

## Install or reinstall your board

New setup and reinstall both use Clean install.
This permanently erases Wi-Fi, IP, accounts, passwords, automation rules, access protection, and saved History on the ESP32.
It does not change the schedule already stored on the FoxESS inverter.
The new firmware starts with automation disabled. Complete setup again before enabling control.

1. Select **New setup / Reinstall**.
2. Keep the USB cable connected.
3. If setup is connected, select **Disconnect**.
4. Review the deletion notice.
5. Confirm the supported board model.
6. Confirm deletion of settings and History.
7. Enter **ERASE** in the confirmation field.
8. Select **Erase all & install**.
9. Select the USB-UART port.
10. Wait for installation and hash verification to finish.
11. Select **Continue: Connect ESP32**.
12. Select **Connect ESP32**.
13. Select the USB serial port again.
14. Select **Next: Network**.
15. Configure Wi-Fi and both APIs.
16. Complete **Test all & save**.

The installer selects its own USB port. A new board does not need a setup connection before installation.
If installation fails after erasure starts, data may already be deleted. Keep USB connected and retry installation.
To retain existing settings, use **Edit settings**. Editing does not reinstall firmware.

## Daily use and limits

- Manage service credentials in **Settings → Account setup** or through USB.
- Use USB for Wi-Fi, IP, and dashboard-port changes.
- Use the optional WebSocket login for live telemetry. Schedule commands still use official REST.
- History uses RAM by default. Optional hourly Flash saving retains hourly records for 60 days.
- Cloudflare, remote relay, Bluetooth setup, and OTA updates are unsupported.

[User guide](../USER-GUIDE.md) · [Verification limits](../FEATURE-PARITY.md)
