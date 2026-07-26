#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this uninstaller with sudo." >&2
  exit 1
fi

systemctl disable --now octopus-foxess-inhibit.service octopus-foxess-worker.service octopus-foxess.service 2>/dev/null || true
rm -f /etc/systemd/system/octopus-foxess-inhibit.service /etc/systemd/system/octopus-foxess-worker.service /etc/systemd/system/octopus-foxess.service
systemctl daemon-reload
systemctl reset-failed

rm -rf /opt/octopus-foxess /var/lib/octopus-foxess /etc/octopus-foxess
if id octopus-foxess >/dev/null 2>&1; then
  userdel octopus-foxess
fi

echo "Octopus FoxESS Linux services, application files, access key, and encrypted configuration were removed."
