#!/bin/sh
set -eu

REPOSITORY="samuelkcc/octopus-foxess-smart-charging"
ASSET_NAME="Octopus_FoxESS_Raspberry_Pi.tar.gz"
APP_USER="octopus-foxess"
APP_ROOT="/opt/octopus-foxess"
STATE_ROOT="/var/lib/octopus-foxess"
CONFIG_ROOT="/etc/octopus-foxess"
PORT="${OCTOPUS_PORT:-8787}"
ACCESS_KEY_FILE="$STATE_ROOT/access.key"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

if [ ! -d /run/systemd/system ]; then
  echo "This installer requires Raspberry Pi OS with systemd." >&2
  exit 1
fi

echo "Installing system packages..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl nodejs chromium fonts-noto-color-emoji \
  python3 python3-gi gir1.2-ayatanaappindicator3-0.1

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 18 or newer is required. Raspberry Pi OS Bookworm or newer is recommended." >&2
  exit 1
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home "$STATE_ROOT" --shell /usr/sbin/nologin "$APP_USER"
fi

install -d -o "$APP_USER" -g "$APP_USER" -m 0750 "$STATE_ROOT" "$STATE_ROOT/chromium"
install -d -o root -g "$APP_USER" -m 0750 "$CONFIG_ROOT"
install -d -o root -g root -m 0755 "$APP_ROOT/releases"

if [ ! -s "$ACCESS_KEY_FILE" ] && [ -s "$CONFIG_ROOT/access.key" ]; then
  cp "$CONFIG_ROOT/access.key" "$ACCESS_KEY_FILE"
fi
if [ ! -s "$ACCESS_KEY_FILE" ]; then
  ACCESS_KEY="$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"
  (umask 077 && printf '%s\n' "$ACCESS_KEY" > "$ACCESS_KEY_FILE")
fi
chown "$APP_USER":"$APP_USER" "$ACCESS_KEY_FILE"
chmod 0600 "$ACCESS_KEY_FILE"
rm -f "$CONFIG_ROOT/access.key"
ln -s "$ACCESS_KEY_FILE" "$CONFIG_ROOT/access.key"

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT INT TERM

if [ "${1:-}" ]; then
  DOWNLOAD_URL="https://github.com/$REPOSITORY/releases/download/$1/$ASSET_NAME"
else
  DOWNLOAD_URL="https://github.com/$REPOSITORY/releases/latest/download/$ASSET_NAME"
fi

echo "Downloading Raspberry Pi release..."
curl -fL "$DOWNLOAD_URL" -o "$TEMP_DIR/$ASSET_NAME"
tar -xzf "$TEMP_DIR/$ASSET_NAME" -C "$TEMP_DIR"

VERSION="$(node -p "JSON.parse(require('fs').readFileSync('$TEMP_DIR/octopus-foxess/package.json')).version")"
RELEASE_ROOT="$APP_ROOT/releases/$VERSION"
rm -rf "$RELEASE_ROOT"
install -d -o root -g root -m 0755 "$RELEASE_ROOT"
cp -R "$TEMP_DIR/octopus-foxess/." "$RELEASE_ROOT/"
chmod -R u=rwX,go=rX "$RELEASE_ROOT"
ln -sfn "$RELEASE_ROOT" "$APP_ROOT/current"

install -m 0755 "$RELEASE_ROOT/open-settings.sh" /usr/local/bin/octopus-foxess-settings
install -m 0755 "$RELEASE_ROOT/open-dashboard.sh" /usr/local/bin/octopus-foxess-dashboard
install -m 0755 "$RELEASE_ROOT/tray.py" /usr/local/bin/octopus-foxess-tray
install -m 0644 "$RELEASE_ROOT/octopus-foxess.desktop" /usr/share/applications/octopus-foxess.desktop
install -d -m 0755 /etc/xdg/autostart
install -m 0644 "$RELEASE_ROOT/octopus-foxess-tray.desktop" /etc/xdg/autostart/octopus-foxess-tray.desktop
install -d -m 0755 /usr/share/icons/hicolor/scalable/apps
install -m 0644 "$RELEASE_ROOT/octopus-foxess.svg" /usr/share/icons/hicolor/scalable/apps/octopus-foxess.svg
install -m 0644 "$RELEASE_ROOT/octopus-foxess-status-green.svg" /usr/share/icons/hicolor/scalable/apps/octopus-foxess-status-green.svg
install -m 0644 "$RELEASE_ROOT/octopus-foxess-status-amber.svg" /usr/share/icons/hicolor/scalable/apps/octopus-foxess-status-amber.svg
install -m 0644 "$RELEASE_ROOT/octopus-foxess-status-red.svg" /usr/share/icons/hicolor/scalable/apps/octopus-foxess-status-red.svg
printf 'OCTOPUS_PORT=%s\n' "$PORT" > /etc/default/octopus-foxess
chmod 0644 /etc/default/octopus-foxess

DESKTOP_USER="${SUDO_USER:-}"
if [ -n "$DESKTOP_USER" ] && [ "$DESKTOP_USER" != "root" ] && id "$DESKTOP_USER" >/dev/null 2>&1; then
  DESKTOP_HOME="$(getent passwd "$DESKTOP_USER" | cut -d: -f6)"
  DESKTOP_GROUP="$(id -gn "$DESKTOP_USER")"
  if [ -n "$DESKTOP_HOME" ] && [ -d "$DESKTOP_HOME/Desktop" ]; then
    rm -f "$DESKTOP_HOME/Desktop/Octopus FoxESS Settings.desktop"
    DESKTOP_SHORTCUT="$DESKTOP_HOME/Desktop/Octopus FoxESS Dashboard.desktop"
    install -o "$DESKTOP_USER" -g "$DESKTOP_GROUP" -m 0755 "$RELEASE_ROOT/octopus-foxess.desktop" "$DESKTOP_SHORTCUT"
    printf '%s\n' "$DESKTOP_SHORTCUT" > "$CONFIG_ROOT/desktop-shortcut.path"
  fi
fi

cat > /etc/systemd/system/octopus-foxess.service <<EOF
[Unit]
Description=Octopus FoxESS local server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
Environment=NODE_ENV=production
Environment=OCTOPUS_HOST=0.0.0.0
Environment=OCTOPUS_PORT=$PORT
Environment=OCTOPUS_STATE_DIR=$STATE_ROOT
Environment=OCTOPUS_ACCESS_KEY_FILE=$ACCESS_KEY_FILE
ExecStart=/usr/bin/node $APP_ROOT/current/server.mjs
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$STATE_ROOT

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/octopus-foxess-worker.service <<EOF
[Unit]
Description=Octopus FoxESS always-on automation worker
After=network-online.target octopus-foxess.service
Requires=octopus-foxess.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
ExecStartPre=/bin/sh -c 'until curl -fsS http://127.0.0.1:$PORT/api/health >/dev/null; do sleep 1; done'
ExecStart=/usr/bin/chromium --headless=new --disable-gpu --disable-dev-shm-usage --no-first-run --password-store=basic --user-data-dir=$STATE_ROOT/chromium http://127.0.0.1:$PORT/?worker=1
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$STATE_ROOT

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/octopus-foxess-inhibit.service <<EOF
[Unit]
Description=Octopus FoxESS sleep inhibitor
After=systemd-logind.service

[Service]
Type=simple
ExecStart=/usr/bin/systemd-inhibit --what=sleep:idle --who=Octopus-FoxESS --why=Always-on-automation --mode=block /usr/bin/sleep infinity
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable octopus-foxess.service octopus-foxess-worker.service octopus-foxess-inhibit.service
systemctl restart octopus-foxess.service octopus-foxess-worker.service octopus-foxess-inhibit.service

if [ -n "$DESKTOP_USER" ] && [ "$DESKTOP_USER" != "root" ]; then
  DESKTOP_UID="$(id -u "$DESKTOP_USER")"
  DESKTOP_RUNTIME="/run/user/$DESKTOP_UID"
  if [ -d "$DESKTOP_RUNTIME" ]; then
    if [ -S "$DESKTOP_RUNTIME/wayland-0" ]; then
      runuser -u "$DESKTOP_USER" -- env \
        XDG_RUNTIME_DIR="$DESKTOP_RUNTIME" \
        DBUS_SESSION_BUS_ADDRESS="unix:path=$DESKTOP_RUNTIME/bus" \
        WAYLAND_DISPLAY=wayland-0 \
        /usr/local/bin/octopus-foxess-tray >/dev/null 2>&1 &
    else
      runuser -u "$DESKTOP_USER" -- env \
        XDG_RUNTIME_DIR="$DESKTOP_RUNTIME" \
        DBUS_SESSION_BUS_ADDRESS="unix:path=$DESKTOP_RUNTIME/bus" \
        DISPLAY="${DISPLAY:-:0}" \
        /usr/local/bin/octopus-foxess-tray >/dev/null 2>&1 &
    fi
  fi
fi

ACCESS_KEY="$(cat "$ACCESS_KEY_FILE")"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "Octopus FoxESS v$VERSION is installed and running."
echo "The taskbar status icon starts automatically at the next desktop login."
echo "Open 'Octopus FoxESS Dashboard' from the desktop or application menu."
echo "Mobile / LAN access: http://${LAN_IP:-raspberrypi.local}:$PORT"
echo "LAN access code: $ACCESS_KEY"
echo
echo "Status: sudo systemctl status octopus-foxess octopus-foxess-worker octopus-foxess-inhibit"
echo "Logs:   sudo journalctl -u octopus-foxess -u octopus-foxess-worker -u octopus-foxess-inhibit -f"
