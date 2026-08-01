#!/bin/sh
set -eu

INSTALL_URL="https://raw.githubusercontent.com/samuelkcc/octopus-foxess-smart-charging/main/linux/install.sh"

if [ "$(id -u)" -ne 0 ]; then
  echo "Administrator permission is required to update Octopus FoxESS." >&2
  exit 1
fi

# pkexec records the desktop user's numeric ID. Pass the resolved account to
# install.sh so it can restart the correct taskbar indicator after the update.
case "${PKEXEC_UID:-}" in
  ''|*[!0-9]*) ;;
  *)
    DESKTOP_ACCOUNT="$(getent passwd "$PKEXEC_UID" | cut -d: -f1)"
    if [ -n "$DESKTOP_ACCOUNT" ] && [ "$DESKTOP_ACCOUNT" != "root" ]; then
      export SUDO_USER="$DESKTOP_ACCOUNT"
    fi
    ;;
esac

UPDATE_TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$UPDATE_TEMP_DIR"' EXIT HUP INT TERM

curl --proto '=https' --tlsv1.2 -fsSL "$INSTALL_URL" -o "$UPDATE_TEMP_DIR/install.sh"
chmod 0700 "$UPDATE_TEMP_DIR/install.sh"
/bin/sh "$UPDATE_TEMP_DIR/install.sh"
