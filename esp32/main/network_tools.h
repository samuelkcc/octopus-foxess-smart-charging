// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include "esp_netif.h"
#include "cJSON.h"
cJSON *sc_network_info(esp_netif_t *station);
cJSON *sc_suggest_ip(esp_netif_t *station);
// 1 = occupied, 0 = no response detected, -1 = probe could not complete.
int sc_probe_ip(esp_netif_t *station,const esp_ip4_addr_t *address);
