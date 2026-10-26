# DEV guide

The development version is **2.0.0**.
The source branch is `codex/ui-ux-preview`.
This branch does not publish GitHub Pages or create a release tag.

## Interface files

| Build file | Use |
|---|---|
| `dist/pi-dev.html` | Pi dashboard with real service data. |
| `dist/Smart_Charging.html` | Standalone web interface with its own account setup. |

Both builds use the existing scheduler engine and element IDs.
The visible views use new markup.
Sign-in hides dashboard navigation until connection.
Unused legacy elements remain hidden for shared-engine compatibility.
The Pi build always runs as a dashboard client.
The web build retains browser automation.

All pages use the same frame and content width.
Settings is part of the main navigation.
The phone layout uses navigation at the bottom.
Settings contains appearance, visible panels, telemetry, access, and help.
The app title, icon, and address have no DEV label.
The Pi remains a development installation.

About & License opens in a side panel.
On first use, its action is **Accept and Continue**.
After acknowledgement, the About panel uses **Close**.
Filled, selected, and hovered buttons use white text.
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

The taskbar charger menu provides **Open Desktop Client**.
The installer does not create desktop shortcuts.
The Pi route is `/app/index.html?client=1`.
The old `/dev/index.html` address redirects to that route.
The Pi exposes one client interface.
Previous root dashboard links also open the new design.
The remote-access window includes the application path in its public URL.
The same application address provides the responsive phone interface.
The bare tunnel address opens the new interface.
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
The internal worker engine remains unchanged.
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

Records expire after 12 calendar months by default.
The administrator can select 1 to 24 months in dashboard Settings.
The service erases expired records every hour and when history is read.
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

The unified interface was installed on 26 October 2026.
Its UI commit is `b8063da`.
The native client and icons use commit `b4fe9af`.
The public root and old client links opened `/app/index.html` through Cloudflare.
The app title and visible pages had no DEV label.
All six pages kept the same frame and content width in the desktop browser check.
The frame measured 1280 pixels.
The content area measured 1048 pixels.
No horizontal overflow or duplicate element IDs were found.
Phone layouts were checked at 320 and 390 pixels.
Settings appearance, panel visibility, and access help worked with mock data.
The standalone login retained its separate account and Google relay fields.
The complete GPL text and component notices remained available.
The live Pi reported healthy Octopus and FoxESS REST connections.
All three services stayed active.
History collection continued through the interface updates.
The final Pi build passed its branding and asset checks before installation.

Icon revision `1adfb50` was installed on 26 October 2026.
It restores the plug and vehicle charge-port shape in the app and taskbar.
The live remote app matched the embedded source icon.
All three services remained active.

Notice and button revision `c6ba1be` was installed on 26 October 2026.
The live public page returned this UI revision.
The first-use action was checked without accepting the notice.
The returning About action was **Close**.
Hovered button text was white in light and dark browser checks.

The [feature review](../docs/FEATURE-PARITY.md) records browser checks and release work.
The [maintenance guide](../docs/ARCHITECTURE.md) defines module boundaries.
The [writing guide](../docs/WRITING.md) defines the documentation method.

## Pause and control update verification

Version 2026.10.26.7 was installed on 26 October 2026.
The runtime commit is `ecc3dabdd97ebcea32df845ffcdc315116a46d59`.
The final interface commit is `3efcd991e596785c136c2fd1d7162570007d98ca`.
The interface update retained the restarted tunnel address.
The live Pi Overview displayed **Pause automation**.
All three services were active after installation.
Octopus and FoxESS REST both reported healthy connections.
The Pi pause state was off.
History used the new 12-month default.
The public page reported the installed version and interface commit.
No remote key or account credential was printed during verification.

Mock checks covered timed pause, indefinite pause, manual resume, and activity display.
They also covered command blocking, in-flight ordering, expiry, restart recovery, and failed history writes.
Both editions retained the shared scheduler safety checks.
Hardware-limit Cancel restored the previous value in the browser check.
Primary rule buttons used pink fills and white text.
Visible-panel switches used green for On and grey for Off.
The phone Settings view was checked at 390 pixels.
The standalone web login and local pause activity were checked with dummy accounts.
The full check suite and both interface builds passed.
Live pause and inverter writes were not used as test actions.

## Overview update verification for 2.0.0

The shared Overview adds Octopus and FoxESS countdowns and **Update now**.
Desktop and 390-pixel phone browser checks used local mock services.
Both checks displayed grid power and measured zero battery power.
Forced failures produced retained red problem buttons.
After recovery, each alert required a separate acknowledgement.
An active failure could not be cleared as healthy.

The GAS mock returns only requested telemetry variables.
This test detected and verifies the missing grid and battery variable fix.
The Pi server tests cover alert persistence across restarts and owner-only storage.
They also cover authentication, cross-site rejection, and protected worker timing.
Only the loopback worker can publish refresh timing.
A remote client can request a refresh through the existing worker path.
An explicit refresh also bypasses the REST telemetry cache.
Pause and scheduler safeguards passed with mocked commands.
No live inverter command was used as a test action.

The standalone test file is `dist/Smart_Charging_v2.0.0.html`.
The full check suite and both interface builds passed.
Version 2.0.0 is installed on the live Pi.
The installation and read-only checks are recorded below.
The new public interface remains pending user approval.

## History storage redesign checks

History now shows four measurement charts with separate Expand actions.
Desktop and 390-pixel browser checks covered expansion and closing the chart.
The month field and action buttons use the same height.
The battery display uses one shared renderer for zero and missing values.

Routine readings remain in RAM until an hourly save.
The user can select a 30-minute interval.
The test suite covers buffered reads, timed saves, sudden buffer loss, restart, and preference migration.
It also covers gzip archives, legacy files, allocated disk bytes, low-space cleanup, and explicit clear isolation.
The Overview warning and deletion confirmation dialogs were checked with local mock data.
No live history was cleared as a test.

A synthetic 24-month data set contained 70,080 intervals.
Its raw rows used 3.70 MB.
Its monthly gzip archives used 1.34 MB, or 1.37 MB with simulated 4 KB allocation blocks.
This example excludes activity files and depends on the measurement values.
A 10 MB history allowance provides a conservative planning margin.


## Pi installation verification for 2.0.0

Runtime and interface commit `214132d72ab06c9ea6696c14b645be4c90da7c6d` was installed on 26 October 2026.
The installer backed up existing configuration and history before the update.
The server and worker were active after installation.
The taskbar process was restarted separately.
The desktop launcher opened the new interface.

At 18:39 UTC, both API states were healthy.
The worker supplied its update timing.
Operator pause was inactive.
FoxESS confirmed the dispatch schedule at 18:38:52 UTC through official REST readback.
The next dispatch windows were 23:30–03:00 and 05:00–05:30.
These future windows do not confirm measured charging behaviour.

Live readings included solar, home demand, grid import, grid export, battery charge, battery discharge, and battery level.
The battery displayed 0.00 kW idle at 10% charge.
No missing directional power field was replaced with a false zero.
History retained 31 intervals and displayed the new chart overview.
The Solar and home demand chart expanded and closed correctly.

History used 1,722 logical bytes and 8,192 allocated bytes at the check.
Free disk space was 16,451,153,920 bytes.
Retention remained 12 months.
The save interval was 60 minutes, with one interval buffered in RAM.
The low-storage warning was inactive.
No live history was cleared or removed to test low-space behaviour.

The existing tunnel restarted with a new public URL.
An unauthenticated browser reached the new interface and reported version 2.0.0 and the installed UI commit.
The existing Remote Access Key was preserved.
Authenticated access through the replacement public URL was not tested.

The installed diagnostic helper requires this command through the runtime symlink:

```bash
node --preserve-symlinks-main /opt/octopus-foxess/current/inspect-runtime.mjs
```

Commit `6aa9b081636d506ca725875070488b264a95d761` removes that command-line requirement for future installations.
This helper-only correction was not installed on the Pi during these checks.
Public Pages and release publication remain pending approval.
