# ESP32 setup

[Back to the project](../../README.md) · [Other editions](../../README.md#setup-guides)

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
| Mac app | [Universal Mac ZIP](https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-2.4.2/SmartCharging-ESP32-Setup-2.4.2-macOS-universal.zip) |
| Windows app | [Windows x64 EXE](https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-2.4.2/SmartCharging-ESP32-Setup-2.4.2-Windows-x64.exe) |

Safari cannot deploy firmware through USB. Safari can display the configured Wi-Fi dashboard.
The Mac and Windows tools provide the same setup flow. They do not run the automation worker.

## Select your task

| Entry | Purpose |
|---|---|
| New setup | Enter a complete configuration, then test before saving |
| Edit settings | Read saved settings, then change them |
| Reinstall firmware | Keep settings by default, or explicitly select Clean install |

![ESP32 deployment tool in dark appearance](../screenshots/esp32-deploy.png)

1. Connect the supported board through USB.
2. Open your chosen deployment tool.
3. Select the required task.
4. Follow Device, Network, Accounts, and Verify & save.
5. Wait for all required checks to pass.
6. Open the displayed local dashboard address.

The default address uses port 8787. The tool displays the actual address after connection.

## Reinstall while keeping settings

1. Select **Reinstall firmware**.
2. Keep the USB cable connected.
3. If setup shows **Firmware connected**, select **Disconnect**.
4. Select **Reinstall firmware · Keep saved settings**.
5. Confirm the supported board model.
6. Confirm installation with saved settings retained.
7. Select **Reinstall · Keep settings**.
8. Select the USB-UART port again.
9. Wait for installation and hash verification to finish.
10. Select **Continue: Edit settings**.
11. Select **Connect ESP32**.

Disconnect releases the setup connection and clears unsaved form entries. The cable must remain connected.
The text above the installation button lists each unmet condition.

## Clean install

Clean install permanently erases Wi-Fi, IP, accounts, passwords, automation rules, access protection, and saved History on the ESP32.
It does not change the schedule already stored on the FoxESS inverter.
The new firmware starts with automation disabled. Full setup is required again.

1. Select **Reinstall firmware**.
2. If setup is connected, select **Disconnect**.
3. Keep the USB cable connected.
4. Select **Clean install · Erase all ESP32 settings and History**.
5. Review the deletion notice.
6. Confirm the supported board model.
7. Select the confirmation to delete settings and History.
8. Enter **ERASE** in the confirmation field.
9. Select **Erase all & install**.
10. Select the USB-UART port.
11. Wait for installation and hash verification to finish.
12. Select **Continue: New setup**.
13. Configure Wi-Fi and both APIs again.

If installation fails after erasure starts, data may already be deleted. Keep USB connected and retry installation.

## Daily use and limits

- Manage service credentials in **Settings → Account setup** or through USB.
- Use USB for Wi-Fi, IP, and dashboard-port changes.
- Use the optional WebSocket login for live telemetry. Schedule commands still use official REST.
- History uses RAM by default. Optional hourly Flash saving retains hourly records for 60 days.
- Cloudflare, remote relay, Bluetooth setup, and OTA updates are unsupported.

[User guide](../USER-GUIDE.md) · [Verification limits](../FEATURE-PARITY.md)
