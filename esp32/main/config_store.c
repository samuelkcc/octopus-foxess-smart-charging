// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <ctype.h>
#include <string.h>
#include "config_store.h"
#include "esp_random.h"
#include "mbedtls/gcm.h"
#include "mbedtls/platform_util.h"
#include "nvs.h"
#include "lwip/inet.h"
#include "lwip/sockets.h"

static bool copy_field(const cJSON *object, const char *name, char *out, size_t size, bool required) {
    const cJSON *item = cJSON_GetObjectItemCaseSensitive(object, name);
    if (!cJSON_IsString(item) || !item->valuestring) return false;
    size_t length = strlen(item->valuestring);
    if (length >= size || (required && !length)) return false;
    for (size_t i = 0; i < length; i++) if ((unsigned char)item->valuestring[i] < 32 || item->valuestring[i] == 127) return false;
    memcpy(out, item->valuestring, length + 1);
    return true;
}

static bool validate_fields(const cJSON *object,bool services) {
    if (!cJSON_IsObject(object)) return false;
    const char *allowed[] = {"ssid","password","account","octopus_key","foxess_sn","foxess_key","ip_mode","ip","gateway","netmask","dns"};
    const cJSON *item;
    cJSON_ArrayForEach(item, object) {
        bool accepted = false;
        for (size_t i = 0; i < sizeof(allowed)/sizeof(allowed[0]); i++) if (!strcmp(item->string, allowed[i])) accepted = true;
        if(!services&&(!strcmp(item->string,"account")||!strcmp(item->string,"octopus_key")||!strcmp(item->string,"foxess_sn")||!strcmp(item->string,"foxess_key")))return false;
        if (!accepted) return false;
        for (const cJSON *other = item->next; other; other = other->next) if (!strcmp(item->string, other->string)) return false;
    }
    return true;
}
static bool parse_network(const cJSON *object,sc_config_t *out){
    if (!copy_field(object,"ssid",out->ssid,sizeof(out->ssid),true) ||
        !copy_field(object,"password",out->password,sizeof(out->password),false)) return false;
    size_t password_length = strlen(out->password);
    if (password_length && password_length < 8) return false;
    if (password_length == 64) for (size_t i = 0; i < 64; i++) if (!isxdigit((unsigned char)out->password[i])) return false;
    char mode[8];
    if (!copy_field(object,"ip_mode",mode,sizeof(mode),true)) return false;
    if (strcmp(mode,"dhcp") && strcmp(mode,"static")) return false;
    out->static_ip = !strcmp(mode,"static");
    if (out->static_ip) {
        if (!copy_field(object,"ip",out->ip,sizeof(out->ip),true) || !copy_field(object,"gateway",out->gateway,sizeof(out->gateway),true) ||
            !copy_field(object,"netmask",out->netmask,sizeof(out->netmask),true) || !copy_field(object,"dns",out->dns,sizeof(out->dns),true)) return false;
        struct in_addr address, gateway, mask, dns;
        if (inet_pton(AF_INET,out->ip,&address)!=1 || inet_pton(AF_INET,out->gateway,&gateway)!=1 ||
            inet_pton(AF_INET,out->netmask,&mask)!=1 || inet_pton(AF_INET,out->dns,&dns)!=1) return false;
        uint32_t inverse = ~ntohl(mask.s_addr);
        if (!inverse || inverse == UINT32_MAX || (inverse & (inverse + 1)) ||
            (address.s_addr & mask.s_addr) != (gateway.s_addr & mask.s_addr)) return false;
    }
    return true;
}
bool sc_parse_network_config(const cJSON *object,sc_config_t *out){
    memset(out,0,sizeof(*out));
    return validate_fields(object,false)&&parse_network(object,out);
}
bool sc_parse_config(const cJSON *object,sc_config_t *out){
    memset(out,0,sizeof(*out));
    if(!validate_fields(object,true)||!parse_network(object,out)||
        !copy_field(object,"account",out->account,sizeof(out->account),true)||
        !copy_field(object,"octopus_key",out->octopus_key,sizeof(out->octopus_key),true)||
        !copy_field(object,"foxess_sn",out->foxess_sn,sizeof(out->foxess_sn),true)||
        !copy_field(object,"foxess_key",out->foxess_key,sizeof(out->foxess_key),true))return false;
    for(const char *p=out->account;*p;p++)if(!isalnum((unsigned char)*p)&&*p!='-')return false;
    for(const char *p=out->foxess_sn;*p;p++)if(!isalnum((unsigned char)*p)&&*p!='-'&&*p!='_')return false;
    for(const char *p=out->octopus_key;*p;p++)if((unsigned char)*p<33||(unsigned char)*p>126)return false;
    for(const char *p=out->foxess_key;*p;p++)if((unsigned char)*p<33||(unsigned char)*p>126)return false;
    return true;
}

// Development protection only: the device-local AES key is stored beside the blob.
// This prevents plain-text credential records, but cannot protect a physical flash dump.
// Hardware key protection requires a separate, explicit eFuse provisioning procedure.
typedef struct { uint32_t version; uint8_t iv[12], tag[16], bytes[sizeof(sc_config_t)]; } encrypted_config_t;
static esp_err_t key_for_store(nvs_handle_t handle, unsigned char key[32], bool create) {
    size_t size = 32;
    esp_err_t result = nvs_get_blob(handle,"local_key",key,&size);
    if (result == ESP_ERR_NVS_NOT_FOUND && create) {
        esp_fill_random(key,32);
        result = nvs_set_blob(handle,"local_key",key,32);
        if (result == ESP_OK) result = nvs_commit(handle);
    } else if (result == ESP_OK && size != 32) result = ESP_FAIL;
    return result;
}
esp_err_t sc_save_config(const sc_config_t *config) {
    nvs_handle_t handle;
    esp_err_t result = nvs_open("sc_config",NVS_READWRITE,&handle);
    if (result != ESP_OK) return result;
    unsigned char key[32] = {0};
    encrypted_config_t blob = {.version=1};
    mbedtls_gcm_context ctx;
    mbedtls_gcm_init(&ctx);
    result = key_for_store(handle,key,true);
    esp_fill_random(blob.iv,sizeof(blob.iv));
    if (result == ESP_OK && (mbedtls_gcm_setkey(&ctx,MBEDTLS_CIPHER_ID_AES,key,256) ||
        mbedtls_gcm_crypt_and_tag(&ctx,MBEDTLS_GCM_ENCRYPT,sizeof(*config),blob.iv,sizeof(blob.iv),
            (unsigned char *)&blob.version,sizeof(blob.version),(const unsigned char *)config,blob.bytes,sizeof(blob.tag),blob.tag))) result = ESP_FAIL;
    if (result == ESP_OK) result = nvs_set_blob(handle,"settings",&blob,sizeof(blob));
    if (result == ESP_OK) result = nvs_commit(handle);
    nvs_close(handle);
    mbedtls_gcm_free(&ctx);
    mbedtls_platform_zeroize(key,sizeof(key));
    mbedtls_platform_zeroize(&blob,sizeof(blob));
    return result;
}
esp_err_t sc_load_config(sc_config_t *config) {
    nvs_handle_t handle;
    esp_err_t result = nvs_open("sc_config",NVS_READONLY,&handle);
    if (result != ESP_OK) return result;
    unsigned char key[32] = {0};
    encrypted_config_t blob = {0};
    size_t size = sizeof(blob);
    result = nvs_get_blob(handle,"settings",&blob,&size);
    if (result == ESP_OK && (size != sizeof(blob) || blob.version != 1)) result = ESP_FAIL;
    if (result == ESP_OK) result = key_for_store(handle,key,false);
    mbedtls_gcm_context ctx;
    mbedtls_gcm_init(&ctx);
    if (result == ESP_OK && (mbedtls_gcm_setkey(&ctx,MBEDTLS_CIPHER_ID_AES,key,256) ||
        mbedtls_gcm_auth_decrypt(&ctx,sizeof(*config),blob.iv,sizeof(blob.iv),(unsigned char *)&blob.version,sizeof(blob.version),
            blob.tag,sizeof(blob.tag),blob.bytes,(unsigned char *)config))) result = ESP_FAIL;
    nvs_close(handle);
    mbedtls_gcm_free(&ctx);
    mbedtls_platform_zeroize(key,sizeof(key));
    mbedtls_platform_zeroize(&blob,sizeof(blob));
    if (result != ESP_OK) mbedtls_platform_zeroize(config,sizeof(*config));
    return result;
}
