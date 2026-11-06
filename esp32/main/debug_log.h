// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#pragma once
#include <stdbool.h>
#include "cJSON.h"
enum sc_debug_source {SC_DEBUG_BOOT,SC_DEBUG_WIFI,SC_DEBUG_OCTOPUS,SC_DEBUG_FOXESS,SC_DEBUG_STORAGE,SC_DEBUG_OTA,SC_DEBUG_TARIFF,SC_DEBUG_SOURCES};
void sc_debug_init(void);
void sc_debug_problem(enum sc_debug_source source,bool failed,int code);
cJSON *sc_debug_events(void);
cJSON *sc_debug_status(void);
bool sc_debug_session_start(char key[65]);
void sc_debug_session_close(void);
bool sc_debug_session_live(void);
int sc_debug_authorize(const char *authorization);
bool sc_debug_private_ipv4(unsigned long address);
