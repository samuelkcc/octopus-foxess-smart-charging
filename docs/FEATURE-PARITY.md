# Feature review

This review applies to development version 2.0.0.
It is not approval for a public release.
The existing public interface remains available.

## Shared functions

| Function | DEV treatment | Verification |
|---|---|---|
| Scheduler priority and dispatch protection | Uses the existing engine. | Mock safety tests pass. |
| Fresh REST readback | Uses the existing engine. | Mock rejection and confirmation tests pass. |
| Five-period capacity | Uses the existing engine. | Priority and partial-schedule tests pass. |
| Queued dispatch revisions | Uses the existing engine. | Queue and stale-result tests pass. |
| Price and weekly rules | Retains original inputs and handlers. | Shared tests pass. |
| Auto-Resume | Retains the existing Smart Dispatch safeguard. | Shared safety tests pass. |
| Manual schedules and deletion | Retains original controls and handlers. | Controls remain present. No live command test was performed. |
| Dashboard-block visibility | Retains saved preferences in Settings. | The DEV visibility override was removed. |
| Theme, fullscreen, and screen saver | Retains original handlers. | Source review completed. |
| About and licences | Adds a side panel with tabs. | Full GPL and component text appear in the browser. |

## Pi functions

| Function | DEV treatment | Verification |
|---|---|---|
| LAN and remote login | Uses the original authentication flow. | Authentication tests pass. |
| Credential editing | Remains in native Server Configuration. | Service credentials remain outside browser clients. |
| Live WS policies | Moves the existing policy control into Settings. | Live WS and fallback tests pass. |
| Remote-key management | Remains in the native settings app. | Key preservation was checked on the Pi. |
| Background worker | Retains one worker. | Live services were active after installation. |
| Graphical public updater | Retains the installed native action. | Source and installed-path checks apply. It was not run against DEV. |
| DEV installer | Adds a pinned source installation. | Live installation passed after the permission correction. |
| Runtime rollback | Retains the previous runtime. | The rollback script exists. A live rollback was not run. |
| Compact history | Default 12 months, configurable from 1 to 24. | Retention, restart, gap, expiry, and authentication tests pass. |
| Pause automation | Blocks every app schedule command. | Timers, restart persistence, write barriers, activity, and authentication tests pass. |
| History charts | Adds month and measurement selection. | A real Pi interval appeared in the interface. |
| History CSV | Adds a month export action. | The data path is separate from credentials and account setup. |

The public updater installs the latest published GitHub release.
Before publication of this interface, that action can replace DEV with the previous public interface.
The Settings page identifies this difference.

## Web functions

| Function | DEV treatment | Verification |
|---|---|---|
| Account setup | Welcome screen and three guided setup stages. | Dummy-account login passed with a cross-origin GAS mock. |
| Google Apps Script guide | Retains the original relay instructions. | Bundled code and guide match. The documented handler passed the relay tests. |
| GAS transport | Retains signed FoxESS requests. | Cross-origin POST, redirect, write, readback, rejection, and pause checks pass with mocks. |
| Account storage | Uses original encryption and storage functions. | Shared storage tests pass. |
| Automatic operation | Retains browser automation. | The Pi-only write restriction does not apply. |
| Backup and import | Retains original dialogs and handlers. | Controls remain present. No real credential file was used. |
| Wipe Local Data | Retains the original operation. | The original storage tests apply. |
| Web updates | Retains hosted and downloaded-file behaviour. | No public deployment was performed. |
| History | Browser pause activity only. Pi power archives remain separate. | Local pause and resume records appear in History. |

## Required checks before public release

1. Complete the new interface review with the user.
2. Test a full update from the last public version on a spare Pi.
3. Check native launchers and the taskbar updater after that update.
4. Check configuration, access settings, and history retention after the update.
5. Test runtime rollback on that spare Pi.
6. Check the hosted web build under the repository's Pages path.
7. Check the downloaded HTML file in supported browsers.
8. Check encrypted export and import with a temporary test account.
9. Check mobile login and Home Screen access.
10. Review the current guides against ASD-STE100 rules and terminology.
11. Keep the existing release-file names compatible with the public updater.
12. Publish only after the user approves the new interface.

The current GitHub Pages workflow still builds the existing public interface.
The release workflow does not yet select the redesigned interface as the default.
Those changes belong to the approved release step.

## Standalone GAS verification

The redesigned standalone file was checked on 26 October 2026.
The fixture used the repository Pages path and a separate relay origin.
The relay executed the bundled GAS `doPost` code with mock FoxESS responses.
Signed reads and schedule writes passed.
The browser followed the relay redirect without a CORS preflight.
A weekly schedule appeared after a matching fresh readback.
The shared safety suite covered Smart Dispatch priority and failed readback.
Pause blocked the browser schedule request before it reached the relay.
No real GAS deployment or live inverter was used.
The current public Pages workflow still selects the previous interface.
The redesigned standalone HTML is available for user testing before release approval.

The version 2.0.0 welcome screen follows the recent Script Bridge layout approach.
It retains the Octopus colours and the charging-plug icon.
Setup and restore actions precede the three web account stages.
The Pi edition retains direct access-key login.
A 390-pixel phone welcome view was checked.
The guided web flow connected through the cross-origin GAS mock.
Required engine element IDs remained unique.
