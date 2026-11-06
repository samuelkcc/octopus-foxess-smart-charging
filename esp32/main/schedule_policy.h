// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <stdbool.h>
#include "cJSON.h"
cJSON *sc_future_test_plan(const cJSON *groups, int now_minute, int start_minute, const char **error);
bool sc_schedules_equal(const cJSON *left, const cJSON *right);
bool sc_schedule_group_enabled(const cJSON *group);
