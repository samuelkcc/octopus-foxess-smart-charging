// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "dashboard_port.h"
#include "nvs.h"
// Independent record: the encrypted credential layout remains compatible.
typedef struct { uint32_t version, port; } port_record_t;
static uint16_t active_port = SC_DASHBOARD_DEFAULT_PORT;
static uint16_t saved_port = SC_DASHBOARD_DEFAULT_PORT;
void sc_dashboard_port_init(void) {
    active_port = saved_port = SC_DASHBOARD_DEFAULT_PORT;
    nvs_handle_t handle;
    if (nvs_open("sc_http", NVS_READONLY, &handle) != ESP_OK) return;
    port_record_t value = {0};
    size_t size = sizeof(value);
    if (nvs_get_blob(handle, "port", &value, &size) == ESP_OK && size == sizeof(value) &&
        value.version == 1 && value.port >= 1 && value.port <= 65535)
        active_port = saved_port = (uint16_t)value.port;
    nvs_close(handle);
}
uint16_t sc_dashboard_port_active(void) { return active_port; }
uint16_t sc_dashboard_port_saved(void) { return saved_port; }
bool sc_dashboard_port_save(unsigned port) {
    if (port < 1 || port > 65535) return false;
    if (port == saved_port) return true;
    nvs_handle_t handle;
    if (nvs_open("sc_http", NVS_READWRITE, &handle) != ESP_OK) return false;
    port_record_t value = {.version = 1, .port = port};
    bool ok = nvs_set_blob(handle, "port", &value, sizeof(value)) == ESP_OK && nvs_commit(handle) == ESP_OK;
    nvs_close(handle);
    if (ok) saved_port = (uint16_t)port;
    return ok;
}
