// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include "config_store.h"
cJSON *sc_cloud_read(const sc_config_t *config, bool fox, const char *path, const cJSON *body, const char *token,
                     int *http, int *retry_after);

bool sc_fox_slot(void);
void sc_fox_cooldown(int seconds);
