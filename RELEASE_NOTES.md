# Smart Charging v2.0.3

This patch makes power-flow direction clear in history charts.

## Changes

- Grid import appears above zero. Grid export appears below zero.
- Solar generation appears above zero. Home demand appears below zero.
- Battery charging appears above zero. Battery discharging appears below zero.
- Legends and tooltips identify each direction with a sign.
- Power charts show both sides of a clear zero line.
- Expanded charts use the same directions and labels.
- Battery level remains between 0% and 100%.
- Saved history and CSV exports retain their original recorded magnitudes.

## Update

- On Pi, use **Update Raspberry Pi Edition** in native Configuration.
- On Windows, replace the EXE with this release's portable app.
- For the downloaded web edition, replace the HTML file.
- For the hosted web edition, reload the page.

History charts are available on Pi and Windows hosts, including their mobile dashboard clients.
This update does not require a Google relay change.

## Verification

Mock tests check source labels, signed values, measured zero, missing readings, percentage limits, expanded charts, and unchanged CSV exports.
The full regression suite and Windows packaging checks pass.
Browser checks cover the Pi dashboard, mobile chart expansion, and standalone web sign-in with mock services.
No verification sends a command to a live inverter.
Native Windows execution and installation on the user's Pi remain unverified for this patch.
