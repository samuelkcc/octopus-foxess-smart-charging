# Windows portable app

This edition includes the dashboard, local service, automation worker, and Cloudflare tunnel client.
The app does not install a Windows service.
The portable app targets 64-bit Windows.
The user tested this edition on Windows 11 ARM through UTM.
The EXE is unsigned.

## Start

1. Open `SmartCharging-2.0.1-Windows-x64.exe`.
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

Normal login has no added 60-second request gap.
Actual API rate-limit responses still delay new requests.
The routine Octopus refresh setting has a 60-second minimum.
FoxESS routine reads use a cache for at least 600 seconds.
New Smart Dispatch schedules bypass routine polling delays.
An explicit automation pause still blocks commands.

The account setup guide opens from Welcome and Configuration.
It explains the Octopus API key, FoxESS API token, and inverter serial number.
The LAN access code has a Show and Hide control.

1. Before an update, close Smart Charging.
2. Replace the portable EXE.
3. Open the new EXE.

The app retains settings and history in the same user profile.
This release is unsigned.

## Build

1. Run `npm ci` in the project root.
2. Run `npm ci --prefix desktop`.
3. Run `npm run build:desktop`.

The build validates the pinned Cloudflare binary checksum.
The `dist` folder contains one standalone HTML file and one portable EXE.
Build directories, checksums, and Pi packages remain in `.build/artifacts-*`.
After a separate packaging run, use `npm run package:deliverables` to organize the two files.
This build does not publish a release.

## Verification limits

Automated tests cover local-service encryption, restart persistence, LAN authentication, and desktop IPC sender restrictions.
A mock host key is used in those tests.
Automated mock checks do not certify native Windows DPAPI, firewall, sleep, or shutdown behaviour.
The design preview uses fake data.
It does not prove real Windows operation.

## Replace a public URL

1. Open **Remote Access**.
2. Select **Update URL**.
3. Wait for the tunnel connection.
4. Select **Copy URL**.
5. Update your bookmark or Home Screen shortcut.

The Remote Access Key stays unchanged.
The previous address stops working.

## Review an API problem

1. Select the API badge with a red border.
2. Read the problem details.
3. After recovery, select **Clear alert**.

Viewing or clearing the alert does not request API data.
Recovered alerts clear automatically after 24 hours by default.
**Settings → API problem alerts** changes this preference.
Active failures remain visible.
