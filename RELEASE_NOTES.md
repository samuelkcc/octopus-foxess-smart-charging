## Desktop integration hotfix v2026.07.26.3

- Uses the bundled Octopus FoxESS icon directly for the Raspberry Pi desktop launcher and local settings window.
- Publishes the same favicon with the Raspberry Pi package and GitHub Pages.
- Documents Raspberry Pi OS's standard first-click **Execute File** question and the direct application-menu alternative.

## Raspberry Pi app experience v2026.07.26.2

- Added an **Octopus FoxESS Settings** icon to the Raspberry Pi desktop and application menu.
- The icon opens a focused app-style settings window without requiring the user to type a local browser address.
- Added a Pi-only configuration control for viewing and changing the iPhone LAN access key.
- Kept Octopus credentials, FoxESS credentials, automation settings, and the LAN key centrally on the Pi.
- Confirmed the supervised worker continues after the settings window or iPhone browser is closed and starts automatically after reboot.
- Clarified that an iPhone is a separate live dashboard client using the Pi's shared state, not a screen mirror.

## Previous hotfix v2026.07.26.1

- Fixed Raspberry Pi installation permissions that could leave the installer waiting while the local server repeatedly restarted.
- Kept the generated access key private while ensuring the installed application is readable by its dedicated service account.
- Moved sleep inhibition into a separate root-owned service so Raspberry Pi OS can acquire the inhibitor while the app and Chromium remain unprivileged.
- Restarted all three services after installation so running Pis switch to the newly downloaded release immediately.

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
- Added the detected Raspberry Pi LAN URL directly to the login screen for easy iPhone access.
- Added `systemd` server and headless Chromium worker services with automatic restart, reboot startup, and sleep inhibition.
- Added one-command `curl` install, update, and uninstall flows.
- Kept the standalone GitHub Pages edition and its existing Google Apps Script option.

## Validation

- JavaScript syntax, scheduler, tariff-selection, chart, encrypted-state, proxy restriction, static-GUI, standalone build, and Raspberry Pi package checks run through `npm run check`.
- GitHub Pages continues to publish `Octopus_IGO_Smart_Charging_Detector.html` as the root app.
