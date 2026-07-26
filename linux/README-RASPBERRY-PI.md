# Raspberry Pi OS edition

This edition runs the Smart Charging Detector continuously as three `systemd`
services:

- `octopus-foxess.service` serves the local web interface and replaces Google
  Apps Script with a restricted FoxESS relay.
- `octopus-foxess-worker.service` runs the automation as the restricted app
  user in a dedicated headless Chromium profile.
- `octopus-foxess-inhibit.service` holds the system sleep and idle inhibitor
  separately from the unprivileged application processes.

All three services restart automatically after failure or reboot.

The server binds to port `8787` on the local network. Configuration is encrypted
at rest on the Pi. LAN browsers must use the access key printed by the installer.
Only the loopback worker performs unattended schedule writes; an iPhone can
monitor the dashboard and apply deliberate changes.

Install:

```bash
curl -fsSL https://raw.githubusercontent.com/samuelkcc/octopus-foxess-smart-charging/main/linux/install.sh | sudo sh
```

Uninstall, including encrypted configuration:

```bash
curl -fsSL https://raw.githubusercontent.com/samuelkcc/octopus-foxess-smart-charging/main/linux/uninstall.sh | sudo sh
```

Useful commands:

```bash
sudo systemctl status octopus-foxess octopus-foxess-worker octopus-foxess-inhibit
sudo journalctl -u octopus-foxess -u octopus-foxess-worker -u octopus-foxess-inhibit -f
sudo systemctl restart octopus-foxess octopus-foxess-worker octopus-foxess-inhibit
sudo cat /etc/octopus-foxess/access.key
```
