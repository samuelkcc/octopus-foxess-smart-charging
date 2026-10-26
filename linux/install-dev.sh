#!/bin/sh
# Copyright (C) 2026 SCKC. GPL-3.0-or-later.
# Install a pinned development commit without publishing GitHub Pages/releases.
set -eu
[ "$(id -u)" -eq 0 ] || { echo 'Run with sudo.' >&2; exit 1; }
DEV_COMMIT="${1:-}"
case "$DEV_COMMIT" in *[!0-9a-f]*|'') echo 'Provide the full pinned Git commit.' >&2; exit 1;; esac
[ "${#DEV_COMMIT}" -eq 40 ] || exit 1
APP_ROOT=/opt/octopus-foxess
PREVIOUS="$(readlink -f "$APP_ROOT/current")"
[ -f "$PREVIOUS/server.mjs" ] || { echo 'Install the regular Pi edition first.' >&2; exit 1; }
DEV_ROOT="$APP_ROOT/dev/$DEV_COMMIT"
TEMP_DEV="$(mktemp -d)"
trap 'rm -rf "$TEMP_DEV"' EXIT INT TERM
curl --proto '=https' --tlsv1.2 -fsSL "https://codeload.github.com/samuelkcc/octopus-foxess-smart-charging/tar.gz/$DEV_COMMIT" -o "$TEMP_DEV/source.tar.gz"
mkdir "$TEMP_DEV/source"
tar -xzf "$TEMP_DEV/source.tar.gz" --strip-components=1 -C "$TEMP_DEV/source"
ln -s "$PREVIOUS/node_modules" "$TEMP_DEV/source/node_modules"
cd "$TEMP_DEV/source"
node scripts/build.mjs
node scripts/build-linux.mjs
OCTOPUS_UI_COMMIT="$DEV_COMMIT" node scripts/build-dev.mjs
node --check linux/server.mjs
node --check linux/history.mjs
node --check dev/ui.js
[ ! -e "$DEV_ROOT" ] || { echo 'This DEV commit is already installed.' >&2; exit 1; }
install -d -m 0755 "$APP_ROOT/dev" "$DEV_ROOT"
cp -R dist/linux-package/octopus-foxess/. "$DEV_ROOT/"
chmod -R u=rwX,go=rX "$DEV_ROOT"
BACKUP_ROOT="/var/backups/octopus-foxess-before-dev-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -m 0700 "$BACKUP_ROOT"
systemctl stop octopus-foxess-worker octopus-foxess
for name in config.enc config.key access.key; do
  if [ -f "/var/lib/octopus-foxess/$name" ]; then cp -p "/var/lib/octopus-foxess/$name" "$BACKUP_ROOT/"; fi
done
printf '%s\n' "$PREVIOUS" > "$BACKUP_ROOT/previous-runtime"
chmod -R go-rwx "$BACKUP_ROOT"
ln -sfn "$DEV_ROOT" "$APP_ROOT/current"
systemctl start octopus-foxess
DEV_READY=0
for attempt in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:8787/api/health >/dev/null; then DEV_READY=1; break; fi
  sleep 1
done
if [ "$DEV_READY" -ne 1 ]; then
  ln -sfn "$PREVIOUS" "$APP_ROOT/current"
  systemctl restart octopus-foxess octopus-foxess-worker
  echo 'DEV failed health check; restored previous runtime.' >&2
  exit 1
fi
systemctl start octopus-foxess-worker
install -m 0755 "$DEV_ROOT/open-dashboard.sh" /usr/local/bin/octopus-foxess-dashboard
install -m 0755 "$DEV_ROOT/tray.py" /usr/local/bin/octopus-foxess-tray
cat > "$APP_ROOT/rollback-dev.sh" <<EOF
#!/bin/sh
set -eu
systemctl stop octopus-foxess-worker octopus-foxess
ln -sfn '$PREVIOUS' '$APP_ROOT/current'
systemctl start octopus-foxess octopus-foxess-worker
echo 'Previous runtime restored; history files retained.'
EOF
chmod 0700 "$APP_ROOT/rollback-dev.sh"
echo "DEV installed: $DEV_COMMIT"
echo 'Use the taskbar charger menu to open the desktop client. Restart the status icon after this installation.'
echo 'DEV dashboard: http://127.0.0.1:8787/dev/index.html?client=1'
echo 'Original dashboard: http://127.0.0.1:8787/?client=1&original=1'
echo 'Rollback: sudo /opt/octopus-foxess/rollback-dev.sh'
echo 'The existing remote key is preserved. The restarted tunnel receives a new URL.'
