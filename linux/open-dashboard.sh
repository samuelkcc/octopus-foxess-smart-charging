#!/bin/sh
set -eu

OCTOPUS_PORT=8787
if [ -r /etc/default/octopus-foxess ]; then
  . /etc/default/octopus-foxess
fi

# Keep the dashboard separate from normal Chromium windows and the worker.
CLIENT_PROFILE="${XDG_CONFIG_HOME:-$HOME/.config}/octopus-foxess-dashboard"
mkdir -p "$CLIENT_PROFILE"
chmod 0700 "$CLIENT_PROFILE"
DASHBOARD_PATH='/?client=1&original=1'
if [ "${1:-}" != '--original' ] && [ -f /opt/octopus-foxess/current/web/dev/index.html ]; then
  DASHBOARD_PATH='/dev/index.html?client=1&view=overview'
fi

exec /usr/bin/chromium \
  --user-data-dir="$CLIENT_PROFILE" \
  --app="http://127.0.0.1:${OCTOPUS_PORT}${DASHBOARD_PATH}" \
  --class=octopus-foxess-dashboard \
  --no-first-run \
  --password-store=basic
