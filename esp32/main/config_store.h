// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <stdbool.h>
#include "cJSON.h"
#include "esp_err.h"
typedef struct {
    char ssid[33], password[65];
    char account[33], octopus_key[129], foxess_sn[65], foxess_key[257];
    char ip[16], gateway[16], netmask[16], dns[16];
    bool static_ip;
} sc_config_t;
bool sc_parse_config(const cJSON *object, sc_config_t *config);
bool sc_parse_network_config(const cJSON *object, sc_config_t *config);
esp_err_t sc_save_config(const sc_config_t *config);
esp_err_t sc_load_config(sc_config_t *config);
