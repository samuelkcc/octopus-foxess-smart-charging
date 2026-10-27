# Smart Charging v2.0.5

This patch makes hosted tariff loading independent of dashboard connections.

## Changes

- The Pi or Windows worker reads electricity tariffs and publishes a shared snapshot.
- Desktop and phone dashboards read that snapshot without Octopus account or tariff requests.
- Each tariff direction displays as soon as its data becomes available.
- A private restart cache retains successful public tariff replies for up to 30 minutes.
- Expired replies still require a normal queued API request.
- Account responses, API keys, and authentication tokens never enter this cache.
- Pi outbound requests retain the 60-second minimum interval.
- Loading messages show progress while the worker waits for queued requests.
- Existing recovered warnings remain separate from current service health.

## Update

- On Pi, select **Update Raspberry Pi Edition** in native Configuration.
- On Windows, replace the portable EXE.
- For standalone web use, reload the hosted app or replace the HTML file.

No Google relay update is required.
A first installation can still need several minutes for queued tariff requests.

## Verification

Tests cover fixed Intelligent Octopus Go day/night responses, partial loading, snapshot-only clients, cache expiry, and credential exclusion.
The full mock suite checks scheduling, authentication, request spacing, and packaging.
Live inverter commands are not used as tests.
Native Windows execution remains a user check.
