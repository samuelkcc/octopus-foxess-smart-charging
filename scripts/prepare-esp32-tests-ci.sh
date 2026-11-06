#!/bin/sh
# Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
# Fetch only pinned native-test dependencies. No toolchain or hardware access.
set -eu
project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
sdk_directory="$project_root/.build/esp32-sdk/esp-idf-v5.5.2"
if [ ! -d "$sdk_directory/.git" ]; then
  git clone --depth 1 --branch v5.5.2 --filter=blob:none --sparse https://github.com/espressif/esp-idf.git "$sdk_directory"
fi
git -C "$sdk_directory" sparse-checkout set components/json components/mbedtls
git -C "$sdk_directory" submodule update --init --depth 1 components/json/cJSON components/mbedtls/mbedtls
