## Raspberry Pi telemetry and configuration polish v2026.08.01.1

### Fixed

- Formats solar, home, grid, battery, and SOC telemetry to two decimal places,
  preventing floating-point values such as `2.4299999999999997 kW` from being
  displayed.
- Removes vertical scrolling from the native Raspberry Pi Server Configuration
  window by using a compact two-column 980 × 620 layout.

### Improved

- Replaces the native telemetry-policy selector with one **Enable FoxESS Live
  WS telemetry** toggle. FoxESS web-login fields appear only when it is enabled.
- Moves the convenient day-to-day choice between **Live WS on demand**,
  **Always Live WS (REST fallback)**, and **Official REST only** to the
  dashboard client menu.
- Prevents a client from selecting Live WS until the native Pi configuration
  has enabled it and stored the optional web-login credentials.

### Deployment

- Publishes updated standalone Web and Raspberry Pi OS release assets while
  keeping the two editions separate.
- Preserves official FoxESS REST for every scheduler and inverter-control
  action; Live WS remains read-only telemetry with REST fallback.

### Validation

- Covers two-decimal telemetry formatting, the no-scroll GTK window contract,
  Live WS capability authorization, all three client policies, encrypted state,
  standalone output, and Raspberry Pi release packaging.

## Previous mobile telemetry controls and Raspberry Pi access v2026.08.01

### Fixed

- Removed the duplicate Menu button that appeared again in the Intelligent
  Octopus Go card on iPhone and other narrow displays.
- Removed the duplicate Live Telemetry block from FoxESS Mode Selector. Live
  power flow and telemetry-source status remain in the top Home Energy
  Protection overview.

### Improved

- Replaced the dashboard's on/off Live WS switch with three clear choices:
  **Live WS on demand**, **Always Live WS (REST fallback)**, and **Official REST
  only**.
- Rewrote the Raspberry Pi OS documentation to explain its always-on server and
  responsive browser client, LAN use, secure DDNS/HTTPS remote access, and
  iPhone/Android home-screen installation.
- Added prominent credit to Nick Farrell's
  [`nicois/foxess-control`](https://github.com/nicois/foxess-control) project,
  whose MIT-licensed work underpins the optional Live WS module.

### Deployment

- Publishes the updated standalone GitHub Pages app and Raspberry Pi OS package
  as separate supported editions.
- Keeps unattended automation on the supervised Pi worker and all schedule or
  inverter-control commands on the official FoxESS REST API.

### Validation

- Covers all three dashboard telemetry policies, single-menu mobile markup,
  top-only telemetry presentation, Linux authorization, standalone builds, and
  Raspberry Pi release packaging.

## Previous Linux Live WS connection-check fix v2026.07.30.1

### Fixed

- Treats on-demand standby with official REST active as a healthy state instead
  of reporting FoxESS Live WS as failed in native Server Configuration.
- Prevents normal five-second REST telemetry polling from cancelling a manual
  Live WS self-test and causing a false failure.
- Subscribes to FoxESS live telemetry once per connection, uses a protocol
  heartbeat, and removes browser-only WebSocket handshake headers.
- Reuses the current FoxESS web-session token for up to 12 hours so reconnects
  do not repeatedly sign in and disturb another FoxESS client.
- Runs native configuration loading, saving, status refreshes, and Live WS
  diagnostics away from GTK's UI thread so the window remains responsive.

### Improved

- Makes **Live WS on demand**, **Always Live WebSocket**, and **Official REST
  API only** explicit native configuration choices.
- Keeps an on-demand diagnostic connection temporary and explains that an
  explicit web-login test may sign the FoxESS mobile app out.

## Mobile / LAN protection dashboard v2026.07.29.1

### Fixed

- Saves a successfully verified Dashboard Access Code on the client device and
  opens the dashboard directly on later visits instead of showing the home
  screen or a ten-second countdown.
- Adds **Remove Access Code** to the dashboard menu so a client can return to
  the access-code screen at any time.
- Removes narrow-screen overflow that previously required iPhone users to zoom
  out before the dashboard fitted the viewport.

### Improved

- Puts Octopus Dynamic Charge Schedule, FoxESS Mode Scheduler, current
  protection state, and the available FoxESS power-flow telemetry at the top of
  the mobile and desktop dashboard.
- Shows **PROTECTED** only when an active Octopus EV charge is covered by an
  effective FoxESS Forced Charge period; otherwise the dashboard calls out the
  mismatch directly.
- Adds a client-menu **Live WS on demand** switch. When enabled, the Pi opens
  the FoxESS web WebSocket only during an active Octopus dynamic charge and
  disconnects afterwards; when disabled, telemetry uses official REST only.

### Deployment

- Keeps GitHub Pages and the Raspberry Pi edition as separate products.
- Keeps all automatic schedule writes on the loopback Pi worker and all
  inverter commands on the official FoxESS REST API.

### Validation

- Covers remembered access-code contracts, worker-only Live WS demand updates,
  on-demand standby, active WebSocket telemetry, official REST fallback,
  responsive schedule-first markup, and Linux server authorization.

## Pi tray upgrade restart and native configuration v2026.07.26.14

This hotfix broadens the running tray-process match used during an upgrade.
Raspberry Pi OS can launch the Python indicator with different command-line
forms, so the installer now reliably stops the old process before starting the
new native Server Configuration UI.

## Previous native Pi configuration and Mobile home-screen polish v2026.07.26.13

This release completes the server/client separation:

- Moves every Linux integration field into the native taskbar **Server
  Configuration** window. The Linux browser is now only a redacted dashboard
  client; the standalone GitHub Pages SPA keeps its browser setup screen.
- Adds a native toggle for access-code protection. Protection remains enabled
  by default, but a trusted private LAN can be configured for direct access.
- Keeps Live WS healthy by requesting a fresh telemetry frame every five
  seconds after a successful self-test, with official REST still the automatic
  fallback.
- Adds dedicated iOS/Android home-screen artwork and a web-app manifest.
- Keeps the hidden Octopus account number and Show button on one line in the
  narrow Mobile view.

## Previous Live WS dashboard status hotfix v2026.07.26.12

This hotfix completes the Live WS dashboard behaviour:

- Hides both manual **Fetch Now** controls while Live WS is healthy; they return
  automatically if the app falls back to REST.
- Updates Current Device Mode immediately from a refreshed active scheduler,
  even if the separate REST WorkMode request times out.
- Keeps the Live WS SOC value in the effective mode badge, so an active
  scheduler block can display, for example, `FORCED CHARGE | 99%`.

## Previous Raspberry Pi tray upgrade restart hotfix v2026.07.26.11

This hotfix makes Raspberry Pi upgrades take effect immediately:

- Restarts an already-running Octopus FoxESS taskbar process after replacing
  its files, so the new indicator and native configuration logic is active
  without logging out or rebooting.
- Retains the v2026.07.26.10 Live WS dashboard improvements: Live Telemetry
  **Fetch Now** stays hidden while Live WS is healthy and returns during REST
  fallback.
- Retains the corrected Current Device Mode and SOC refresh, including active
  FoxESS scheduler groups overriding the base `SelfUse` mode.

## Previous Raspberry Pi taskbar indicator compatibility hotfix v2026.07.26.10

This hotfix completes the native Raspberry Pi server experience introduced in
v2026.07.26.9:

- Corrected Raspberry Pi OS Wayland taskbar icon discovery by publishing the
  green, amber, and red indicators through the standard system icon theme.
- Refreshes the icon theme cache during installation so the server indicator is
  visible immediately, without waiting for a reboot.
- Corrected the native configuration window to recognise FoxESS Live WS
  `live` telemetry as connected instead of showing an incorrect REST fallback.
- Hides the unnecessary Live Telemetry **Fetch Now** button while Live WS is
  healthy and restores it automatically during REST fallback.
- Corrects Current Device Mode by combining the FoxESS base mode with the
  currently active scheduler group, and refreshes its SOC from Live WS.
- Verified on Raspberry Pi OS Trixie with the taskbar icon, status menu, native
  Server Configuration window, listen address, masked LAN access code, and all
  API health indicators.

## Previous Raspberry Pi native server indicator and Mobile / LAN client v2026.07.26.9

### Fixed

- Shows the effective active FoxESS scheduler mode instead of the base
  `SelfUse` setting while a Force Charge or Force Discharge block is running.
- Hides the Octopus account number by default in both setup and dashboard
  details until **Show** is selected.

### Improved

- Replaces device-specific labels and guidance with **Mobile / LAN** so the same
  client flow is clear for iOS, Android, tablets, and computers.
- Adds a native Raspberry Pi taskbar indicator with green, amber, and red
  server-health icons plus individual Octopus API, FoxESS REST, and FoxESS Live
  WS states.
- Adds a compact native server configuration window for the listen address and
  LAN access code.
- Changes the desktop/application-menu shortcut into a separate
  access-code-only **Octopus FoxESS Dashboard** client.

### Deployment

- Installs the GTK/Ayatana taskbar indicator through Raspberry Pi OS packages
  and starts it for the current desktop session and future logins.
- Keeps the three supervised `systemd` services, encrypted Pi configuration,
  automatic REST fallback, and standalone GitHub Pages edition.

### Validation

- Covers active and overnight scheduler mode resolution, account-number
  protection, Mobile / LAN copy, native tray packaging, service health status,
  one-code client separation, standalone build, and Raspberry Pi archive.

## Previous Raspberry Pi Live WebSocket telemetry layout hotfix v2026.07.26.8

### Fixed

- Keeps the Live WS/fallback status badge readable in the Raspberry Pi Settings
  app without squeezing the FoxESS telemetry heading in its narrow app window.

### Validation

- Rechecked the Pi-local Settings window, phone-sized one-code LAN client,
  WebSocket/REST fallback tests, release bundle, and GitHub Pages build.

## Previous Raspberry Pi Live WebSocket telemetry v2026.07.26.7

### Improved

- Added a Pi-only telemetry selector with **Live WebSocket** as the default and **Official REST API only** as the alternative.
- Added optional FoxESS Cloud web-login fields and a live self-test to the Raspberry Pi Settings app.
- Streams supported FoxESS telemetry approximately every five seconds when the undocumented web-portal WebSocket is healthy.
- Shows `LIVE WS`, `REST FALLBACK`, or `OFFICIAL REST` in the dashboard and settings UI.

### Fixed

- Automatically falls back to quota-aware cached REST telemetry when Live WS credentials are empty, login or self-test fails, the connection closes, or fresh frames stop arriving.
- Keeps all scheduler and inverter-control commands on the official FoxESS REST API.
- Keeps FoxESS web-login credentials encrypted on the Pi and redacted from LAN-client configuration responses.

### Deployment

- Bundles the pinned zero-dependency `ws` client and the reviewed MIT-licensed FoxESS web-signature WebAssembly asset in the Raspberry Pi archive.
- The GitHub Pages edition remains REST/Google-relay based and is otherwise unchanged.

### Validation

- Covers WebSocket message mapping, password hashing, first-frame self-test, REST-only mode, empty-credential fallback, one-minute REST caching, encrypted Pi state, restricted LAN UI, and release packaging.

## Previous Raspberry Pi client cache hotfix v2026.07.26.6

### Fixed

- Versioned Pi-served CSS and JavaScript URLs so a mobile browser cannot reuse an older login layout after the app is updated.
- Changed installed static assets to revalidate on refresh.

### Validation

- Confirmed a newly refreshed LAN client receives the current one-key login instead of cached Pi-local controls.

## Previous Mobile client display hotfix v2026.07.26.5

### Fixed

- Corrected a CSS specificity conflict that left Pi-local access-key and background-service controls visible on a remote LAN client.
- The remote login now renders only the single Dashboard Access Code field.

### Validation

- Verified the rendered LAN login against the running Raspberry Pi service after installation.

## Previous Raspberry Pi service/client separation v2026.07.26.4

### Fixed

- The Mobile / LAN login now asks only for the access code configured in the Raspberry Pi Settings app.
- Removed Octopus account/API-key, FoxESS serial/token, config import, wipe, and setup controls from remote clients.

### Improved

- Octopus authentication and FoxESS request signing now happen inside the Pi service.
- Remote configuration responses expose managed-state markers instead of stored service secrets.
- Credential changes and full configuration wipes are restricted to the Pi-local Settings app.

### Deployment

- Keeps the existing GitHub Pages web edition and Raspberry Pi `systemd` services.
- Updates the one-command installer package without changing the port or LAN URL.

### Validation

- Covers the one-code LAN login, redacted client state, server-side API authentication, remote mutation restrictions, standalone web build, and Raspberry Pi package.

## Previous desktop integration hotfix v2026.07.26.3

- Uses the bundled Octopus FoxESS icon directly for the Raspberry Pi desktop launcher and local settings window.
- Publishes the same favicon with the Raspberry Pi package and GitHub Pages.
- Documents Raspberry Pi OS's standard first-click **Execute File** question and the direct application-menu alternative.

## Raspberry Pi app experience v2026.07.26.2

- Added an **Octopus FoxESS Settings** icon to the Raspberry Pi desktop and application menu.
- The icon opens a focused app-style settings window without requiring the user to type a local browser address.
- Added a Pi-only configuration control for viewing and changing the LAN access code.
- Kept Octopus credentials, FoxESS credentials, automation settings, and the LAN key centrally on the Pi.
- Confirmed the supervised worker continues after the settings window or LAN browser is closed and starts automatically after reboot.
- Clarified that a LAN browser is a separate live dashboard client using the Pi's shared state, not a screen mirror.

## Previous hotfix v2026.07.26.1

- Fixed Raspberry Pi installation permissions that could leave the installer waiting while the local server repeatedly restarted.
- Kept the generated access code private while ensuring the installed application is readable by its dedicated service account.
- Moved sleep inhibition into a separate root-owned service so Raspberry Pi OS can acquire the inhibitor while the app and Chromium remain unprivileged.
- Restarted all three services after installation so running Pis switch to the newly downloaded release immediately.

## Fixed

- Corrected SEG accounts that could select an export meter point as the primary import tariff.
- Kept fixed-rate tariffs with no end date active and available to charts and automation rules.
- Separated import-rate charging logic from export-rate discharge logic.

## Improved

- Added separate import and SEG export live cards and tariff charts.
- Reworked the login screen and setup guidance so the selected Web or Raspberry Pi runtime is explicit.
- Optimised the Mobile dashboard for safe areas, touch targets, form zoom prevention, single-column cards, and responsive charts.

## Deployment

- Added a Raspberry Pi OS edition that replaces Google Apps Script with a restricted local FoxESS relay.
- Added encrypted shared Pi configuration, a generated LAN access code, and separate dashboard/automation-worker roles.
- Added the detected Raspberry Pi LAN URL directly to the client login screen.
- Added `systemd` server and headless Chromium worker services with automatic restart, reboot startup, and sleep inhibition.
- Added one-command `curl` install, update, and uninstall flows.
- Kept the standalone GitHub Pages edition and its existing Google Apps Script option.

## Validation

- JavaScript syntax, scheduler, tariff-selection, chart, encrypted-state, proxy restriction, static-GUI, standalone build, and Raspberry Pi package checks run through `npm run check`.
- GitHub Pages continues to publish `Octopus_IGO_Smart_Charging_Detector.html` as the root app.
