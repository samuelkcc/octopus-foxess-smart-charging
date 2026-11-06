// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include "cJSON.h"
typedef struct {
    void *context;
    bool (*activate)(void *context);
    cJSON *(*test)(void *context);
    bool (*save)(void *context);
    bool (*restore)(void *context);
} sc_provision_ops_t;
cJSON *sc_validate_and_save(const sc_provision_ops_t *ops);
size_t sc_ip_candidates(uint32_t current,uint32_t mask,uint32_t gateway,uint32_t dns,uint32_t *out,size_t capacity);
