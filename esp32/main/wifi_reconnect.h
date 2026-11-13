// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <stdbool.h>
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

#define SC_WIFI_CONNECTED BIT0
#define SC_WIFI_FAILED BIT1

bool sc_wifi_reconnect_init(EventGroupHandle_t events);
// Pause before deliberate disconnects or changes to station configuration.
void sc_wifi_reconnect_pause(void);
bool sc_wifi_reconnect_start(void);
void sc_wifi_reconnect_disconnected(void);
void sc_wifi_reconnect_associated(void);
bool sc_wifi_reconnect_got_ip(void);
void sc_wifi_reconnect_lost_ip(void);
// Run on a dedicated task, independently of USB tests and cloud request locks.
void sc_wifi_reconnect_tick(void);
