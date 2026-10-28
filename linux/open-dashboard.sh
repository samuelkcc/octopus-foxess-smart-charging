#!/bin/sh
set -eu

OCTOPUS_PORT=8787
if [ -r /etc/default/octopus-foxess ]; then
  . /etc/default/octopus-foxess
fi

# The tray can inherit an inaccessible installer working directory.
cd "$HOME"

# Select the display backend explicitly for trays started by the updater.
WAYLAND_SOCKET="${WAYLAND_DISPLAY:-}"
case "$WAYLAND_SOCKET" in
  /*) ;;
  ?*) WAYLAND_SOCKET="${XDG_RUNTIME_DIR:-}/$WAYLAND_SOCKET" ;;
esac
if [ -n "$WAYLAND_SOCKET" ] && [ -S "$WAYLAND_SOCKET" ]; then
  set -- --ozone-platform=wayland
elif [ -n "${DISPLAY:-}" ]; then
  set -- --ozone-platform=x11
else
  echo 'No desktop display is available. Open the dashboard from the Pi desktop session.' >&2
  exit 1
fi

# Keep the dashboard separate from normal Chromium windows and the worker.
CLIENT_PROFILE="${XDG_CONFIG_HOME:-$HOME/.config}/octopus-foxess-dashboard"
mkdir -p "$CLIENT_PROFILE"
chmod 0700 "$CLIENT_PROFILE"
DASHBOARD_PATH='/?client=1'
if [ -f /opt/octopus-foxess/current/web/app/index.html ]; then
  DASHBOARD_PATH='/app/index.html?client=1&view=overview'
fi

exec /usr/bin/chromium "$@" \
  --user-data-dir="$CLIENT_PROFILE" \
  --app="http://127.0.0.1:${OCTOPUS_PORT}${DASHBOARD_PATH}" \
  --class=octopus-foxess-dashboard \
  --no-first-run \
  --password-store=basic
