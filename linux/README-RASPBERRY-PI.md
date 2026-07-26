# Raspberry Pi OS edition

This edition runs the Smart Charging Detector continuously as two `systemd`
services:

- `octopus-foxess.service` serves the local web interface and replaces Google
  Apps Script with a restricted FoxESS relay.
- `octopus-foxess-worker.service` runs the automation in a dedicated headless
  Chromium profile. `systemd-inhibit` blocks sleep while the worker is active,
  and both services restart automatically after failure or reboot.

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
sudo systemctl status octopus-foxess octopus-foxess-worker
sudo journalctl -u octopus-foxess -u octopus-foxess-worker -f
sudo systemctl restart octopus-foxess octopus-foxess-worker
sudo cat /etc/octopus-foxess/access.key
```
