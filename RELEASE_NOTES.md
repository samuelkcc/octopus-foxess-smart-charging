# Smart Charging v2.0.1

This maintenance release improves remote access recovery and API problem alerts.

## Changes

- Pi and Windows Remote Access include **Update URL**. This creates a replacement address without changing the Remote Access Key.
- Pi Remote Access includes **Copy URL** and grouped controls.
- A tunnel shows **running** only after Cloudflare reports a connection. Startup failures retry automatically.
- API badges use a red border for active failures and retained alerts.
- Selecting a red badge opens problem details. It does not request API data or reset refresh intervals.
- Recovered alerts clear after 24 hours by default. Settings provides other periods or manual clearing.
- Pi request spacing includes a one-second safety margin. Storage latency cannot shorten the next request interval.
- Browser sign-in failures identify the affected service. Octopus failures no longer point to the GAS setup step.
- Active failures remain visible. Alert preferences survive host restarts and browser reloads.

## Remote access recovery

1. On the host, open **Remote Access**.
2. Select **Update URL**.
3. Wait until the tunnel connects.
4. Select **Copy URL**.
5. Open that URL on your other device.
6. Enter the existing Remote Access Key.
7. Replace any bookmark or Home Screen shortcut that uses the previous URL.

A Quick Tunnel address can change after a reboot, app update, or tunnel restart.
The old address cannot redirect to its replacement.
Pi Connect provides another way to retrieve the current address.

## Verification

Mock tests cover tunnel reconnection, URL renewal, authentication boundaries, retained alerts, expiry, settings persistence, and badge interaction.
The complete scheduler, history, transport, and desktop regression suite also passes.
Tests do not send commands to a live inverter.
Windows packaging checks do not replace native Windows verification of this patch.
Safari returned HTTP 403 during the direct Octopus preflight in an isolated check.
Chrome and Windows connections were confirmed by the user.
This release improves that error message but does not claim to resolve the upstream Safari rejection.

[Setup and screenshots](https://github.com/samuelkcc/octopus-foxess-smart-charging#readme)
