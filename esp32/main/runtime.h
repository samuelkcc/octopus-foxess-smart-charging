// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include "config_store.h"
#include "esp_http_server.h"
void sc_runtime_init(void);
void sc_runtime_tick(const sc_config_t *config, bool network_ready);
void sc_runtime_register(httpd_handle_t server);
cJSON *sc_runtime_state(void);
cJSON *sc_runtime_account(void);
bool sc_runtime_request_refresh(const char *service);
cJSON *sc_runtime_history(int days);
bool sc_runtime_lan_access_enabled(void);
bool sc_runtime_reset_lan_access(void);
bool sc_runtime_enabled(void);
bool sc_runtime_paused(void);
bool sc_runtime_update(const cJSON *rules);

void sc_runtime_credentials_changed(void);

bool sc_runtime_apply_services(const sc_config_t *candidate,bool (*save)(const sc_config_t *));

bool sc_runtime_claim_octopus_setup(void);
void sc_runtime_octopus_setup_result(int http,int retry_after);
