# Version 2.0.1 release verification

The user approved publication after testing the Windows and web editions.
The redesigned interface is the default in all release assets.
Public screenshots use demonstration data only.

| Area | Verification |
|---|---|
| Smart Dispatch | Mock tests cover immediate reconciliation, overnight windows, priority, and queued revisions. |
| FoxESS safety | Mock tests cover five-period capacity, conflict handling, and fresh REST readback. |
| Operator pause | Write barriers, expiry, persistence, and activity tests pass. |
| Service disable | Native-only control blocks new upstream requests and preserves administration. |
| Octopus request budget | Pi spacing, concurrency, deduplication, restart guards, and actual cooldown tests pass. |
| Host dashboard snapshots | Concurrent clients read cached data without outbound requests or extra authentication. |
| FoxESS request budget | Routine cache and fresh post-command verification tests pass. |
| Remote access | Listener isolation, sessions, expiry, revocation, CSRF, and admin blocking pass with a mock tunnel. |
| History | Buffering, compression, migration, retention, low-space cleanup, and clear isolation tests pass. |
| Web GAS relay | Signed reads, writes, redirects, rejection, pause, and readback tests use the documented handler. |
| Windows service | Mock tests cover private key transfer, IPC origin isolation, encryption, and persistence. |
| User testing | The user tested Windows through UTM and the standalone web edition. |
| Shared UI | Browser checks use mock data for desktop, saved setup, mobile login, and native-host controls. |
| Restart recovery | A recovered browser transport incident can be reviewed and cleared after the host returns. |
| Pi live operation | Server, worker, taskbar registration, API health, and fixed 1920 × 1080 output were checked. |
| Public packaging | Existing Pi asset names are retained. Staging includes the redesigned Pi interface. |

## Practical limits

A fresh REST readback confirms the schedule programmed in FoxESS.
It does not prove measured battery behaviour on every inverter model.
No live inverter command or history deletion is used as a test action.

The automated Windows suite uses a mock host key.
It does not independently certify native DPAPI, firewall, sleep, or shutdown behaviour.
Public screenshots do not display a real account or device identifier.

A spare-Pi rollback exercise was not performed for this release.
The source-based development installer retains its backup and rollback paths.
The public installer preserves the configuration and history directories.

## Live public update

Release commit `40fa2893272d5185f65d2101aed909aa10d97ba2` was installed through the normal Pi updater on 27 October 2026.
Credential, LAN-code, and remote-key fingerprints were unchanged.
The history store retained 60 intervals. All three services and both energy APIs were healthy.
Four concurrent snapshot reads completed in approximately 0.02 seconds on the host.
The taskbar icon was visible, and the display remained at 1920 × 1080.
An unauthenticated request reached the correct release login entry.
Dashboard authentication remains required.
An authenticated test through that replacement URL was not performed.

## Version 2.0.1 maintenance review

- URL renewal preserves the remote key and uses the dedicated remote listener.
- Tunnel status requires a registered Cloudflare connection before it reports running.
- Warning badges open details without requesting API data.
- Recovered alerts expire after 24 hours by default. Active failures remain visible.
- The expiry preference persists across host and browser restarts.
- Slow reservation tests verify the API spacing floor. Pi startup also retains a full interval.
- New tests use mock tunnels and upstream services.
- Native Windows verification of this patch remains a user check.
- The Pi installed revision is `b1ffb035e850df1c6e4fd95e67e3c99840857e49`.

### Safari connection limit

Safari returned HTTP 403 for the direct Octopus preflight during an isolated invalid-key check.
Disabling content blockers did not resolve that response.
The temporary Safari preference changes were restored.
The user confirmed Chrome and Windows connections.
No live account query or inverter command was needed for this reproduction.

### Public patch installation

The normal Pi updater installed v2.0.1 on 27 October 2026.
The three system services were active after installation.
Octopus and FoxESS both reported healthy state.
Private fingerprints confirmed that account settings, LAN access, and the Remote Access Key remained unchanged.
History was backed up before the update.
The screen remained at 1920 × 1080 with normal orientation.

The live URL renewal returned a starting state without a ready address.
After Cloudflare connected, the host reported a different URL and the same key.
The replacement public URL returned the v2.0.1 dashboard runtime.
Authentication through the dedicated listener returned a secure session cookie during a loopback test.
No key was submitted through the new Cloudflare address during verification.

Both GitHub workflows passed for the release revision.
All downloaded release assets matched the published checksums.
The final local distribution contains one HTML file and one Windows EXE.
Native Windows execution of this patch remains a user check.

## Version 2.0.2 Safari compatibility review

- Existing browser setups retain direct Octopus access.
- Setup and Settings disclose Google relay processing before compatibility mode is selected.
- Saved browser setup and configuration backups retain the transport selection.
- Relay capabilities are checked before forwarding Octopus credentials.
- Mock tests cover Octopus sign-in, GraphQL data, account GET, and tariff GET.
- HTTP 429 and Retry-After remain visible to the request policy.
- Unsupported targets and methods cannot reach UrlFetchApp.
- FoxESS signatures, pause blocking, and fresh schedule readback retain regression coverage.
- Pi and Windows requests still use the local host API.
- The existing personal GAS deployment was updated to Version 2 without changing its URL.
- Safari received HTTP 200 with the expected invalid-key response through that deployment.
- The live connection check used an invalid demonstration key and no inverter command.
- No live inverter command is used for verification.

### Public v2.0.2 verification

The release UI revision is `356720b9c661718684310749af10d77141a715d7`.
Both GitHub workflows completed successfully.
The published app's Copy relay code action returned the exact canonical GAS source.
The personal deployment and downloadable relay source use that same code.
All downloaded release assets matched the published checksums.
The local distribution contains one HTML file and one Windows EXE.
Interface images use dark appearance. The mobile montage was supplied by the project owner.

## Version 2.0.3 history direction review

- Power charts show positive and negative directions with a clear zero line.
- Solar generation, grid import, and battery charging are positive.
- Home demand, grid export, and battery discharging are negative.
- Source fields remain paired with their original labels and colours.
- Expanded charts use the same data and axis limits.
- Battery level retains its 0–100% range.
- Tests cover missing readings, measured zero, original records, and CSV magnitudes.
- This presentation change does not modify telemetry, storage, authentication, or scheduler behaviour.
- Native Windows execution and installation on the user's Pi remain unverified for this patch.
