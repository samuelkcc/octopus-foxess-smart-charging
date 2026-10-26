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


## Compact Overview refresh header

API refresh status now uses a small row in the Overview heading.
The two countdowns and Update now remain available.
Retained problem buttons still open the acknowledgement dialog.
Both schedule cards follow the power readings without an intervening update panel.
Desktop and 390-pixel phone layouts were checked with mock data.
Recovered alert acknowledgement was checked for both services.
The full check suite and both interface builds passed.


UI commit `9ba43d1fbbed4f6054a64eafb3857708627b36f9` was installed on 26 October 2026.
The interface-only updater preserved the running worker, configuration, history, and tunnel.
The existing authenticated Safari session loaded the new header through the same public URL.
Both countdowns displayed healthy status.
The two real dispatch windows and the confirmed FoxESS schedule remained visible below the power readings.
The installed runtime remains `214132d72ab06c9ea6696c14b645be4c90da7c6d`.


## Stable application-header status and About

Refresh controls now appear at the top right of the application header.
Countdowns keep fixed numeric widths during updates.
The activity dot shows an update without replacing the countdown text.
When Pi worker timing is available, dashboard requests do not change the worker activity indicator.
Connected edition labels, repeated page footers, and sidebar developer text are removed.
Developer credit, version, copyright, and full licence information remain in About.
The About background follows the public GitHub README and describes the battery-protection purpose.

Desktop measurements showed identical timer-control widths during connected and updating states.
The 390-pixel phone header retained both timers and the update action without horizontal overflow.
Both About panels displayed their edition-specific requirements and full licence tabs.
The full check suite and both interface builds passed.


UI commit `ef215b95ac6805adbb6b86d26417d1831722e943` was installed on 26 October 2026.
The interface-only update did not restart the server, worker, or tunnel.
The existing authenticated Safari session displayed the top-right timers and both real schedule cards.
The repeated footer and connected Pi label were absent.
The live About panel displayed the new background and the exact installed UI revision.
The runtime remains `214132d72ab06c9ea6696c14b645be4c90da7c6d`.


## API health badges and interval settings

The application header shows two equal API status buttons without countdown text.
Green rings identify healthy connections.
The circular border moves continuously while connected.
Its progress arc follows the next scheduled API refresh.
The border moves faster during API reads.
Selecting either badge reloads API data through the existing protected refresh path.
Retained incidents use small red indicators in reserved positions.
The indicator opens the existing review and acknowledgement dialog.

Settings contains both API refresh intervals.
The web edition saves values in browser storage.
The Pi stores values inside its encrypted automation configuration.
The worker loads changed configuration through its existing revision check.
Invalid values and failed saves cannot replace the last saved interval.
Existing automation rules are preserved when an interval is saved.
Pi Smart Dispatch checks remain at 60 seconds or less.
Shorter intervals retain the existing API-rate warning confirmation.

The pinned browser-asset updater now builds the shared engine from source.
Its optional `--restart-worker` argument reloads the existing background worker.
The updater does not restart the server or tunnel.
This installation needs that option so the worker can read saved intervals.


Mock browser checks measured both desktop badges at 148 by 40 pixels.
A retained error did not change either badge size.
Selecting a badge requested an immediate refresh.
The Pi fixture saved a 900-second FoxESS interval and restored it after page reload.
A 390-pixel phone check confirmed visible circular icons and a fixed red alert indicator.
The standalone setup screen and interval persistence unit tests passed.


UI and shared browser engine commit `1e28da6dfb622c898fa26b20dfaef756a9a57f28` was installed on 26 October 2026.
The pinned updater completed its build and interface checks on the Pi.
Only the background worker restarted to load the new interval preference module.
The server and tunnel stayed running.
The public URL stayed unchanged.
All three application services reported active after installation.
The server runtime remains `214132d72ab06c9ea6696c14b645be4c90da7c6d`.

The existing Safari session displayed two equal green API badges without countdown text.
The retained Octopus recovery indicator stayed visible.
Settings displayed the existing 60-second Octopus and 600-second FoxESS values.
Live interval values were not changed during this check.
Both real schedule cards remained visible with confirmed Smart Dispatch windows.
The battery reported 9 percent and zero-kilowatt idle power during this check.
This confirms schedule readback, not actual EV charging during the future windows.
The standalone GAS contract checks used mock services, not a live GAS deployment.
The full check suite and rebuilt Pi and standalone interfaces passed.

Selecting a live API badge completed the refresh and retained both schedule cards.
Manual reloads start the circular activity indicator immediately.

Pause automation now sits beside the API badges in the shared application header.
It remains available while browsing other pages.
The red pause banner and confirmation dialogs are unchanged.

The rotating border indicates scheduled polling, not an API request on each rotation.
Green still means that the last connection check succeeded.


Final UI commit `fb4ead16b0692bf1eadb4e4144474a7acdda7cb0` was installed after the shared-engine update.
This final asset update did not restart any service.
The public dashboard displayed Pause automation beside the two equal API badges.
The Overview heading no longer contained a duplicate pause button.
Mock browser measurements confirmed all three desktop controls were 148 by 40 pixels.
The 390-pixel phone preview kept all three controls on one row without overflow.
Separate animation observations confirmed that the circular borders continued to move while connected.
The pause dialog retained the 6-hour, 12-hour, 24-hour, and indefinite options.
No live pause, schedule, or history-clear action was submitted.

The live Octopus alert detail reported one Load failed event and subsequent recovery.
The check did not clear retained incidents.


## Interval-synchronized API circles

The circular progress uses the next API refresh deadline and its configured interval.
A 60-second Octopus interval completes one circle in 60 seconds.
A 600-second FoxESS interval completes one circle in 600 seconds.
The fixed-speed decorative rotation is removed.
Green means that the latest recorded read succeeded.
The circle itself does not prove a new successful response.
Selecting either badge still requests both API updates through the existing refresh path.
Selecting the red indicator opens the retained error details.

UI commit `943aab78ab14bec9785565e8f297030bf6b37b27` was installed on the Pi on 26 October 2026.
The update did not restart the server, worker, or tunnel.
The public URL and saved intervals stayed unchanged.
Mock observations confirmed that Octopus progress moved ten times faster than FoxESS at the 60-second and 600-second defaults.
The fixed-speed animation was absent in both badge states.
The full check suite and both interface builds passed.


## Desktop viewport layout

Desktop pages fit inside the available browser viewport.
The navigation rail follows the lower edge of the visible content.
Content uses a common width and consistent outer margins.
The interface scales content proportionally when a desktop page needs more room.
The desktop target is a 2560-by-1440 landscape display.
The available height excludes browser controls.
Wide desktop Settings uses three columns.
History shows all four charts with compact captions and paged activity.
Each activity page contains up to three entries, with the newest entries first.
Expanded charts and licence drawers remain separate overlays.
Phone and touch layouts retain normal scrolling.

Comparable desktop action buttons and input fields use a common 40-pixel height.
Charging and discharging actions use the same right-aligned button row.
Enabled toggle switches use green across Settings and automation rules.
Cards in the same grid row share aligned lower edges.

Desktop browser checks used a 2560-by-1320 content viewport to allow space for browser controls on the target display.
All six main Pi pages fit at their original scale without document overflow.
The navigation rail ended at the same lower edge as the viewport.
A 1280-by-720 check confirmed proportional fitting on smaller desktop windows.
The 390-pixel phone check retained vertical scrolling without horizontal overflow.
History activity pagination and chart expansion passed browser checks.
Mock pause controls preserved the red banner without extending the desktop page.
Pi login and standalone setup were checked separately.
Standalone setup connected to a local GAS mock.
No live GAS deployment was used.
No real pause, inverter, history-clear, or credential change was submitted.
The full check suite and both interface builds passed.

UI commit `5537aaf05f4843445a97edaab6ff5f4da3b7a9d6` was installed on the Pi on 26 October 2026.
The installer completed its pinned source build and interface checks.
The update did not restart the server, worker, or tunnel.
The existing public URL and authenticated Safari session remained available.
Safari displayed all four live history charts, storage information, and activity within one screen.
The page accessibility tree no longer reported a vertical scrollbar.
The full-height navigation rail and content edges remained aligned.
The Pi retained 43 recorded history intervals and its hourly save policy during verification.
The server runtime remains `214132d72ab06c9ea6696c14b645be4c90da7c6d`.


## Dynamic navigation height

The desktop menu follows the bottom of the last visible content row.
Navigation, new data, and viewport changes trigger a new measurement.
Short pages retain enough content height for all navigation controls.
The menu does not remain at full screen height when the right side is shorter.
Phone navigation and scrolling are unchanged.

Browser measurements showed zero pixels between the menu and content lower edges after four navigation changes.
History, Settings, Schedules, and Overview retained all navigation buttons without document overflow at 1280 by 720.
The 2560-by-1320 History preview also showed matching lower edges at the original scale.
The full check suite and both interface builds passed.
