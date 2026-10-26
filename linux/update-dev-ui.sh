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
mkdir -p "$TEMP_UI/dist" "$TEMP_UI/dev" "$TEMP_UI/scripts" "$TEMP_UI/linux"
cp "$ACTIVE_DEV/web/index.html" "$TEMP_UI/dist/Octopus_IGO_Smart_Charging_Detector.html"
for file in dev/ui.css dev/ui.js dev/about.js dev/setup.js dev/views.js dev/site.webmanifest linux/octopus-foxess.svg scripts/build-dev.mjs package.json; do
  curl --connect-timeout 15 --max-time 60 --proto '=https' --tlsv1.2 -fsSL "https://raw.githubusercontent.com/samuelkcc/octopus-foxess-smart-charging/$DEV_UI_COMMIT/$file" -o "$TEMP_UI/$file"
done
cd "$TEMP_UI"
node --check dev/ui.js
node --check dev/about.js
node --check dev/setup.js
node --check dev/views.js
OCTOPUS_UI_COMMIT="$DEV_UI_COMMIT" node scripts/build-dev.mjs
cp -p "$ACTIVE_DEV/web/dev/index.html" "$ACTIVE_DEV/web/dev/index.previous.html"
install -m 0644 dist/pi-dev.html "$ACTIVE_DEV/web/dev/index.html"
install -m 0644 dist/linux-package/octopus-foxess/web/dev/site.webmanifest "$ACTIVE_DEV/web/dev/site.webmanifest"
echo "DEV UI updated to $DEV_UI_COMMIT; original dashboard, worker, configuration and tunnel unchanged."
