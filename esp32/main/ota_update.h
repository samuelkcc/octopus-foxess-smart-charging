// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#pragma once
#include <stdbool.h>
#include "cJSON.h"
void sc_ota_init(bool server_ready);
void sc_ota_tick(bool online);
bool sc_ota_submit(const cJSON *request);
cJSON *sc_ota_status(void);
