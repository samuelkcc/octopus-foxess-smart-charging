// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "wifi_reconnect.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/semphr.h"
#include <stdint.h>

#define JOIN_TIMEOUT_US 45000000LL
#define LINK_CHECK_US 5000000LL
static SemaphoreHandle_t guard;
static EventGroupHandle_t events;
static bool enabled, joining, online;
static unsigned failures;
static int64_t next_attempt, join_deadline, next_link_check;

static void retry_later(int64_t now) {
    // A timeout can also produce a disconnect event. Count that failure once.
    if (!joining && !online && next_attempt > now) return;
    online = false;
    joining = false;
    if (failures < 5) ++failures;
    unsigned seconds = failures < 5 ? 1U << failures : 30;
    next_attempt = now + (int64_t)seconds * 1000000;
    xEventGroupClearBits(events, SC_WIFI_CONNECTED);
    // This wakes a bounded USB trial. It never stops background retries.
    if (failures >= 5) xEventGroupSetBits(events, SC_WIFI_FAILED);
}

static bool connect_now(int64_t now) {
    joining = true;
    join_deadline = now + JOIN_TIMEOUT_US;
    esp_err_t result = esp_wifi_connect();
    if (result == ESP_ERR_WIFI_NOT_STARTED && esp_wifi_start() == ESP_OK)
        result = esp_wifi_connect();
    if (result != ESP_OK) retry_later(now);
    return result == ESP_OK;
}

bool sc_wifi_reconnect_init(EventGroupHandle_t group) {
    if (!group) return false;
    guard = xSemaphoreCreateMutex();
    if (!guard) return false;
    events = group;
    enabled = joining = online = false;
    failures = 0;
    next_attempt = join_deadline = next_link_check = 0;
    return true;
}

void sc_wifi_reconnect_pause(void) {
    xSemaphoreTake(guard, portMAX_DELAY);
    enabled = joining = online = false;
    next_attempt = join_deadline = 0;
    xEventGroupClearBits(events, SC_WIFI_CONNECTED | SC_WIFI_FAILED);
    xSemaphoreGive(guard);
}

bool sc_wifi_reconnect_start(void) {
    xSemaphoreTake(guard, portMAX_DELAY);
    enabled = true;
    online = joining = false;
    failures = 0;
    next_attempt = 0;
    xEventGroupClearBits(events, SC_WIFI_CONNECTED | SC_WIFI_FAILED);
    bool ok = connect_now(esp_timer_get_time());
    xSemaphoreGive(guard);
    return ok;
}

void sc_wifi_reconnect_disconnected(void) {
    xSemaphoreTake(guard, portMAX_DELAY);
    xEventGroupClearBits(events, SC_WIFI_CONNECTED);
    if (enabled) retry_later(esp_timer_get_time());
    xSemaphoreGive(guard);
}

void sc_wifi_reconnect_associated(void) {
    xSemaphoreTake(guard, portMAX_DELAY);
    // Association alone is not usable connectivity. Wait for DHCP or static IP.
    if (enabled && joining) join_deadline = esp_timer_get_time() + JOIN_TIMEOUT_US;
    xSemaphoreGive(guard);
}

bool sc_wifi_reconnect_got_ip(void) {
    xSemaphoreTake(guard, portMAX_DELAY);
    bool accepted = enabled;
    if (accepted) {
        online = true;
        joining = false;
        failures = 0;
        next_attempt = 0;
        next_link_check = esp_timer_get_time() + LINK_CHECK_US;
        xEventGroupClearBits(events, SC_WIFI_FAILED);
        xEventGroupSetBits(events, SC_WIFI_CONNECTED);
    }
    xSemaphoreGive(guard);
    return accepted;
}

void sc_wifi_reconnect_lost_ip(void) {
    xSemaphoreTake(guard, portMAX_DELAY);
    xEventGroupClearBits(events, SC_WIFI_CONNECTED);
    if (enabled) {
        online = false;
        joining = true;
        join_deadline = esp_timer_get_time();
    }
    xSemaphoreGive(guard);
}

void sc_wifi_reconnect_tick(void) {
    xSemaphoreTake(guard, portMAX_DELAY);
    int64_t now = esp_timer_get_time();
    if (enabled) {
        if (online && now >= next_link_check) {
            wifi_ap_record_t ap;
            next_link_check = now + LINK_CHECK_US;
            // Recover even if the disconnect notification was missed.
            if (esp_wifi_sta_get_ap_info(&ap) == ESP_ERR_WIFI_NOT_CONNECT)
                retry_later(now);
        }
        if (joining && now >= join_deadline) {
            retry_later(now);
            esp_wifi_disconnect();
        } else if (!online && !joining && now >= next_attempt) {
            connect_now(now);
        }
    }
    xSemaphoreGive(guard);
}
