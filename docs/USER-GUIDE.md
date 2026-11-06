# Smart Charging User guide

## 1. Choose an edition

All editions connect Octopus charging windows to FoxESS schedules. The automation host and setup method differ.

| Edition | Automation host | Setup | Records | Cloudflare remote access |
|---|---|---|---|---|
| ESP32 | Powered ESP32-S3 N16R8 | USB website or setup app, then local Account setup | RAM, optional hourly Flash | **Not supported** |
| Raspberry Pi | Background Pi worker | Native Pi Configuration | Compressed power History | Optional protected tunnel |
| Portable app | Windows or macOS worker while the app remains open | Welcome and Account setup tab | Compressed power History | Optional protected tunnel |
| Web HTML / GitHub Pages | Open, awake browser | Browser wizard and Google Apps Script relay | Browser Activity | Not a remote host |

ESP32 Setup for Mac, Windows, or web only configures the board. It does not run automation or store dashboard History.

A phone dashboard displays the host's state. Closing a Pi or ESP32 dashboard does not stop its worker.

The desktop host app must remain open. The standalone web browser must remain open and awake.

The ESP32 Setup app is not the desktop automation host. Closing the setup app does not stop a configured ESP32.

Use only one active automation host for each inverter. Before changing hosts, disable the previous worker.

Dashboard sections use a shared design. Settings reflect each host's capabilities.

This ESP32 build has known differences in advanced scheduler handling. The release review records these limits in FEATURE-PARITY.md.

## 2. Prepare the inverter

1. Open Work Mode in the FoxESS app.
2. Under Advanced, enable Mode Scheduler.
3. Set Remaining Time Mode to Self-use.
4. Save the FoxESS settings.

Mode Scheduler applies the programmed periods. Outside those periods, Remaining Time Mode controls the inverter.

## 3. Deploy ESP32

Supported hardware is ESP32-S3 N16R8, with 16 MB Flash and 8 MB Octal PSRAM. Other ESP32 models are unsupported.

Bluetooth is disabled. Setup uses USB. Dashboards use Wi-Fi.

[Open the USB deployment website](https://samuelkcc.github.io/octopus-foxess-smart-charging/esp32/).
[Download the Mac app or Windows EXE](https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/tag/esp32-preview-2.3.0).

The Mac app and Windows EXE contain the same four-step setup interface as the USB website.

1. Connect the supported board with a USB data cable.
2. Open ESP32 Setup for Mac or Windows.
3. Alternatively, open the USB website in desktop Chrome or Edge.
4. Select Connect ESP32.
5. Select the USB serial port.
6. If firmware is absent, use First installation or firmware recovery.
7. Select Next to open Network.
8. Scan for a 2.4 GHz Wi-Fi network.
9. Enter the network password.
10. Run Test Wi-Fi with DHCP.
11. Select Accounts.
12. Enter your Octopus and FoxESS API details.
13. Select Verify & save.
14. Select Test all & save.
15. Wait for all required checks to pass.
16. Open the displayed local dashboard address.

For an existing board, unchanged Wi-Fi, IP, and API settings can be verified while automation runs.
Test all & save checks both APIs before saving optional telemetry settings.
It keeps the saved network, API credentials, rules, and Pause state.

If these main settings changed, disable automation before full USB deployment.
The message beside Test all & save explains the requirement.

Tests must pass before the initial configuration is stored. Failed checks keep the previous saved settings.

Wi-Fi and IP changes require physical USB setup. A failed network change could otherwise remove access to the original dashboard address.

A router DHCP reservation is the preferred stable-address method. The optional fixed-IP suggestion starts at .188 where the subnet permits.

ARP and ping checks cannot prove that an address is unused. A sleeping device or future DHCP allocation can still conflict.

Before accepting a suggested IP, check the router's DHCP pool and reservations.

### Supported and unsupported functions

| Function | ESP32 behaviour |
|---|---|
| Independent operation | Runs while powered, without the setup computer |
| Phone dashboard | Same local Wi-Fi network |
| USB setup | Desktop Chrome or Edge, Mac app, or Windows EXE |
| Cloudflare or remote relay | Not supported |
| Bluetooth setup | Disabled |
| OTA firmware update | Not supported, use USB |
| Flash History | Optional, off by default, hourly averages for 60 days |
| Advanced scheduler parity | Incomplete, see the feature review |

This build retains the existing schedule across a UK clock transition and blocks new programming during the transition guard.
Advanced Auto-Resume handling is not equivalent to the Pi worker.
A successful REST readback confirms schedule programming, not measured battery behaviour.

### Add the iPhone dashboard to Home Screen

1. Open the ESP32 local IP in Safari.
2. Open Share.
3. Select Add to Home Screen.
4. Check the charging icon and app name.
5. Select Add.

For an older shortcut showing an S, remove that shortcut and add it again after the firmware update.

### Account setup and general preferences

1. Open Settings.
2. Select General settings for display, intervals, and History.
3. Select Account setup for Octopus, FoxESS, optional WebSocket, and local access.

Wi-Fi and IP changes remain in the USB setup tool. Incorrect network settings can remove access to the original dashboard address.
Credentials stay masked. Service tests remain separate from saving.

## 4. Set up other editions

### Web edition

1. Open the website or downloaded HTML in your browser.
2. Select Set up Smart Charging.
3. Follow the setup wizard.
4. Enter your Octopus account number and API key.
5. Enter your FoxESS serial number and API token.
6. Configure the Google Apps Script relay shown in setup.
7. Check both service connection states.

The web edition runs automation in that browser. Its saved setup belongs to that browser profile.

### Pi and desktop hosts

1. Install the package for your host.
2. On Pi, open Configuration from the taskbar menu.
3. On desktop, open Settings → Account setup.
4. Enter the service credentials.
5. Save the configuration.
6. Open the dashboard address on your phone or computer.

Pi credentials remain in native Configuration. The dashboard uses the worker's cached readings.

A LAN access code is optional where supported. Remote access always requires its separate Remote Access Key.

## 5. Read and protect ESP32 settings

By default, USB setup loads saved settings without a Config Password. Sensitive values appear as dots.

1. To show one sensitive field, select its eye button.
2. To hide the field, select the eye again.

Credentials remain in the setup page's memory. The tool does not upload them or store the form in browser storage.

Tests and saves retain masked form values. Selecting Clear form, disconnecting, or closing the page clears them. A saved FoxESS portal password is represented by its verifier, not recoverable plaintext.

Config Password is optional. It protects reading original settings through the USB protocol.

1. To enable protection, open Verify & save.
2. Enter a new Config Password of 8–128 characters.
3. Enter the same password in the confirmation field.
4. Select Save Config Password.

On the next connection, protected settings require that password. Repeated incorrect attempts cause a temporary delay.

1. To read protected settings, enter Config Password on the Device step.
2. Select Unlock & read settings.

You can skip reading and enter replacement settings. Skipping does not reveal old values or remove the existing password.

To change or remove an existing password, first unlock it. Config Password does not change LAN dashboard access.

This protection does not prevent physical Flash extraction. Development encryption stores its local key on the board.

## 6. Manage accounts and telemetry

ESP32 Settings → Account setup and USB setup support Octopus, FoxESS REST, and optional FoxESS cloud login.

1. To test a service, enter its candidate credentials.
2. Select that service's Test button.
3. Read the result beside the button.

Tests read service data. They do not save candidate values or program charging schedules.

The Octopus test checks account REST access. The normal worker checks Smart Dispatch access separately.

1. Before saving API credentials, pause automation or disable control.
2. Select the service's Test & save button.
3. Wait for confirmation.

Blank fields keep existing values during account-only edits. Wi-Fi, IP, rules, and Pause remain unchanged.

REST is the default telemetry source. Optional WebSocket uses FoxESS cloud-login details for live measurements.

1. To enable WebSocket, enter the optional FoxESS cloud login.
2. Select Test WebSocket.
3. After a successful test, save the optional login.
4. Select WebSocket with REST fallback as the telemetry source.

An identical successful WebSocket test can validate a save for five minutes.
This avoids another portal login immediately after testing.
Changed credentials or an expired test require fresh validation.
The worker reconnects after a cached validation is saved.

The unofficial portal interface can change. A portal login can sign another FoxESS session out.

Missing, stale, or failed WebSocket readings cause REST fallback. Schedule commands and confirmation always use official FoxESS REST.

The ESP32 does not require a separate signature service. Its firmware creates the portal request signature locally.

## 7. Use the dashboard

### Welcome and display

Welcome introduces the app and opens your home energy workspace. Appearance controls affect the current browser.

1. On ESP32, open Settings to change the starting page.
2. To bypass Welcome, enable Open Dashboard directly.
3. To restore Welcome, disable that option.

LAN access protection still applies when Welcome is skipped.

### Overview

Overview shows solar generation, home demand, grid power, and battery power. Charge level appears with the battery reading.

Octopus charging windows and the FoxESS programmed schedule appear separately. These can differ while reconciliation or confirmation is pending.

Electricity prices show published unit rates. Missing or expired prices remain unavailable.

REST confirmation proves schedule programming. Power measurements show actual inverter and battery behaviour.

### Service refresh controls

The Octopus and FoxESS header controls show service progress and health.

1. To request fresh service data, select its header refresh control.
2. If a problem dialog opens, read the retained error.
3. To retry, select Refresh now.

The host queues upstream requests. Rate limits and cooldowns still apply.

Opening another dashboard does not create another Pi or ESP32 automation worker.

### Connections

Connections shows account and device information beside service status. Account numbers are masked until deliberately shown.

A successful account test does not guarantee an immediate Smart Dispatch. Charger and Octopus scheduling states can update at different times.

## 8. Set charging and discharging rules

Smart Dispatch protects the home battery during valid Octopus charging windows. It has priority over ordinary charging.

By default, Smart Dispatch also takes priority over discharging. Review safeguards before changing that behaviour.

1. Open Automations.
2. Review the charging rules.
3. Review the discharge rules.
4. Review battery limits and safeguards.
5. Select the review or save control.
6. Confirm the proposed change.
7. Check the resulting FoxESS schedule.

Schedule changes affect real equipment. Follow your inverter and battery manufacturer's permitted limits.

FoxESS accepts at most five schedule periods. The app must not report a partial schedule as fully confirmed.

Changed dispatches trigger reconciliation before routine tariff work. Invalid or rate-limited responses retain the last valid dispatches.

Overnight windows remain supported. Smart Dispatch times are rounded outward to half-hour boundaries where required.

Auto-Resume must not cancel an active dispatch. Advanced ESP32 parity limits remain listed in the release review.

## 9. Pause and resume automation

The round power control is green when automation is running. It is red when operator Pause is active.

1. To pause app control, select the green power button.
2. Read the confirmation dialog.
3. Confirm Pause.

Pause blocks new app schedule writes. Monitoring continues.

An already-sent command can finish before Pause is complete. Pause does not switch off the ESP32, inverter, or battery.

1. To resume, select the red power button or Resume automation.
2. Confirm the action when requested.
3. Wait for fresh dispatch data and official REST confirmation.

Rules, enablement, and Pause survive a restart. Do not run another worker against the same inverter during testing.

## 10. Review History and Activity

Pi and desktop hosts store power History. The web edition stores browser Activity.

ESP32 uses RAM History by default. Display updates and changed measurements do not cause Flash writes.

1. Open History.
2. Select the displayed time range.
3. To enlarge a chart, select Expand.
4. To download the visible records, select Export CSV.

Missing readings remain missing. Averages are based on recorded observations.

### Optional ESP32 Flash History

Flash saving is off by default. When enabled, the ESP32 saves at most one hourly batch.

Saved hourly averages are retained for up to 60 days. The latest unsaved hour can be lost after power loss.

1. Open Settings.
2. Enable Save hourly history to Flash.
3. Review the storage explanation.
4. Save the preferences.

The supported board has sufficient reserved storage for these hourly records. Flash availability and write errors appear in storage status.

Configuration changes are saved separately from History. Disabling Flash History does not remove saved Wi-Fi or API settings.

## 11. Troubleshooting

### USB does not connect

1. Check that the cable supports data.
2. Close other serial tools.
3. Select the USB-UART port.
4. Check the supported board model.
5. If firmware recovery fails, hold BOOT while pressing RESET.

iPhone browsers do not provide the desktop USB setup flow. Use the local dashboard after desktop setup.

### Dashboard address is unknown

1. Check the router's connected-device list.
2. Alternatively, connect USB setup.
3. Read Device status.

A router DHCP reservation prevents unexpected address changes.

### An API update is delayed

1. Open Connections.
2. Read the service status.
3. Check the next-request countdown.
4. After the cooldown, request one manual refresh.

ESP32 cold-start tariff discovery can take several minutes because requests share a 60-second gap.

The tariff panel shows the current stage and next request slot. Repeated clicks do not bypass rate limits. Valid cached dispatches remain available during temporary failures.

### FoxESS differs from the requested schedule

1. Check that Mode Scheduler is enabled in FoxESS.
2. Check the app's Pause state.
3. Check official REST confirmation.
4. Check measured power separately.

Do not infer battery behaviour from command acceptance alone.

### Protection or settings need attention

A forgotten Config Password cannot reveal old USB secrets. Replacement setup can overwrite entered settings while retaining existing protection.

Optional LAN access protection has a separate physical-USB recovery control. That control does not unlock Config Password.

## 12. About, licences, and support information

About & licences is in the lower-left menu. Its Components tab identifies bundled software and the relevant notices.

Smart Charging is independent software by SCKC under GPL-3.0-or-later. Octopus Energy and FoxESS do not endorse or support it.

The complete application licence and third-party notices are included. The About panel shows version and edition information.

Before reporting a problem, note the edition, version, service status, and relevant time. Never include API keys or passwords.
