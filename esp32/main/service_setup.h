// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#pragma once
#include "config_store.h"
typedef bool (*sc_service_save_t)(const sc_config_t *);
void sc_service_setup_init(void);
void sc_service_setup_prepare(void);
bool sc_service_setup_submit(const cJSON *request,unsigned *id);
cJSON *sc_service_setup_status(unsigned id);
void sc_service_setup_tick(const sc_config_t *active,bool online,sc_service_save_t save);
cJSON *sc_service_setup_execute(const cJSON *request,const sc_config_t *active,sc_service_save_t save);

cJSON *sc_service_setup_health(void);
