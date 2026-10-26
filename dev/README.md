# DEV guide

The development version is **2026.10.26.6**.
The source branch is `codex/ui-ux-preview`.
This branch does not publish GitHub Pages or create a release tag.

## Interface files

| Build file | Use |
|---|---|
| `dist/pi-dev.html` | Pi dashboard with real service data. |
| `dist/Smart_Charging_UI_DEV.html` | Standalone web interface with its own account setup. |

Both builds use the existing scheduler engine and element IDs.
The visible views use new markup.
Sign-in hides dashboard navigation until connection.
Unused legacy elements remain hidden for shared-engine compatibility.
The Pi build always runs as a dashboard client.
The web build retains browser automation.

About & License opens in a side panel.
The panel includes the complete GPL text and component notices.
The setup guide also opens from the side.
Pi and web login fields remain different.

## Build DEV

1. Run `npm ci`.
2. Run `npm run check`.
3. Run `npm run build:dev`.
4. Check both editions in a browser.

## Install DEV on an existing Pi

The Pi must already have the public edition installed.
The installer uses its existing `ws` dependency.

1. Select the complete 40-character Git commit ID.
2. Download `linux/install-dev.sh` from that commit.
3. Run this command with the selected ID:

```bash
sudo sh linux/install-dev.sh FULL_40_CHARACTER_COMMIT
```

The installer creates a private configuration backup.
It keeps the previous runtime for rollback.
It restarts the existing server and worker.
It does not create another worker.

The taskbar charger menu provides **Open Desktop Client (DEV)**.
**Open Original Dashboard** opens the previous interface.
The installer does not create desktop shortcuts.
The DEV route is `/dev/index.html?client=1`.
The original dashboard remains at `/?client=1&original=1`.
The remote-access window includes the DEV path in its public URL.
The same DEV address provides the responsive phone interface.
The bare tunnel address opens the new DEV interface.
The worker URL continues to open its existing engine.

A service restart creates a new Quick Tunnel address.
The existing Remote Access Key remains valid.

## Update only the DEV interface

1. Select the complete source commit ID.
2. Download `linux/update-dev-ui.sh` from that commit.
3. Run this command with the selected ID:

```bash
sudo sh linux/update-dev-ui.sh FULL_40_CHARACTER_COMMIT
```

This update does not restart the worker, service, or tunnel.
The original dashboard remains unchanged.
The About panel identifies the UI commit when the build receives that value.

## Return to the previous runtime

1. Run this command on the Pi:

```bash
sudo /opt/octopus-foxess/rollback-dev.sh
```

The command restores the previous runtime.
It retains the history files.
It restarts the service and worker.
The tunnel receives a new address after that restart.

## History storage

The server reuses telemetry requests from the existing worker.
It does not request extra FoxESS data.
Collection continues with the dashboards closed if the worker remains healthy.

One fresh observation in each minute can contribute to a 15-minute average.
The stored interval contains averages and observation counts.
The server does not retain the raw minute readings.
Duplicate or stale cached readings do not become new observations.

History contains seven measurements.

- Solar power.
- Home load.
- Grid import power.
- Grid export power.
- Battery charge power.
- Battery discharge power.
- Battery state of charge.

The files are in `/var/lib/octopus-foxess/history`.
The directory and files have owner-only permissions.
The files contain no account credentials, remote keys, or public URLs.

Records expire after 24 calendar months.
The server removes expired records during collection and history queries.
Missing readings remain gaps.
No earlier records are imported.

Approximately 70,000 intervals fit within 24 months.
Expected file storage is approximately 5–10 MB.
The interface reports actual file bytes.
Filesystem allocation can be larger.

These values are observed power averages.
They are not billing-grade energy totals.
A sudden power loss can remove up to five minutes from the current partial interval.
A clean service shutdown saves that interval.

## Current verification

Runtime commit `47fe62a` was installed on 26 October 2026.
The initial startup found a parent-directory permission error.
The directory permission was corrected to 0755.
Commit `285594b` fixes the installer for later installations.

The server, worker, and inhibitor were active after the correction.
Octopus and FoxESS REST reported healthy connections.
The new overview displayed real Pi data.
History displayed its first recorded interval.

The encrypted pre-DEV backup was compared with the active configuration.
Credentials, automation rules, LAN protection, and the remote key were unchanged.
The original dashboard and rollback script were present.
No manual inverter command was sent for these checks.

UI and native client commit `49ed9f0` was installed on 26 October 2026.
The bare public URL opened the new sign-in interface through Cloudflare.
The server, worker, and inhibitor stayed active.
The taskbar launcher opened the new Pi interface with a separate browser profile.
The first-use licence panel remained for the user to acknowledge.
The two app desktop shortcuts were moved to a recovery folder.
The folder is under `~/.local/share/octopus-foxess/removed-desktop-shortcuts/`.
The standalone HTML login was checked with local mock account data.
The current UI-only update does not restart the tunnel.

The [feature review](../docs/FEATURE-PARITY.md) records browser checks and release work.
The [maintenance guide](../docs/ARCHITECTURE.md) defines module boundaries.
The [writing guide](../docs/WRITING.md) defines the documentation method.
