# Pi DEV interface

Development build **2026.10.26.6** on `codex/ui-ux-preview`; not a published release or replacement for GitHub Pages.

This is a real Pi dashboard, built from the existing HTML, JavaScript, authentication and scheduler engine. It rearranges the original controls into Overview, Schedules, Automations, History and Connections. It uses the current Octopus light/dark palette. It always runs as a dashboard client; it cannot become another automatic scheduler. Applying rules requires an explicit review step. Pi credentials and remote-key management remain in the native taskbar application.

The original dashboard remains at `/?client=1`. DEV lives at `/dev/index.html?client=1`. The installer adds a **Smart Charging DEV** desktop shortcut and a runtime rollback script, preserves the encrypted configuration and remote key, and restarts the existing server/worker. A tunnel restart produces a new public URL. No GitHub Pages deployment or release tag is involved.

Build after `npm run check` with `npm run build:dev`. Install a pinned source commit on the Pi with `sudo sh linux/install-dev.sh FULL_40_CHARACTER_COMMIT`. The installer uses the installed runtime's `ws` dependency and does not install another browser worker. Roll back with `sudo /opt/octopus-foxess/rollback-dev.sh`; history remains on disk.

## Compact history

- The server reuses `/api/foxess/live` readings already requested by the always-on worker. It adds no upstream FoxESS requests. Collection continues with dashboards closed while the worker is healthy.
- At most one fresh observation per minute contributes to 15-minute averages. Missing fields remain null; stale cached readings and duplicate samples are ignored. Network outages remain gaps.
- Seven fields: solar, home load, grid import/export, battery charge/discharge (kW), and state of charge (%). Counts accompany each field so missing coverage is visible in the API.
- Monthly compact JSON-lines files plus a small five-minute checkpoint live in `/var/lib/octopus-foxess/history`, with owner-only permissions. No credentials, account numbers, URLs or API keys are recorded. Raw minute readings are not retained.
- Rolling 24-calendar-month retention, with daily expiry cleanup during collection and on every history query. Old boundary-month records are removed as well as whole expired months.
- Approximately 70,000 intervals across 24 months; expected storage is roughly 5–10 MB depending on numeric values and filesystem allocation. The History screen reports actual file bytes, not an assumed fixed size.
- These are observed power averages, not billing-grade kWh totals. No backfill of past data is included. Collection starts with this DEV build. Up to five minutes of the current partial interval may be lost after sudden power loss; clean shutdown checkpoints it.
- History is authenticated with the same LAN code/remote session as the dashboard. Only GET is permitted; the API is available through the existing protected tunnel. Month browsing, selectable measures and CSV export are provided.

Verification uses mocks for scheduler, upstream APIs, remote authentication and history. No live inverter commands should be sent merely to test layout or data collection.

## Live Pi verification — 26 October 2026

Installed DEV runtime commit `47fe62a` (version 2026.10.26.6). Corrected the new parent directory's permissions to 0755 after initial service startup failed under a restrictive umask; the installer fix is recorded in `285594b`. Server, worker and inhibitor are active. Octopus and FoxESS REST report healthy. The DEV page returns HTTP 200, the real overview renders, and the first recorded interval is available through History. Credentials, automation rules, LAN-protection setting and remote key were compared against the encrypted pre-DEV backup and were unchanged. The original dashboard, separate DEV desktop shortcut and rollback script remain available. No manual inverter command was sent for verification.

`linux/update-dev-ui.sh FULL_COMMIT` updates only the DEV frontend without restarting services or changing the tunnel URL. DEV has its own home-screen manifest and supports a `view=history` (or overview/schedules/rules/connections) link. A persistent Home Screen shortcut still needs a stable hostname if the Quick Tunnel later restarts.
