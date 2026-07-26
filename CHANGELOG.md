# Changelog

## v2026.07.26.12 — 2026-07-26

- Hide both scheduler and telemetry **Fetch Now** controls while FoxESS Live WS
  is healthy, restoring them automatically during REST fallback.
- Refresh Current Device Mode immediately from active scheduler data and the
  latest Live WS SOC, even when the following REST WorkMode request times out.

## v2026.07.26.11 — 2026-07-26

- Restart the signed-in user's existing Octopus FoxESS taskbar process during
  an upgrade so the newly installed indicator and native configuration logic
  takes effect immediately without a logout or reboot.
- Carry forward the Live WS-aware **Fetch Now** visibility and effective
  Current Device Mode/SOC refresh corrections from v2026.07.26.10.

## v2026.07.26.10 — 2026-07-26

- Fixed the Raspberry Pi OS Wayland taskbar indicator so its green, amber, and
  red icons resolve through the standard system icon theme.
- Refresh the system icon cache during Linux installation for immediate taskbar
  visibility.
- Fixed the native configuration window so a healthy FoxESS Live WS `live`
  state is displayed as connected.
- Hide the redundant Live Telemetry **Fetch Now** control while Live WS is
  healthy; it returns automatically if the app falls back to REST.
- Refresh Current Device Mode and battery SOC from each Live WS frame, while
  using an active FoxESS scheduler group as the effective mode instead of the
  base `SelfUse` setting.

## v2026.07.26.9 — 2026-07-26

- Renamed the device-specific client experience to Mobile / LAN across the UI,
  documentation, and release guidance.
- Hid the Octopus account number by default behind explicit Show controls.
- Fixed effective FoxESS mode reporting so an active scheduler Force Charge or
  Force Discharge block overrides the REST API's base `SelfUse` value.
- Added a native Raspberry Pi taskbar server indicator with individual Octopus
  API, FoxESS REST, and FoxESS Live WS health states.
- Added a compact native server configuration screen for the listen address and
  LAN access code, plus a separate access-code-only desktop dashboard client.

## v2026.07.26.8 — 2026-07-26

- Fixed the Pi Settings app's narrow-window layout so the long Live WS/fallback
  status badge wraps below the FoxESS telemetry heading instead of squeezing it.
- Revalidated the phone-sized one-code client layout and all release checks.

## v2026.07.26.7 — 2026-07-26

- Added optional approximately five-second FoxESS telemetry through the undocumented web-portal WebSocket.
- Made Live WebSocket the Raspberry Pi default, with automatic cached REST fallback and an explicit REST-only selection.
- Added Pi-only FoxESS web-login fields, live self-test, connection-source badges, stale-frame rejection, and reconnect handling.
- Kept all FoxESS schedule and inverter-control writes on the official REST API.
- Bundled the reviewed MIT-licensed signature WebAssembly integration and recorded its attribution.

## v2026.07.26.6 — 2026-07-26

- Versioned the Pi web assets so Safari and Chrome load the corrected LAN client immediately after an update.
- Disabled long-lived static asset caching on the Pi service to make future installed updates visible on refresh.

## v2026.07.26.5 — 2026-07-26

- Fixed Pi-local access-key and background-service controls remaining visible on remote LAN clients because of a CSS specificity conflict.
- Confirmed the remote login renders only the single Dashboard Access Code field.

## v2026.07.26.4 — 2026-07-26

- Reduced the Mobile / LAN login to one dashboard access-code field and removed all service credential, import, wipe, and setup controls from remote clients.
- Kept Octopus API keys, FoxESS tokens, and inverter serial numbers inside the Pi service; remote configuration responses now contain only non-secret managed-state markers.
- Moved Octopus authentication and FoxESS request signing into the Pi server so service credentials do not enter a LAN browser.
- Restricted credential changes and full configuration wipes to the Pi-local Settings app.
- Clarified the service/client model in the Raspberry Pi guide.

## v2026.07.26.3 — 2026-07-26

- Use the bundled Octopus FoxESS artwork directly for the Raspberry Pi desktop launcher and browser window icon.
- Publish the same favicon with both the Raspberry Pi package and GitHub Pages.
- Document Raspberry Pi OS's standard first-click desktop launcher question and the direct application-menu alternative.

## v2026.07.26.2 — 2026-07-26

- Added a Raspberry Pi desktop and application-menu icon that opens the configuration UI in an app-style Chromium window.
- Added a Pi-local configuration screen for changing the LAN access code alongside the Octopus and FoxESS credentials.
- Moved the live access code into the service-owned encrypted-state area while retaining the legacy `/etc` compatibility path.
- Clarified that the Pi is the central source of truth, the background worker continues without an open window, and LAN browsers are separate live dashboard clients.
- Added launcher, access-key, package, update, and uninstall regression coverage.

## v2026.07.26.1 — 2026-07-26

- Fixed Raspberry Pi release permissions so the dedicated service account can read and start the local server.
- Scoped the access-key umask so it no longer affects application files copied later in the installer.
- Split sleep inhibition into a root-owned service while keeping the server and Chromium worker unprivileged.
- Restart all services after an update so the newly installed release becomes active immediately.

## v2026.07.26 — 2026-07-26

- Fixed SEG accounts selecting an export meter point as the primary tariff.
- Import and export agreements and rates are now detected separately across all account properties.
- The main price display, chart, and target-price forced-charge rule always use import rates.
- The price-based discharge rule uses export rates when an active export tariff is available.
- Replaced the combined tariff graph with separate import and SEG export charts, live-rate cards, and explicit missing-data states.
- Fixed fixed-rate tariffs with `valid_to: null` being treated as expired, which could hide the export rate and prevent its chart from rendering.
- Added a Raspberry Pi OS edition with a restricted local FoxESS relay, encrypted shared configuration, and no Google Apps Script dependency.
- Added supervised `systemd` server and headless automation-worker services with automatic restart, reboot startup, and sleep inhibition.
- Added a local-network dashboard protected by a generated access code and a mobile-optimised responsive interface.
- The Raspberry Pi login now displays its detected LAN URL for Mobile / LAN access.
- Added one-command `curl` installation, update, and complete uninstall procedures.
- Rewrote the login screen, setup guidance, security notes, and README to distinguish the GitHub Pages and Raspberry Pi editions.

## v2026.07.22 — 2026-07-22

- Added a configurable weekly Forced Charge schedule with selectable Monday–Sunday operation.
- Supports overnight windows such as 23:30–05:30 and persists the selected days and times locally.
- Weekly Force Charge works independently of Octopus tariff-rate availability, while still sharing the FoxESS five-period safety limit.
- Preserved Smart Dispatch priority so an overlapping dispatch keeps its safer configured SOC limit.
- Fixed FoxESS confirmation failures when it merges adjacent charge periods or omits disabled padding flags.
- Fixed Active Mode Scheduler source labels after FoxESS removes app-only metadata.
- Extended Auto-Resume Self-Use to weekly schedules while preserving active Smart Dispatch periods.

## v2026.07.11 — 2026-07-11

- Split the maintainable application source into HTML, CSS, and JavaScript files.
- Added a reproducible `npm run build` standalone SPA output.
- Fixed stale Active Mode Scheduler updates after FoxESS schedule writes.
- Hardened schedule retries so disabled padding cannot become active ghost schedules.
- Added explicit handling and warnings for the FoxESS five-period scheduler limit.
- Prevented duplicate background refresh timers and unnecessary API calls.
- Added encrypted persistent credential storage with a session-only fallback.
- Added request timeouts, HTTP error handling, safer dynamic rendering, pinned CDN assets, and regression tests.
