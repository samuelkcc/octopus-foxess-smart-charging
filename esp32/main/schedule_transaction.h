// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include "schedule_policy.h"
typedef struct {
    void *context;
    cJSON *(*read)(void *context);
    bool (*write)(void *context,const cJSON *groups);
    bool (*save)(void *context,const cJSON *original,const cJSON *candidate);
    bool (*clear)(void *context);
    void (*wait)(void *context);
} sc_schedule_ops_t;
cJSON *sc_run_schedule_test(const sc_schedule_ops_t *ops,int now_minute,int start_minute);
cJSON *sc_restore_schedule(const sc_schedule_ops_t *ops,const cJSON *original,const cJSON *candidate);
