// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#pragma once
#include "config_store.h"
// Stored separately so upgrades never change the Wi-Fi/API credential blob ABI.
typedef struct {char username[129],password_hash[33];bool websocket;} sc_live_config_t;
esp_err_t sc_live_load(sc_live_config_t *config);
esp_err_t sc_live_save(const sc_live_config_t *config);
void sc_live_init(void);
void sc_live_poll(const sc_config_t *device,bool online);
cJSON *sc_live_status(void);
cJSON *sc_live_reading(void);
cJSON *sc_live_configure(const cJSON *request,const sc_config_t *device);
cJSON *sc_live_test(const cJSON *request,const sc_config_t *device);
bool sc_live_set_mode(const char *mode);

cJSON *sc_live_store(const cJSON *request);
