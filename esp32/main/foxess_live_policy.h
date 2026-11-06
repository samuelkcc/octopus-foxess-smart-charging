// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#pragma once
#include <stdbool.h>
#include <stddef.h>
#include "cJSON.h"
bool sc_fox_web_signature(const char *path, const char *token, const char *language, const char *timestamp, char out[64]);
cJSON *sc_fox_live_values(const cJSON *frame);
