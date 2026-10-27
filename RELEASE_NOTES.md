# Smart Charging v2.0.4

This patch improves electricity-price startup, automatic recovery, and diagnostics.

## Changes

- Tariff replies update prices and charts immediately, including during dashboard startup.
- Chart updates do not repeat authentication, dispatch requests, or scheduler commands.
- Missing tariff data displays a loading or unavailable message. It never creates a synthetic 0p chart.
- Failed price updates retain available rates for the same tariff agreement.
- Failed updates retry automatically after one minute through the existing request queue.
- Successful tariff checks retain the existing 30-minute cache.
- Overview shows tariff loading, failure, and last-check information.
- Settings includes **Save diagnostic log** under **API problem alerts**.
- Diagnostic records contain API failures only, with repeated failures grouped and a 100-entry limit.
- Diagnostic exports exclude credentials, account numbers, device serial numbers, private URLs, and raw upstream messages.
- Clearing a recovered badge does not erase diagnostic records.

## Update

- On Pi, use **Update Raspberry Pi Edition** in native Configuration.
- On Windows, replace the EXE with this release's portable app.
- For the downloaded web edition, replace the HTML file.
- For the hosted web edition, reload the page.

After a Pi restart, the shared Octopus request queue can delay initial tariffs for several minutes.
Prices load automatically after the required account and tariff requests complete.
Pi request spacing remains at least 60 seconds.
Actual API cooldowns remain enforced.
No Google relay update is required.

## Verification

Mock tests cover delayed startup, automatic chart rendering, missing rates, real zero and negative prices, retained rates, and failed-update recovery.
Diagnostic tests cover error-only recording, grouping, size limits, restart persistence, and private-data exclusion.
The full regression suite and build checks pass.
Browser checks confirm automatic price display and diagnostic-export feedback with mock services.
No verification sends a command to a live inverter.
Native Windows execution remains a user check.
