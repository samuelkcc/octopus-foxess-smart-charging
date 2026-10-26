## v2.0.0 — Major redesign under review

- Match the charging icon and browser-tab icon to the selected light or dark appearance.
- Remove the repeated Pi administration card from Connections. Keep Settings in the navigation menu.

- Fit desktop pages inside one viewport. Dynamically align the menu bottom with the visible content. Preserve phone scrolling.
- Use compact desktop cards, responsive chart heights, and three Settings columns on wide screens.
- Page through history activity without extending the dashboard. Keep all four history charts and Expand actions available.

- Replace header countdowns with two equal API status buttons. Synchronize their circular progress with each API interval and reload data on selection.
- Move Pause automation into the shared application header. Keep the red pause banner and duration dialog.
- Keep retained problem alerts in fixed-size red indicators. Remove the separate Update now action.
- Move refresh intervals into Settings. Save browser values locally and Pi values in encrypted configuration for the worker.
- Keep the Pi Smart Dispatch interval at 60 seconds or less. Retain confirmation before shorter API intervals.

- Put developer and build details in About. Add the project background, battery-protection purpose, and edition-specific operating requirements.

- Remove the repeated page footer. Keep developer credit, version, and licence information in About.

- Place refresh controls in the top-right application header. Remove the connected edition label from Pi, desktop, and web views.
- Keep control widths stable during updates. Use worker activity for Pi status instead of frequent dashboard requests.

- Keep retained problem indicators compact and both schedule cards visible.

- Buffer history readings in memory. Save compressed monthly archives every hour by default, with a 30-minute option.
- Show history disk use, free space, unsaved intervals, and the last save time.
- Below 4 GB free space, show an Overview warning and remove oldest history early. Preserve the newest 24 hours.
- Add confirmed Clear all history and Keep recent 3 months actions. Retain account settings and automation rules.
- Back up history before a full development update. Read existing plain archives and migrate active archives during a batch save.

- Replace the History measurement selector with four overview charts and individual Expand actions. Align the month and action controls.
- Remove competing battery display updates. Keep measured idle power at zero without alternating with unavailable data.

- Request grid and battery power in the web edition. Show measured zero as zero and unavailable readings as missing.
- Add shared API health controls and retained red problem alerts for web, Pi, and mobile.
- Use Pi worker timing across dashboard clients. A refresh request preserves worker ownership and an active pause.
- Retain Pi alerts across restarts. Require recovery and an explicit acknowledgement before clearing an alert.
- Verify failure, recovery, acknowledgement, protected worker timing, storage permissions, and GAS power fields with mocks.

- Keep guided setup height and button spacing stable when switching between Octopus, FoxESS and GAS.

- Add a branded welcome screen with setup and restore actions. Use guided web account setup and direct Pi key access.
- Use MAJOR.MINOR.PATCH version numbers, matching the convention in Script Bridge. Preserve legacy calendar release history and existing update asset names.
- Include the redesigned Pi, desktop-browser, mobile and standalone HTML interfaces, with the shared automation safeguards, pause controls and history features.
- Rename the native settings window and heading to Configuration. Remove its duplicate Open Dashboard Client button. Keep the taskbar dashboard action.
- Verify the standalone GAS contract with signed reads, schedule writes, fresh readback, response redirects, rejection handling and pause blocking against mock responses.
- Create a versioned standalone HTML file for user testing. Keep public Pages and release publication pending approval.

## v2026.10.26.7 — Pi development update (not a public release)

- Add Overview pause control for 6, 12, 24 hours, or until manual resume. Show a red banner on every connected page.
- Persist Pi pause across restarts. Block all app schedule mutations while paused, including worker and manual requests. Leave the inverter schedule unchanged.
- Keep monitoring active. Reconcile fresh dispatches and REST schedules after resume. Record pause, resume, and expiry in History with durable retry.
- Add configurable history retention from 1 to 24 calendar months. Default to 12 months. Erase expired readings and activity automatically.
- Use compact hardware-limit dialogs with Cancel and Done. Keep limits staged until rule review. Use pink primary buttons with white text.
- Use green On and grey Off switches for panel visibility. Default new browsers to dark appearance and retain saved choices.
- Validate command blocking, in-flight ordering, expiry, restart recovery, history cleanup, and protected APIs with mocks. Live inverter commands are not test fixtures.

# Changelog

## Unreleased

## v2026.10.26.6 — Pi DEV (2026-10-26, not released)

- Label first-use acknowledgement as Accept and Continue. Keep Close for later About visits. Use white text on filled and hovered buttons.
- Keep a stable app frame across all pages. Move the old Menu controls into Settings. Add phone navigation and consistent cards, buttons, fields and switches.
- Use the charging-plug and vehicle charge-port shape for the app and health indicators. Remove visible DEV labels. Use `/app/index.html` with redirects from old links.
- Fit History charts to the recorded period so sparse new data stays readable.
- Add separate Pi and web DEV interfaces. Rebuild the visible views around the Octopus palette. Hide dashboard navigation during sign-in. Keep the shared engine.
- Add edition-specific setup guides and a side panel for About, the complete GPL text, and component notices.
- Add maintenance boundaries, a feature review, and current guides written toward ASD-STE100 Issue 9. Add structural documentation checks.
- Store compact 15-minute telemetry averages for 24 months, reusing existing readings without extra upstream calls. Add authenticated month queries, History charts, disk-usage reporting and CSV export. No historical backfill or billing-grade energy totals.
- Add a pinned DEV installer with encrypted-configuration backup, health check, original runtime rollback and taskbar access without desktop shortcuts. No Pages deployment or release tag.
- Open the new Pi design from the bare tunnel URL and taskbar menu. Offer only the new interface to Pi clients. Use a separate Chromium dashboard profile and show launch failures.
- Verify with the full mock-based suite, history retention/restart/outage tests, authenticated endpoint checks and local browser checks. Live Pi verification is recorded in dev/README.md after deployment.

## v2026.10.26.5 — 2026-10-26

- Clarify the Remote Access window by separating tunnel status, temporary URL lifetime, browser login duration, and key validity.
- Explain that a browser login lasts up to 12 hours and can be renewed with the same key; the tunnel and key do not expire at that limit.
- Identify the events that generate a new URL and clarify that closing a browser does not change it. Rename key rotation to New Key / Sign Out All.

## v2026.10.26.4 — 2026-10-26

- Replace the Pi taskbar wall-box artwork with a charging-plug-and-socket silhouette based on the supplied visual reference, rendered as scalable vectors in green, orange, and red.
- Keep connection-health rules and the application launcher icon unchanged.

## v2026.10.26.3 — 2026-10-26

- Refine the Raspberry Pi taskbar symbol to a home EV wall charger with a lightning bolt, cable, and plug, retaining green/orange/red health states.

## v2026.10.26.2 — 2026-10-26

- Replace the Raspberry Pi taskbar tick/warning/cross status badges with an EV car-and-charger icon. Green indicates healthy connections, orange indicates waiting or fallback, and red indicates a configuration or connection problem.
- Preserve the application launcher artwork and all existing connection-status rules.

## v2026.10.26.1 — 2026-10-26

- Add optional Cloudflare Quick Tunnel access with a random HTTPS URL and a separate generated 256-bit Remote Access Key. LAN access-code settings remain independent.
- Isolate remote requests on a dedicated listener; deny Pi administration and worker endpoints, allowlist dashboard updates, rate-limit logins, and use expiring Secure/HttpOnly/SameSite browser sessions with logout and key revocation.
- Apply newly detected Smart Dispatch schedules before tariff work in both editions, including initial connection with saved dispatch automation enabled.
- Require fresh official FoxESS REST readback instead of cached schedule confirmation. Retain Smart Dispatch priority when selecting the five hardware periods and report partial schedules as incomplete.
- Add matching About & License information to HTML, Pi dashboards, and the native Pi menu, with SCKC attribution, source links, complete GPL text, and third-party notices.
- Add behavior tests for both scheduler editions and remote access security; document Codex maintenance and provide a version-update command.

## v2026.09.02.1 — 2026-09-02

- Preserve the last confirmed Smart Dispatch schedule when Octopus GraphQL
  returns a rate-limit error, missing data, or a null dispatch field.
- Reduce Octopus API pressure by caching the Kraken authentication token,
  limiting worker queries to dispatch data, and using safer polling intervals.
- Keep the worker retrying after an unsuccessful startup without clearing the
  server's last authoritative dispatch snapshot.
- Show the linked charger or vehicle make when Octopus omits the optional
  device-provider label instead of incorrectly displaying `NONE DETECTED`.

## v2026.09.01.2 — 2026-09-01

- Authenticate loopback worker publications with an explicit request marker
  instead of a `Referer` that the Pi server's privacy policy suppresses.
- Restore immediate Smart Dispatch publication and FoxESS reconciliation after
  Raspberry Pi worker startup.
- Read fixed Intelligent Octopus Go import prices from the four-rate day and
  night endpoints when `standard-unit-rates` is intentionally empty.
- Build the fixed 23:30–05:30 off-peak timeline so live import price, charts,
  and price-based automation use the correct day and night rates.

## v2026.09.01.1 — 2026-09-01

- Make the Raspberry Pi worker the single source of truth for Octopus Smart
  Dispatch windows; Pi dashboards no longer make an independent dispatch query.
- Publish each new worker dispatch revision as syncing before immediately
  rebuilding and writing the FoxESS scheduler.
- Mark a dispatch revision confirmed only after the FoxESS REST readback exactly
  matches the requested conflict-resolved schedule.
- Reject stale FoxESS confirmations when Octopus replaces a dispatch while an
  earlier scheduler write is still in flight.
- Show waiting, syncing, confirmed, failed, and disabled protection states in
  every Pi dashboard, refreshed from the worker every five seconds.
- Add Linux integration coverage for worker-only updates, protected dashboard
  reads, rapid dispatch replacement, stale confirmation rejection, and invalid
  dispatch data.

## v2026.08.24.1 — 2026-08-24

- Round Smart Dispatch windows outward to 30-minute Octopus slots, including
  rounding an 18:11 start down to 18:00.
- Give Smart Dispatch SOC and mode priority inside overlapping weekly or
  target-price Forced Charge periods while those rules fill the remaining
  gaps.
- Show Smart Dispatch explicitly in the Mode Scheduler even when FoxESS merges
  it into a compatible weekly or target-price Forced Charge period.
- Apply a changed Smart Dispatch through the official FoxESS REST scheduler as
  soon as the worker receives it, before tariff refresh work completes and
  without waiting for another automation cycle.

## v2026.08.19.2 — 2026-08-19

- Fixed Raspberry Pi Smart Dispatch synchronization so FoxESS receives dynamic
  charging periods in the next 24 hours, including slots that begin after
  midnight on the following calendar date.
- Queued dispatch changes that arrive while a FoxESS scheduler write is being
  confirmed, so the newest schedule is applied immediately instead of being
  silently skipped until a later polling cycle.
- Refresh the visible Active Mode Scheduler shortly after Octopus dispatches
  change, instead of leaving it stale until the normal 10-minute FoxESS poll.
- Detect Smart Dispatch additions and removals in the Raspberry Pi worker within
  15 seconds, without increasing the standalone HTML edition's polling rate.
- Refresh Octopus and the REST-confirmed FoxESS scheduler immediately when an
  iPhone or other LAN dashboard returns from the background.

## v2026.08.01.3 — 2026-08-01

- Fix tariff charts escaping their dashboard column when the browser becomes
  narrow; the layout now stacks earlier and explicitly resizes both canvases.
- Split SEG export-price discharging into a hidden-by-default **Smart
  Discharging Automation** block and add a weekly Forced Discharge schedule.
- Add default-on safeguards that pause discharging during Smart Dispatch and
  remove overlapping ordinary Forced Charge periods while discharging is
  active.
- Add Menu visibility controls for Intelligent Octopus Go, FoxESS Mode
  Selector, Device & Settings, Smart Charging Automations, and Smart
  Discharging Automation.
- Clarify that Auto-Resume only ends target-price or weekly charging and cannot
  cancel an active Smart Dispatch.
- Remove the Mini HUD.

## v2026.08.01.2 — 2026-08-01

- Use a single-line **SCKC** developer and copyright credit in the web and
  Raspberry Pi editions, without linking the project to a personal website.
- Add **Update Raspberry Pi Edition** to native Server Configuration, using the
  standard graphical administrator prompt so future updates need no terminal
  command.
- Preserve encrypted configuration and the Dashboard Access Code while the
  updater installs the latest release and restarts the Pi services and taskbar
  indicator.
- Add the Raspberry Pi Server Configuration reference screenshot to the main
  README.

## v2026.08.01.1 — 2026-08-01

- Format every dashboard telemetry value to two decimal places.
- Replace the vertically scrolling native Pi configuration window with a
  compact two-column layout that fits in one 980 × 620 popup.
- Replace the native telemetry-policy selector with a single **Enable FoxESS
  Live WS telemetry** toggle that reveals the FoxESS web-login fields.
- Make the dashboard menu the convenient place to select **Live WS on demand**,
  **Always Live WS (REST fallback)**, or **Official REST only**.
- Prevent clients from selecting a Live WS policy until it has been enabled in
  native Server Configuration.

## v2026.08.01 — 2026-08-01

- Replaced the Mobile / LAN dashboard's binary Live WS switch with explicit
  **Live WS on demand**, **Always Live WS (REST fallback)**, and **Official REST
  only** choices.
- Removed the duplicated Menu button from the Intelligent Octopus Go card; the
  single Menu action remains in Home Energy Protection.
- Removed the repeated Live Telemetry panel from FoxESS Mode Selector and kept
  live power flow and telemetry-source status in the top protection overview.
- Expanded the Raspberry Pi server/client, mobile home-screen, and secure
  DDNS/HTTPS remote-access documentation.
- Added prominent GitHub README acknowledgement of Nick Farrell's
  `nicois/foxess-control` Live WS work.

## v2026.07.30.1 — 2026-07-30

- Correct on-demand Live WS standby health reporting in the Raspberry Pi tray
  and native Server Configuration window.
- Keep GTK responsive during native configuration and Live WS network checks.
- Prevent normal REST telemetry polling from cancelling an explicit Live WS
  self-test, then close a temporary on-demand test socket immediately.
- Match the current FoxESS stream protocol by subscribing once, using a
  transport heartbeat, and omitting browser-only WebSocket handshake headers.
- Reuse the FoxESS web-session token for up to 12 hours instead of logging in
  again on every reconnect.
- Restore an explicit Always Live WebSocket choice alongside on-demand and
  official-REST-only policies.

## v2026.07.29.1 — 2026-07-29

- Remember a valid Dashboard Access Code on each client and reconnect directly
  on later visits; add a menu action that removes it and returns to login.
- Add a schedule-first Home Energy Protection overview with Octopus dynamic
  charge windows, FoxESS mode periods, effective protection state, battery SOC,
  and available power-flow telemetry.
- Reorder the mobile client around dynamic charging and FoxESS scheduling and
  remove horizontal overflow on narrow iPhone viewports.
- Replace persistent FoxESS Live WS use with a dashboard-controlled on-demand
  policy that connects only during an active Octopus dynamic charge.
- Preserve worker-only unattended schedule writes and official-REST-only
  inverter control.

## v2026.07.26.14 — 2026-07-26

- Broadened Raspberry Pi tray process detection during install and uninstall so
  an older indicator cannot survive an upgrade with obsolete menu entries.
- Revalidated the native Server Configuration, Live WS, and service states
  against the real Pi after updating.

## v2026.07.26.13 — 2026-07-26

- Consolidated Pi credentials, telemetry selection, LAN access protection, and
  Live WS testing in the native taskbar Server Configuration window.
- Removed integration editing from the Linux browser client while preserving
  the standalone GitHub Pages SPA setup.
- Added optional password-free trusted-LAN access, defaulting to protected.
- Added a five-second Live WS request heartbeat to prevent a successful
  connection from incorrectly becoming stale and falling back.
- Added dedicated iOS/Android home-screen icons and manifest metadata.
- Kept the Mobile account-number row on one line.

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
