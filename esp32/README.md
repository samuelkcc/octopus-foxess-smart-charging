# ESP32 dashboard and automation firmware

This firmware targets an ESP32-S3 with 16 MB flash and 8 MB octal PSRAM.
It uses ESP-IDF v5.5.2.
The interface defaults to English.

The firmware provides USB deployment, a LAN dashboard, a background controller, and optional persistent History.
The dashboard uses the shared interface style and the existing view, setup, settings, and About owners.
The ESP32 runs automation while phone and desktop dashboards are closed.
An additional USB diagnostic can test one future Force Charge period and restore the original schedule.
Cloudflare is omitted. Bluetooth is disabled at build time. GitHub OTA is available after the initial USB installation.
Local Settings supports service accounts and optional LAN protection.
The USB setup tool is available as a website, macOS app, and Windows portable app.
See `desktop/README.md` for supported boards and packaging.
See the feature review for verified scheduler cases and remaining hardware test limits.

## Open the dashboard

1. Open the device's local IP address on your phone or computer.

New deployments do not require an access code on the local network.
The default matches the desktop edition.
To enable protection, open **Settings → LAN access**.
Enter and confirm a code with 6 to 128 characters.
Select **Save LAN access**.
Review the change before applying it.
The device stores a salted PBKDF2 hash, not the entered code.
Changing protection revokes previous browser sessions.

### Recover optional LAN protection through USB

1. Open USB setup in desktop Chrome, Edge, or the ESP32 Setup app.
2. Open **Device**.
3. Connect the configured ESP32.
4. Open **LAN access recovery**.
5. Confirm that protection can be turned off.
6. Select **Reset LAN access**.

This recovery uses physical USB access and requires no pairing code.
Wi-Fi, API settings, and automation rules are kept.
A signed-in browser remains authenticated for 30 days, including restarts.
Browser-cookie hashes persist in a single authentication record.
The local HTTP cookie is HttpOnly and SameSite=Strict.
Changing protection or resetting access revokes existing sessions.
Host, Origin, CSRF, and proxy checks remain active when LAN protection is off.
No service API keys are returned to dashboards.

## Enable actual control

1. Stop other automation workers for the same inverter.
2. Open **Automations**.
3. Review Smart Dispatch, weekly rules, prices, and SOC limits.
4. Enable **ESP32 automation**.
5. Select **Review & apply**.
6. Review the complete settings summary.
7. Select **Apply to ESP32**.
8. Wait for fresh dispatch data and official REST confirmation.

Applying can replace existing inverter periods.
New installations start with automation disabled until the operator applies their rules.
Saved enablement survives restart.
Pause also persists and blocks schedule writes while monitoring continues.
An in-flight command must finish before the dashboard reports pause as complete.
Resume requires fresh dispatch data and current official REST schedule reads.

## Background controller

The controller reads Octopus Smart Dispatch through authenticated GraphQL.
Null, invalid, failed, and rate-limited dispatch replies retain the last valid windows.
Stale or invalid dispatch data prevents new schedule writes.
Changed valid windows reach reconciliation before account or tariff work.

The pure policy module handles Smart Dispatch, import-price charging, export-price discharging, weekly periods, and temporary modes.
Smart Dispatch takes priority over ordinary charging, discharging, and temporary modes.
Dispatch times round outward to half-hours.
Overnight weekly periods retain their selected start day.
Auto-Resume ends the active ordinary charge at its target SOC.
It cannot cancel an active Smart Dispatch.

The controller selects Smart Dispatch periods before ordinary periods within the five-period limit.
Omitted ordinary periods produce a partial result.
More than five dispatch periods block programming.
The dashboard never labels a partial schedule as fully confirmed.

Two fresh REST reads must agree before a changed schedule is written.
The device saves a durable intent before sending the command.
A separate fresh official REST readback must match the programmed controls.
Command acceptance alone cannot confirm success.
Rule revisions received during a write remain queued for fresh reconciliation.
Failed reads and readbacks back off before retrying.

Octopus requests share a queue with at least 60 seconds between sends.
Authentication tokens remain in RAM and are reused.
Fixed IOG day/night rates are expanded into the standard half-hour timeline.
Initial account and tariff loading can take several minutes.
FoxESS reads and writes share request spacing and rate-limit cooldowns.
Dashboard polling reads cached ESP32 state without extra upstream requests.

## Dashboard port

The default port is 8787, including existing devices without a saved port record.
Open `http://DEVICE-IP:8787/` on the same local network.
The USB Network step can save another port from 1 to 65535.
Restart ESP32 to apply the saved port.
Port storage is separate from encrypted credentials and saved automation rules.
Wi-Fi, IP, and port changes remain USB-only.

## RAM History

The worker collects 15-minute averages from its existing telemetry requests.
It adds no separate cloud requests.
Missing measurements remain unavailable. Measured zero is retained.
The reserved RAM buffer holds up to 60 days on the N16R8 board.
The operator can select 1–60 days of RAM retention.
Four dashboard charts and CSV export use recent RAM records and any retained hourly Flash records.
Restarting clears only unsaved RAM observations.
Rules, network settings, credentials, and browser sessions survive restart.

## Current limits

UK clock changes no longer block schedule programming. Repeated hours map onto civil inverter minutes.
Auto-Resume retains source completion until its original end. Falling SOC does not restart a completed ordinary charge.
Long-running reliability, physical battery behaviour, and maximum History retention need operator verification.
Local Account setup supports Octopus, FoxESS REST, and optional WebSocket credentials and tests.
The existing USB setup remains available for credential and network changes.

## Build

1. Install ESP-IDF v5.5.2 from Espressif.
2. Activate its environment.
3. From the repository root, run:

```sh
idf.py -C esp32 -B "$PWD/.build/esp32-firmware" -D SDKCONFIG="$PWD/.build/esp32-sdkconfig" build
```

Build products remain in the ignored `.build/` directory.
The factory application and two OTA slots each reserve 3 MB.
OTA writes an inactive slot and verifies the release SHA-256 before boot selection.
Bootloader rollback is enabled. A pending image needs successful server startup and a working local connection.
The check occurs after 30 seconds. Failed connection checks cause rollback after 120 seconds.
Default OTA preserves settings. Explicit Clean OTA requires ERASE and deletes settings only after a confirmed healthy boot.
The initial USB install must include the OTA-capable bootloader.

## USB setup

New setup / Reinstall first erases settings and History, then installs firmware after explicit deletion confirmation.
Connect ESP32 becomes available after verified installation.
Use Edit settings to retain the existing configuration without reinstalling.

The board's CH340 interface connects UART0 through GPIO43 and GPIO44 at 115200 baud.
The native USB connector is not the setup transport in this firmware.
The setup page is `prototype/esp32-usb-test/index.html`.
Its local server accepts no configuration requests.

Each USB command is one JSON line with `protocol`, `version`, `id`, and `command` fields.
The protocol name is `sc-esp32`, and its version is `1`.
Replies begin with `SCESP1 `, followed by JSON.
Setup commands are `hello`, `status`, `scan`, `network_info`, `network_trial`, `suggest_ip`, `configure`, `test`, and `reboot`.
The internal `configure_recheck` diagnostic validates and saves unchanged stored settings without exposing them.
Additional diagnostic commands are `schedule_inspect`, `manual_future_charge_test`, and `schedule_recover`.
Dashboard state is available through `runtime_state`.
USB account tests use `service_setup` and `service_setup_status`.
Unknown commands are rejected.
The configuration schema has an explicit field allowlist.
`config_read` returns saved credentials only through physical USB.
Existing devices without a Config Password allow this read automatically.
Sensitive setup fields remain masked until the eye button is selected.
`config_access_set` sets, changes, or removes the optional Config Password.
Changes to existing protection require its current password.
Skipping reading permits replacement setup but retains existing protection.
Password hashes use PBKDF2-SHA256 with a random salt and 100,000 iterations.
Five failed attempts cause a 60-second delay.
Corrupt authentication records fail closed.
These commands never grant LAN dashboard privileges.

## Verified deployment

Run `npm run build:esp32-deploy` after building and checking the firmware.
The generated `dist/esp32-deploy/` directory can be hosted as a static GitHub Pages site.
The build command does not publish it.
Desktop Chrome and Edge provide the required Web Serial transport.
The page uses the other editions' visual style and includes English setup guidance.

`network_trial` temporarily connects with DHCP without saving credentials.
`suggest_ip` probes up to 16 candidates with ARP and ping.
No response does not guarantee that an address is unused.
The operator must review the router DHCP pool before selecting a fixed address.
The firmware probes a requested static address again before applying it temporarily.

`configure` tests the candidate in RAM.
Wi-Fi, IP, clock synchronization, Octopus REST, and FoxESS REST must all pass before NVS storage.
Failed validation restores the previous runtime settings and leaves persistent configuration unchanged.
A browser capability check prevents older firmware from enabling the new save flow.

The browser installer validates fixed partition boundaries and download SHA-256 hashes.
It verifies each written part through the bootloader's MD5 command.
It excludes NVS sectors and never requests a complete flash erase.

## Persistent configuration

Wi-Fi settings and service credentials survive restart.
Wi-Fi driver storage remains in RAM to avoid duplicate plain-text credential records.
NVS retains an AES-256-GCM configuration blob with a random nonce and integrity tag.
The development encryption key is stored in the same device's NVS.
This design does not protect against physical flash extraction.
Hardware key protection requires a separate provisioning decision.
This build does not enable secure boot or flash-encryption eFuse programming.
Initialization does not automatically erase NVS on failure.

Rules, enablement, Pause, refresh preferences, and optional LAN protection also persist.
History remains in RAM by default. Optional hourly Flash saving retains hourly averages for up to 60 days.
Retention can exceed 14 days within a reserved memory budget.
Restart and power loss clear RAM history.

## Connection tests

Tests require an explicit USB command.
They wait for Wi-Fi and time synchronization before HTTPS requests.
Certificate verification uses the ESP-IDF certificate bundle.
Upstream redirects are disabled.
The Octopus test reads the configured account through official REST.
It does not validate Smart Dispatch GraphQL permissions.
The FoxESS test reads SoC through `/op/v0/device/real/query`.
Results contain generic status and error codes, without raw upstream responses or credentials.
Repeat tests wait at least 60 seconds.
HTTP 429 responses extend the in-memory cooldown.
Restarting clears that cooldown, so operators must not restart to bypass an upstream limit.

The LAN dashboard exposes authenticated state, rules, temporary-mode, History, login, and logout routes.
It does not expose credentials, account identifiers, inverter serial numbers, or USB network configuration.
The controller is independent of the Pi worker.

## Dashboard and access requirements

The dashboard retains the other editions' navigation, cards, status terms, controls, and mobile behaviour.
Interface reuse must preserve the existing engine element IDs and view adapters.
The ESP32 data transport and firmware scheduler must remain separate from interface code.

Wi-Fi and IP changes require the deployment website through physical USB.
The future authenticated LAN dashboard may change Octopus and FoxESS credentials.
Cloudflare URL and Remote Access Key retrieval or management must require authenticated LAN access.
Remote dashboard routes must exclude network, account, key management, and administration endpoints.
A private source IP or forwarded header must not grant local privileges.
Cloudflare transport is not implemented or selected yet.

## Authorised future-period diagnostic

This diagnostic requires an explicit operator request.
Before running it, stop other automation workers for the same inverter.
If operator pause is active, resolve that pause before authorising a write.
Keep the ESP32 powered until restoration is confirmed.

The USB command requires `operator_ready: true` and `confirmation: "FUTURE_CHARGE_TEST_AND_RESTORE"`.
The requested date must be today in Europe/London.
The half-hour test period must start at least two hours ahead.
It cannot cross midnight or overlap an existing active period.
The diagnostic preserves the five-period application limit, even if the device reports a larger capacity.
It copies control parameters from an existing Force Charge period.

Two fresh REST reads must agree before a write is allowed.
The original and candidate schedules are saved in a device-bound NVS recovery journal.
The journal must be committed before the test write.
Fresh official REST readback must confirm the future period.
The firmware then restores the original schedule and reads it back again.
Command acceptance alone never confirms programming or restoration.
Neither result proves measured battery power during the future window.

After an interruption, a pending journal permits restoration of the original schedule.
Recovery starts after Wi-Fi and clock synchronization, with two-minute retries after failure.
If a different schedule revision is found, recovery stops overwriting it.
The USB status reports `schedule_restore_pending` until the journal is cleared.
An inverter change is blocked while restoration is pending.
The LAN status page and normal setup buttons cannot initiate the diagnostic.

## Verification

Run `node scripts/test-esp32-provisioning.mjs` for mocked USB behaviour and firmware endpoint checks.
With ESP-IDF available, run `npm run test:esp32-schedule` for native policy and transaction tests.
Run `npm run test:esp32-runtime` for controller, authentication, restart-pairing, tariff, and transport contract tests.
Run `npm run check` before packaging.
The ESP-IDF build enables the boot-time PSRAM memory test.
Record the installed firmware SHA-256 and actual device checks separately.
Connection success does not demonstrate scheduler parity or measured inverter behaviour.
The operator reported a physical power cycle before the diagnostic firmware update.
Saved configuration, automatic Wi-Fi reconnection, and both REST connections passed after that cycle.
The live future-period diagnostic confirmed a test schedule and then confirmed restoration of the original schedule.
The detailed installed hashes and verification limits are recorded in `VERIFICATION.json`.

Copyright (C) 2026 SCKC. GPL-3.0-or-later.
Independent software. Not endorsed or supported by Octopus Energy or FoxESS.
The firmware embeds the full GPL, project notices, and `SDK_NOTICES.txt`.

## History storage

Flash saving is off by default.
The live dashboard and 15-minute RAM observations update through normal telemetry requests.
Display updates do not write History to Flash.
RAM retention is configurable from 1 to 60 days.

1. Open Settings.
2. Enable **Save hourly history to Flash**.
3. Select **Review & save preferences**.
4. Confirm the change.

When enabled, the ESP32 saves one hourly average per batch, at most once each hour.
Saved records remain available for 60 days after restarts.
Recent unsaved readings can be lost after power loss.
Disabling this option stops new History writes. It does not erase existing records.
The viewer uses recent RAM observations and older hourly records.
CSV includes record resolution and storage source.

The journal uses 128 KiB of the board's 16 MB Flash.
Configuration and firmware partitions keep their existing addresses.
The new History partition requires the current partition table from USB firmware installation.
Mock tests cover power interruption, restart recovery, retention, and write pacing.
Enabled Flash saving and long-running retention still need operator hardware verification.

## Circular automation control

Green means automation is running. Red means it is paused.
Select the circle to open confirmation. Cancel keeps the existing state.
Pausing leaves the device and monitoring running. The current inverter schedule remains programmed.

## Local dashboard access

This ESP32 edition supports local-network access.
Cloudflare remote access is omitted from this ESP32 edition.
No Cloudflare account is needed.

1. Connect your phone or computer to the same local network.
2. Open the ESP32 address shown by USB setup.
3. If LAN protection is enabled, enter your LAN access code.

The ESP32 continues automation when the setup computer is off.

## Dashboard entry and refresh

Welcome uses the shared dashboard composition.
In Settings → Appearance, enable **Open Dashboard directly** to skip Welcome on this browser.
This preference does not bypass optional LAN access protection.

The header API controls queue fresh worker reads for both services and the official FoxESS schedule.
A minimum request gap and upstream cooldowns still apply.
Dashboard polling does not create additional cloud requests.
Account and device information comes from the worker cache.
API keys remain on the device.

The Octopus parser accepts space-separated timestamps with explicit UTC offsets.
The dashboard receives canonical ISO timestamps.
Invalid responses retain the last valid windows.

## Local distribution folders

- `ESP32/macOS` contains the Universal setup app and ZIP.
- `ESP32/Windows` contains the setup EXE.
- `ESP32/Web` contains the complete HTTPS USB setup website.
- `Windows Portable` contains the desktop automation host EXE.
- `Web HTML` contains the standalone browser app.
- `Pi` contains the service package and installation guide.

The setup app supports ESP32-S3 N16R8 boards with 16 MB Flash and 8 MB Octal PSRAM.
No download is published automatically.

## User guide and account setup

The left menu includes the shared [User guide](../docs/USER-GUIDE.md).
Its first chapter compares editions and setup responsibilities.
The same guide is bundled offline in the setup apps and dashboard.

Local-IP Settings can test and save Octopus and FoxESS service credentials.
Wi-Fi and IP changes remain USB-only to avoid losing the original dashboard address.
Each service has separate Test and Test & save controls.
Tests do not save candidate credentials or program schedules.
Saving core API credentials requires disabled control or explicit operator Pause.

Optional FoxESS WebSocket telemetry uses an independently stored cloud login.
REST remains the default and schedule authority.
The native portal signer matches the Pi WebAssembly output without its 16 MB heap.
This unofficial portal interface still requires a live test with operator-supplied login details.

Config Password protects USB protocol reads, not physical Flash extraction.
It does not change optional LAN access protection.
The setup form clears on disconnect and page exit.
The tool does not upload credentials or persist the form in browser storage.

## Prepare an OTA release

1. Build the final firmware.
2. Run `node scripts/prepare-esp32-ota.mjs`.
3. Commit `esp32/ota-release.json` with the release source.
4. Publish the matching application binary as `SmartCharging-ESP32-Firmware-VERSION.bin` in `esp32-VERSION`.
5. Publish the frozen metadata as `ota.json` with that release.
6. Deploy GitHub Pages from the same source revision.

Pages copies the frozen release digest. CI-rebuilt USB binaries do not replace that digest.
The release binary must match the committed SHA-256 and size. Do not regenerate the frozen record from a different binary.
OTA trusts verified HTTPS from the project publisher. It does not add hardware Secure Boot or an eFuse signing requirement.
[ESP-IDF OTA documentation](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32s3/api-reference/system/ota.html) explains pending-image confirmation and rollback.
