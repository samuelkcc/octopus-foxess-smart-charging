# Project maintenance

This repository builds the standalone HTML/GitHub Pages edition and the Raspberry Pi edition from the same `src/app.js`, `src/index.html`, and `src/styles.css`. Edit source files, never generated `dist/` files. Read `README.md` and `linux/README-RASPBERRY-PI.md` before changing runtime behavior.

## Release and verification

- Preserve the established calendar version format: `YYYY.M.D.revision` in package metadata; Git tags pad month/day, e.g. `v2026.10.26.1`.
- Run `npm run version:set -- YYYY.M.D.revision` to update package metadata, cache identifiers, About/footer text, and the release workflow default together.
- Update `CHANGELOG.md` and `RELEASE_NOTES.md` with actual changes and verification limits.
- Run `npm run check` before packaging or publishing. It tests shared scheduler behavior, Pi integration, live telemetry, and remote authentication, then builds both artifacts. Localhost tests need socket permissions. Also parse `linux/tray.py` with Python's `ast` and run `sh -n` on changed shell files.
- Preserve GPL-3.0-or-later, SCKC attribution, complete license text, third-party notices, and independent-software disclaimers in both editions.
- Live hardware commands are not a test environment. Validate scheduler changes with mocks; distinguish REST-confirmed schedule programming from measured inverter/battery behavior.

## Automation invariants

- Changed, valid Octopus dispatches trigger schedule reconciliation before tariff work. Invalid, null, or rate-limited responses must preserve the last valid dispatches.
- Smart Dispatch wins over ordinary charging and, by default, discharging. Auto-Resume must never cancel an active dispatch. Preserve overnight windows and half-hour outward rounding.
- Queue revisions received during a FoxESS write. Require a fresh official REST readback before confirmation; cached data and command acceptance are insufficient.
- Respect the five-period FoxESS hardware limit, retain Smart Dispatch priority, and never report a partial schedule as fully confirmed.
- On Pi, only the loopback worker performs unattended writes and publishes authoritative dispatch state. Visible dashboards consume that snapshot. Standalone HTML requires the browser to stay open and awake.

## Remote access invariants

- Cloudflare Quick Tunnel must target the dedicated loopback remote listener, never the LAN/admin port. Requests on the remote listener must never inherit loopback privileges, even with worker or forwarded headers.
- Remote authentication uses a separate cryptographically generated 256-bit key, independent of optional LAN protection. Never log keys, put them in URLs, commit them, or return them in dashboard state.
- Browser sessions use Secure, HttpOnly, SameSite cookies with expiration, logout, and rotation/revocation. Protect mutations against cross-site requests and rate-limit login attempts.
- Keep Pi administration, credentials, key management, and worker publication inaccessible through the tunnel. Dashboard configuration updates must use an explicit field allowlist.
- Use a mock `cloudflared` in tests. Starting a real tunnel creates public access and must follow the user's authorization and tool confirmation requirements.
