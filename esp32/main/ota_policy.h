// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#pragma once
#include <stdbool.h>
#include <stddef.h>
#include "cJSON.h"
typedef struct {char version[24],url[256],sha256[65];size_t size;} sc_ota_manifest_t;
bool sc_ota_manifest_parse(const cJSON *json,const char *current,sc_ota_manifest_t *out);
bool sc_ota_url_allowed(const char *url);
