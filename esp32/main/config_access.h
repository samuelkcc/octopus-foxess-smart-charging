// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#pragma once
#include <stdbool.h>
#include "cJSON.h"
// USB-only. No dashboard session or LAN access privileges are granted.
void sc_config_access_init(void);
bool sc_config_access_enabled(void);
bool sc_config_access_check(const char *password);
bool sc_config_access_change(const char *current,const char *replacement);
cJSON *sc_config_access_status(void);
