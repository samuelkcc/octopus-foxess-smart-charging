// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#pragma once
#include "cJSON.h"
void sc_debug_http_init(void);
void sc_debug_http_tick(void);
cJSON *sc_debug_access_status(void);
cJSON *sc_debug_access_update(const cJSON *request);
