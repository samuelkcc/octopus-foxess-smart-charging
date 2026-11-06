// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include "config_store.h"
cJSON *sc_schedule_inspect(const sc_config_t *config);
cJSON *sc_schedule_manual_test(const sc_config_t *config,int start_minute,const char *date);
cJSON *sc_schedule_recover(const sc_config_t *config);
bool sc_schedule_recovery_pending(void);

cJSON *sc_schedule_read(const sc_config_t *config,int *http);
bool sc_schedule_program(const sc_config_t *config,const cJSON *groups,int *http);
