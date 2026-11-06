// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "cloud_read.h"
#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "mbedtls/base64.h"
#include "mbedtls/md5.h"
#include "mbedtls/platform_util.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
static int64_t fox_last_us, fox_until_us;
bool sc_fox_slot(void) {
    int64_t now = esp_timer_get_time();
    if (now < fox_until_us)
        return false;
    int64_t wait = 1500000 - (now - fox_last_us);
    if (wait > 0)
        vTaskDelay(pdMS_TO_TICKS((wait + 999) / 1000));
    fox_last_us = esp_timer_get_time();
    return true;
}
void sc_fox_cooldown(int seconds) {
    int64_t until = esp_timer_get_time() + (int64_t)(seconds > 60 ? seconds : 600) * 1000000;
    if (until > fox_until_us)
        fox_until_us = until;
}
#define LIMIT 65536
typedef struct {
    char *bytes;
    size_t used;
    int retry;
    bool overflow;
} buffer_t;
static esp_err_t receive(esp_http_client_event_t *e) {
    buffer_t *b = e->user_data;
    if (e->event_id == HTTP_EVENT_ON_HEADER && e->header_key && e->header_value &&
        !strcasecmp(e->header_key, "Retry-After")) {
        char *end;
        long n = strtol(e->header_value, &end, 10);
        if (!*end && n > 0 && n <= 86400)
            b->retry = n;
    }
    if (e->event_id == HTTP_EVENT_ON_DATA) {
        if (e->data_len < 0 || b->used + e->data_len > LIMIT) {
            b->overflow = true;
            return ESP_FAIL;
        }
        memcpy(b->bytes + b->used, e->data, e->data_len);
        b->used += e->data_len;
        b->bytes[b->used] = 0;
    }
    return ESP_OK;
}
cJSON *sc_cloud_read(const sc_config_t *config, bool fox, const char *path, const cJSON *body, const char *token,
                     int *http, int *retry_after) {
    *http = 0;
    *retry_after = 0;
    // No caller-supplied hosts, credentials in URLs, redirects, or mutation endpoints.
    if (!path || strstr(path, "://") || strchr(path, '#') ||
        (fox ? (strcmp(path, "/op/v0/device/real/query") && strcmp(path, "/op/v0/plant/list"))
             : !(!strcmp(path, "/v1/graphql/") || !strncmp(path, "/v1/accounts/", 13) ||
                 !strncmp(path, "/v1/products/", 13))))
        return NULL;
    char url[768], auth[256] = {0};
    snprintf(url, sizeof(url), "https://%s%s", fox ? "www.foxesscloud.com" : "api.octopus.energy", path);
    buffer_t buffer = {.bytes = calloc(LIMIT + 1, 1)};
    if (!buffer.bytes)
        return NULL;
    esp_http_client_config_t options = {.url = url,
                                        .timeout_ms = 20000,
                                        .crt_bundle_attach = esp_crt_bundle_attach,
                                        .disable_auto_redirect = true,
                                        .event_handler = receive,
                                        .user_data = &buffer,
                                        .buffer_size = 2048,
                                        .buffer_size_tx = 8192};
    esp_http_client_handle_t client = esp_http_client_init(&options);
    char *text = body ? cJSON_PrintUnformatted(body) : NULL;
    cJSON *out = NULL;
    if (!client || (body && !text))
        goto done;
    if (body) {
        esp_http_client_set_method(client, HTTP_METHOD_POST);
        esp_http_client_set_header(client, "Content-Type", "application/json");
        esp_http_client_set_post_field(client, text, strlen(text));
    }
    if (fox) {
        char timestamp[32], input[512], signature[33];
        unsigned char digest[16];
        snprintf(timestamp, sizeof(timestamp), "%lld", (long long)time(NULL) * 1000);
        snprintf(input, sizeof(input), "%s\\r\\n%s\\r\\n%s", path, config->foxess_key, timestamp);
        mbedtls_md5((unsigned char *)input, strlen(input), digest);
        for (int i = 0; i < 16; i++)
            snprintf(signature + 2 * i, 3, "%02x", digest[i]);
        esp_http_client_set_header(client, "token", config->foxess_key);
        esp_http_client_set_header(client, "timestamp", timestamp);
        esp_http_client_set_header(client, "signature", signature);
        esp_http_client_set_header(client, "lang", "en");
        mbedtls_platform_zeroize(input, sizeof(input));
    } else if (token)
        esp_http_client_set_header(client, "Authorization", token);
    else if (!strncmp(path, "/v1/accounts/", 13)) {
        char raw[132];
        unsigned char encoded[192];
        size_t length = 0;
        snprintf(raw, sizeof(raw), "%s:", config->octopus_key);
        mbedtls_base64_encode(encoded, sizeof(encoded) - 1, &length, (unsigned char *)raw, strlen(raw));
        encoded[length] = 0;
        snprintf(auth, sizeof(auth), "Basic %s", encoded);
        esp_http_client_set_header(client, "Authorization", auth);
        mbedtls_platform_zeroize(raw, sizeof(raw));
        mbedtls_platform_zeroize(encoded, sizeof(encoded));
    }
    if (fox && !sc_fox_slot()) {
        *http = 429;
        *retry_after = 600;
        goto done;
    }
    esp_err_t result = esp_http_client_perform(client);
    *http = esp_http_client_get_status_code(client);
    *retry_after = buffer.retry;
    if (fox && *http == 429)
        sc_fox_cooldown(buffer.retry);
    if (result == ESP_OK && !buffer.overflow)
        out = cJSON_Parse(buffer.bytes);
done:
    if (client)
        esp_http_client_cleanup(client);
    if (text) {
        mbedtls_platform_zeroize(text, strlen(text));
        free(text);
    }
    mbedtls_platform_zeroize(auth, sizeof(auth));
    mbedtls_platform_zeroize(buffer.bytes, LIMIT + 1);
    free(buffer.bytes);
    return out;
}
