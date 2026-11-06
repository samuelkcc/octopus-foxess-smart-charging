// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "esp_netif.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "mbedtls/platform_util.h"
#include "mbedtls/pkcs5.h"
#include "mbedtls/sha256.h"
#include "nvs.h"
#include "runtime.h"
#include "dashboard_port.h"
#include "foxess_live.h"
#include "service_setup.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
extern cJSON *sc_runtime_history(int days);
extern bool sc_runtime_manual(const cJSON *value);
extern unsigned sc_runtime_revision(void);
extern bool sc_runtime_update_expected(const cJSON *value, unsigned expected);
extern const unsigned char dashboard_start[] asm("_binary_dashboard_html_gz_start");
extern const unsigned char dashboard_end[] asm("_binary_dashboard_html_gz_end");
typedef struct {
    char cookie[65], csrf[65];
    int64_t expires;
} session_t;
static session_t sessions[6];
typedef struct {
    uint32_t version, enabled, iterations;
    unsigned char salt[16], hash[32];
} access_t;
static access_t lan_access;
static bool access_storage_invalid;
static char open_csrf[65];
static int64_t login_window;
static unsigned attempts;
static SemaphoreHandle_t session_guard;
static void random_hex(char out[65]) {
    unsigned char bytes[32];
    esp_fill_random(bytes, sizeof(bytes));
    for (unsigned i = 0; i < 32; i++)
        snprintf(out + i * 2, 3, "%02x", bytes[i]);
    mbedtls_platform_zeroize(bytes, sizeof(bytes));
}
static void cookie_hash(const char *cookie, char out[65]) {
    unsigned char bytes[32];
    mbedtls_sha256((const unsigned char *)cookie, 64, bytes, 0);
    for (unsigned i = 0; i < 32; i++)
        snprintf(out + i * 2, 3, "%02x", bytes[i]);
    mbedtls_platform_zeroize(bytes, sizeof(bytes));
}
typedef struct {
    uint32_t version;
    access_t access;
    session_t sessions[6];
} auth_store_t;
static bool save_auth(const access_t *access) {
    auth_store_t stored = {.version = 1, .access = *access};
    stored.access.version = 1;
    memcpy(stored.sessions, sessions, sizeof(sessions));
    nvs_handle_t handle;
    bool ok = nvs_open("sc_lan", NVS_READWRITE, &handle) == ESP_OK;
    if (ok) {
        ok = nvs_set_blob(handle, "auth", &stored, sizeof(stored)) == ESP_OK && nvs_commit(handle) == ESP_OK;
        nvs_close(handle);
    }
    mbedtls_platform_zeroize(&stored, sizeof(stored));
    return ok;
}
static bool save_sessions(void) { return save_auth(&lan_access); }
static void load_sessions(void) {
    memset(sessions, 0, sizeof(sessions));
    memset(&lan_access, 0, sizeof(lan_access));
    access_storage_invalid = false;
    nvs_handle_t handle;
    esp_err_t opened = nvs_open("sc_lan", NVS_READONLY, &handle);
    if (opened == ESP_OK) {
        auth_store_t stored = {0};
        size_t size = sizeof(stored);
        esp_err_t result = nvs_get_blob(handle, "auth", &stored, &size);
        if (result == ESP_OK && size == sizeof(stored) && stored.version == 1) {
            lan_access = stored.access;
            memcpy(sessions, stored.sessions, sizeof(sessions));
        } else if (result == ESP_ERR_NVS_NOT_FOUND) {
            // Preserve legacy browser sessions during the storage upgrade.
            size = sizeof(sessions);
            if (nvs_get_blob(handle, "sessions", sessions, &size) != ESP_OK || size != sizeof(sessions))
                memset(sessions, 0, sizeof(sessions));
            lan_access.version = 1;
        } else access_storage_invalid = true;
        if (lan_access.version != 1 || lan_access.enabled > 1 ||
            (lan_access.enabled && lan_access.iterations != 100000)) access_storage_invalid = true;
        mbedtls_platform_zeroize(&stored, sizeof(stored));
        nvs_close(handle);
    } else if (opened != ESP_ERR_NVS_NOT_FOUND) access_storage_invalid = true;
    if (access_storage_invalid) memset(sessions, 0, sizeof(sessions));
    random_hex(open_csrf);
    for (unsigned i = 0; i < 6; i++) random_hex(sessions[i].csrf);
}
static bool equal(const char *a, const char *b, size_t size) {
    unsigned char difference = 0;
    for (size_t i = 0; i < size; i++)
        difference |= (unsigned char)a[i] ^ (unsigned char)b[i];
    return difference == 0;
}
static bool protected_lan(void) {
    return lan_access.enabled || access_storage_invalid;
}
static bool derive_code(const char *code, const access_t *access, unsigned char hash[32]) {
    return mbedtls_pkcs5_pbkdf2_hmac_ext(MBEDTLS_MD_SHA256, (const unsigned char *)code, strlen(code),
                                       access->salt, sizeof(access->salt), access->iterations, 32, hash) == 0;
}
static bool valid_access_code(const cJSON *value) {
    if (!lan_access.enabled || access_storage_invalid || !cJSON_IsString(value) ||
        strlen(value->valuestring) < 6 || strlen(value->valuestring) > 128)
        return false;
    unsigned char hash[32];
    bool ok = derive_code(value->valuestring, &lan_access, hash) &&
              equal((const char *)hash, (const char *)lan_access.hash, sizeof(hash));
    mbedtls_platform_zeroize(hash, sizeof(hash));
    return ok;
}
static int new_session(char raw_cookie[65]) {
    int index = 0;
    for (int i = 0; i < 6; i++) {
        if (sessions[i].expires <= time(NULL)) { index = i; break; }
        if (sessions[i].expires < sessions[index].expires) index = i;
    }
    random_hex(raw_cookie);
    cookie_hash(raw_cookie, sessions[index].cookie);
    random_hex(sessions[index].csrf);
    sessions[index].expires = time(NULL) + 2592000;
    return index;
}
static void session_cookie(httpd_req_t *r, const char *raw_cookie) {
    char cookie[192];
    snprintf(cookie, sizeof(cookie), "sc_lan=%s; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000", raw_cookie);
    httpd_resp_set_hdr(r, "Set-Cookie", cookie);
}
bool sc_runtime_lan_access_enabled(void) {
    if (!session_guard) return false;
    xSemaphoreTake(session_guard, portMAX_DELAY);
    bool enabled = protected_lan();
    xSemaphoreGive(session_guard);
    return enabled;
}
bool sc_runtime_reset_lan_access(void) {
    if (!session_guard) return false;
    xSemaphoreTake(session_guard, portMAX_DELAY);
    session_t previous[6];
    memcpy(previous, sessions, sizeof(sessions));
    memset(sessions, 0, sizeof(sessions));
    access_t next = {.version = 1, .enabled = 0, .iterations = 100000};
    bool ok = save_auth(&next);
    if (ok) {
        lan_access = next;
        access_storage_invalid = false;
        random_hex(open_csrf);
    } else memcpy(sessions, previous, sizeof(sessions));
    mbedtls_platform_zeroize(previous, sizeof(previous));
    xSemaphoreGive(session_guard);
    return ok;
}
static void headers(httpd_req_t *r) {
    httpd_resp_set_hdr(r, "Cache-Control", "no-store");
    httpd_resp_set_hdr(r, "Connection", "close");
    httpd_resp_set_hdr(r, "X-Content-Type-Options", "nosniff");
    httpd_resp_set_hdr(r, "Referrer-Policy", "no-referrer");
    httpd_resp_set_hdr(r, "X-Frame-Options", "DENY");
}
// ESP-IDF closes a session when its URI handler returns an error.
// Send the complete response first. Idle browser pools must not retain our three sockets.
static esp_err_t finish_response(esp_err_t result) { return result == ESP_OK ? ESP_FAIL : result; }
static esp_err_t json_reply(httpd_req_t *r, cJSON *value, const char *status) {
    headers(r);
    httpd_resp_set_type(r, "application/json");
    if (status)
        httpd_resp_set_status(r, status);
    char *text = value ? cJSON_PrintUnformatted(value) : NULL;
    esp_err_t result = httpd_resp_sendstr(r, text ? text : "{}");
    free(text);
    cJSON_Delete(value);
    return finish_response(result);
}
static esp_err_t failure(httpd_req_t *r, const char *status, const char *message) {
    cJSON *out = cJSON_CreateObject();
    cJSON_AddStringToObject(out, "error", message);
    return json_reply(r, out, status);
}
static bool local_request(httpd_req_t *r, bool mutation) {
    const char *forwarded[] = {"Forwarded", "X-Forwarded-For", "X-Forwarded-Host", "CF-Connecting-IP"};
    for (unsigned i = 0; i < 4; i++)
        if (httpd_req_get_hdr_value_len(r, forwarded[i]))
            return false;
    char host[96];
    if (httpd_req_get_hdr_value_str(r, "Host", host, sizeof(host)) != ESP_OK)
        return false;
    esp_netif_t *station = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    esp_netif_ip_info_t info = {0};
    if (!station || esp_netif_get_ip_info(station, &info) != ESP_OK)
        return false;
    char ip[24];
    snprintf(ip, sizeof(ip), IPSTR, IP2STR(&info.ip));
    char bare[96];
    snprintf(bare, sizeof(bare), "%s", host);
    char *port = strchr(bare, ':');
    if (port) {
        char expected_port[8];
        snprintf(expected_port, sizeof(expected_port), ":%u", (unsigned)sc_dashboard_port_active());
        if (strcmp(port, expected_port)) return false;
        *port = 0;
    } else if (sc_dashboard_port_active() != 80) return false;
    if (strcmp(bare, ip) && strcmp(bare, "smart-charging-esp32.local"))
        return false;
    if (mutation) {
        char origin[128], expected[128];
        snprintf(expected, sizeof(expected), "http://%s", host);
        if (httpd_req_get_hdr_value_str(r, "Origin", origin, sizeof(origin)) != ESP_OK || strcmp(origin, expected))
            return false;
    }
    return true;
}
static int authenticate(httpd_req_t *r, bool mutation) {
    if (time(NULL) < 1700000000)
        return -1;
    char cookies[512], csrf[65];
    if (httpd_req_get_hdr_value_str(r, "Cookie", cookies, sizeof(cookies)) != ESP_OK)
        return -1;
    char *start = strstr(cookies, "sc_lan=");
    if (!start || (start != cookies && start[-1] != ' ' && start[-1] != ';'))
        return -1;
    start += 7;
    if (strlen(start) < 64 || (start[64] && start[64] != ';'))
        return -1;
    if (mutation && httpd_req_get_hdr_value_str(r, "X-SC-CSRF", csrf, sizeof(csrf)) != ESP_OK)
        return -1;
    char hashed[65];
    cookie_hash(start, hashed);
    int found = -1;
    xSemaphoreTake(session_guard, portMAX_DELAY);
    for (unsigned i = 0; i < 6; i++)
        if (sessions[i].expires > time(NULL) && equal(hashed, sessions[i].cookie, 64) &&
            (!mutation || (strlen(csrf) == 64 && equal(csrf, sessions[i].csrf, 64))))
            found = i;
    xSemaphoreGive(session_guard);
    return found;
}
static cJSON *body_json(httpd_req_t *r) {
    if (r->content_len < 2 || r->content_len > 4096)
        return NULL;
    char type[64];
    if (httpd_req_get_hdr_value_str(r, "Content-Type", type, sizeof(type)) != ESP_OK ||
        strncmp(type, "application/json", 16))
        return NULL;
    char *text = calloc(r->content_len + 1, 1);
    if (!text)
        return NULL;
    int got = 0;
    while (got < r->content_len) {
        int count = httpd_req_recv(r, text + got, r->content_len - got);
        if (count <= 0) {
            mbedtls_platform_zeroize(text, r->content_len);
            free(text);
            return NULL;
        }
        got += count;
    }
    cJSON *out = cJSON_Parse(text);
    mbedtls_platform_zeroize(text, r->content_len);
    free(text);
    return out;
}
extern const unsigned char touch_icon_start[] asm("_binary_apple_touch_icon_png_start");
extern const unsigned char touch_icon_end[] asm("_binary_apple_touch_icon_png_end");
extern const unsigned char icon192_start[] asm("_binary_icon_192_png_start");
extern const unsigned char icon192_end[] asm("_binary_icon_192_png_end");
extern const unsigned char icon512_start[] asm("_binary_icon_512_png_start");
extern const unsigned char icon512_end[] asm("_binary_icon_512_png_end");
static esp_err_t app_asset(httpd_req_t *r){
    if(!local_request(r,false))return failure(r,"403 Forbidden","Local device address required");
    headers(r);
    if(!strcmp(r->uri,"/site.webmanifest")){
        httpd_resp_set_type(r,"application/manifest+json");
        return finish_response(httpd_resp_sendstr(r,"{\"name\":\"Smart Charging ESP32\",\"short_name\":\"Smart Charging\",\"start_url\":\"/\",\"scope\":\"/\",\"display\":\"standalone\",\"background_color\":\"#10002b\",\"theme_color\":\"#10002b\",\"icons\":[{\"src\":\"/icon-192.png\",\"sizes\":\"192x192\",\"type\":\"image/png\"},{\"src\":\"/icon-512.png\",\"sizes\":\"512x512\",\"type\":\"image/png\"}]}"));
    }
    const unsigned char *start=touch_icon_start,*end=touch_icon_end;
    if(!strncmp(r->uri,"/icon-192.png",13)){start=icon192_start;end=icon192_end;}
    if(!strncmp(r->uri,"/icon-512.png",13)){start=icon512_start;end=icon512_end;}
    httpd_resp_set_type(r,"image/png");return finish_response(httpd_resp_send(r,(const char *)start,end-start));
}
static esp_err_t page(httpd_req_t *r) {
    if (!local_request(r, false))
        return failure(r, "403 Forbidden", "Local device address required");
    headers(r);
    httpd_resp_set_type(r, "text/html; charset=utf-8");
    httpd_resp_set_hdr(r, "Content-Encoding", "gzip");
    httpd_resp_set_hdr(r, "Content-Security-Policy",
                       "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; manifest-src 'self'; "
                       "connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
    return finish_response(httpd_resp_send(r, (const char *)dashboard_start, dashboard_end - dashboard_start));
}
static esp_err_t api(httpd_req_t *r) {
    bool mutation = r->method == HTTP_POST;
    if (!local_request(r, mutation))
        return failure(r, "403 Forbidden", "Local dashboard requests only");
    if (!strcmp(r->uri, "/api/login") && mutation) {
        if (time(NULL) < 1700000000)
            return failure(r, "503 Service Unavailable", "Wait for the ESP32 clock to synchronize");
        int64_t now = esp_timer_get_time();
        xSemaphoreTake(session_guard, portMAX_DELAY);
        if (now - login_window > 60000000) {
            login_window = now;
            attempts = 0;
        }
        bool limited = attempts >= 5;
        attempts++;
        xSemaphoreGive(session_guard);
        if (limited)
            return failure(r, "429 Too Many Requests", "Wait one minute before trying again");

        cJSON *body = body_json(r);
        const cJSON *access_code = cJSON_GetObjectItemCaseSensitive(body, "access_code");
        int index = -1;
        xSemaphoreTake(session_guard, portMAX_DELAY);
        bool valid = valid_access_code(access_code);
        if (valid) {
            char raw_cookie[65];
            index = new_session(raw_cookie);
            if (save_sessions())
                session_cookie(r, raw_cookie);
            else {
                memset(&sessions[index], 0, sizeof(sessions[index]));
                index = -1;
            }
            mbedtls_platform_zeroize(raw_cookie, sizeof(raw_cookie));
        }
        xSemaphoreGive(session_guard);
        if (cJSON_IsString(access_code))
            mbedtls_platform_zeroize(access_code->valuestring, strlen(access_code->valuestring));
        cJSON_Delete(body);
        if (index < 0)
            return failure(r, "401 Unauthorized", "Incorrect LAN access code");
        cJSON *out = cJSON_CreateObject();
        cJSON_AddBoolToObject(out, "authenticated", true);
        return json_reply(r, out, NULL);
    }
    int session = authenticate(r, mutation);
    if (session < 0 && !protected_lan()) {
        char supplied[65];
        if (!mutation || (httpd_req_get_hdr_value_str(r, "X-SC-CSRF", supplied, sizeof(supplied)) == ESP_OK &&
                          strlen(supplied) == 64 && equal(supplied, open_csrf, 64)))
            session = 6; // LAN access is deliberately open until the operator enables protection.
    }
    if (session < 0)
        return failure(r, "401 Unauthorized", "Enter the LAN access code. USB setup can reset LAN protection.");
    if (!strcmp(r->uri, "/api/state") && !mutation) {
        cJSON *out = sc_runtime_state();
        xSemaphoreTake(session_guard, portMAX_DELAY);
        cJSON_AddStringToObject(out, "csrf", session == 6 ? open_csrf : sessions[session].csrf);
        cJSON_AddBoolToObject(out, "lan_access_enabled", protected_lan());
        xSemaphoreGive(session_guard);
        return json_reply(r, out, NULL);
    }
    if (!strcmp(r->uri, "/api/account") && !mutation)
        return json_reply(r, sc_runtime_account(), NULL);
    if (!strcmp(r->uri,"/api/setup-job") && mutation){
        cJSON *body=body_json(r);unsigned id=0;bool ok=sc_service_setup_submit(body,&id);
        const cJSON *v;cJSON_ArrayForEach(v,body)if(cJSON_IsString(v))mbedtls_platform_zeroize(v->valuestring,strlen(v->valuestring));cJSON_Delete(body);
        if(!ok)return failure(r,"400 Bad Request","Setup is busy or the submitted fields are invalid. Wi-Fi and IP require USB setup.");
        cJSON *out=cJSON_CreateObject();cJSON_AddNumberToObject(out,"id",id);return json_reply(r,out,NULL);
    }
    if(!strncmp(r->uri,"/api/setup-job?",15)&&!mutation){
        char query[64],number[16];unsigned id=0;
        if(httpd_req_get_url_query_str(r,query,sizeof(query))==ESP_OK&&httpd_query_key_value(query,"id",number,sizeof(number))==ESP_OK){char *end;unsigned long value=strtoul(number,&end,10);if(!*end&&value<=UINT32_MAX)id=(unsigned)value;}
        cJSON *out=sc_service_setup_status(id);if(!out)return failure(r,"404 Not Found","Setup test not found");return json_reply(r,out,NULL);
    }
    if (!strcmp(r->uri, "/api/telemetry-mode") && mutation) {
        cJSON *body = body_json(r);
        const cJSON *mode = cJSON_GetObjectItemCaseSensitive(body, "mode");
        bool ok = cJSON_IsObject(body) && cJSON_GetArraySize(body) == 1 && cJSON_IsString(mode) && sc_live_set_mode(mode->valuestring);
        cJSON_Delete(body);
        if (!ok) return failure(r, "400 Bad Request", "Configure optional FoxESS login through USB before selecting WebSocket");
        return json_reply(r, sc_live_status(), NULL);
    }
    if (!strcmp(r->uri, "/api/refresh") && mutation) {
        cJSON *body = body_json(r);
        const cJSON *service = cJSON_GetObjectItemCaseSensitive(body, "service");
        bool ok = cJSON_IsString(service) && sc_runtime_request_refresh(service->valuestring);
        cJSON_Delete(body);
        if (!ok) return failure(r, "400 Bad Request", "Choose Octopus or FoxESS");
        cJSON *out = cJSON_CreateObject();
        cJSON_AddBoolToObject(out, "queued", true);
        return json_reply(r, out, NULL);
    }
    if (!strncmp(r->uri, "/api/history", 12) && (!r->uri[12] || r->uri[12] == '?') && !mutation) {
        char query[64], days_text[8];
        int days = 14;
        if (httpd_req_get_url_query_str(r, query, sizeof(query)) == ESP_OK &&
            httpd_query_key_value(query, "days", days_text, sizeof(days_text)) == ESP_OK)
            days = atoi(days_text);
        return json_reply(r, sc_runtime_history(days), NULL);
    }
    if (!strcmp(r->uri, "/api/logout") && mutation) {
        xSemaphoreTake(session_guard, portMAX_DELAY);
        if (session == 6) {
            httpd_resp_set_hdr(r, "Set-Cookie", "sc_lan=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
            xSemaphoreGive(session_guard);
            return json_reply(r, cJSON_CreateObject(), NULL);
        }
        session_t previous = sessions[session];
        mbedtls_platform_zeroize(&sessions[session], sizeof(sessions[session]));
        bool saved = save_sessions();
        if (!saved)
            sessions[session] = previous;
        mbedtls_platform_zeroize(&previous, sizeof(previous));
        xSemaphoreGive(session_guard);
        if (!saved)
            return failure(r, "503 Service Unavailable", "Session revocation could not be saved. Retry sign out.");
        httpd_resp_set_hdr(r, "Set-Cookie", "sc_lan=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
        return json_reply(r, cJSON_CreateObject(), NULL);
    }
    if (!strcmp(r->uri, "/api/lan-access") && mutation) {
        cJSON *body = body_json(r);
        const cJSON *enabled = cJSON_GetObjectItemCaseSensitive(body, "enabled");
        const cJSON *code = cJSON_GetObjectItemCaseSensitive(body, "access_code");
        if (!cJSON_IsBool(enabled) || !cJSON_IsString(code) ||
            (cJSON_IsTrue(enabled) && (strlen(code->valuestring) < 6 || strlen(code->valuestring) > 128))) {
            if (cJSON_IsString(code)) mbedtls_platform_zeroize(code->valuestring, strlen(code->valuestring));
            cJSON_Delete(body);
            return failure(r, "400 Bad Request", "Use an access code with 6 to 128 characters");
        }
        access_t next = {.version = 1, .enabled = cJSON_IsTrue(enabled), .iterations = 100000};
        esp_fill_random(next.salt, sizeof(next.salt));
        bool ok = !next.enabled || derive_code(code->valuestring, &next, next.hash);
        mbedtls_platform_zeroize(code->valuestring, strlen(code->valuestring));
        cJSON_Delete(body);
        if (!ok) return failure(r, "503 Service Unavailable", "Access code could not be protected");
        xSemaphoreTake(session_guard, portMAX_DELAY);
        session_t previous[6];
        memcpy(previous, sessions, sizeof(previous));
        memset(sessions, 0, sizeof(sessions));
        char raw_cookie[65] = {0};
        if (next.enabled) new_session(raw_cookie);
        ok = save_auth(&next);
        if (ok) {
            lan_access = next;
            access_storage_invalid = false;
            random_hex(open_csrf);
            if (next.enabled) session_cookie(r, raw_cookie);
            else httpd_resp_set_hdr(r, "Set-Cookie", "sc_lan=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
        } else memcpy(sessions, previous, sizeof(sessions));
        mbedtls_platform_zeroize(previous, sizeof(previous));
        mbedtls_platform_zeroize(raw_cookie, sizeof(raw_cookie));
        mbedtls_platform_zeroize(&next, sizeof(next));
        xSemaphoreGive(session_guard);
        if (!ok) return failure(r, "503 Service Unavailable", "LAN protection could not be saved");
        cJSON *out = cJSON_CreateObject();
        cJSON_AddBoolToObject(out, "saved", true);
        return json_reply(r, out, NULL);
    }
    if (!strcmp(r->uri, "/api/rules") && mutation) {
        cJSON *body = body_json(r);
        const cJSON *rules = cJSON_GetObjectItemCaseSensitive(body, "rules"),
                    *rev = cJSON_GetObjectItemCaseSensitive(body, "revision");
        bool enable = cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(rules, "enabled"));
        if (enable && !cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(body, "acknowledge_control"))) {
            cJSON_Delete(body);
            return failure(r, "400 Bad Request", "Review the real inverter changes before enabling automation");
        }
        if (!cJSON_IsNumber(rev) || rev->valuedouble != sc_runtime_revision()) {
            cJSON_Delete(body);
            return failure(r, "409 Conflict", "Settings changed. Refresh before applying");
        }
        bool ok = sc_runtime_update_expected(rules, rev->valueint);
        cJSON_Delete(body);
        if (!ok)
            return failure(r, "400 Bad Request", "Invalid rules or persistent storage failure");
        cJSON *out = cJSON_CreateObject();
        cJSON_AddBoolToObject(out, "saved", true);
        cJSON_AddNumberToObject(out, "revision", sc_runtime_revision());
        return json_reply(r, out, NULL);
    }
    if (!strcmp(r->uri, "/api/manual") && mutation) {
        cJSON *body = body_json(r);
        bool ok = cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(body, "acknowledge_control")) &&
                  sc_runtime_manual(cJSON_GetObjectItemCaseSensitive(body, "period"));
        cJSON_Delete(body);
        if (!ok)
            return failure(r, "400 Bad Request",
                           "Review a valid temporary period while automation is enabled and not paused");
        return json_reply(r, cJSON_CreateObject(), NULL);
    }
    return failure(r, "404 Not Found", "Unknown dashboard route");
}
void sc_runtime_register(httpd_handle_t server) {
    session_guard = xSemaphoreCreateMutex();
    load_sessions();
    httpd_uri_t root = {.uri = "/", .method = HTTP_GET, .handler = page};
    httpd_uri_t get = {.uri = "/api/*", .method = HTTP_GET, .handler = api};
    httpd_uri_t post = {.uri = "/api/*", .method = HTTP_POST, .handler = api};
    const char *asset_paths[]={"/apple-touch-icon.png*","/icon-192.png*","/icon-512.png*","/site.webmanifest"};
    for(unsigned i=0;i<sizeof(asset_paths)/sizeof(*asset_paths);i++){httpd_uri_t asset={.uri=asset_paths[i],.method=HTTP_GET,.handler=app_asset};httpd_register_uri_handler(server,&asset);}
    httpd_register_uri_handler(server, &root);
    httpd_register_uri_handler(server, &get);
    httpd_register_uri_handler(server, &post);
}
