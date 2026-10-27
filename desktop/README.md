# Windows portable app

This edition includes the dashboard, local service, automation worker, and Cloudflare tunnel client.
The app does not install a Windows service.
The portable app targets 64-bit Windows.
Windows runtime verification is pending.
The EXE is unsigned.

## Start

1. Open `SmartCharging-2.0.0-Windows-x64.exe`.
2. Read the application licence notice.
3. Select **Accept and Continue**.
4. Open the account setup from Welcome.
5. Enter the Octopus and FoxESS account details.
6. Save the configuration.
7. Open the dashboard from Welcome.
8. Before live testing, stop other app hosts that use the same Octopus account.

No Google Apps Script relay is required.
Settings contains the local account and LAN protection controls.
New installations have no enabled automation rules.
The PC and app must stay on for automation and remote access.
Minimizing the window continues operation.
Closing the app stops its worker, local server, and public tunnel.
A normal exit saves pending history.

## Connect another device

1. Open **Remote Access** above **Settings**.
2. Find the local network address.
3. Open that address on another device in your trusted network.
4. Enter the LAN access code when requested.

The Windows firewall can ask about private-network access.
The app does not change firewall rules automatically.

## Use internet access

1. Open **Remote Access**.
2. Select **Start Quick Tunnel**.
3. Select **Copy URL**.
4. Select **Copy Key**.
5. Open the URL on the remote device.
6. Enter the Remote Access Key.

The tunnel targets the separate remote listener.
Remote clients cannot change service credentials or manage keys.
The URL remains valid while that tunnel process runs.
Restarting the app creates a new URL.
Browser sessions last up to 12 hours.
The same key remains valid until you replace it.
**New key / Sign out all** invalidates existing remote sessions.

## Data and updates

The EXE can run without installation.
Settings and history remain in the Windows user profile.
Moving the EXE does not transfer that data to another PC.
Windows encryption protects the configuration key for the current user.
The app transfers that key to its service through a private process channel.
The service does not write an unprotected configuration key file.

Octopus requests remain at least 60 seconds apart.
FoxESS routine reads use a cache for at least 600 seconds.
New Smart Dispatch schedules bypass routine polling delays.
An explicit automation pause still blocks commands.

1. Before an update, close Smart Charging.
2. Replace the portable EXE.
3. Open the new EXE.

The app retains settings and history in the same user profile.
A public release and signed distribution remain separate review steps.

## Build

1. Run `npm ci` in the project root.
2. Run `npm ci --prefix desktop`.
3. Run `npm run build:desktop`.

The build validates the pinned Cloudflare binary checksum.
The output is in `dist/windows`.
This build does not publish a release.

## Verification limits

Automated tests cover local-service encryption, restart persistence, LAN authentication, and desktop IPC sender restrictions.
A mock host key is used in those tests.
Windows DPAPI, EXE startup, firewall prompts, sleep behaviour, and shutdown require a Windows PC test.
The design preview uses fake data.
It does not prove real Windows operation.
