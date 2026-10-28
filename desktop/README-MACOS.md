# macOS Universal app

This download contains one app for Apple Silicon and Intel Macs.
It includes the local service, dashboard, automation worker, and Cloudflare tunnel client.
No Google Apps Script relay is required.
macOS 12 or later is required.

## Start

1. Download the macOS Universal ZIP from [Releases](https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/latest).
2. Extract the ZIP.
3. Move **Smart Charging.app** to **Applications**.
4. Open **Smart Charging**.
5. Read the application licence notice.
6. Select **Accept and Continue**.
7. From Welcome, select **Configure this computer**.
8. Enter your Octopus account number and API key.
9. Enter your FoxESS serial number and API token.
10. Select **Save configuration**.
11. Open the dashboard from Welcome.

Complete the [FoxESS work mode setup](../README.md#prepare-foxess-work-modes) before enabling automation.
Use only one automation host for each inverter.
The [desktop account guide](README.md#start) provides the same account requirements.

This build has an ad-hoc signature. It is not Apple Developer ID signed or notarised.
macOS can block the first launch or request Keychain permission.
Review the publisher and [Apple's guidance](https://support.apple.com/en-gb/102445) before deciding whether to open it.
The app does not disable Gatekeeper or change security settings.

## Operation

- Keep the Mac awake and Smart Charging open.
- Minimize the window when you do not need the dashboard.
- Closing the app stops automation, the local server, and the public tunnel.
- Open **Remote Access** to use LAN access or Cloudflare Quick Tunnel.
- If the public URL stops working, use the LAN address on your trusted network.
- Select **Update URL** to replace the public address.
- Copy the new URL after the tunnel connects.

The remote key remains unchanged when the URL changes.
Remote browser sessions last up to 12 hours.
Public clients cannot manage account credentials or remote keys.
No automatic firewall change is made.

## Storage and updates

Settings and History remain in `~/Library/Application Support/Smart Charging/service`.
The app uses macOS Keychain through Electron safeStorage to protect its configuration key.
The service does not write an unprotected configuration key.
Ad-hoc signatures can cause another Keychain permission request after an update.
See [Electron's signing guidance](https://www.electronjs.org/docs/latest/api/safe-storage#platform-specific-key-providers).

1. Before updating, close Smart Charging.
2. Replace the app in **Applications**.
3. Open the new app.

Replacing the app preserves its user-profile data.
Moving the app does not transfer configuration to another Mac.

## Build and verification

1. On macOS, run `npm ci`.
2. Run `npm ci --prefix desktop`.
3. Run `npm run build:mac`.

The build verifies both official Cloudflare archive checksums.
It combines their tunnel binaries into one Universal executable.
Package checks verify Apple Silicon and Intel slices in the app, Electron framework, and tunnel client.
They also verify the ad-hoc signature, service files, interface, and licences.
Mock tests cover service encryption, restart recovery, API budgets, and access restrictions.
These checks do not prove native Keychain, Intel execution, firewall, sleep, or live inverter behaviour.
