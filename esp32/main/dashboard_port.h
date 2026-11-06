// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <stdbool.h>
#include <stdint.h>
#define SC_DASHBOARD_DEFAULT_PORT 8787
void sc_dashboard_port_init(void);
uint16_t sc_dashboard_port_active(void);
uint16_t sc_dashboard_port_saved(void);
bool sc_dashboard_port_save(unsigned port);
