## Fixed

- Corrected SEG accounts that could select an export meter point as the primary import tariff.
- Kept fixed-rate tariffs with no end date active and available to charts and automation rules.
- Separated import-rate charging logic from export-rate discharge logic.

## Improved

- Added separate import and SEG export live cards and tariff charts.
- Reworked the login screen and setup guidance so the selected Web or Raspberry Pi runtime is explicit.
- Optimised the local dashboard for iPhone safe areas, touch targets, form zoom prevention, single-column cards, and responsive charts.

## Deployment

- Added a Raspberry Pi OS edition that replaces Google Apps Script with a restricted local FoxESS relay.
- Added encrypted shared Pi configuration, a generated LAN access key, and separate dashboard/automation-worker roles.
- Added `systemd` server and headless Chromium worker services with automatic restart, reboot startup, and sleep inhibition.
- Added one-command `curl` install, update, and uninstall flows.
- Kept the standalone GitHub Pages edition and its existing Google Apps Script option.

## Validation

- JavaScript syntax, scheduler, tariff-selection, chart, encrypted-state, proxy restriction, static-GUI, standalone build, and Raspberry Pi package checks run through `npm run check`.
- GitHub Pages continues to publish `Octopus_IGO_Smart_Charging_Detector.html` as the root app.
