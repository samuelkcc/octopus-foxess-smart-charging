// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include "cJSON.h"
#include <stdbool.h>
#include <stdint.h>
#include <time.h>
// Worker-owned, RAM-only completion memory. Explicit rule application clears it.
typedef struct { time_t until; unsigned source; } sc_resume_state_t;
cJSON *sc_automation_plan_stateful(const cJSON *rules, const cJSON *dispatches, const cJSON *import_rates,
    const cJSON *export_rates, const cJSON *manual, time_t now, double soc, sc_resume_state_t *resume);
cJSON *sc_rules_default(void);
bool sc_rules_valid(const cJSON *rules);
bool sc_dispatch_valid(const cJSON *dispatches);
time_t sc_timestamp(const char *value);
cJSON *sc_automation_plan(const cJSON *rules, const cJSON *dispatches, const cJSON *import_rates,
                          const cJSON *export_rates, const cJSON *manual, time_t now, double soc);
bool sc_plan_matches(const cJSON *wanted, const cJSON *actual);
