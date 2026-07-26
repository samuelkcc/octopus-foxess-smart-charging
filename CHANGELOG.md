# Changelog

## v2026.07.26 — 2026-07-26

- Fixed SEG accounts selecting an export meter point as the primary tariff.
- Import and export agreements and rates are now detected separately across all account properties.
- The main price display, chart, and target-price forced-charge rule always use import rates.
- The price-based discharge rule uses export rates when an active export tariff is available.
- Replaced the combined tariff graph with separate import and SEG export charts, live-rate cards, and explicit missing-data states.
- Fixed fixed-rate tariffs with `valid_to: null` being treated as expired, which could hide the export rate and prevent its chart from rendering.
- Added a Raspberry Pi OS edition with a restricted local FoxESS relay, encrypted shared configuration, and no Google Apps Script dependency.
- Added supervised `systemd` server and headless automation-worker services with automatic restart, reboot startup, and sleep inhibition.
- Added a local-network dashboard protected by a generated access key and an iPhone-optimised responsive interface.
- The Raspberry Pi login now displays its detected LAN URL for iPhone access.
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
