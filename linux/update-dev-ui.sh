#!/bin/sh
# Update only the DEV view; no server restart, configuration write, or tunnel change.
set -eu
[ "$(id -u)" -eq 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
DEV_UI_COMMIT="${1:-}"
case "$DEV_UI_COMMIT" in *[!0-9a-f]*|'') exit 1;; esac
[ "${#DEV_UI_COMMIT}" -eq 40 ] || exit 1
ACTIVE_DEV="$(readlink -f /opt/octopus-foxess/current)"
case "$ACTIVE_DEV" in /opt/octopus-foxess/dev/*) ;; *) echo 'DEV runtime required.' >&2; exit 1;; esac
TEMP_UI="$(mktemp -d)"
trap 'rm -rf "$TEMP_UI"' EXIT INT TERM
mkdir -p "$TEMP_UI/dist" "$TEMP_UI/dev" "$TEMP_UI/scripts" "$TEMP_UI/linux" "$TEMP_UI/src/icons"
cp "$ACTIVE_DEV/web/index.html" "$TEMP_UI/dist/Octopus_IGO_Smart_Charging_Detector.html"
for file in dev/ui.css dev/ui.js dev/about.js dev/setup.js dev/views.js dev/settings.js dev/controls.js dev/monitor.js dev/history.js dev/default-route.js dev/site.webmanifest linux/octopus-foxess.svg src/icons/icon-192.png src/icons/icon-512.png src/icons/apple-touch-icon.png scripts/build-dev.mjs scripts/test-dev-build.mjs package.json; do
  curl --connect-timeout 15 --max-time 60 --proto '=https' --tlsv1.2 -fsSL "https://raw.githubusercontent.com/samuelkcc/octopus-foxess-smart-charging/$DEV_UI_COMMIT/$file" -o "$TEMP_UI/$file"
done
[ -f "$ACTIVE_DEV/automation-pause.mjs" ] && [ -f "$ACTIVE_DEV/integration-state.mjs" ] || { echo 'Install the full runtime update before this UI update.' >&2; exit 1; }
cd "$TEMP_UI"
node --check dev/ui.js
node --check dev/about.js
node --check dev/setup.js
node --check dev/views.js
node --check dev/settings.js
node --check dev/controls.js
node --check dev/monitor.js
node --check dev/history.js
node --check dev/default-route.js
OCTOPUS_UI_COMMIT="$DEV_UI_COMMIT" node scripts/build-dev.mjs
node scripts/test-dev-build.mjs
cp -p "$ACTIVE_DEV/web/dev/index.html" "$ACTIVE_DEV/web/dev/index.previous.html"
install -d -m 0755 "$ACTIVE_DEV/web/app"
if [ -f "$ACTIVE_DEV/web/app/index.html" ]; then
  cp -p "$ACTIVE_DEV/web/app/index.html" "$ACTIVE_DEV/web/app/index.previous.html"
fi
install -m 0644 dist/pi-dev.html "$ACTIVE_DEV/web/app/index.html"
install -m 0644 dist/linux-package/octopus-foxess/web/dev/index.html "$ACTIVE_DEV/web/dev/index.html"
cp -p "$ACTIVE_DEV/web/index.html" "$ACTIVE_DEV/web/index.previous.html"
install -m 0644 dist/linux-package/octopus-foxess/web/index.html "$ACTIVE_DEV/web/index.html"
install -m 0644 linux/octopus-foxess.svg "$ACTIVE_DEV/web/octopus-foxess.svg"
install -m 0644 dist/linux-package/octopus-foxess/web/app/site.webmanifest "$ACTIVE_DEV/web/app/site.webmanifest"
install -m 0644 dist/linux-package/octopus-foxess/web/dev/site.webmanifest "$ACTIVE_DEV/web/dev/site.webmanifest"
install -d -m 0755 "$ACTIVE_DEV/web/app/icons"
for icon in icon-192.png icon-512.png apple-touch-icon.png; do
  install -m 0644 "dist/linux-package/octopus-foxess/web/app/icons/$icon" "$ACTIVE_DEV/web/app/icons/$icon"
done
echo "DEV UI updated to $DEV_UI_COMMIT; original dashboard, worker, configuration and tunnel unchanged."
