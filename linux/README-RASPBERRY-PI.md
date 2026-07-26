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
at rest on the Pi. The Pi desktop and application menu contain an **Octopus
FoxESS Settings** icon that opens a focused local app window. Use it to enter the
Octopus/FoxESS credentials and view or change the iPhone LAN access key—no
terminal key command is required.

If Raspberry Pi OS shows its normal **Execute File** question when the desktop
shortcut is opened for the first time, choose **Execute**. The application-menu
launcher opens directly.

The Pi is the central source of truth. Closing the settings window does not stop
the service. An iPhone opens a separate responsive dashboard, reads the Pi's
current state, and sends deliberate changes back to the Pi; it is not a
pixel-by-pixel screen mirror. Only the loopback worker performs unattended
schedule writes.

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
```

Re-run the install command to update. The encrypted configuration and selected
access key are preserved. The uninstall command removes the services, launcher,
desktop icon, encrypted configuration, and access key.
