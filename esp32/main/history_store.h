// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define SC_HISTORY_FLASH_DAYS 60
#define SC_HISTORY_SAVED_CAPACITY (SC_HISTORY_FLASH_DAYS * 24)
typedef struct {
    uint32_t at;
    float solar, home, grid, battery, soc;
    uint16_t counts[5];
    uint16_t reserved;
} sc_history_row_t;
typedef struct {
    size_t next_slot, slots;
    uint64_t sequence;
    uint32_t last_at;
    bool available;
} sc_history_store_t;
bool sc_history_store_init(sc_history_store_t *store);
bool sc_history_store_append(sc_history_store_t *store, const sc_history_row_t *row);
size_t sc_history_store_load(const sc_history_store_t *store, sc_history_row_t *rows, size_t capacity,
                             uint32_t from, uint32_t until);
// The backend owns only the dedicated History partition, never configuration or
// firmware.
size_t sc_history_flash_size(void);
bool sc_history_flash_read(size_t offset, void *data, size_t size);
bool sc_history_flash_write(size_t offset, const void *data, size_t size);
bool sc_history_flash_erase(size_t offset, size_t size);
