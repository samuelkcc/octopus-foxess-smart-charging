# Smart Charging v2.1.0

This release adds manual currency display and protected LAN remote-access management.
It also separates tariff transport problems from price-rendering problems.

- Settings accepts a currency code, symbol, and manual exchange rate against GBP.
- Overview prices and tariff charts use the display currency on the current browser.
- Rule inputs retain UK p/kWh and show converted reference values.
- Protected LAN clients can view or renew the public URL and reveal or rotate the remote key.
- LAN management requires enabled access-code protection and explicit code verification.
- Cloudflare clients cannot use LAN management, even with a valid remote key or session.
- Key rotation revokes remote sessions. Ordinary LAN status replies exclude the key.
- Price diagnostics include host publication, client receipt, rendering, and bounded request timing.
- Host-price reload and foreground recovery read snapshots without additional Octopus requests.
- Chart errors no longer stop hosted price polling.
- Email notifications and additional Shell key-display commands are not included.
- No GAS update is required.

LAN HTTP remains unencrypted. Use a trusted private network or a secure private connection.
The manual currency setting does not add support for Octopus accounts outside the UK.
The earlier intermittent missing-price incident has not been reproduced on live hardware.
These diagnostics support investigation without claiming a confirmed upstream cause.
Native Windows and live Pi deployment require operator verification.
The full automated checks and both interface builds passed.
Browser checks used mock Pi, web, and 390-pixel mobile interfaces.
