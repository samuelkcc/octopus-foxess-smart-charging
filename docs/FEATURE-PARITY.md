# 2.5.1 — 6 November 2026

New ESP32 deployments start automation after verified Wi-Fi and IP settings are saved.
Existing disabled rules and operator Pause remain unchanged through edits, restarts, and OTA.
OTA uses a temporary control hold without rewriting saved enablement or Pause.
Failed updates restore control with fresh dispatch and REST reads. Successful updates resume the saved state after boot verification.
Clean update still requires setup again. Firmware 2.5.0 requires manual Pause for its first OTA update.
Settings cards use independent columns to remove empty row gaps. Mobile uses one column.
Native regression tests cover activation persistence, storage failure, existing Pause, update suspension, failed downloads, and boot verification.
Physical OTA and native Windows execution remain unverified.

# 2.5.0 deployment and account workflow — 6 November 2026

OTA uses a fixed project manifest and strict GitHub download hosts. Redirects to HTTP or other hosts are rejected.
SHA-256, length, image validation, application identity, and persistent intent must pass before boot selection.
All download writes target an inactive application partition. Failed downloads keep the current boot selection.
A healthy server and local connection are required before confirming a pending OTA boot.
Default OTA keeps settings. Explicit Clean OTA erases settings and History only after confirming the intended image.
Mock tests cover corrupted and truncated downloads, blocked redirects, storage failure, clean consent, boot confirmation, and rollback.
Physical OTA, interruption recovery on hardware, and native Windows execution remain unverified.

Wi-Fi and IP verification remain mandatory. Network-only saving performs no Octopus, FoxESS REST, or portal-login tests.
The earlier test-before-save protocol remains available for compatible legacy clients. New tools require the network-only capability.
Account setup uses one sequential Test all APIs action. One failed check does not skip other configured services.
Save accounts stores credentials independently from testing. Pause and recovery barriers still protect API credential replacement.
Recent test faults and worker semantic faults are exposed without credentials in device state.
Fresh successful worker readings supersede older diagnostic failures. Waiting is separate from failure.
The shared scheduler engine and Pi authentication are unchanged. ESP32 remains local-network only.
Mock verification covers network failure rollback, unverified credential storage, sequential tests, and semantic failures with HTTP 200.
No live board erasure, flashing, or inverter command is used in verification. Native Windows execution remains unverified.
The tutorial remains private until its captures match the simplified flow and the user approves publication.

# 2.4.4 installation entry review — 6 November 2026

The public deployment tool has two task entries. New setup / Reinstall includes firmware installation before configuration.
The setup serial connection cannot run before installation on this path.
A verified install opens Connect ESP32, followed by Network, Accounts, and Verify & save.
Every public installation uses Clean install with model confirmation, deletion consent, and exact ERASE input.
The installer validates every image and supported hardware before erasing once.
Edit settings retains the existing configuration and does not invoke installation.
Tests use mock serial devices and bootloaders. No live board erasure is part of verification.
The tutorial is withheld while its instructions and captures are updated.

# 2.4.3 credential controls and preparation guide — 6 November 2026

ESP32 credential fields reserve a separate 44-pixel touch target for each SVG eye button.
Desktop and 390-pixel browser checks confirmed an eight-pixel gap and 20-pixel icons in all six controls.
Visibility changes retain edits. Labels change between Show and Hide. Page exit clears and masks inputs.
No scheduler, transport, storage, or access-policy changes are included.
The README and edition guides link one shared credentials preparation page.
The user confirmed the physical iPhone Home Screen icon is correct.
The tutorial is private until the user approves its voice and content.

# 2.4.2 installer and documentation review — 6 November 2026

The repository README introduces ESP32 first. Separate setup pages cover ESP32, Pi, Windows Portable, and HTML.
Each installer condition is shown beside the disabled button. Disconnect releases setup USB without unplugging the cable.
Normal reinstall keeps settings. Clean install requires deletion consent and the exact word ERASE.
All images and hardware checks complete before the erase command. The erase occurs once before partition writes.
Failed download verification, unsupported hardware, missing confirmation, and erase failure prevent programming in mock tests.
No live board was erased. Native Windows execution and long-term Flash endurance remain unverified.

# 2.4.1 interface and USB network review — 6 November 2026

- Shared mobile help uses centered SVG icons. The duplicate page-name row is hidden.
- API badges remain left of the operator switch in the shared toolbar.
- Current ESP32 firmware permits serialized read-only Wi-Fi scanning while control runs.
- Wi-Fi testing requests explicit confirmation before disabling automation through USB.
- The disable operation waits for the worker network lock and preserves other rules and Pause.
- Failed confirmation does not start a network trial. Entered form values remain available.
- Native runtime and serial mocks cover these transitions without live schedule commands.
- Pi and web Welcome entry, Portable Account setup, and guide chapters were reviewed with isolated services.
- The website has two main entries. Downloads, edition chapters, and the interface gallery use separate pages.
- USB setup separates New setup, Edit settings, and Reinstall firmware. Native serial mocks cover each entry.
- All published interface screenshots were recaptured from isolated demonstration services.

Windows execution, continuous WebSocket operation, and long-term Flash endurance remain verification limits.
The new USB network transition was tested with mocks. Changing the user's live SSID is not part of release verification.

# 2.4.0 scheduler and deployment review — Unreleased

ESP32 defaults to HTTP port 8787. Physical USB can save another port for the next restart.
Port storage is independent of credentials, optional USB protection, and automation rules.
Host and Origin checks require the active port. Dashboard configuration cannot change it.

The former 24-hour UK clock-transition guard is removed.
Weekly periods use civil weekdays and carry-over minutes, matching Pi scheduling.
Repeated-hour dispatches cannot become an all-day period.
The shared Pi scheduler also applies the selected ordinary SOC limit to weekly charging.

Auto-Resume retains the completed weekly or price source until its original end.
A falling SOC or missing reading does not reactivate that source.
Smart Dispatch remains protected. New control rules, temporary periods, or explicit resume reset completion memory.
General refresh and History settings do not reset completion memory.
Only fresh telemetry can establish completion.

Native tests cover falling SOC, overnight completion, source isolation, dispatch overlap, next-day expiry, and both UK clock transitions.
Differential tests run the actual Pi evaluation function against the native ESP32 planner.
The original known clock guard and non-latching Auto-Resume differences are superseded by this section.
Earlier sections retain the historical verification record.

The final firmware was installed from source commit `e3ae1e619f6a903af6dc9115be03f1f3caff2c39`.
Port 8787 returned HTTP 200 for the dashboard, cached state, and manifest.
Existing rules, automation enablement, and Pause state survived the app-only update.
All 42 deliverable checksums passed. Web, Mac, and Windows setup contain identical UI and firmware payloads.
The Mac Universal signature check and native launch passed.
Physical iPhone access remains unresolved. Port 8787 does not yet establish a network fix.
Cloudflare remains excluded. Native Windows execution and long-term hardware operation remain unverified.

# 2.4.0 mobile help review — Unreleased

Mobile dashboards and USB setup use compact User guide (?) and About (!) buttons beside the brand heading.
The existing buttons move between the mobile header and desktop sidebar.
Their IDs, dialog handlers, and focus targets remain unchanged.
Desktop layouts retain full text labels in the lower sidebar.

Browser checks covered ESP32 and Pi dashboards, plus USB setup at 390 pixels.
The ESP32 header also fit at 320 pixels without horizontal overflow.
Both drawers opened and closed, with focus returning to their trigger.
Resizing restored one copy of each desktop sidebar button.
The full check, DEV build, and Python AST check passed.
These checks used local fixtures, not the physical iPhone.
The change has not been installed on the ESP32 or published.

# 2.3.1 Preview release review — 6 November 2026

This section supersedes earlier development reviews below.

ESP32 appears first in the introduction and edition comparison, followed by Pi, Portable, and Web HTML.
The shared Welcome links include the ESP32 USB deployment website.
The User guide contains a dedicated ESP32 deployment chapter and an explicit capability comparison.
HTTPS deployment and download links render as links. Other URL schemes remain plain text.

ESP32 and native Portable Settings separate General settings from Account setup.
The Portable account editor requires the native desktop bridge. LAN clients do not receive that bridge.
ESP32 account cards use existing local API tests and save endpoints. Wi-Fi and IP changes require physical USB setup.
Switching tabs retains the existing controls and unsaved values. Tab navigation supports arrow keys, Home, and End.

ESP32 serves embedded PNG icons and a standalone manifest before optional LAN login.
The asset routes retain the local Host and proxy checks. No credential appears in these responses.
Existing iPhone shortcuts can retain their old icon until removed and added again.

ESP32 Cloudflare, remote relay, Bluetooth setup, and OTA are not supported.
The LAN account editor and optional FoxESS WebSocket telemetry are implemented.
WebSocket is read-only. Schedule writes and confirmation require official REST.

Shared presentation does not establish complete scheduler parity.
The ESP32 clock-transition guard and advanced Auto-Resume differences remain documented release limits.
Only mocked scheduler commands are used for this release verification.
The full check, DEV build, Python AST check, and shell syntax check passed.
Native ESP32 runtime, transport, access, live-signature, and schedule suites passed.
Browser checks covered separate Web and Pi Welcome entry and native Portable account editing.
ESP32 and Portable tab switching retained unsaved demonstration input. Arrow-key tab navigation passed.
All public interface screenshots were recaptured with isolated demonstration services.
Native Windows execution and physical iPhone Home Screen installation require separate device checks.

# Historical development reviews

The following sections describe earlier build states. They are retained as development evidence.

# Shared dashboard design review

Page headings, About navigation, Pause switch, paused banner, Overview, and Connections use shared presentation code.
About opens from the lower-left menu into its existing right-side drawer.
The circular control shows green when running and red when paused. Pending or unavailable states are neutral.
Resume still requires confirmation. The interface does not change scheduler policy.
ESP32-specific host configuration appears in Settings.
Removed ESP32 grid overrides caused the previous wide, separated Connections cards.
Web and Pi mock browser checks cover separate login paths and the Pause dialogs.
ESP32 mock browser checks cover Pause, resume confirmation, About, and paired Connections cards.
The operator confirmed direct iPhone Safari access and normal data before this design update.
The revised physical iPhone layout and native Windows execution remain unverified.
Browser Activity still differs from host power History. This change does not establish complete functional parity.
At that review, Cloudflare relay support remained pending. It was later removed from the ESP32 scope.

# ESP32 dashboard control review

The LAN root now serves the shared Overview component instead of the connection-test status page.
The dashboard uses the existing desktop viewport, Chart.js version, tariff styles, and directional power labels.
About uses a centred SVG close button. Settings fields have explicit spacing.
Overview, Schedules, Automations, History, Connections, and Settings use the existing view owners.
The firmware contains an independent background controller with real FoxESS command support.
Smart Dispatch, price rules, weekly schedules, SOC limits, temporary modes, and persistent Pause have native policy tests.
Tests cover fresh REST readback, durable intent failure, queued revisions, failed readback backoff, and 429 cooldowns.
Allocation fault tests prevent incomplete Smart Dispatch plans from becoming valid empty schedules.
Fixed IOG day/night loading continues without starving dispatch refreshes.
Monitoring and tariff work continue while automation is disabled or paused.

LAN access protection defaults to off, matching the desktop edition.
Settings can enable a persistent LAN access code.
There is no pairing code. Physical USB can reset optional LAN protection.
Random browser-cookie hashes persist for 30 days.
Authentication tests cover default-open access, persistent opt-in protection, code login, failure handling, restart recovery, revocation, CSRF, Origin, Host, forwarded requests, and login limits.
No service credentials are returned through dashboard state.
Network and credential changes still use USB setup in this build.
The LAN account editor, Cloudflare transport, Bluetooth, and OTA remain unimplemented.

History uses a reserved RAM buffer for up to 60 days of 15-minute observations.
Optional Flash storage retains one hourly average for 60 days. It defaults to off.
Long-running retention and physical battery behaviour are not established by mock tests.
A UK clock transition in the next 24 hours retains the existing schedule and blocks new programming.
This guard is a verification limit, not complete DST parity.
Live GraphQL and FoxESS REST checks returned HTTP 200.
Enabled controller revision 2 passed fresh official REST confirmation.
The active rules preserve the existing daily 23:30–05:30 charge baseline and follow Smart Dispatch.
Software restart retained the static IP, configuration, controller rules, and browser sessions.
Separate Pi and standalone web login browser checks passed.
The exact installed image and live results are recorded in `esp32/VERIFICATION.json`.

# Previous ESP32 connection-test review

This section records the earlier connection-test image.

The ESP32 connection-test prototype is separate from the released web, Pi, and desktop editions.
It verifies a firmware handshake before allowing USB configuration or tests.
Configuration previews hide passwords, API keys, account numbers, and inverter serial numbers.
The English Deploy page uses the existing visual style with one visible step and fixed Back/Next controls.
Contextual guidance follows the active step without a separate scrolling column.
About and complete licence content use a top-bar button and a right-side drawer.
The lower-left development message is removed.
Desktop and mobile browser checks verified the layout, drawer opening, Escape dismissal, and focus return.
The browser installer checks image hashes and preserves the NVS configuration sectors.
Its physical browser-flashing verification is recorded separately in `esp32/VERIFICATION.json`.
All network and API checks must pass before configuration is saved.
A temporary DHCP trial and optional ARP/ping IP suggestion do not save settings.
Static IP selection requires review against the router DHCP pool.
Native tests cover validation failures, storage failures, restoration, and subnet-safe candidate selection.
The full dashboard must retain the other editions' navigation, cards, controls, and mobile behaviour.
Network settings require the USB website. Service credentials may use the future authenticated LAN dashboard.
Cloudflare URL and Remote Access Key management require LAN authentication.
The future remote dashboard must not expose network, account, credential, or administration settings.
Device configuration uses an allowlisted USB protocol. Routine cloud connection tests are read-only.
The additional USB future-period diagnostic requires explicit readiness and test-and-restore confirmation.
Development AES-GCM storage cannot protect credentials against physical flash extraction.
All firmware settings must persist across restarts. Only History remains in RAM.
History can exceed 14 days if the reserved memory budget permits it.
Actual retention requires runtime memory testing with networking and dashboard clients.
Command-line identification confirmed ESP32-S3, 16 MB flash, and reported 8 MB PSRAM.
A live Chrome connection opened the USB serial port and displayed its interface IDs.
The prototype defaults to English. Firmware implements a 2.4 GHz Wi-Fi scan command.
The installed firmware passed its 8 MB PSRAM boot test, USB handshake, and live 2.4 GHz Wi-Fi scan.
Chrome completed the firmware handshake and displayed actual scan results.
Invalid configuration and unsupported inverter-control commands were rejected on the device.
The installed firmware and interface hashes are recorded in `esp32/VERIFICATION.json`.
The operator saved real configuration through Chrome USB setup.
Wi-Fi and time synchronization succeeded. Octopus account REST and FoxESS telemetry REST both returned HTTP 200.
FoxESS returned API code 0. Automation remained disabled.
After software restart, configuration was recovered and Wi-Fi reconnected without entering settings again.
An operator-reported physical power cycle retained configuration, reconnected Wi-Fi, and passed both REST connection tests.
Native tests cover future-only planning, capacity, control preservation, allocation failures, ambiguous writes, rollback, and concurrent revisions.
The live diagnostic used two authorised schedule writes: a future Force Charge period and restoration.
Fresh official REST reads confirmed the test period and independently confirmed the restored original schedule.
No recovery journal remained after the test. No measured charging-power test was performed.
No unattended scheduler is implemented. Smart Dispatch access and scheduler parity remain unverified.
A physical power cycle of the final diagnostic firmware image was not performed.

# Version 2.0.1 release verification

The user approved publication after testing the Windows and web editions.
The redesigned interface is the default in all release assets.
Public screenshots use demonstration data only.

| Area | Verification |
|---|---|
| Smart Dispatch | Mock tests cover immediate reconciliation, overnight windows, priority, and queued revisions. |
| FoxESS safety | Mock tests cover five-period capacity, conflict handling, and fresh REST readback. |
| Operator pause | Write barriers, expiry, persistence, and activity tests pass. |
| Service disable | Native-only control blocks new upstream requests and preserves administration. |
| Octopus request budget | Pi spacing, concurrency, deduplication, restart guards, and actual cooldown tests pass. |
| Host dashboard snapshots | Concurrent clients read cached data without outbound requests or extra authentication. |
| FoxESS request budget | Routine cache and fresh post-command verification tests pass. |
| Remote access | Listener isolation, sessions, expiry, revocation, CSRF, and admin blocking pass with a mock tunnel. |
| History | Buffering, compression, migration, retention, low-space cleanup, and clear isolation tests pass. |
| Web GAS relay | Signed reads, writes, redirects, rejection, pause, and readback tests use the documented handler. |
| Windows service | Mock tests cover private key transfer, IPC origin isolation, encryption, and persistence. |
| User testing | The user tested Windows through UTM and the standalone web edition. |
| Shared UI | Browser checks use mock data for desktop, saved setup, mobile login, and native-host controls. |
| Restart recovery | A recovered browser transport incident can be reviewed and cleared after the host returns. |
| Pi live operation | Server, worker, taskbar registration, API health, and fixed 1920 × 1080 output were checked. |
| Public packaging | Existing Pi asset names are retained. Staging includes the redesigned Pi interface. |

## Practical limits

A fresh REST readback confirms the schedule programmed in FoxESS.
It does not prove measured battery behaviour on every inverter model.
No live inverter command or history deletion is used as a test action.

The automated Windows suite uses a mock host key.
It does not independently certify native DPAPI, firewall, sleep, or shutdown behaviour.
Public screenshots do not display a real account or device identifier.

A spare-Pi rollback exercise was not performed for this release.
The source-based development installer retains its backup and rollback paths.
The public installer preserves the configuration and history directories.

## Live public update

Release commit `40fa2893272d5185f65d2101aed909aa10d97ba2` was installed through the normal Pi updater on 27 October 2026.
Credential, LAN-code, and remote-key fingerprints were unchanged.
The history store retained 60 intervals. All three services and both energy APIs were healthy.
Four concurrent snapshot reads completed in approximately 0.02 seconds on the host.
The taskbar icon was visible, and the display remained at 1920 × 1080.
An unauthenticated request reached the correct release login entry.
Dashboard authentication remains required.
An authenticated test through that replacement URL was not performed.

## Version 2.0.1 maintenance review

- URL renewal preserves the remote key and uses the dedicated remote listener.
- Tunnel status requires a registered Cloudflare connection before it reports running.
- Warning badges open details without requesting API data.
- Recovered alerts expire after 24 hours by default. Active failures remain visible.
- The expiry preference persists across host and browser restarts.
- Slow reservation tests verify the API spacing floor. Pi startup also retains a full interval.
- New tests use mock tunnels and upstream services.
- Native Windows verification of this patch remains a user check.
- The Pi installed revision is `b1ffb035e850df1c6e4fd95e67e3c99840857e49`.

### Safari connection limit

Safari returned HTTP 403 for the direct Octopus preflight during an isolated invalid-key check.
Disabling content blockers did not resolve that response.
The temporary Safari preference changes were restored.
The user confirmed Chrome and Windows connections.
No live account query or inverter command was needed for this reproduction.

### Public patch installation

The normal Pi updater installed v2.0.1 on 27 October 2026.
The three system services were active after installation.
Octopus and FoxESS both reported healthy state.
Private fingerprints confirmed that account settings, LAN access, and the Remote Access Key remained unchanged.
History was backed up before the update.
The screen remained at 1920 × 1080 with normal orientation.

The live URL renewal returned a starting state without a ready address.
After Cloudflare connected, the host reported a different URL and the same key.
The replacement public URL returned the v2.0.1 dashboard runtime.
Authentication through the dedicated listener returned a secure session cookie during a loopback test.
No key was submitted through the new Cloudflare address during verification.

Both GitHub workflows passed for the release revision.
All downloaded release assets matched the published checksums.
The final local distribution contains one HTML file and one Windows EXE.
Native Windows execution of this patch remains a user check.

## Version 2.0.2 Safari compatibility review

- Existing browser setups retain direct Octopus access.
- Setup and Settings disclose Google relay processing before compatibility mode is selected.
- Saved browser setup and configuration backups retain the transport selection.
- Relay capabilities are checked before forwarding Octopus credentials.
- Mock tests cover Octopus sign-in, GraphQL data, account GET, and tariff GET.
- HTTP 429 and Retry-After remain visible to the request policy.
- Unsupported targets and methods cannot reach UrlFetchApp.
- FoxESS signatures, pause blocking, and fresh schedule readback retain regression coverage.
- Pi and Windows requests still use the local host API.
- The existing personal GAS deployment was updated to Version 2 without changing its URL.
- Safari received HTTP 200 with the expected invalid-key response through that deployment.
- The live connection check used an invalid demonstration key and no inverter command.
- No live inverter command is used for verification.

### Public v2.0.2 verification

The release UI revision is `356720b9c661718684310749af10d77141a715d7`.
Both GitHub workflows completed successfully.
The published app's Copy relay code action returned the exact canonical GAS source.
The personal deployment and downloadable relay source use that same code.
All downloaded release assets matched the published checksums.
The local distribution contains one HTML file and one Windows EXE.
Interface images use dark appearance. The mobile montage was supplied by the project owner.

## Version 2.0.3 history direction review

- Power charts show positive and negative directions with a clear zero line.
- Solar generation, grid import, and battery charging are positive.
- Home demand, grid export, and battery discharging are negative.
- Source fields remain paired with their original labels and colours.
- Expanded charts use the same data and axis limits.
- Battery level retains its 0–100% range.
- Tests cover missing readings, measured zero, original records, and CSV magnitudes.
- This presentation change does not modify telemetry, storage, authentication, or scheduler behaviour.
- Native Windows execution and installation on the user's Pi remain unverified for this patch.

## Version 2.0.4 tariff and diagnostics review

- Delayed tariff completion redraws charts during startup without replaying dashboard requests.
- Missing rates remain unavailable. Real zero and negative tariffs remain valid.
- Failed updates retain available rates and retry through the existing request budget.
- Successful tariff reads keep their 30-minute cache.
- Diagnostic records contain errors only, with grouping and a 100-entry cap.
- Restart and acknowledgement preserve diagnostic records.
- Export tests exclude account details, credentials, serial numbers, and private URLs.
- The user's Pi was running v2.0.3 during read-only diagnosis.
- All three Pi services were active. Both API services reported healthy live state.
- Recent Chromium graphics and desktop-bus warnings did not coincide with an active API failure.
- No live inverter command is used for verification.

### Public v2.0.4 installation

The normal Pi updater installed v2.0.4 on 27 October 2026.
The installed UI revision is `938259d7dc124c6ebfc5780530cdc1c7ae0eb3bf`.
All three services were active after installation. Both API services reported healthy state.
A private on-device backup preserves the previous settings and history.
Private fingerprints confirmed unchanged account settings, LAN code, and Remote Access Key.
The replacement public URL returned the v2.0.4 runtime without a credential submission.
Both GitHub workflows passed. All downloaded release files matched the published checksums.
The local distribution contains one HTML file and one Windows EXE.
Native Windows execution remains a user check.


## 2.0.5 tariff recovery review

- Fixed IOG standard/day/night transport and independent direction rendering: mock verified.
- Multiple dashboard tariff reads consume no Octopus requests: local server mock verified.
- Worker publication guard and snapshot field filtering: local server mock verified.
- Public-rate restart cache, expiry, failed responses, and private-data exclusion: verified.
- Live Pi installation: superseded by the 2.0.6 verification below.
- Native Windows execution: not repeated by Codex.

## 2.0.6 headless tariff review

- Worker tariff calculation with unavailable DOM: verified.
- Snapshot publication and retry precede visible chart rendering.
- Installed UI commit: `145e1d761631c9f37f18273c1b3cee4b5eac7f00`.
- Official Pi updater completed successfully on 2026-10-27.
- Post-restart shared snapshot: 144 import intervals and two export rate records, with no active tariff problem.
- Live Overview: 29.82p import and 12p export. Both charts rendered without manual API refresh.
- Live Octopus and FoxESS service health: healthy after the update.
- Welcome, Overview, and Settings navigation: verified through the Pi LAN dashboard.
- Retained recovered alerts remain visible until acknowledgement or configured expiry.
- Account credentials and access keys were verified unchanged during the 2.0.5 migration.
- Display remained 1920 × 1080 with normal orientation and scale 1.
- The existing native Chromium window was not reliably controllable through Pi Connect during the final check.

## Version 2.1.0 review

- Currency conversion keeps API rates and scheduler thresholds in UK p/kWh.
- Tests cover validation, persistence, negative rates, zero rates, chart conversion, and default recovery.
- Snapshot tests cover read failure, last-valid-price retention, recovery, and chart exceptions.
- Host transport tests verify snapshot metadata and zero additional upstream calls from dashboard reads.
- LAN tests cover disabled protection, missing codes, remote credentials, cross-site requests, rebinding, rotation, and rate limiting.
- The mock tunnel never creates public access.
- GAS code remains unchanged.
- No live Pi installation or native Windows execution is claimed for this release.
- The previous intermittent price incident remains unconfirmed on live hardware.
- Full `npm run check` and `npm run build:dev` passed before publication.
- Browser checks verified Pi Welcome entry, web account setup, web prices, manual currency display, and LAN management with mock values.
- A 390-pixel phone fixture verified the Settings entry and six-item navigation without horizontal overflow.
- LAN key reveal was checked with a demonstration key only.


## Version 2.2.0 review

- Live Pi diagnostics showed complete import/export data after startup queuing, with recent HTTP 200 responses and no observed 429.
- The Pi launcher log identified missing X11 display configuration in a Wayland session.
- The repaired launcher opened native Welcome without restarting the worker or tunnel.
- Restart display tests cover private storage, expiry, account/agreement isolation, and fresh-worker replacement.
- Cached display values remain absent from scheduler price arrays and live-price inputs.
- Web Activity tests cover backup validation, round trips, duplicates, retention, size limits, and unchanged pause state.
- Browser review verified web Welcome entry, Activity recording, JSON download, and duplicate-free import.
- Pi and desktop retain the host History view.
- The macOS package includes verified arm64 and x86_64 app, framework, and Cloudflare binaries.
- The macOS ad-hoc signature and bundled service/licence checks passed.
- Native Keychain, Intel execution, and current Windows execution require operator verification.
- No GAS change or live inverter test command is included.
- The full automated suite and both interface builds passed before publication.
- The [standard QA checklist](QA.md) distinguishes mock tests, package checks, and native review.

## Circular control and About review

The circular power control opens a confirmation dialog. Cancelling does not change the stored Pause state.
The device and monitoring continue while automation is paused.
History selection and export controls use equal heights and bottom alignment.
About lists component purpose, version, licence, source, and bundled notice access.
The curated inventory identifies key runtime components. Complete SDK notices remain available separately.
Optional Flash saving requires manual enablement in Settings. It is off by default.
Live display updates and RAM collection do not cause Flash writes.
The worker saves one hourly average in a batch, at most once each hour.
A dedicated 128 KiB journal rotates 64-byte records and erases one sector for each 64 records.
Checksums and commit markers reject interrupted records. Failed History I/O does not block automation.
Mock tests cover every interrupted write position, interrupted sector recycling, restart recovery, and multiple complete journal rotations.
The last 60 days remain readable after rotation. Missing observations remain gaps.
Runtime tests cover zero writes by default, opt-in, hourly pacing, disabling, mixed-resolution reads, and legacy-rule migration.
Flash saving remains disabled on the live device. Enabled hardware saving and a 60-day soak remain unverified.

## ESP32 local-access scope and presentation alignment

The operator removed Cloudflare remote access from this ESP32 edition.
Users open the dashboard on the same local network. No Cloudflare account is needed.
Charge-limit grouping and weekday order follow the shared dashboard.
Breadcrumb labels follow navigation labels after refresh.
History uses the shared grid, metadata row, and observation note.
Settings and supported storage choices remain specific to the host.
Firmware scheduler inputs and stored rule values are unchanged.

## ESP32 and Pi function mapping: local review

| Function | ESP32 implementation | Verification |
|---|---|---|
| Welcome | Shared composition; optional browser-local Dashboard entry | Live desktop entry and reload |
| Overview | Shared power, schedule and price composition | Live data and canonical timestamps |
| Schedules | Official REST schedule and reviewed temporary control | Read-only live review; mocked writes |
| Automations | Dispatch, weekly periods, price rules, SOC limits and discharge safeguards | Native policy mocks |
| API header refresh | Coalesced worker reads for both services and official schedule | Runtime and HTTP mocks |
| Authentication recovery | Expiry-aware RAM token; GraphQL expiry recovery | Mocked expiry; live sign-in |
| Account and device | Allowlisted cached account, EV, charger, tariff and target fields | Mocked cache and failure isolation |
| Pause | Shared circular control and confirmation; monitoring continues | Pi fixture cancellation; runtime mocks |
| History | Shared chart presentation; RAM and optional hourly Flash | Journal and runtime mocks |
| About | Shared drawer and tab navigation; complete bundled texts | Live tabs and GPL text |
| Setup | USB website or desktop app | Separate setup host tests |
| Cloudflare | Omitted from ESP32 | No tunnel deployed |

Full Pi worker equivalence is not established by this table.
The ESP32 clock-transition guard remains a scheduler difference.
Auto-Resume suppression across subsequent falling SOC readings requires further comparison.
The Pi supports richer schedule editing and persistent diagnostic records.
Those controls must not be described as implemented on ESP32 without matching adapters and tests.
Physical battery behaviour and long-running retention remain operator hardware checks.

## USB settings and optional WebSocket review

Saved settings load automatically when Config Password is absent.
Masked fields have individual eye controls.
Native Mac USB readback and the independent Octopus test passed against the connected board.
The user also confirmed a successful FoxESS REST test.

Optional Config Password uses a separate salted PBKDF2 record.
Mock tests cover legacy defaults, protected reads, failed attempts, rotation, removal, corruption, and save failures.
Reading can be skipped without removing existing protection.

Service tests and credential saves share a strict LAN/USB job actor.
Tests do not save credentials or program schedules.
Password input remains after tests and failed saves.
A successful save, disconnect, or page exit clears the relevant secret input.
Progress and errors appear beside the service controls.

The first live WebSocket test did not complete normally in the setup UI.
Its error was hidden on the Device step, while Accounts retained a Testing label.
The next build exposes individual connection stages and safe numeric errors.
A successful live WebSocket frame is still required before declaring that transport verified.

The User guide is bundled in all dashboard and USB setup editions.
Its first chapter compares versions and host responsibilities.
Web and Pi Welcome entry and guide open/close passed separate browser fixture checks.

## Verify & save and User guide entrance

The operator confirmed a live WebSocket test succeeded on the ESP32.
The previous final button was disabled whenever automation was enabled.
It now verifies unchanged saved Wi-Fi, IP, and API settings without reconnecting or rewriting them.
Both API tests must pass before the optional telemetry save starts.
Changed main settings still require disabled automation for full USB deployment.
The requirement appears beside the final button.

Mock tests cover running automation, unchanged fixed IP without new consent, changed-value blocking, failed API tests, and failed optional saves.
The native WebSocket test covers saving an identical recent test without another portal login.
A cached test cannot report live measurements as fresh.

The User guide uses a 240 ms slide from the right and a fading backdrop.
Reduced-motion preferences disable the animation.
These styles are shared by all dashboard and setup builds.

### Shared interface follow-up — 6 November 2026

Weekday selectors use full-tile checkbox targets across all editions. Connections no longer repeats the Settings or Schedules entry.
User guide opens with a right-side animation and respects reduced-motion preferences. USB tests and saves retain masked form values.
These interface changes do not change scheduler policy. Complete ESP32 scheduler equivalence remains unverified.

### Automation spacing — 6 November 2026

Shared rule labels have 16-pixel padding above and below separators. Paired charge-limit controls have no partial separator.
The ESP32 charging panel no longer removes top padding from every toggle. Scheduler controls and element IDs remain unchanged.
Web and ESP32 fixture checks verified the separator spacing.

### ESP32 dashboard cache and mobile recovery — 6 November 2026

Dashboard GET requests copy published RAM data without cloud calls or cache invalidation.
A native regression performs 100 independent state, account, and history reads.
It checks both tariff caches and verifies no additional cloud calls or schedule writes.
Rate limiting retains both cached tariff series.
Live independent readers received the same import tariff cache.
Initial caches are empty after a device restart while serialized discovery runs.

Connection mocks cover stalled fetches, stalled bodies, foreground recovery, and late replies.
Local concurrent reads returned complete HTML, JSON, and icon responses.
Device Hub confirmed the physical iPhone reports a lost network connection.
Physical iPhone recovery is not verified.
Web Inspector is currently disabled on that device.

## ESP32 read-only diagnostics — 6 November 2026

ESP32 direct entry keeps Welcome hidden while the first authenticated state request is pending.
Optional account metadata now follows pending tariff discovery. Octopus requests remain at least 60 seconds apart.
Dashboard status includes tariff stages, cache counts, attempt times, completion times, and failure counts.
Empty FoxESS schedules explain when no dispatch or ordinary rule requires a period.
Schedule commits retry fresh REST readback without repeating the write or waiting for telemetry polling.
Successful saves use a short confirmation without revision details.
ESP32 checks GitHub after startup, then every 24 hours. A header badge links to available updates.
Settings can disable automatic checks. This choice survives restart. Dashboard opening sends no update request.
Automatic checks never install firmware or change automation enablement.

Settings adds optional read-only LAN diagnostics on a separate port, with 8788 as the default.
A random 256-bit Bearer key expires after one hour. Disable, rotation, and restart revoke access.
The connection details keep the key outside the URL. LAN HTTP is unencrypted.
Structured numeric events use RAM for up to 24 hours, with a 512-event limit.
Diagnostic responses exclude account details, credentials, browser sessions, and raw cloud responses.
No diagnostic route sends upstream requests or changes settings or inverter schedules.

Native mocks verify authentication, expiry, revocation, rate limits, bounded retention, redaction, and blocked mutations.
The user confirmed a physical OTA update from 2.5.0 to 2.5.1 succeeded.
The new diagnostic listener and native Windows runtime still require physical verification.
The tutorial remains a private preview pending approval.

# 2.5.3 — 6 November 2026

Fix the diagnostics listener for IPv4 clients represented as mapped IPv6 peers by ESP-IDF.
Private IPv4 restrictions, Host checks, proxy rejection, and independent Bearer authentication remain required.
Global IPv6 and public IPv4 peers remain blocked.

Read the existing FoxESS schedule after startup, independently of the first Octopus request.
Monitoring does not wait for tariff discovery or enable schedule writes without fresh dispatch data.
Native regressions cover both socket representations and startup monitoring before any Octopus call.

Physical Wi-Fi OTA from 2.5.2 to 2.5.3 preserved every saved rule and restored official REST confirmation.
The schedule appeared before the first Octopus request. The startup GitHub check completed once.
Authenticated diagnostics returned safe RAM data. Anonymous access was denied. The temporary key was revoked.
Native Windows execution remains unverified. The user approved publication of the setup tutorial.

Installed firmware and UI commit: `bc06b2089b69bf2a7d82cd8c395ab5e55a823fb8`.
The full local check, native ESP-IDF build, and GitHub Pages checks passed.
The 24-hour interval and disabled-on-restart policy passed clock-controlled mocks.
A physical 24-hour soak and interrupted-power OTA recovery remain unverified.

## HTML Welcome and inline account help — 6 November 2026

HTML Welcome retains setup, restore, and connection actions without other-edition shortcuts.
Each account step provides collapsed help for Octopus, FoxESS, or the Google relay.
FoxESS help includes Mode Scheduler and Remaining Time Mode requirements.
The original account controls and engine IDs remain unique.
Browser review covered Welcome and all three expanded help panels with fictional input.
Pi access was checked separately. Interface review sent no cloud or inverter commands.
The complete local project checks and development build passed.

## ESP32 automatic Wi-Fi recovery — 13 November 2026

Version 2.5.4 replaces the five-attempt retry limit with continuous capped backoff.
A dedicated Wi-Fi task runs independently of cloud requests and USB test waits.
Retry delays increase from two seconds to a maximum of 30 seconds.
A 45-second watchdog disconnects stalled association or IP acquisition before another attempt.
Recovery also handles lost IP events, missed disconnect notifications, and stopped-driver errors.
Successful IP acquisition clears failure state and resets the retry delay.
USB network changes suspend automatic retries before deliberate disconnection.
An unconfigured board does not attempt to reconnect.
Recovery changes no saved configuration and performs no Flash writes.

Native mocks exercise more than 1,000 failed attempts and subsequent successful reconnection.
They also cover duplicate events, IP timeouts, missing notifications, driver errors, and deliberate setup suspension.
Physical router-restart recovery remains unverified. No live inverter commands are used for this change.

The full local project check and ESP-IDF 5.5.2 firmware build passed for 2.5.4.
The new image has not been installed on a physical board during this change.
