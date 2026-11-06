// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "runtime.h"
#include "foxess_live.h"
#include "automation_policy.h"
#include "cloud_read.h"
#include "esp_heap_caps.h"
#include "esp_timer.h"
#include "foxess_schedule.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "history_store.h"
#include "mbedtls/platform_util.h"
#include "nvs.h"
#include "schedule_policy.h"
#include <math.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
static SemaphoreHandle_t guard;
static cJSON *preferences, *published, *dispatches, *imports, *exports, *programmed, *measurements, *manual,
    *previous_plan, *fixed_day, *fixed_night, *device_info, *published_account;
static char account_number[33];
static time_t device_info_at;
static int64_t next_device_info;
static bool device_info_error;
static _Atomic unsigned revision = 1, confirmed_revision;
static _Atomic bool dispatch_valid, dispatch_changed, inflight, confirmed, partial, persistence_fault;
static time_t dispatch_at, telemetry_at, schedule_at, confirmed_at;
static int64_t next_octopus, next_fox, next_tick, token_until, next_schedule;
static int64_t octopus_not_before, fox_not_before;
static _Atomic bool refresh_octopus, refresh_fox, refresh_plan;
static char dispatch_error[32], dispatch_time_sample[100];
static bool was_live;
static char token[8192], import_code[96], export_code[96];
static int tariff_stage,tariff_http;
static time_t import_rates_at, export_rates_at;
static unsigned previous_revision, dispatch_sequence, attempt_revision, attempt_dispatch_sequence;
static _Atomic unsigned required_dispatch_revision = 1;
static int64_t next_attempt;
static char octopus_status[96] = "Waiting for first Octopus update",
            foxess_status[96] = "Waiting for first FoxESS update",
            control_status[128] = "Automation is not enabled";
static int octopus_http, foxess_http;
static double soc = NAN;
static sc_resume_state_t resume_memory;
static unsigned resume_revision;
static time_t resume_telemetry_at;
static _Atomic unsigned resume_epoch = 1;
typedef sc_history_row_t history_t;
static history_t *history, *saved_history;
static size_t history_used, history_head, saved_history_used;
#define HISTORY_CAPACITY (60 * 96)
static sc_history_store_t history_store;
static bool history_cache_loaded, history_flash_was_enabled, history_flash_error;
static int64_t history_save_due, history_last_attempt;
static double n(const cJSON *o, const char *key, double fallback) {
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(o, key);
    return cJSON_IsNumber(v) ? v->valuedouble : fallback;
}
static bool b(const cJSON *o, const char *key) {
    return cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(o, key));
}
static void replace(cJSON **target, cJSON *value) {
    cJSON_Delete(*target);
    *target = value;
}
static bool store(const char *key, const cJSON *value) {
    char *text = cJSON_PrintUnformatted(value);
    nvs_handle_t h;
    bool ok = false;
    if (text && nvs_open("sc_runtime", NVS_READWRITE, &h) == ESP_OK) {
        ok = nvs_set_str(h, key, text) == ESP_OK && nvs_commit(h) == ESP_OK;
        nvs_close(h);
    }
    free(text);
    return ok;
}
static cJSON *load(const char *key) {
    nvs_handle_t h;
    if (nvs_open("sc_runtime", NVS_READONLY, &h) != ESP_OK)
        return NULL;
    size_t size = 0;
    cJSON *out = NULL;
    if (nvs_get_str(h, key, NULL, &size) == ESP_OK && size > 1 && size < 16384) {
        char *text = malloc(size);
        if (text && nvs_get_str(h, key, text, &size) == ESP_OK)
            out = cJSON_Parse(text);
        free(text);
    }
    nvs_close(h);
    return out;
}
static bool clear_intent(void) {
    nvs_handle_t h;
    if (nvs_open("sc_runtime", NVS_READWRITE, &h) != ESP_OK)
        return false;
    esp_err_t e = nvs_erase_key(h, "intent");
    bool ok = (e == ESP_OK || e == ESP_ERR_NVS_NOT_FOUND) && nvs_commit(h) == ESP_OK;
    nvs_close(h);
    return ok;
}
void sc_runtime_init(void) {
    guard = xSemaphoreCreateMutex();
    resume_memory = (sc_resume_state_t){0}; resume_revision = 0; resume_telemetry_at = 0; resume_epoch = 1;
    sc_live_init();
    preferences = load("rules");
    // Add the opt-in field without resetting existing operator rules on upgrade.
    if (cJSON_IsObject(preferences) && !cJSON_HasObjectItem(preferences, "history_flash_enabled"))
        cJSON_AddBoolToObject(preferences, "history_flash_enabled", false);
    if (cJSON_IsObject(preferences) && !cJSON_HasObjectItem(preferences, "pause_discharge_dispatch"))
        cJSON_AddBoolToObject(preferences, "pause_discharge_dispatch", true);
    if (cJSON_IsObject(preferences) && !cJSON_HasObjectItem(preferences, "discharge_overrides_charge"))
        cJSON_AddBoolToObject(preferences, "discharge_overrides_charge", true);
    if (cJSON_IsObject(preferences) && !cJSON_HasObjectItem(preferences, "charge_soc_enabled"))
        cJSON_AddBoolToObject(preferences, "charge_soc_enabled", true);
    cJSON *retention = cJSON_GetObjectItemCaseSensitive(preferences, "history_days");
    if (cJSON_IsNumber(retention) && retention->valuedouble > 60)
        cJSON_SetNumberValue(retention, 60);
    if (!sc_rules_valid(preferences)) {
        replace(&preferences, sc_rules_default());
    }
    manual = load("manual");
    dispatches = cJSON_CreateArray();
    imports = cJSON_CreateArray();
    exports = cJSON_CreateArray();
    programmed = cJSON_CreateArray();
    measurements = cJSON_CreateObject();
    history = heap_caps_calloc(HISTORY_CAPACITY, sizeof(*history), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    sc_history_store_init(&history_store);          // Read-only scan. Opt-in remains off
                                                    // unless explicitly saved.
    next_octopus = esp_timer_get_time() + 60000000; // Restart cannot bypass the initial Octopus request gap.
    octopus_not_before = next_octopus; // USB/LAN tests share the same restart guard.
}
void sc_runtime_credentials_changed(void) {
    // Called with the shared network I/O lock held and automation disabled.
    mbedtls_platform_zeroize(token, sizeof(token));
    import_code[0] = export_code[0] = 0;
    token_until = 0;
    tariff_stage = 0;tariff_http=0;
    import_rates_at = export_rates_at = 0;
    dispatch_valid = false;
    confirmed = false;
    dispatch_at = telemetry_at = schedule_at = confirmed_at = 0;
    soc = NAN; resume_epoch++;
    replace(&dispatches, cJSON_CreateArray());
    replace(&imports, cJSON_CreateArray());
    replace(&exports, cJSON_CreateArray());
    replace(&programmed, cJSON_CreateArray());
    replace(&measurements, cJSON_CreateObject());
    replace(&device_info, NULL);
    device_info_at = 0;
    next_device_info = 0;
    device_info_error = false;
    replace(&previous_plan, NULL);
    xSemaphoreTake(guard, portMAX_DELAY);
    replace(&manual, NULL);
    cJSON *cleared = cJSON_CreateNull();
    store("manual", cleared);
    cJSON_Delete(cleared);
    xSemaphoreGive(guard);
    int64_t minimum = esp_timer_get_time() + 60000000;
    if (next_octopus < minimum)
        next_octopus = minimum;
}
bool sc_runtime_enabled(void) {
    if (!guard)
        return false;
    xSemaphoreTake(guard, portMAX_DELAY);
    bool value = b(preferences, "enabled");
    xSemaphoreGive(guard);
    return value;
}
bool sc_runtime_paused(void) {
    if (!guard)
        return false;
    xSemaphoreTake(guard, portMAX_DELAY);
    bool value = b(preferences, "paused");
    xSemaphoreGive(guard);
    return value;
}
unsigned sc_runtime_revision(void) {
    xSemaphoreTake(guard, portMAX_DELAY);
    unsigned value = revision;
    xSemaphoreGive(guard);
    return value;
}
bool sc_runtime_update_expected(const cJSON *rules, unsigned expected) {
    if (!sc_rules_valid(rules))
        return false;
    cJSON *copy = cJSON_Duplicate(rules, true);
    if (!copy)
        return false;
    xSemaphoreTake(guard, portMAX_DELAY);
    bool ok = (!expected || expected == revision) && store("rules", copy);
    if (ok) {
        bool resume = (!b(copy, "paused") && b(preferences, "paused")) ||
                      (b(copy, "enabled") && !b(preferences, "enabled"));
        // General refresh/history preferences do not restart a fulfilled charge.
        bool changed_control = resume;
        const cJSON *field;
        cJSON_ArrayForEach(field, copy) {
            if (!strcmp(field->string, "octopus_seconds") || !strcmp(field->string, "foxess_seconds") ||
                !strcmp(field->string, "history_days") || !strcmp(field->string, "history_flash_enabled") ||
                !strcmp(field->string, "pause_until") || !strcmp(field->string, "paused")) continue;
            if (!cJSON_Compare(field, cJSON_GetObjectItemCaseSensitive(preferences, field->string), true)) changed_control = true;
        }
        if (changed_control) resume_epoch++;
        replace(&preferences, copy);
        revision++;
        confirmed = false;
        if (resume) {
            required_dispatch_revision = revision;
        }
        if (resume) {
            dispatch_valid = false;
        }
    } else
        cJSON_Delete(copy);
    xSemaphoreGive(guard);
    return ok;
}
bool sc_runtime_update(const cJSON *rules) { return sc_runtime_update_expected(rules, 0); }
static cJSON *rules_copy(unsigned *rev) {
    xSemaphoreTake(guard, portMAX_DELAY);
    cJSON *copy = cJSON_Duplicate(preferences, true);
    if (rev)
        *rev = revision;
    xSemaphoreGive(guard);
    return copy;
}
// The USB caller holds network_io, so any current cloud command has finished.
bool sc_runtime_disable_for_setup(void) {
    unsigned expected;
    cJSON *copy = rules_copy(&expected);
    if (!copy) return false;
    cJSON_SetBoolValue(cJSON_GetObjectItemCaseSensitive(copy, "enabled"), false);
    bool ok = sc_runtime_update_expected(copy, expected);
    cJSON_Delete(copy);
    return ok;
}
static void add_number(cJSON *o, const char *key, double value) {
    if (isfinite(value))
        cJSON_AddNumberToObject(o, key, value);
    else
        cJSON_AddNullToObject(o, key);
}
static double measurement(const char *key) { return n(measurements, key, NAN); }
static void history_sample(time_t now) {
    if (!history)
        return;
    uint32_t interval = (uint32_t)(now / 900 * 900);
    history_t *row = history_used ? &history[(history_head + history_used - 1) % HISTORY_CAPACITY] : NULL;
    float values[] = {measurement("solar"), measurement("home"), measurement("grid"), measurement("battery"),
                      measurement("soc")};
    if (!row || row->at != interval) {
        if (history_used == HISTORY_CAPACITY) {
            history_head = (history_head + 1) % HISTORY_CAPACITY;
            history_used--;
        }
        row = &history[(history_head + history_used++) % HISTORY_CAPACITY];
        *row = (history_t){.at = interval,
                           .solar = values[0],
                           .home = values[1],
                           .grid = values[2],
                           .battery = values[3],
                           .soc = values[4]};
        for (int i = 0; i < 5; i++)
            row->counts[i] = isfinite(values[i]) ? 1 : 0;
    } else {
        float *fields[] = {&row->solar, &row->home, &row->grid, &row->battery, &row->soc};
        for (int i = 0; i < 5; i++)
            if (isfinite(values[i])) {
                *fields[i] = row->counts[i] ? (*fields[i] * row->counts[i] + values[i]) / (row->counts[i] + 1)
                                            : values[i];
                row->counts[i]++;
            }
    }
}
static bool history_reload_saved(time_t now) {
    history_t *rows =
        heap_caps_calloc(SC_HISTORY_SAVED_CAPACITY, sizeof(*rows), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!rows)
        return false;
    size_t count =
        sc_history_store_load(&history_store, rows, SC_HISTORY_SAVED_CAPACITY,
                              (uint32_t)(now - SC_HISTORY_FLASH_DAYS * 86400), (uint32_t)(now / 3600 * 3600));
    if (count == SIZE_MAX) {
        free(rows);
        return false;
    }
    xSemaphoreTake(guard, portMAX_DELAY);
    free(saved_history);
    saved_history = rows;
    saved_history_used = count;
    xSemaphoreGive(guard);
    history_cache_loaded = true;
    return true;
}
static void history_persist(time_t now, int64_t us, const cJSON *rules) {
    if (now < 1700000000)
        return;
    if (!history_cache_loaded && history_store.available)
        history_flash_error = !history_reload_saved(now);
    if (!b(rules, "history_flash_enabled")) {
        history_flash_was_enabled = false;
        history_save_due = 0;
        return;
    }
    if (!history_flash_was_enabled) {
        history_flash_was_enabled = true;
        history_save_due = us + (3600 - now % 3600) * 1000000LL;
        if (history_last_attempt && history_save_due < history_last_attempt + 3600000000LL)
            history_save_due = history_last_attempt + 3600000000LL;
        return;
    }
    if (us < history_save_due)
        return;
    // Also rate-limit failed attempts and reboot recovery. No rapid retry or NVS
    // writes.
    history_last_attempt = us;
    history_save_due = us + 3600000000LL;
    if (!history_store.available && !sc_history_store_init(&history_store)) {
        history_flash_error = true;
        return;
    }
    history_t hour = {.at = (uint32_t)((now / 3600 - 1) * 3600)};
    if (hour.at <= history_store.last_at)
        return;
    double sums[5] = {0};
    uint32_t counts[5] = {0};
    xSemaphoreTake(guard, portMAX_DELAY);
    for (size_t i = 0; i < history_used; i++) {
        const history_t *row = &history[(history_head + i) % HISTORY_CAPACITY];
        if (row->at < hour.at || row->at >= hour.at + 3600)
            continue;
        const float values[] = {row->solar, row->home, row->grid, row->battery, row->soc};
        for (unsigned k = 0; k < 5; k++)
            if (row->counts[k] && isfinite(values[k])) {
                sums[k] += (double)values[k] * row->counts[k];
                counts[k] += row->counts[k];
            }
    }
    xSemaphoreGive(guard);
    float *values[] = {&hour.solar, &hour.home, &hour.grid, &hour.battery, &hour.soc};
    bool observed = false;
    for (unsigned k = 0; k < 5; k++) {
        *values[k] = counts[k] ? (float)(sums[k] / counts[k]) : NAN;
        hour.counts[k] = counts[k] > UINT16_MAX ? UINT16_MAX : (uint16_t)counts[k];
        observed |= counts[k] != 0;
    }
    if (!observed)
        return; // Missing observations remain gaps, never fabricated zeroes.
    // Serialize this bounded local commit with changes to the opt-in preference.
    xSemaphoreTake(guard, portMAX_DELAY);
    bool still_enabled = b(preferences, "history_flash_enabled");
    if (still_enabled)
        history_flash_error = !sc_history_store_append(&history_store, &hour);
    xSemaphoreGive(guard);
    if (still_enabled && !history_flash_error)
        history_flash_error = !history_reload_saved(now);
}
static void publish(time_t now, const cJSON *rules) {
    cJSON *out = cJSON_CreateObject();
    if (!out)
        return;
    cJSON_AddNumberToObject(out, "schema", 1);
    cJSON_AddNumberToObject(out, "now", now);
    cJSON_AddStringToObject(out, "edition", "ESP32");
    cJSON_AddNumberToObject(out, "uptime_seconds", esp_timer_get_time() / 1000000);
    cJSON_AddNumberToObject(out, "revision", revision);
    cJSON_AddNumberToObject(out, "confirmed_revision", confirmed_revision);
    cJSON_AddItemToObject(out, "rules", cJSON_Duplicate(rules, true));
    cJSON_AddItemToObject(out, "telemetry", cJSON_Duplicate(measurements, true));
    cJSON_AddItemToObject(out, "dispatches", cJSON_Duplicate(dispatches, true));
    cJSON *safe_groups = cJSON_AddArrayToObject(out, "groups");
    const cJSON *source_group;
    cJSON_ArrayForEach(source_group, programmed) {
        cJSON *row = cJSON_CreateObject();
        const char *keys[] = {"enable",   "startHour", "startMinute",  "endHour", "endMinute",
                              "workMode", "fdSoc",     "minSocOnGrid", "fdPwr"};
        for (unsigned i = 0; i < 9; i++) {
            const cJSON *value = cJSON_GetObjectItemCaseSensitive(source_group, keys[i]);
            if (cJSON_IsNumber(value) || cJSON_IsBool(value) || cJSON_IsString(value))
                cJSON_AddItemToObject(row, keys[i], cJSON_Duplicate(value, true));
        }
        cJSON_AddItemToArray(safe_groups, row);
    }
    cJSON_AddItemToObject(out, "import_rates", cJSON_Duplicate(imports, true));
    cJSON_AddItemToObject(out, "export_rates", cJSON_Duplicate(exports, true));
    cJSON_AddNumberToObject(out, "import_rates_at", import_rates_at);
    cJSON_AddNumberToObject(out, "export_rates_at", export_rates_at);
    cJSON_AddNumberToObject(out, "dispatch_at", dispatch_at);
    cJSON_AddNumberToObject(out, "telemetry_at", telemetry_at);
    cJSON_AddNumberToObject(out, "schedule_at", schedule_at);
    cJSON_AddNumberToObject(out, "confirmed_at", confirmed_at);
    cJSON_AddBoolToObject(out, "dispatch_valid", dispatch_valid);
    cJSON_AddBoolToObject(out, "confirmed", confirmed && confirmed_revision == revision && !partial);
    cJSON_AddBoolToObject(out, "partial", partial);
    cJSON_AddBoolToObject(out, "write_inflight", inflight);
    cJSON_AddStringToObject(out, "control_status", control_status);
    cJSON_AddStringToObject(out, "octopus_status", octopus_status);
    const char *tariff_steps[]={"Tariff refresh idle", "Loading account tariff codes", "Loading import unit rates", "Loading export unit rates", "Loading import day rates", "Loading import night rates"};
    cJSON_AddNumberToObject(out,"tariff_http",tariff_http);
    cJSON_AddStringToObject(out,"tariff_status",!import_code[0]&&tariff_stage==0?"Waiting for tariff discovery after dispatch":tariff_steps[tariff_stage>=0&&tariff_stage<6?tariff_stage:0]);
    cJSON_AddStringToObject(out, "dispatch_error_code", dispatch_error);
    cJSON_AddStringToObject(out, "dispatch_time_sample", dispatch_time_sample);
    cJSON_AddBoolToObject(out, "octopus_refresh_pending", refresh_octopus);
    cJSON_AddBoolToObject(out, "foxess_refresh_pending", refresh_fox || refresh_plan);
    cJSON_AddStringToObject(out, "foxess_status", foxess_status);
    cJSON_AddItemToObject(out, "foxess_telemetry", sc_live_status());
    cJSON_AddNumberToObject(out, "octopus_http", octopus_http);
    cJSON_AddNumberToObject(out, "foxess_http", foxess_http);
    int64_t us = esp_timer_get_time();
    cJSON_AddNumberToObject(out, "octopus_next",
                            now + (next_octopus > us ? (next_octopus - us) / 1000000 : 0));
    cJSON_AddNumberToObject(out, "foxess_next", now + (next_fox > us ? (next_fox - us) / 1000000 : 0));
    cJSON_AddBoolToObject(out, "history_available", history != NULL);
    cJSON_AddNumberToObject(out, "history_records", history_used);
    cJSON_AddBoolToObject(out, "history_flash_available", history_store.available);
    cJSON_AddBoolToObject(out, "history_flash_error", history_flash_error);
    cJSON_AddNumberToObject(out, "history_saved_records", saved_history_used);
    cJSON_AddNumberToObject(out, "history_saved_through",
                            history_store.last_at ? history_store.last_at + 3600 : 0);
    cJSON_AddNumberToObject(out, "history_flash_days", SC_HISTORY_FLASH_DAYS);
    cJSON_AddNumberToObject(out, "free_psram_bytes", heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
    // Account details have a separate LAN-only endpoint. No service keys, raw
    // API responses, address fields, or sign-in tokens enter this snapshot.
    cJSON *account = device_info ? cJSON_Duplicate(device_info, true) : cJSON_CreateObject();
    if (account) {
        cJSON_AddStringToObject(account, "account_number", account_number);
        cJSON_AddStringToObject(account, "import_tariff", import_code);
        cJSON_AddStringToObject(account, "export_tariff", export_code);
        cJSON_AddNumberToObject(account, "updated_at", device_info_at);
        cJSON_AddBoolToObject(account, "update_error", device_info_error);
    }
    xSemaphoreTake(guard, portMAX_DELAY);
    replace(&published, out);
    replace(&published_account, account);
    xSemaphoreGive(guard);
}
cJSON *sc_runtime_account(void) {
    xSemaphoreTake(guard, portMAX_DELAY);
    cJSON *out = published_account ? cJSON_Duplicate(published_account, true) : cJSON_CreateObject();
    xSemaphoreGive(guard);
    return out;
}
bool sc_runtime_request_refresh(const char *service) {
    if (!service || (strcmp(service, "octopus") && strcmp(service, "foxess"))) return false;
    refresh_octopus = true;
    refresh_fox = true;
    refresh_plan = true;
    return true;
}
cJSON *sc_runtime_state(void) {
    xSemaphoreTake(guard, portMAX_DELAY);
    cJSON *out = published ? cJSON_Duplicate(published, true) : cJSON_CreateObject();
    if (out) {
        cJSON_DeleteItemFromObjectCaseSensitive(out, "rules");
        cJSON_AddItemToObject(out, "rules", cJSON_Duplicate(preferences, true));
        cJSON_DeleteItemFromObjectCaseSensitive(out, "revision");
        cJSON_AddNumberToObject(out, "revision", revision);
        cJSON_DeleteItemFromObjectCaseSensitive(out, "write_inflight");
        cJSON_AddBoolToObject(out, "write_inflight", inflight);
        if (confirmed_revision != revision) {
            cJSON_DeleteItemFromObjectCaseSensitive(out, "confirmed");
            cJSON_AddBoolToObject(out, "confirmed", false);
        }
        if (b(preferences, "paused")) {
            cJSON_DeleteItemFromObjectCaseSensitive(out, "control_status");
            cJSON_AddStringToObject(out, "control_status",
                                    inflight ? "Pausing; waiting for the in-flight command"
                                             : "Paused; monitoring continues");
        }
    }
    xSemaphoreGive(guard);
    return out ? out : cJSON_CreateObject();
}
static void history_json_row(cJSON *out, const history_t *h, int seconds, const char *storage) {
    cJSON *row = cJSON_CreateObject();
    cJSON_AddNumberToObject(row, "at", h->at);
    add_number(row, "solar", h->solar);
    add_number(row, "home", h->home);
    add_number(row, "grid", h->grid);
    add_number(row, "battery", h->battery);
    add_number(row, "soc", h->soc);
    cJSON_AddNumberToObject(row, "interval_seconds", seconds);
    cJSON_AddStringToObject(row, "storage", storage);
    cJSON_AddItemToArray(out, row);
}
cJSON *sc_runtime_history(int days) {
    if (days < 1 || days > 60)
        days = 14;
    time_t now = time(NULL), cutoff = now - (time_t)days * 86400;
    cJSON *out = cJSON_CreateArray();
    // HTTP reads cached observations only. Flash and upstream I/O stay outside
    // this lock.
    xSemaphoreTake(guard, portMAX_DELAY);
    uint32_t live_from = history_used ? history[history_head].at / 3600 * 3600 : UINT32_MAX;
    for (size_t i = 0; i < saved_history_used; i++) {
        const history_t *h = &saved_history[i];
        if (h->at >= cutoff && h->at < live_from && h->at < now)
            history_json_row(out, h, 3600, "flash");
    }
    for (size_t i = 0; i < history_used; i++) {
        const history_t *h = &history[(history_head + i) % HISTORY_CAPACITY];
        if (h->at >= cutoff && h->at < now)
            history_json_row(out, h, 900, "ram");
    }
    xSemaphoreGive(guard);
    return out;
}
bool sc_runtime_manual(const cJSON *value) {
    int start = n(value, "start", -1), end = n(value, "end", -1), mode = n(value, "mode", -1);
    time_t now = time(NULL);
    struct tm end_time;
    localtime_r(&now, &end_time);
    end_time.tm_hour = end / 60;
    end_time.tm_min = end % 60;
    end_time.tm_sec = 0;
    end_time.tm_isdst = -1;
    time_t expires = mktime(&end_time);
    if (expires <= now) {
        end_time.tm_mday++;
        end_time.tm_isdst = -1;
        expires = mktime(&end_time);
    }
    if (start < 0 || start > 1439 || end < 0 || end > 1439 || start == end || mode < 0 || mode > 2 ||
        expires <= now || expires > now + 86400 || sc_runtime_paused() || !sc_runtime_enabled())
        return false;
    cJSON *copy = cJSON_CreateObject();
    if (!copy || !cJSON_AddNumberToObject(copy, "start", start) ||
        !cJSON_AddNumberToObject(copy, "end", end) || !cJSON_AddNumberToObject(copy, "mode", mode) ||
        !cJSON_AddNumberToObject(copy, "expires", expires)) {
        cJSON_Delete(copy);
        return false;
    }
    xSemaphoreTake(guard, portMAX_DELAY);
    bool ok = store("manual", copy);
    if (ok) {
        replace(&manual, copy);
        resume_epoch++;
        revision++;
        confirmed = false;
    } else
        cJSON_Delete(copy);
    xSemaphoreGive(guard);
    return ok;
}
static void account_tariffs(const cJSON *json) {
    const cJSON *props = cJSON_GetObjectItemCaseSensitive(json, "properties"), *property;
    time_t now = time(NULL);
    cJSON_ArrayForEach(property, props) {
        const cJSON *meters = cJSON_GetObjectItemCaseSensitive(property, "electricity_meter_points"), *meter;
        cJSON_ArrayForEach(meter, meters) {
            const cJSON *agreements = cJSON_GetObjectItemCaseSensitive(meter, "agreements"), *a;
            cJSON_ArrayForEach(a, agreements) {
                const cJSON *code = cJSON_GetObjectItemCaseSensitive(a, "tariff_code"),
                            *from = cJSON_GetObjectItemCaseSensitive(a, "valid_from"),
                            *to = cJSON_GetObjectItemCaseSensitive(a, "valid_to");
                if (!cJSON_IsString(code) || strlen(code->valuestring) >= 96 ||
                    strncmp(code->valuestring, "E-1R-", 5))
                    continue;
                if (cJSON_IsString(from) && sc_timestamp(from->valuestring) > now)
                    continue;
                if (cJSON_IsString(to) && sc_timestamp(to->valuestring) <= now)
                    continue;
                char *target = b(meter, "is_export") ? export_code : import_code;
                strcpy(target, code->valuestring);
            }
        }
    }
}
static time_t tariff_day_start(time_t now){
    struct tm local;localtime_r(&now,&local);local.tm_hour=0;local.tm_min=0;local.tm_sec=0;local.tm_isdst=-1;return mktime(&local);
}
static cJSON *tariff_read(const sc_config_t *config, const char *code, const char *kind, int *http,
                          int *retry) {
    if (!code[0])
        return NULL;
    size_t length = strlen(code);
    if (length < 8 || code[length - 2] != '-')
        return NULL;
    for (size_t i = 0; i < length; i++)
        if (!(code[i] >= 'A' && code[i] <= 'Z') && !(code[i] >= '0' && code[i] <= '9') && code[i] != '-')
            return NULL;
    char product[96], path[512], from[32], to[32];
    snprintf(product, sizeof(product), "%.*s", (int)length - 7, code + 5);
    time_t now = time(NULL), from_time = tariff_day_start(now), until = now + 86400;
    struct tm utc;
    gmtime_r(&from_time, &utc);
    strftime(from, sizeof(from), "%Y-%m-%dT%H:%M:%SZ", &utc);
    gmtime_r(&until, &utc);
    strftime(to, sizeof(to), "%Y-%m-%dT%H:%M:%SZ", &utc);
    snprintf(path, sizeof(path),
             "/v1/products/%s/electricity-tariffs/%s/%s-unit-rates/"
             "?page_size=150&period_from=%s&period_to=%s",
             product, code, kind, from, to);
    cJSON *json = sc_cloud_read(config, false, path, NULL, NULL, http, retry);
    const cJSON *results = cJSON_GetObjectItemCaseSensitive(json, "results");
    cJSON *rates = NULL;
    if (*http == 200 && cJSON_IsArray(results)) {
        rates = cJSON_CreateArray();
        const cJSON *r;
        cJSON_ArrayForEach(r, results) {
            const cJSON *a = cJSON_GetObjectItemCaseSensitive(r, "valid_from"),
                        *z = cJSON_GetObjectItemCaseSensitive(r, "valid_to"),
                        *v = cJSON_GetObjectItemCaseSensitive(r, "value_inc_vat");
            time_t start = cJSON_IsString(a) ? sc_timestamp(a->valuestring) : 0,
                   end = cJSON_IsString(z) ? sc_timestamp(z->valuestring) : until;
            if (!start || end <= start || !cJSON_IsNumber(v))
                continue;
            cJSON *row = cJSON_CreateObject();
            cJSON_AddNumberToObject(row, "start", start);
            cJSON_AddNumberToObject(row, "end", end);
            cJSON_AddNumberToObject(row, "value", v->valuedouble);
            cJSON_AddItemToArray(rates, row);
        }
    }
    cJSON_Delete(json);
    return rates;
}
static void account_text(cJSON *out, const char *target, const cJSON *source, const char *key) {
    const cJSON *value = cJSON_GetObjectItemCaseSensitive(source, key);
    if (cJSON_IsString(value) && strlen(value->valuestring) <= 128)
        cJSON_AddStringToObject(out, target, value->valuestring);
}
static void account_device(const cJSON *response) {
    const cJSON *data = cJSON_GetObjectItemCaseSensitive(response, "data");
    const cJSON *device = cJSON_GetObjectItemCaseSensitive(data, "registeredKrakenflexDevice");
    const cJSON *prefs = cJSON_GetObjectItemCaseSensitive(data, "vehicleChargingPreferences");
    if (!cJSON_IsObject(data) || cJSON_GetArraySize(cJSON_GetObjectItemCaseSensitive(response, "errors")) ||
        !(cJSON_IsObject(device) || cJSON_IsNull(device)) || !(cJSON_IsObject(prefs) || cJSON_IsNull(prefs))) {
        device_info_error = true;
        return; // Preserve the previous valid account details on partial/error responses.
    }
    cJSON *out = cJSON_CreateObject();
    if (!out) { device_info_error = true; return; }
    cJSON_AddBoolToObject(out, "device_reported", cJSON_IsObject(device));
    const char *fields[] = {"provider", "vehicleMake", "vehicleModel", "chargePointMake", "chargePointModel", "status"};
    for (unsigned i = 0; i < sizeof(fields) / sizeof(*fields); i++)
        account_text(out, fields[i], device, fields[i]);
    account_text(out, "target_time", prefs, "weekdayTargetTime");
    double target = n(prefs, "weekdayTargetSoc", NAN);
    if (isfinite(target) && target >= 0 && target <= 100)
        cJSON_AddNumberToObject(out, "charge_limit", target);
    replace(&device_info, out);
    device_info_at = time(NULL);
    device_info_error = false;
}
static const char *graphql_code(const cJSON *response) {
    const cJSON *error = cJSON_GetArrayItem(cJSON_GetObjectItemCaseSensitive(response, "errors"), 0);
    const cJSON *value = cJSON_GetObjectItemCaseSensitive(
        cJSON_GetObjectItemCaseSensitive(error, "extensions"), "errorCode");
    if (!cJSON_IsString(value)) return "";
    const char *s = value->valuestring;
    size_t length = strlen(s);
    if (length < 10 || length > 20 || strncmp(s, "KT-", 3) || s[5] != '-' ||
        s[3] < 'A' || s[3] > 'Z' || s[4] < 'A' || s[4] > 'Z') return "";
    for (size_t i = 6; i < length; i++) if (s[i] < '0' || s[i] > '9') return "";
    return s;
}
static bool graphql_auth_error(const cJSON *response) {
    const char *code = graphql_code(response);
    if (!strcmp(code, "KT-CT-1124") || !strcmp(code, "KT-CT-1111")) return true;
    const cJSON *errors = cJSON_GetObjectItemCaseSensitive(response, "errors"), *error;
    cJSON_ArrayForEach(error, errors) {
        const cJSON *message = cJSON_GetObjectItemCaseSensitive(error, "message");
        if (cJSON_IsString(message) && (strstr(message->valuestring, "Signature has expired") ||
            strstr(message->valuestring, "Token has expired") || strstr(message->valuestring, "JWT expired"))) return true;
    }
    return false;
}
static void octopus_poll(const sc_config_t *config, const cJSON *rules) {
    int retry = 0;
    int64_t us = esp_timer_get_time();
    unsigned request_revision = sc_runtime_revision();
    if (us < next_octopus)
        return;
    bool manual_refresh = refresh_octopus;
    refresh_octopus = false;
    octopus_not_before = us + 60000000;
    next_octopus = us + (int64_t)n(rules, "octopus_seconds", 60) * 1000000;
    cJSON *body = cJSON_CreateObject(), *response = NULL;
    if (!token[0] || us >= token_until) {
        char query[256];
        cJSON *escaped = cJSON_CreateString(config->octopus_key);
        char *key = cJSON_PrintUnformatted(escaped);
        if (key) {
            snprintf(query, sizeof(query), "mutation { obtainKrakenToken(input: { APIKey: %s }) { token payload } }",
                     key);
            cJSON_AddStringToObject(body, "query", query);
            mbedtls_platform_zeroize(query, sizeof(query));
            mbedtls_platform_zeroize(key, strlen(key));
            free(key);
        }
        cJSON_Delete(escaped);
        response = sc_cloud_read(config, false, "/v1/graphql/", body, NULL, &octopus_http, &retry);
        const cJSON *value = cJSON_GetObjectItemCaseSensitive(
            cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(response, "data"),
                                             "obtainKrakenToken"),
            "token");
        if (octopus_http == 200 && cJSON_IsString(value) && strlen(value->valuestring) < sizeof(token)) {
            strcpy(token, value->valuestring);
            const cJSON *auth = cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(response, "data"), "obtainKrakenToken");
            double expires = n(cJSON_GetObjectItemCaseSensitive(auth, "payload"), "exp", 0);
            double lifetime = expires > 0 ? expires - time(NULL) - 60 : 600;
            if (lifetime > 600) lifetime = 600;
            if (lifetime < 0) lifetime = 0;
            token_until = us + (int64_t)(lifetime * 1000000);
            next_octopus = us + 60000000;
            refresh_octopus = manual_refresh;
            strcpy(octopus_status, "Signed in; charging windows queued");
        } else {
            dispatch_valid = false;
            strcpy(octopus_status, cJSON_IsString(value)
                                       ? "Octopus sign-in token exceeds buffer limit"
                                       : "Octopus sign-in failed; retained previous dispatches");
        }
    } else if (manual_refresh || !dispatch_valid || tariff_stage == 0 || time(NULL) - dispatch_at >= 120) {
        cJSON_AddStringToObject(body, "query",
                                "query getGoData($acc: String!) { plannedDispatches(accountNumber: "
                                "$acc) { startDt endDt } }");
        cJSON_AddStringToObject(cJSON_AddObjectToObject(body, "variables"), "acc", config->account);
        response = sc_cloud_read(config, false, "/v1/graphql/", body, token, &octopus_http, &retry);
        const cJSON *rows = cJSON_GetObjectItemCaseSensitive(
            cJSON_GetObjectItemCaseSensitive(response, "data"), "plannedDispatches");
        bool errors = cJSON_GetArraySize(cJSON_GetObjectItemCaseSensitive(response, "errors")) > 0;
        if (octopus_http == 200 && !errors && sc_dispatch_valid(rows)) {
            cJSON *normalized = cJSON_Duplicate(rows, true), *item;
            if (!normalized) {
                dispatch_valid = false;
                strcpy(dispatch_error, "DISPATCH_ALLOCATION_FAILED");
                strcpy(octopus_status, "Dispatch allocation failed; previous windows retained");
                cJSON_Delete(response);cJSON_Delete(body);return;
            }
            cJSON_ArrayForEach(item, normalized) {
                cJSON_GetObjectItemCaseSensitive(item, "startDt")->valuestring[10] = 'T';
                cJSON_GetObjectItemCaseSensitive(item, "endDt")->valuestring[10] = 'T';
            }
            dispatch_changed = !cJSON_Compare(dispatches, normalized, true);
            if (dispatch_changed) dispatch_sequence++;
            replace(&dispatches, normalized);
            dispatch_at = time(NULL);
            dispatch_valid = request_revision >= required_dispatch_revision;
            dispatch_error[0] = 0;
            dispatch_time_sample[0] = 0;
            strcpy(octopus_status, "Charging windows updated");
            if (!import_code[0])
                tariff_stage = 1;
            else if (tariff_stage == 0 && time(NULL) % 600 < 90)
                tariff_stage = 2;
        } else {
            dispatch_valid = false;
            snprintf(dispatch_error, sizeof(dispatch_error), "%s", errors ? graphql_code(response) : "INVALID_DISPATCH_DATA");
            dispatch_time_sample[0] = 0;
            if (!errors && cJSON_IsArray(rows)) {
                strcpy(dispatch_error, "INVALID_DISPATCH_TIMESTAMP");
                const cJSON *first = cJSON_GetArrayItem(rows, 0);
                const cJSON *a = cJSON_GetObjectItemCaseSensitive(first, "startDt");
                const cJSON *b = cJSON_GetObjectItemCaseSensitive(first, "endDt");
                if (cJSON_IsString(a) && cJSON_IsString(b) && strlen(a->valuestring) < 45 && strlen(b->valuestring) < 45 &&
                    strspn(a->valuestring, "0123456789TtZz:+-. ") == strlen(a->valuestring) &&
                    strspn(b->valuestring, "0123456789TtZz:+-. ") == strlen(b->valuestring))
                    snprintf(dispatch_time_sample, sizeof(dispatch_time_sample), "%s / %s", a->valuestring, b->valuestring);
            }
            strcpy(octopus_status, "Dispatch update failed; retained previous valid windows");
            if (octopus_http == 401 || octopus_http == 403 || graphql_auth_error(response)) {
                mbedtls_platform_zeroize(token, sizeof(token));
                strcpy(octopus_status, "Octopus session expired; sign-in queued; previous windows retained");
            }
        }
    } else if (us >= next_device_info) {
        // Optional presentation data never shares the critical dispatch query.
        // A schema error here must not invalidate valid charging windows.
        next_device_info = us + 3600000000LL;
        cJSON_AddStringToObject(body, "query",
            "query getDeviceDetails($acc: String!) { registeredKrakenflexDevice(accountNumber: $acc) { "
            "provider vehicleMake vehicleModel chargePointMake chargePointModel status } "
            "vehicleChargingPreferences(accountNumber: $acc) { weekdayTargetTime weekdayTargetSoc } }");
        cJSON_AddStringToObject(cJSON_AddObjectToObject(body, "variables"), "acc", config->account);
        response = sc_cloud_read(config, false, "/v1/graphql/", body, token, &octopus_http, &retry);
        if (octopus_http == 200) account_device(response);
        else device_info_error = true;
        if (octopus_http == 401 || octopus_http == 403 || graphql_auth_error(response))
            mbedtls_platform_zeroize(token, sizeof(token));
    } else if (tariff_stage == 1) {
        char path[96];
        snprintf(path, sizeof(path), "/v1/accounts/%s/", config->account);
        response = sc_cloud_read(config, false, path, NULL, NULL, &octopus_http, &retry);
        if (octopus_http == 200)
            account_tariffs(response);
        tariff_stage = 2;
    } else {
        bool is_export = tariff_stage == 3;
        const char *code = is_export ? export_code : import_code;
        const char *kind = tariff_stage == 4 ? "day" : tariff_stage == 5 ? "night" : "standard";
        cJSON *rates = tariff_read(config, code, kind, &octopus_http, &retry);
        tariff_http=octopus_http;
        if (tariff_stage == 4) {
            replace(&fixed_day, rates);
            tariff_stage = 5;
        } else if (tariff_stage == 5) {
            replace(&fixed_night, rates);
            cJSON *slots = cJSON_CreateArray();
            time_t now = time(NULL), first = tariff_day_start(now);
            for (int i = 0; i < 100 && first + i * 1800 < now + 86400; i++) {
                time_t at = first + i * 1800;
                struct tm local;
                localtime_r(&at, &local);
                int minute = local.tm_hour * 60 + local.tm_min;
                const cJSON *source = (minute >= 1410 || minute < 330) ? fixed_night : fixed_day, *row;
                cJSON_ArrayForEach(row, source) if (at >= n(row, "start", 0) && at < n(row, "end", 0)) {
                    cJSON *slot = cJSON_CreateObject();
                    cJSON_AddNumberToObject(slot, "start", at);
                    cJSON_AddNumberToObject(slot, "end", at + 1800);
                    cJSON_AddNumberToObject(slot, "value", n(row, "value", 0));
                    cJSON_AddItemToArray(slots, slot);
                    break;
                }
            }
            if (cJSON_GetArraySize(slots) > 0) {
                replace(&imports, slots);
                import_rates_at = time(NULL);
            } else
                cJSON_Delete(slots);
            tariff_stage = 3;
        } else if (!is_export && rates && cJSON_GetArraySize(rates) == 0 && strstr(import_code, "-IOG-")) {
            cJSON_Delete(rates);
            tariff_stage = 4;
        } else {
            if (rates && cJSON_GetArraySize(rates) > 0) {
                replace(is_export ? &exports : &imports, rates);
                if (is_export) export_rates_at = time(NULL);
                else import_rates_at = time(NULL);
            } else
                cJSON_Delete(rates);
            tariff_stage = is_export ? 0 : 3;
        }
    }
    if (octopus_http == 429) {
        int delay = retry > 60 ? retry : 600;
        next_octopus = esp_timer_get_time() + (int64_t)delay * 1000000;
        octopus_not_before = next_octopus;
        strcpy(octopus_status, "Rate limited; previous data retained");
    }
    if (response) {
        char *raw = cJSON_PrintUnformatted(response);
        if (raw) {
            mbedtls_platform_zeroize(raw, strlen(raw));
            free(raw);
        }
    }
    cJSON_Delete(response);
    cJSON_Delete(body);
}
static void foxess_poll(const sc_config_t *config, const cJSON *rules) {
    if (esp_timer_get_time() < next_fox)
        return;
    refresh_fox = false;
    fox_not_before = esp_timer_get_time() + 5000000;
    int retry = 0;
    next_fox = esp_timer_get_time() + (int64_t)n(rules, "foxess_seconds", 600) * 1000000;
    cJSON *body = cJSON_CreateObject();
    cJSON_AddStringToObject(body, "sn", config->foxess_sn);
    cJSON *vars = cJSON_AddArrayToObject(body, "variables");
    const char *names[] = {"SoC",         "pvPower",        "loadsPower",       "gridConsumptionPower",
                           "feedinPower", "batChargePower", "batDischargePower"};
    for (unsigned i = 0; i < 7; i++)
        cJSON_AddItemToArray(vars, cJSON_CreateString(names[i]));
    cJSON *response =
        sc_cloud_read(config, true, "/op/v0/device/real/query", body, NULL, &foxess_http, &retry);
    const cJSON *datas = cJSON_GetObjectItemCaseSensitive(
        cJSON_GetArrayItem(cJSON_GetObjectItemCaseSensitive(response, "result"), 0), "datas");
    if (foxess_http == 200 && n(response, "errno", -1) == 0 && cJSON_IsArray(datas) &&
        cJSON_GetArraySize(datas) > 0) {
        double values[7];
        for (int i = 0; i < 7; i++)
            values[i] = NAN;
        const cJSON *row;
        cJSON_ArrayForEach(row, datas) {
            const cJSON *variable = cJSON_GetObjectItemCaseSensitive(row, "variable"),
                        *value = cJSON_GetObjectItemCaseSensitive(row, "value"),
                        *unit = cJSON_GetObjectItemCaseSensitive(row, "unit");
            for (int i = 0; i < 7; i++)
                if (cJSON_IsString(variable) && !strcmp(variable->valuestring, names[i]) &&
                    cJSON_IsNumber(value)) {
                    values[i] = value->valuedouble;
                    if (i > 0 && cJSON_IsString(unit) && !strcmp(unit->valuestring, "W"))
                        values[i] /= 1000;
                }
        }
        cJSON *data = cJSON_CreateObject();
        add_number(data, "soc", values[0]);
        add_number(data, "solar", values[1]);
        add_number(data, "home", values[2]);
        add_number(data, "grid", isfinite(values[3]) && isfinite(values[4]) ? values[3] - values[4] : NAN);
        add_number(data, "battery", isfinite(values[5]) && isfinite(values[6]) ? values[5] - values[6] : NAN);
        replace(&measurements, data);
        soc = values[0];
        telemetry_at = time(NULL);
        strcpy(foxess_status, "Official REST telemetry updated");
        xSemaphoreTake(guard, portMAX_DELAY);
        history_sample(telemetry_at);
        xSemaphoreGive(guard);
    } else
        strcpy(foxess_status, "FoxESS telemetry update failed; last reading retained");
    if (foxess_http == 429) {
        next_fox = esp_timer_get_time() + (int64_t)(retry > 60 ? retry : 600) * 1000000;
        fox_not_before = next_fox;
        strcpy(foxess_status, "Rate limited; last reading retained");
    }
    cJSON_Delete(response);
    cJSON_Delete(body);
}
static bool current_revision(unsigned rev) {
    xSemaphoreTake(guard, portMAX_DELAY);
    bool valid = revision == rev && b(preferences, "enabled") && !b(preferences, "paused");
    xSemaphoreGive(guard);
    return valid;
}
static void reconcile(const sc_config_t *config, const cJSON *rules, unsigned rev, time_t now) {
    if (!b(rules, "enabled")) {
        strcpy(control_status, "Automation is not enabled");
        return;
    }
    if (sc_runtime_paused()) {
        strcpy(control_status, "Paused; monitoring continues");
        return;
    }
    if (!dispatch_valid || now - dispatch_at > (time_t)n(rules, "octopus_seconds", 60) * 3 + 60) {
        strcpy(control_status, "Waiting for fresh valid Smart Dispatch data; "
                               "existing schedule retained");
        return;
    }
    if (sc_schedule_recovery_pending()) {
        strcpy(control_status, "Resolve the diagnostic recovery journal before automation");
        return;
    }
    xSemaphoreTake(guard, portMAX_DELAY);
    cJSON *manual_copy = cJSON_Duplicate(manual, true);
    xSemaphoreGive(guard);
    // Only the worker owns completion memory. Dashboards never run this planner.
    unsigned completion_epoch = resume_epoch;
    if (!current_revision(rev)) { cJSON_Delete(manual_copy); return; }
    if (resume_revision != completion_epoch) { resume_memory = (sc_resume_state_t){0}; resume_revision = completion_epoch; }
    double fresh_soc = telemetry_at && telemetry_at != resume_telemetry_at ? soc : NAN;
    cJSON *plan = sc_automation_plan_stateful(rules, dispatches, imports, exports, manual_copy, now, fresh_soc, &resume_memory);
    if (plan) resume_telemetry_at = telemetry_at;
    cJSON_Delete(manual_copy);
    if (!plan) {
        strcpy(control_status, "Schedule planning failed; existing schedule retained");
        return;
    }
    const cJSON *groups = cJSON_GetObjectItemCaseSensitive(plan, "groups");
    partial = b(plan, "partial");
    if (b(plan, "dispatch_capacity_exceeded")) {
        confirmed = false;
        strcpy(control_status, "More than five Smart Dispatch periods; no partial protection written");
        cJSON_Delete(plan);
        return;
    }
    bool changed = dispatch_changed || previous_revision != rev || !sc_plan_matches(groups, previous_plan);
    if (!changed && confirmed && esp_timer_get_time() < next_schedule) {
        cJSON_Delete(plan);
        return;
    }
    if (esp_timer_get_time() < next_attempt && attempt_revision == rev &&
        attempt_dispatch_sequence == dispatch_sequence) {
        cJSON_Delete(plan);
        return;
    }
    attempt_revision = rev;
    attempt_dispatch_sequence = dispatch_sequence;
    next_attempt = esp_timer_get_time() + 60000000;
    int http = 0;
    cJSON *before = sc_schedule_read(config, &http);
    if (!before) {
        confirmed = false;
        strcpy(control_status, "Fresh FoxESS schedule read failed; no command sent");
        next_schedule = esp_timer_get_time() + 60000000;
        cJSON_Delete(plan);
        return;
    }
    replace(&programmed, cJSON_Duplicate(before, true));
    schedule_at = now;
    if (!sc_plan_matches(groups, before)) {
        cJSON *second = sc_schedule_read(config, &http);
        bool stable = second && sc_schedules_equal(before, second);
        cJSON_Delete(second);
        if (!stable || !current_revision(rev)) {
            strcpy(control_status, "A newer revision is queued; refresh before writing");
            cJSON_Delete(before);
            cJSON_Delete(plan);
            return;
        }
        cJSON *intent = cJSON_CreateObject(), *intent_groups = cJSON_Duplicate(groups, true);
        bool durable = intent && intent_groups && cJSON_AddNumberToObject(intent, "revision", rev) &&
                       cJSON_AddNumberToObject(intent, "at", now);
        if (durable && cJSON_AddItemToObject(intent, "groups", intent_groups))
            intent_groups = NULL;
        else
            durable = false;
        durable = durable && store("intent", intent);
        cJSON_Delete(intent_groups);
        cJSON_Delete(intent);
        if (!durable) {
            persistence_fault = true;
            strcpy(control_status, "Schedule intent could not be saved; no command sent");
            cJSON_Delete(before);
            cJSON_Delete(plan);
            return;
        }
        if (!current_revision(rev)) {
            cJSON_Delete(before);
            cJSON_Delete(plan);
            return;
        }
        inflight = true;
        confirmed = false;
        strcpy(control_status, "Writing schedule; official REST confirmation pending");
        publish(now, rules);
        // Acceptance is deliberately ignored as a confirmation. Even an ambiguous
        // POST needs a fresh readback.
        sc_schedule_program(config, groups, &http);
        cJSON *readback = sc_schedule_read(config, &http);
        inflight = false;
        if (!readback || !sc_plan_matches(groups, readback)) {
            strcpy(control_status, "Schedule not confirmed by fresh official REST readback");
            cJSON_Delete(readback);
            cJSON_Delete(before);
            cJSON_Delete(plan);
            return;
        }
        replace(&programmed, readback);
        schedule_at = time(NULL);
    }
    confirmed = current_revision(rev);
    confirmed_revision = rev;
    confirmed_at = time(NULL);
    previous_revision = rev;
    replace(&previous_plan, cJSON_Duplicate(groups, true));
    dispatch_changed = false;
    next_schedule = esp_timer_get_time() + 600000000;
    if (!clear_intent()) {
        confirmed = false;
        persistence_fault = true;
        strcpy(control_status, "REST matched; persistent intent cleanup failed");
    } else {
        persistence_fault = false;
        strcpy(control_status,
               confirmed ? (partial ? "Selected periods REST-confirmed; five-period "
                                      "capacity omitted ordinary periods"
                                    : "Schedule confirmed by official FoxESS REST")
                         : (sc_runtime_paused() ? "Paused after the in-flight command completed"
                                                : "New rules queued; fresh reconciliation pending"));
    }
    cJSON_Delete(before);
    cJSON_Delete(plan);
}
void sc_runtime_tick(const sc_config_t *config, bool network_ready) {
    int64_t us = esp_timer_get_time();
    if (us < next_tick)
        return;
    next_tick = us + 5000000;
    time_t now = time(NULL);
    snprintf(account_number, sizeof(account_number), "%s", config->account);
    unsigned rev;
    cJSON *rules = rules_copy(&rev);
    if (!rules)
        return;
    if (b(rules, "paused") && n(rules, "pause_until", 0) > 0 && now >= n(rules, "pause_until", 0)) {
        cJSON_SetBoolValue(cJSON_GetObjectItemCaseSensitive(rules, "paused"), false);
        cJSON_SetNumberValue(cJSON_GetObjectItemCaseSensitive(rules, "pause_until"), 0);
        sc_runtime_update_expected(rules, rev);
        dispatch_valid = false;
        next_octopus = 0;
        cJSON_Delete(rules);
        return;
    }
    if (network_ready && now > 1700000000) {
        if (refresh_octopus && us >= octopus_not_before && next_octopus > us) next_octopus = us;
        if (refresh_fox && us >= fox_not_before && next_fox > us) next_fox = us;
        // Dispatch reconciliation precedes every piece of account/tariff work.
        bool tariff_due = tariff_stage > 0 && dispatch_valid;
        if (!tariff_due)
            octopus_poll(config, rules);
        reconcile(config, rules, rev, time(NULL));
        if (tariff_due)
            octopus_poll(config, rules);
        // Optional live work follows schedule reconciliation. REST remains the
        // authority for programming and readback, including while paused.
        sc_live_poll(config, true);
        cJSON *live = sc_live_reading();
        if (live) {
            cJSON *live_status = sc_live_status();
            time_t at = n(live_status, "updated_at", 0);
            cJSON_Delete(live_status);
            if (at >= telemetry_at) {
                cJSON *value;
                cJSON_ArrayForEach(value, live) {
                    cJSON_DeleteItemFromObjectCaseSensitive(measurements, value->string);
                    cJSON_AddItemToObject(measurements, value->string, cJSON_Duplicate(value, true));
                }
                soc = n(measurements, "soc", NAN);
                if (at > telemetry_at) {
                    telemetry_at = at;
                    xSemaphoreTake(guard, portMAX_DELAY);history_sample(at);xSemaphoreGive(guard);
                }
                strcpy(foxess_status, "Live WebSocket telemetry");
            }
            // A deliberate API refresh still performs its official REST read.
            if (!refresh_fox && next_fox <= esp_timer_get_time())
                next_fox = esp_timer_get_time() + (int64_t)n(rules, "foxess_seconds", 600) * 1000000;
        }
        if (!live && was_live && esp_timer_get_time() >= fox_not_before)
            next_fox = esp_timer_get_time();
        was_live = live != NULL;
        cJSON_Delete(live);
        foxess_poll(config, rules);
        if (refresh_plan && !inflight && us >= fox_not_before) {
            int http = 0;
            cJSON *read = sc_schedule_read(config, &http);
            if (read) { replace(&programmed, read); schedule_at = time(NULL); }
            if (http == 429) fox_not_before = esp_timer_get_time() + 600000000;
            else refresh_plan = false;
            next_schedule = esp_timer_get_time() + 600000000;
        }
        if (!b(rules, "enabled") && us >= next_schedule) {
            int http = 0;
            cJSON *read = sc_schedule_read(config, &http);
            if (read) {
                replace(&programmed, read);
                schedule_at = time(NULL);
            }
            next_schedule = esp_timer_get_time() + 600000000;
        }
    } else {
        sc_live_poll(config, false);
        strcpy(control_status, "Waiting for Wi-Fi and synchronized clock");
    }
    now = time(NULL);
    xSemaphoreTake(guard, portMAX_DELAY);
    time_t cutoff = now - (time_t)n(rules, "history_days", 14) * 86400;
    while (history_used && history[history_head].at < cutoff) {
        history_head = (history_head + 1) % HISTORY_CAPACITY;
        history_used--;
    }
    xSemaphoreGive(guard);
    history_persist(now, esp_timer_get_time(), rules);
    if (persistence_fault)
        confirmed = false;
    publish(now, rules);
    cJSON_Delete(rules);
}

// The network I/O owner calls this after read-only validation. HTTP rule
// updates cannot enable control between the guard check and credential commit.
bool sc_runtime_apply_services(const sc_config_t *candidate,bool (*save)(const sc_config_t *)){
    xSemaphoreTake(guard,portMAX_DELAY);
    bool ok=(!b(preferences,"enabled")||b(preferences,"paused"))&&save&&save(candidate);
    xSemaphoreGive(guard);
    if(ok)sc_runtime_credentials_changed();
    return ok;
}

bool sc_runtime_claim_octopus_setup(void){
    int64_t us=esp_timer_get_time();
    if(us<octopus_not_before)return false;
    if(sc_runtime_enabled()&&!sc_runtime_paused()&&dispatch_valid&&time(NULL)-dispatch_at>=120)return false;
    octopus_not_before=us+60000000;
    if(next_octopus<octopus_not_before)next_octopus=octopus_not_before;
    return true;
}
void sc_runtime_octopus_setup_result(int http,int retry_after){
    if(http!=429)return;
    int64_t until=esp_timer_get_time()+(int64_t)(retry_after>60?retry_after:600)*1000000;
    if(octopus_not_before<until)octopus_not_before=until;
    if(next_octopus<until)next_octopus=until;
}
