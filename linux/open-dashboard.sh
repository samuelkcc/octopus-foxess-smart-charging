#!/bin/sh
set -eu

OCTOPUS_PORT=8787
if [ -r /etc/default/octopus-foxess ]; then
  . /etc/default/octopus-foxess
fi

exec /usr/bin/chromium \
  --app="http://127.0.0.1:${OCTOPUS_PORT}/?client=1" \
  --class=octopus-foxess-dashboard \
  --no-first-run \
  --password-store=basic
