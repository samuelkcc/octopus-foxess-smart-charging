# Smart Charging v2.2.0

This release adds a macOS Universal desktop host and browser Activity backups.
It also repairs Pi desktop launching and preserves last-known price displays after host restarts.

- macOS includes one app for Apple Silicon and Intel, with the local host, dashboard, worker, and Cloudflare client.
- macOS uses Keychain through Electron safeStorage. The app is ad-hoc signed and is not Apple notarised.
- The standalone web edition replaces History with Activity.
- Activity records pause, resume, and pause-expiry events in browser storage.
- Activity export/import uses validated JSON, merges duplicates, and keeps up to 2,000 records for 12 months.
- Activity import does not restore accounts, change pause state, or send inverter commands.
- Pi and Windows keep their existing power History.
- The Pi desktop launcher selects Wayland or X11 and avoids inaccessible installer working directories.
- Hosts save the last complete price display with private permissions and account isolation.
- Restart recovery clearly labels last-known prices and waits for worker confirmation.
- Display recovery expires after 24 hours and never supplies scheduler price inputs.
- The first successful update must complete before its display recovery file exists.
- Dashboard reads do not add upstream tariff requests. Pi request spacing remains unchanged.
- No GAS update is required.

Live Pi diagnostics confirmed complete import/export data after the startup queue finished, with recent HTTP 200 responses and no observed 429.
The native Pi desktop launcher was repaired and successfully opened Welcome without restarting the worker or tunnel.
This finding does not establish the cause of every earlier missing-price report.

Automated checks cover restart recovery, stale-display isolation, Activity backups, desktop access restrictions, API budgets, authentication, and scheduler safety.
Package checks verify both macOS architectures and the bundled tunnel client.
Native macOS Keychain, Intel execution, and current Windows execution require operator verification.
No live inverter command is used as a test.
