#!/bin/sh
# Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
node_directory=$(dirname "$(command -v node)")
docker run --rm \
  -v "$project_root:/project" \
  -v "$node_directory:/opt/host-node:ro" \
  -w /project \
  -e IDF_TARGET=esp32s3 \
  espressif/idf:v5.5.2 \
  /bin/bash -c 'export PATH="/opt/host-node:$PATH"; idf.py -C esp32 -B /project/.build/esp32-firmware -D SDKCONFIG=/project/.build/esp32-sdkconfig build'
