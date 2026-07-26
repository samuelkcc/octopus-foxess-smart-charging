#!/bin/sh
set -eu

REPOSITORY="samuelkcc/octopus-foxess-smart-charging"
ASSET_NAME="Octopus_FoxESS_Raspberry_Pi.tar.gz"
APP_USER="octopus-foxess"
APP_ROOT="/opt/octopus-foxess"
STATE_ROOT="/var/lib/octopus-foxess"
CONFIG_ROOT="/etc/octopus-foxess"
PORT="${OCTOPUS_PORT:-8787}"

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
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl nodejs chromium fonts-noto-color-emoji

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

if [ ! -s "$CONFIG_ROOT/access.key" ]; then
  ACCESS_KEY="$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"
  (umask 027 && printf '%s\n' "$ACCESS_KEY" > "$CONFIG_ROOT/access.key")
fi
chown root:"$APP_USER" "$CONFIG_ROOT/access.key"
chmod 0640 "$CONFIG_ROOT/access.key"

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
Environment=OCTOPUS_ACCESS_KEY_FILE=$CONFIG_ROOT/access.key
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
systemctl enable --now octopus-foxess.service octopus-foxess-worker.service octopus-foxess-inhibit.service

ACCESS_KEY="$(cat "$CONFIG_ROOT/access.key")"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "Octopus FoxESS v$VERSION is installed and running."
echo "Open http://${LAN_IP:-raspberrypi.local}:$PORT on your iPhone."
echo "Raspberry Pi access key: $ACCESS_KEY"
echo
echo "Status: sudo systemctl status octopus-foxess octopus-foxess-worker octopus-foxess-inhibit"
echo "Logs:   sudo journalctl -u octopus-foxess -u octopus-foxess-worker -u octopus-foxess-inhibit -f"
