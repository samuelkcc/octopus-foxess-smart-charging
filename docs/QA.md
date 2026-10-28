# Release quality checks

Every release must pass `npm run check` and `npm run build:dev`.
The automated suite uses mock energy APIs and local services.
It does not send live inverter commands.

## Automated checks

| Area | Required evidence |
|---|---|
| Scheduler | Smart Dispatch priority, pause barriers, overnight windows, five-period limit, and fresh official REST confirmation. |
| API transport | Shared host requests, minimum intervals, duplicate suppression, actual rate-limit delays, and post-command FoxESS verification. |
| Prices | Delayed loading, partial completion, retry, zero/negative prices, snapshot recovery, and no synthetic prices. |
| Restart display | Private cache, account/agreement isolation, 24-hour expiry, last-known label, and no cached scheduler inputs. |
| Access | Separate remote listener, session expiry, key rotation, CSRF checks, login limits, and protected LAN management. |
| Activity | Export/import round trip, validation, deduplication, retention, size limits, and unchanged pause/control state. |
| Pi desktop | Mock Wayland, X11, missing display, working-directory recovery, and shell syntax. |
| Windows package | EXE structure, service files, interface, IPC isolation, verified Cloudflare binary, and licences. |
| macOS package | Universal app/framework/tunnel slices, ad-hoc signature, service files, interface, and licences. |

## Interface review

1. Open each edition at Welcome.
2. Check the licence entry and setup guide.
3. Open the dashboard with demonstration accounts.
4. Check desktop layout and 390-pixel phone layout.
5. Switch between dark and light themes.
6. Check that navigation and controls remain aligned.
7. Confirm that Pi and Windows show History.
8. Confirm that standalone web shows Activity.
9. Export an Activity backup.
10. Import that backup.
11. Confirm that duplicate records are absent.

## Native desktop review

Run this review separately on Windows, Apple Silicon, and Intel macOS.
Mock package checks cannot establish native operating-system behaviour.

1. Stop other automation hosts for the same inverter.
2. Open the packaged app.
3. Confirm that Welcome appears.
4. Configure the local host.
5. Close the app.
6. Reopen the app.
7. Confirm that settings remain available.
8. Check that API reads follow the configured intervals.
9. Minimize the app.
10. Confirm that monitoring continues.
11. Close the app.
12. Confirm that its worker and local listeners stop.

Check LAN authentication and Cloudflare sessions separately.
On macOS, check Keychain permission and update persistence.
On Windows, check encrypted storage and private-network firewall behaviour.
Real tunnel creation requires explicit operator authorization.
Record hardware behaviour separately from REST-confirmed schedule programming.
