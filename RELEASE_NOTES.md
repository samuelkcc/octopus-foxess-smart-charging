# Smart Charging v2.0.6

This patch separates background tariff processing from interface rendering.

- The host worker updates numeric tariff data without creating charts or changing the interface.
- Snapshot publication and automatic retry no longer depend on chart rendering.
- Phones and desktop dashboards continue to read the shared host snapshot.
- Pi API spacing and authentication protections remain unchanged.
- No Google relay update is required.

Tests cover DOM-independent worker calculation and the full scheduling, transport, authentication, and packaging suite.
Native Windows execution remains a user check.
