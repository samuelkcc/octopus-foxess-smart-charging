#include "debug_log.h"
#include "debug_http.h"
// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
// Connection tests and an explicitly authorised, USB-only future-period diagnostic.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "config_store.h"
#include "config_access.h"
#include "foxess_schedule.h"
#include "provision_policy.h"
#include "network_tools.h"
#include "runtime.h"
#include "dashboard_port.h"
#include "foxess_live.h"
#include "service_setup.h"
#include "ota_update.h"
#include "cloud_read.h"
#include "freertos/semphr.h"
#include "driver/uart.h"
#include "esp_crt_bundle.h"
#include "esp_event.h"
#include "esp_flash.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_netif_sntp.h"
#include "esp_psram.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "freertos/event_groups.h"
#include "mbedtls/base64.h"
#include "mbedtls/md5.h"
#include "mbedtls/platform_util.h"
#include "nvs_flash.h"

#define CONNECTED BIT0
#define FAILED BIT1
#define MAX_LINE 4096
#define MAX_RESPONSE 32768
static sc_config_t settings;
static bool configured;
static bool settings_saved;
static bool network_trial_active;
static EventGroupHandle_t wifi_events;
static esp_netif_t *station;
static int retries;
static int64_t next_test_us;
static bool sntp_ready;
static SemaphoreHandle_t network_io;
static bool save_service_configuration(const sc_config_t *candidate){
    if(sc_save_config(candidate)!=ESP_OK)return false;
    settings=*candidate;configured=true;settings_saved=true;return true;
}
static void runtime_task(void *arg){
    sc_config_t *copy=calloc(1,sizeof(*copy));
    while(copy){
        if(xSemaphoreTake(network_io,pdMS_TO_TICKS(100))==pdTRUE){
            *copy=settings;
            bool online=configured&&settings_saved&&!network_trial_active&&(xEventGroupGetBits(wifi_events)&CONNECTED);
            if(online&&time(NULL)>1700000000)sc_service_setup_prepare();
            sc_runtime_tick(copy,online);
            sc_service_setup_tick(copy,online&&time(NULL)>1700000000,save_service_configuration);
            sc_ota_tick(online&&time(NULL)>1700000000);
            sc_debug_http_tick();
            mbedtls_platform_zeroize(copy,sizeof(*copy));
            xSemaphoreGive(network_io);
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
    vTaskDelete(NULL);
}

static void *json_alloc(size_t size){void *out=heap_caps_malloc(size,MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);return out?out:malloc(size);}

static void wifi_event(void *arg, esp_event_base_t base, int32_t id, void *data) {
    if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        retries = 0;
        sc_debug_problem(SC_DEBUG_WIFI,false,0);
        xEventGroupClearBits(wifi_events,FAILED);
        xEventGroupSetBits(wifi_events,CONNECTED);
        if (sntp_ready) esp_netif_sntp_start();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        sc_debug_problem(SC_DEBUG_WIFI,true,data?((wifi_event_sta_disconnected_t *)data)->reason:0);
        xEventGroupClearBits(wifi_events,CONNECTED);
        if (configured && retries++ < 5) esp_wifi_connect();
        else xEventGroupSetBits(wifi_events,FAILED);
    }
}

static bool start_connection(void) {
    // Suppress reconnection of the old configuration while it is replaced.
    bool was_configured = configured;
    configured = false;
    esp_wifi_disconnect();
    vTaskDelay(pdMS_TO_TICKS(100));
    configured = was_configured;
    xEventGroupClearBits(wifi_events,CONNECTED | FAILED);
    esp_netif_dhcpc_stop(station);
    if (settings.static_ip) {
        esp_netif_ip_info_t info = {0};
        esp_netif_str_to_ip4(settings.ip,&info.ip);
        esp_netif_str_to_ip4(settings.gateway,&info.gw);
        esp_netif_str_to_ip4(settings.netmask,&info.netmask);
        if (esp_netif_set_ip_info(station,&info) != ESP_OK) return false;
        esp_netif_dns_info_t dns = {.ip.type=ESP_IPADDR_TYPE_V4};
        esp_netif_str_to_ip4(settings.dns,&dns.ip.u_addr.ip4);
        if (esp_netif_set_dns_info(station,ESP_NETIF_DNS_MAIN,&dns) != ESP_OK) return false;
    } else {
        esp_netif_ip_info_t empty = {0};
        esp_netif_set_ip_info(station,&empty);
        if (esp_netif_dhcpc_start(station) != ESP_OK) return false;
    }
    wifi_config_t config = {0};
    memcpy(config.sta.ssid,settings.ssid,strlen(settings.ssid));
    memcpy(config.sta.password,settings.password,strlen(settings.password));
    config.sta.pmf_cfg.capable = true;
    esp_err_t result = esp_wifi_set_config(WIFI_IF_STA,&config);
    mbedtls_platform_zeroize(&config,sizeof(config));
    retries = 0;
    return result == ESP_OK && esp_wifi_connect() == ESP_OK;
}

static cJSON *status_json(void) {
    cJSON *object = cJSON_CreateObject();
    cJSON_AddStringToObject(object,"firmware","Smart Charging ESP32");
    cJSON_AddStringToObject(object,"version","2.5.2");
    cJSON_AddBoolToObject(object,"automation_enabled",sc_runtime_enabled());
    cJSON_AddBoolToObject(object,"configured",settings_saved);
    cJSON_AddBoolToObject(object,"network_trial_active",network_trial_active);
    cJSON *capabilities=cJSON_AddObjectToObject(object,"capabilities");
    cJSON_AddBoolToObject(capabilities,"production_controller",true);
    cJSON_AddBoolToObject(capabilities,"wifi_scan_while_running",true);
    cJSON_AddBoolToObject(capabilities,"usb_network_setup",true);
    cJSON_AddBoolToObject(capabilities,"dashboard_port_configuration",true);
    cJSON_AddNumberToObject(object,"dashboard_port",sc_dashboard_port_active());
    cJSON_AddNumberToObject(object,"configured_dashboard_port",sc_dashboard_port_saved());
    cJSON_AddBoolToObject(object,"dashboard_restart_required",sc_dashboard_port_active()!=sc_dashboard_port_saved());
    cJSON_AddBoolToObject(capabilities,"usb_config_readback",true);
    cJSON_AddItemToObject(object,"config_access",sc_config_access_status());
    cJSON_AddBoolToObject(capabilities,"optional_foxess_websocket",true);
    cJSON_AddItemToObject(object,"foxess_telemetry",sc_live_status());
    cJSON_AddBoolToObject(capabilities,"lan_access_recovery",true);
    cJSON_AddBoolToObject(object,"lan_access_enabled",sc_runtime_lan_access_enabled());
    cJSON_AddBoolToObject(capabilities,"validate_before_save",true);
    cJSON_AddBoolToObject(capabilities,"network_only_save",true);
    cJSON_AddBoolToObject(capabilities,"network_trial",true);
    cJSON_AddBoolToObject(capabilities,"ip_suggestion",true);
    cJSON_AddBoolToObject(object,"schedule_restore_pending",sc_schedule_recovery_pending());
    bool connected = (xEventGroupGetBits(wifi_events) & CONNECTED) != 0;
    cJSON_AddBoolToObject(object,"wifi_connected",connected);
    if (connected) {
        esp_netif_ip_info_t info;
        if (esp_netif_get_ip_info(station,&info) == ESP_OK) {
            char address[16];
            snprintf(address,sizeof(address),IPSTR,IP2STR(&info.ip));
            cJSON_AddStringToObject(object,"ip",address);
        }
    }
    uint32_t flash_size = 0;
    esp_flash_get_size(NULL,&flash_size);
    cJSON_AddNumberToObject(object,"flash_bytes",flash_size);
    cJSON_AddNumberToObject(object,"psram_bytes",esp_psram_get_size());
    cJSON_AddNumberToObject(object,"free_internal_bytes",heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT));
    cJSON_AddNumberToObject(object,"free_psram_bytes",heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
    cJSON_AddNumberToObject(object,"uptime_seconds",esp_timer_get_time()/1000000);
    cJSON_AddNumberToObject(object,"reset_reason",esp_reset_reason());
    cJSON_AddStringToObject(object,"settings_storage","Persistent; development AES-GCM protection; no physical flash protection");
    cJSON_AddStringToObject(object,"history","Live RAM averages; optional hourly Flash saving");
    return object;
}

static void wipe_json(cJSON *node){
    if(!node)return;
    if(cJSON_IsString(node)&&node->valuestring)mbedtls_platform_zeroize(node->valuestring,strlen(node->valuestring));
    cJSON *child;cJSON_ArrayForEach(child,node)wipe_json(child);
}
static void reply(int id, bool ok, cJSON *result, const char *error) {
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root,"protocol","sc-esp32");
    cJSON_AddNumberToObject(root,"version",1);
    cJSON_AddNumberToObject(root,"id",id);
    cJSON_AddBoolToObject(root,"ok",ok);
    if (result) cJSON_AddItemToObject(root,"result",result);
    if (error) cJSON_AddStringToObject(root,"error",error);
    char *text = cJSON_PrintUnformatted(root);
    if (text) {
        uart_write_bytes(UART_NUM_0,"SCESP1 ",7);
        uart_write_bytes(UART_NUM_0,text,strlen(text));
        uart_write_bytes(UART_NUM_0,"\n",1);
        mbedtls_platform_zeroize(text,strlen(text));free(text);
    }
    wipe_json(root);cJSON_Delete(root);
}

typedef struct { char *bytes; size_t used; bool overflow; int retry_after; } response_buffer_t;
static esp_err_t http_event(esp_http_client_event_t *event) {
    response_buffer_t *buffer = event->user_data;
    if (event->event_id == HTTP_EVENT_ON_HEADER && event->header_key && event->header_value && !strcasecmp(event->header_key,"Retry-After")) {
        char *end;
        long seconds=strtol(event->header_value,&end,10);
        if (*end==0 && seconds>0 && seconds<=86400) buffer->retry_after=(int)seconds;
    }
    if (event->event_id == HTTP_EVENT_ON_DATA) {
        if (event->data_len < 0 || buffer->used + event->data_len > MAX_RESPONSE) { buffer->overflow=true; return ESP_FAIL; }
        memcpy(buffer->bytes+buffer->used,event->data,event->data_len);
        buffer->used += event->data_len;
        buffer->bytes[buffer->used] = 0;
    }
    return ESP_OK;
}

static cJSON *api_test(bool foxess) {
    cJSON *result = cJSON_CreateObject();
    response_buffer_t buffer = {.bytes=calloc(MAX_RESPONSE+1,1)};
    if (!buffer.bytes) { cJSON_AddStringToObject(result,"status","Not enough memory"); return result; }
    char url[192], authorization[256] = {0}, timestamp[32], signature[33] = {0};
    const char *fox_path = "/op/v0/device/real/query";
    if (foxess) snprintf(url,sizeof(url),"https://www.foxesscloud.com%s",fox_path);
    else snprintf(url,sizeof(url),"https://api.octopus.energy/v1/accounts/%s/",settings.account);
    esp_http_client_config_t config = {
        .url=url, .timeout_ms=20000, .crt_bundle_attach=esp_crt_bundle_attach,
        .event_handler=http_event, .user_data=&buffer, .disable_auto_redirect=true,
        .buffer_size=2048, .buffer_size_tx=2048,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    cJSON *body = NULL;
    char *body_text = NULL;
    if (!client) { cJSON_AddStringToObject(result,"status","HTTP client unavailable"); goto done; }
    if (foxess) {
        // FoxESS requires literal backslash-r/backslash-n separators, as in src/app.js.
        char sign_input[512];
        snprintf(timestamp,sizeof(timestamp),"%lld",(long long)time(NULL)*1000);
        snprintf(sign_input,sizeof(sign_input),"%s\\r\\n%s\\r\\n%s",fox_path,settings.foxess_key,timestamp);
        unsigned char digest[16];
        mbedtls_md5((unsigned char *)sign_input,strlen(sign_input),digest);
        for (int i=0;i<16;i++) snprintf(signature+i*2,3,"%02x",digest[i]);
        mbedtls_platform_zeroize(sign_input,sizeof(sign_input));
        esp_http_client_set_method(client,HTTP_METHOD_POST);
        esp_http_client_set_header(client,"Content-Type","application/json");
        esp_http_client_set_header(client,"token",settings.foxess_key);
        esp_http_client_set_header(client,"timestamp",timestamp);
        esp_http_client_set_header(client,"signature",signature);
        esp_http_client_set_header(client,"lang","en");
        body = cJSON_CreateObject();
        cJSON_AddStringToObject(body,"sn",settings.foxess_sn);
        cJSON *variables=cJSON_AddArrayToObject(body,"variables");
        cJSON_AddItemToArray(variables,cJSON_CreateString("SoC"));
        body_text=cJSON_PrintUnformatted(body);
        esp_http_client_set_post_field(client,body_text,strlen(body_text));
    } else {
        char credentials[132];
        unsigned char encoded[192];
        size_t length=0;
        snprintf(credentials,sizeof(credentials),"%s:",settings.octopus_key);
        mbedtls_base64_encode(encoded,sizeof(encoded),&length,(unsigned char *)credentials,strlen(credentials));
        encoded[length]=0;
        snprintf(authorization,sizeof(authorization),"Basic %s",encoded);
        esp_http_client_set_header(client,"Authorization",authorization);
        mbedtls_platform_zeroize(credentials,sizeof(credentials));
        mbedtls_platform_zeroize(encoded,sizeof(encoded));
    }
    if(foxess&&!sc_fox_slot()){cJSON_AddBoolToObject(result,"connected",false);cJSON_AddStringToObject(result,"status","FoxESS cooldown is active");esp_http_client_cleanup(client);goto done;}
    esp_err_t request_result=esp_http_client_perform(client);
    int status=esp_http_client_get_status_code(client);
    if(!foxess)sc_runtime_octopus_setup_result(status,buffer.retry_after);
    if (status==429) {
        if(foxess)sc_fox_cooldown(buffer.retry_after);
        int seconds=buffer.retry_after>60?buffer.retry_after:600;
        int64_t until=esp_timer_get_time()+(int64_t)seconds*1000000;
        if (until>next_test_us) next_test_us=until;
    }
    cJSON_AddNumberToObject(result,"http_status",status);
    cJSON *json = request_result==ESP_OK && !buffer.overflow ? cJSON_Parse(buffer.bytes) : NULL;
    bool success=false;
    if (foxess) {
        cJSON *error=cJSON_GetObjectItemCaseSensitive(json,"errno");
        cJSON *rows=cJSON_GetObjectItemCaseSensitive(json,"result");
        cJSON *datas=cJSON_GetObjectItemCaseSensitive(cJSON_GetArrayItem(rows,0),"datas");
        success=status==200 && cJSON_IsNumber(error) && error->valuedouble==0 && cJSON_IsArray(datas) && cJSON_GetArraySize(datas)>0;
        if (cJSON_IsNumber(error)) cJSON_AddNumberToObject(result,"api_code",error->valuedouble);
    } else {
        cJSON *number=cJSON_GetObjectItemCaseSensitive(json,"number");
        success=status==200 && cJSON_IsString(number) && !strcmp(number->valuestring,settings.account);
    }
    cJSON_AddBoolToObject(result,"connected",success);
    cJSON_AddStringToObject(result,"status",success ? (foxess ? "Official REST telemetry read succeeded" : "Account REST read succeeded; dispatch access not tested") :
        status==429 ? "Rate limited; wait before testing again" : request_result!=ESP_OK ? "TLS or network request failed" : "Account, token or device validation failed");
    cJSON_Delete(json);
    esp_http_client_cleanup(client);
done:
    if (body_text) { mbedtls_platform_zeroize(body_text,strlen(body_text)); free(body_text); }
    cJSON_Delete(body);
    mbedtls_platform_zeroize(authorization,sizeof(authorization));
    mbedtls_platform_zeroize(buffer.bytes,MAX_RESPONSE+1);
    free(buffer.bytes);
    return result;
}

static cJSON *test_connections(void) {
    if (!configured) return NULL;
    cJSON *result=cJSON_CreateObject();
    bool connected=(xEventGroupGetBits(wifi_events)&CONNECTED)!=0;
    if (!connected) {
        start_connection();
        EventBits_t bits=xEventGroupWaitBits(wifi_events,CONNECTED|FAILED,pdFALSE,pdFALSE,pdMS_TO_TICKS(35000));
        connected=(bits&CONNECTED)!=0;
    }
    cJSON_AddBoolToObject(result,"wifi_connected",connected);
    if (!connected) { cJSON_AddStringToObject(result,"status","Wi-Fi connection failed; check SSID, password and 2.4 GHz coverage"); return result; }
    time_t now=time(NULL);
    if (now<1700000000) esp_netif_sntp_sync_wait(pdMS_TO_TICKS(20000));
    bool clock_ready=time(NULL)>=1700000000;
    cJSON_AddBoolToObject(result,"clock_synced",clock_ready);
    if (!clock_ready) { cJSON_AddStringToObject(result,"status","Clock not synchronized; HTTPS tests were skipped"); return result; }
    if(sc_runtime_claim_octopus_setup())cJSON_AddItemToObject(result,"octopus",api_test(false));
    else{cJSON *waiting=cJSON_AddObjectToObject(result,"octopus");cJSON_AddBoolToObject(waiting,"connected",false);cJSON_AddStringToObject(waiting,"status","Octopus cooldown is active. Wait before testing again.");}
    cJSON_AddItemToObject(result,"foxess",api_test(true));
    cJSON_AddBoolToObject(result,"automation_enabled",false);
    return result;
}

static bool wait_for_wifi(void){
    EventBits_t bits=xEventGroupWaitBits(wifi_events,CONNECTED|FAILED,pdFALSE,pdFALSE,pdMS_TO_TICKS(35000));
    return (bits&CONNECTED)!=0;
}
typedef struct{
    const sc_config_t *candidate;
    sc_config_t previous;
    bool was_configured,was_saved,was_trial,network_only;
} provision_context_t;
static bool provision_activate(void *arg){
    provision_context_t *ctx=arg;
    settings=*ctx->candidate;settings.static_ip=false;configured=true;network_trial_active=true;
    if(!start_connection()||!wait_for_wifi())return false;
    if(ctx->candidate->static_ip){
        esp_ip4_addr_t requested;
        if(esp_netif_str_to_ip4(ctx->candidate->ip,&requested)!=ESP_OK||sc_probe_ip(station,&requested)!=0)return false;
        settings=*ctx->candidate;
        if(!start_connection()||!wait_for_wifi())return false;
    }
    return true;
}
static cJSON *provision_test(void *arg){
    provision_context_t *ctx=arg;
    cJSON *result=ctx->network_only?cJSON_CreateObject():test_connections();if(!result)return NULL;
    if(ctx->network_only){cJSON_AddBoolToObject(result,"wifi_connected",(xEventGroupGetBits(wifi_events)&CONNECTED)!=0);cJSON_AddBoolToObject(result,"clock_synced",time(NULL)>=1700000000);}
    esp_netif_ip_info_t actual={0};
    bool valid=esp_netif_get_ip_info(station,&actual)==ESP_OK&&actual.ip.addr&&actual.netmask.addr&&actual.gw.addr;
    if(valid&&ctx->candidate->static_ip){
        esp_ip4_addr_t ip,mask,gateway;
        valid=esp_netif_str_to_ip4(ctx->candidate->ip,&ip)==ESP_OK&&esp_netif_str_to_ip4(ctx->candidate->netmask,&mask)==ESP_OK&&
            esp_netif_str_to_ip4(ctx->candidate->gateway,&gateway)==ESP_OK&&ip.addr==actual.ip.addr&&mask.addr==actual.netmask.addr&&gateway.addr==actual.gw.addr;
    }
    cJSON_AddBoolToObject(result,"ip_valid",valid);
    cJSON_AddItemToObject(result,"network",sc_network_info(station));return result;
}
static bool provision_save(void *arg){
    provision_context_t *ctx=arg;
    if(sc_save_config(ctx->candidate)!=ESP_OK)return false;
    if(strcmp(ctx->previous.account,ctx->candidate->account)||strcmp(ctx->previous.octopus_key,ctx->candidate->octopus_key)||strcmp(ctx->previous.foxess_sn,ctx->candidate->foxess_sn)||strcmp(ctx->previous.foxess_key,ctx->candidate->foxess_key))sc_runtime_credentials_changed();
    settings=*ctx->candidate;configured=true;settings_saved=true;network_trial_active=false;return true;
}
static bool provision_restore(void *arg){
    provision_context_t *ctx=arg;
    settings=ctx->previous;configured=ctx->was_configured;settings_saved=ctx->was_saved;network_trial_active=ctx->was_trial;
    if(configured)return start_connection()&&wait_for_wifi();
    esp_wifi_disconnect();xEventGroupClearBits(wifi_events,CONNECTED|FAILED);return true;
}
static cJSON *validate_configuration(const sc_config_t *candidate,bool network_only){
    provision_context_t *ctx=calloc(1,sizeof(*ctx));
    if(!ctx)return NULL;
    ctx->network_only=network_only;ctx->candidate=candidate;ctx->previous=settings;ctx->was_configured=configured;ctx->was_saved=settings_saved;ctx->was_trial=network_trial_active;
    sc_provision_ops_t ops={ctx,provision_activate,provision_test,provision_save,provision_restore};
    if(!network_only)next_test_us=esp_timer_get_time()+60000000;
    cJSON *result=network_only?sc_validate_network_and_save(&ops):sc_validate_and_save(&ops);
    if(!network_only){int64_t minimum=esp_timer_get_time()+60000000;if(next_test_us<minimum)next_test_us=minimum;}
    if(result)cJSON_AddBoolToObject(result,"previous_configuration_saved",ctx->was_saved);
    mbedtls_platform_zeroize(ctx,sizeof(*ctx));free(ctx);return result;
}

extern const char licence_start[] asm("_binary_LICENSE_start");
extern const char notices_start[] asm("_binary_THIRD_PARTY_NOTICES_md_start");
extern const char sdk_notices_start[] asm("_binary_SDK_NOTICES_txt_start");
static esp_err_t legal_page(httpd_req_t *request) {
    httpd_resp_set_type(request,"text/plain; charset=utf-8");
    httpd_resp_set_hdr(request,"Cache-Control","no-store");
    httpd_resp_set_hdr(request,"Connection","close");
    esp_err_t sent=httpd_resp_sendstr(request,!strcmp(request->uri,"/licence")?licence_start:!strcmp(request->uri,"/sdk-notices")?sdk_notices_start:notices_start);
    return sent==ESP_OK?ESP_FAIL:sent;
}

static void handle_command(char *line) {
    cJSON *root=cJSON_Parse(line);
    cJSON *id=cJSON_GetObjectItemCaseSensitive(root,"id");
    cJSON *protocol=cJSON_GetObjectItemCaseSensitive(root,"protocol");
    cJSON *version=cJSON_GetObjectItemCaseSensitive(root,"version");
    cJSON *command=cJSON_GetObjectItemCaseSensitive(root,"command");
    if (!cJSON_IsNumber(id) || id->valuedouble<1 || id->valuedouble>INT32_MAX || id->valuedouble!=id->valueint ||
        !cJSON_IsString(protocol) || strcmp(protocol->valuestring,"sc-esp32") || !cJSON_IsNumber(version) || version->valuedouble!=1 || !cJSON_IsString(command)) {
        cJSON_Delete(root); return;
    }
    int request_id=id->valueint;
    bool usb_access=!strcmp(command->valuestring,"config_read")||!strcmp(command->valuestring,"config_access_set");
    bool fast=!strcmp(command->valuestring,"dashboard_port")||!strcmp(command->valuestring,"hello")||!strcmp(command->valuestring,"status")||!strcmp(command->valuestring,"reset_lan_access")||!strcmp(command->valuestring,"runtime_state")||!strcmp(command->valuestring,"service_setup")||!strcmp(command->valuestring,"service_setup_status");
    bool live_operation=!strcmp(command->valuestring,"foxess_live_configure")||!strcmp(command->valuestring,"foxess_live_store");
    bool scan_operation=!strcmp(command->valuestring,"scan");
    bool network_setup=!strcmp(command->valuestring,"network_setup");
    if(!fast&&!live_operation&&!usb_access&&!scan_operation&&!network_setup&&sc_runtime_enabled()&&strcmp(command->valuestring,"reboot")){
        reply(request_id,false,NULL,"Disable ESP32 automation in the dashboard before USB network or diagnostic operations");
        wipe_json(root);cJSON_Delete(root);return;
    }
    bool locked=fast||xSemaphoreTake(network_io,pdMS_TO_TICKS(1000))==pdTRUE;
    if(!locked){reply(request_id,false,NULL,"The ESP32 worker is completing a cloud request. Retry shortly.");wipe_json(root);cJSON_Delete(root);return;}

    if (!strcmp(command->valuestring,"hello") || !strcmp(command->valuestring,"status")) reply(request_id,true,status_json(),NULL);
    else if(!strcmp(command->valuestring,"dashboard_port")) {
        const cJSON *value=cJSON_GetObjectItemCaseSensitive(root,"port");
        bool ok=cJSON_IsNumber(value)&&value->valuedouble>=1&&value->valuedouble<=65535&&
                value->valuedouble==value->valueint&&sc_dashboard_port_save((unsigned)value->valueint);
        reply(request_id,ok,ok?status_json():NULL,ok?NULL:"Port must be an integer from 1 to 65535 and storage must be available");
    }
    else if(!strcmp(command->valuestring,"reset_lan_access")) {
        const cJSON *confirmation=cJSON_GetObjectItemCaseSensitive(root,"confirmation");
        bool ok=cJSON_IsString(confirmation)&&!strcmp(confirmation->valuestring,"RESET_LAN_ACCESS")&&sc_runtime_reset_lan_access();
        reply(request_id,ok,ok?status_json():NULL,ok?NULL:"Confirm the physical-USB LAN access reset");
    }
    else if(network_setup) {
        const cJSON *confirmation=cJSON_GetObjectItemCaseSensitive(root,"confirmation");
        bool ok=cJSON_IsString(confirmation)&&!strcmp(confirmation->valuestring,"DISABLE_AUTOMATION_FOR_NETWORK_SETUP")&&sc_runtime_disable_for_setup();
        reply(request_id,ok,ok?status_json():NULL,ok?NULL:"Confirm disabling automation before network setup, or retry if settings changed");
    }
    else if(usb_access){
        cJSON *password=cJSON_GetObjectItemCaseSensitive(root,"config_password");
        const char *provided=cJSON_IsString(password)?password->valuestring:"";
        if(!strcmp(command->valuestring,"config_access_set")){
            cJSON *next=cJSON_GetObjectItemCaseSensitive(root,"new_password");
            bool ok=cJSON_IsString(next)&&sc_config_access_change(provided,next->valuestring);
            reply(request_id,ok,ok?sc_config_access_status():NULL,ok?NULL:"Password not accepted. Use 8–128 characters, or wait after repeated attempts.");
        }else if(!sc_config_access_check(provided))reply(request_id,false,NULL,"Config Password not accepted. Wait after repeated attempts, or skip reading and enter replacement settings.");
        else{
            sc_config_t copy={0};
            if(sc_load_config(&copy)!=ESP_OK)reply(request_id,false,NULL,"No saved configuration is available");
            else{
                cJSON *out=cJSON_CreateObject();
                cJSON_AddStringToObject(out,"ssid",copy.ssid);cJSON_AddStringToObject(out,"password",copy.password);
                cJSON_AddStringToObject(out,"account",copy.account);cJSON_AddStringToObject(out,"octopus_key",copy.octopus_key);
                cJSON_AddStringToObject(out,"foxess_sn",copy.foxess_sn);cJSON_AddStringToObject(out,"foxess_key",copy.foxess_key);
                cJSON_AddStringToObject(out,"ip_mode",copy.static_ip?"static":"dhcp");
                cJSON_AddStringToObject(out,"ip",copy.ip);cJSON_AddStringToObject(out,"gateway",copy.gateway);cJSON_AddStringToObject(out,"netmask",copy.netmask);cJSON_AddStringToObject(out,"dns",copy.dns);
                sc_live_config_t live={0};
                if(sc_live_load(&live)==ESP_OK){cJSON_AddStringToObject(out,"foxess_username",live.username);cJSON_AddStringToObject(out,"foxess_password_hash",live.password_hash);cJSON_AddStringToObject(out,"telemetry_mode",live.websocket?"live-ws":"rest");}
                mbedtls_platform_zeroize(&live,sizeof(live));reply(request_id,true,out,NULL);
            }
            mbedtls_platform_zeroize(&copy,sizeof(copy));
        }
    }
    else if(!strcmp(command->valuestring,"runtime_state"))reply(request_id,true,sc_runtime_state(),NULL);
    else if(!strcmp(command->valuestring,"service_setup")){
        unsigned job=0;bool ok=sc_service_setup_submit(cJSON_GetObjectItemCaseSensitive(root,"config"),&job);
        cJSON *out=ok?cJSON_CreateObject():NULL;if(out)cJSON_AddNumberToObject(out,"id",job);
        reply(request_id,ok,out,ok?NULL:"Setup is busy or the submitted fields are invalid");
    }else if(!strcmp(command->valuestring,"service_setup_status")){
        cJSON *job=cJSON_GetObjectItemCaseSensitive(root,"job_id");
        unsigned number=cJSON_IsNumber(job)&&job->valuedouble>0&&job->valuedouble<=UINT32_MAX?(unsigned)job->valuedouble:0;
        cJSON *out=sc_service_setup_status(number);reply(request_id,out!=NULL,out,out?NULL:"Setup test not found");
    }
    else if (!strcmp(command->valuestring,"foxess_live_store")) {
        cJSON *result=settings_saved?sc_live_store(cJSON_GetObjectItemCaseSensitive(root,"config")):NULL;
        reply(request_id,result!=NULL,result,result?NULL:"Save the main settings first and enter valid optional login fields");
    }
    else if (!strcmp(command->valuestring,"foxess_live_configure")) {
        if(!settings_saved||!(xEventGroupGetBits(wifi_events)&CONNECTED))reply(request_id,false,NULL,"Save the main configuration and connect Wi-Fi first");
        else{
            cJSON *result=sc_live_configure(cJSON_GetObjectItemCaseSensitive(root,"config"),&settings);
            reply(request_id,result!=NULL,result,result?NULL:"Enter a valid telemetry mode and optional FoxESS login");
        }
    }
    else if (!strcmp(command->valuestring,"scan")) {
        wifi_scan_config_t scan={.show_hidden=false};
        if (esp_wifi_scan_start(&scan,true)!=ESP_OK) reply(request_id,false,NULL,"Wi-Fi scan unavailable while connecting; try again shortly");
        else {
            wifi_ap_record_t records[24];
            uint16_t count=24;
            esp_err_t result=esp_wifi_scan_get_ap_records(&count,records);
            cJSON *networks=cJSON_CreateArray();
            if (result==ESP_OK) for (int i=0;i<count;i++) {
                cJSON *network=cJSON_CreateObject();
                char ssid[33]={0}; memcpy(ssid,records[i].ssid,32);
                cJSON_AddStringToObject(network,"ssid",ssid);
                cJSON_AddNumberToObject(network,"rssi",records[i].rssi);
                cJSON_AddStringToObject(network,"security",records[i].authmode==WIFI_AUTH_OPEN?"Open":"Secured");
                cJSON_AddItemToArray(networks,network);
            }
            reply(request_id,result==ESP_OK,networks,result==ESP_OK?NULL:"Scan failed");
        }
    } else if(!strcmp(command->valuestring,"network_info")){
        reply(request_id,true,sc_network_info(station),NULL);
    } else if(!strcmp(command->valuestring,"network_trial")){
        sc_config_t *trial=calloc(1,sizeof(*trial));
        if(sc_schedule_recovery_pending())reply(request_id,false,NULL,"Resolve schedule restoration before changing networks");
        else if(!trial||!sc_parse_network_config(cJSON_GetObjectItemCaseSensitive(root,"config"),trial)||trial->static_ip)reply(request_id,false,NULL,"Enter valid Wi-Fi settings with DHCP for this temporary test");
        else{
            provision_context_t *previous=calloc(1,sizeof(*previous));
            if(!previous)reply(request_id,false,NULL,"Not enough memory for a temporary network test");
            else{
                previous->previous=settings;previous->was_configured=configured;previous->was_saved=settings_saved;previous->was_trial=network_trial_active;
                memcpy(settings.ssid,trial->ssid,sizeof(settings.ssid));memcpy(settings.password,trial->password,sizeof(settings.password));
                settings.static_ip=false;configured=true;network_trial_active=true;
                if(start_connection()&&wait_for_wifi()){
                    cJSON *result=sc_network_info(station);cJSON_AddBoolToObject(result,"saved",false);cJSON_AddBoolToObject(result,"temporary",true);reply(request_id,true,result,NULL);
                }else{provision_restore(previous);reply(request_id,false,NULL,"Wi-Fi trial failed. Previous settings were retained.");}
                mbedtls_platform_zeroize(previous,sizeof(*previous));free(previous);
            }
        }
        if(trial){mbedtls_platform_zeroize(trial,sizeof(*trial));free(trial);}
    } else if(!strcmp(command->valuestring,"suggest_ip")){
        if(!(xEventGroupGetBits(wifi_events)&CONNECTED)||settings.static_ip)reply(request_id,false,NULL,"Connect using DHCP before requesting a fixed-IP suggestion");
        else reply(request_id,true,sc_suggest_ip(station),NULL);
    } else if (!strcmp(command->valuestring,"configure")||!strcmp(command->valuestring,"configure_network")) {
        bool network_only=!strcmp(command->valuestring,"configure_network");
        sc_config_t *next=calloc(1,sizeof(*next));
        if (!next || !sc_parse_config(cJSON_GetObjectItemCaseSensitive(root,"config"),next)) reply(request_id,false,NULL,"Invalid configuration; existing settings were retained");
        else if(sc_schedule_recovery_pending())reply(request_id,false,NULL,"Resolve schedule restoration before changing configuration");
        else if(next->static_ip&&!cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(root,"static_ip_reviewed")))reply(request_id,false,NULL,"Review the router DHCP pool before selecting a fixed IP");
        else if(!network_only&&esp_timer_get_time()<next_test_us)reply(request_id,false,NULL,"Wait for the API test cooldown before validating another configuration");
        else reply(request_id,true,validate_configuration(next,network_only),NULL);
        if (next) { mbedtls_platform_zeroize(next,sizeof(*next)); free(next); }
    } else if(!strcmp(command->valuestring,"configure_recheck")){
        if(!settings_saved||network_trial_active||sc_schedule_recovery_pending()||esp_timer_get_time()<next_test_us)reply(request_id,false,NULL,"Saved settings and an available validation slot are required");
        else{
            sc_config_t *candidate=calloc(1,sizeof(*candidate));
            if(!candidate)reply(request_id,false,NULL,"Not enough memory");
            else{*candidate=settings;reply(request_id,true,validate_configuration(candidate,false),NULL);mbedtls_platform_zeroize(candidate,sizeof(*candidate));free(candidate);}
        }
    } else if (!strcmp(command->valuestring,"schedule_inspect")) {
        if(!configured || !(xEventGroupGetBits(wifi_events)&CONNECTED) || time(NULL)<1700000000) reply(request_id,false,NULL,"Saved configuration, Wi-Fi and synchronized time are required");
        else reply(request_id,true,sc_schedule_inspect(&settings),NULL);
    } else if (!strcmp(command->valuestring,"manual_future_charge_test")) {
        cJSON *confirmation=cJSON_GetObjectItemCaseSensitive(root,"confirmation");
        cJSON *start=cJSON_GetObjectItemCaseSensitive(root,"start_minute");
        cJSON *date=cJSON_GetObjectItemCaseSensitive(root,"date");
        cJSON *ready=cJSON_GetObjectItemCaseSensitive(root,"operator_ready");
        if(!settings_saved || network_trial_active || !(xEventGroupGetBits(wifi_events)&CONNECTED) || time(NULL)<1700000000 || !cJSON_IsTrue(ready) ||
            !cJSON_IsString(confirmation) || strcmp(confirmation->valuestring,"FUTURE_CHARGE_TEST_AND_RESTORE") ||
            !cJSON_IsString(date) || !cJSON_IsNumber(start) || start->valuedouble!=start->valueint)
            reply(request_id,false,NULL,"Explicit operator readiness, future time, and test-and-restore confirmation are required");
        else reply(request_id,true,sc_schedule_manual_test(&settings,start->valueint,date->valuestring),NULL);
    } else if (!strcmp(command->valuestring,"schedule_recover")) {
        if(!configured || !(xEventGroupGetBits(wifi_events)&CONNECTED) || time(NULL)<1700000000) reply(request_id,false,NULL,"Wi-Fi and time synchronization are required");
        else reply(request_id,true,sc_schedule_recover(&settings),NULL);
    } else if (!strcmp(command->valuestring,"test")) {
        if (!settings_saved||network_trial_active) reply(request_id,false,NULL,"Validate and save configuration first");
        else if (esp_timer_get_time()<next_test_us) reply(request_id,false,NULL,"Wait at least 60 seconds before another API test");
        else {
            next_test_us=esp_timer_get_time()+60000000;
            cJSON *result=test_connections();
            int64_t minimum=esp_timer_get_time()+60000000;
            if (next_test_us<minimum) next_test_us=minimum;
            reply(request_id,true,result,NULL);
        }
    } else if (!strcmp(command->valuestring,"reboot")) {
        reply(request_id,true,NULL,NULL); vTaskDelay(pdMS_TO_TICKS(200)); esp_restart();
    } else reply(request_id,false,NULL,"Unsupported command; inverter control is unavailable");
    // Erase parsed values before freeing the command tree.
    wipe_json(root);
    if(!fast)xSemaphoreGive(network_io);
    cJSON_Delete(root);
}

void app_main(void) {
    esp_log_level_set("*",ESP_LOG_NONE);
    cJSON_Hooks json_hooks={.malloc_fn=json_alloc,.free_fn=free};cJSON_InitHooks(&json_hooks);
    sc_debug_init();sc_debug_http_init();
    setenv("TZ","GMT0BST,M3.5.0/1,M10.5.0",1);tzset();
    uart_config_t uart={.baud_rate=115200,.data_bits=UART_DATA_8_BITS,.parity=UART_PARITY_DISABLE,.stop_bits=UART_STOP_BITS_1,.flow_ctrl=UART_HW_FLOWCTRL_DISABLE,.source_clk=UART_SCLK_DEFAULT};
    ESP_ERROR_CHECK(uart_driver_install(UART_NUM_0,8192,0,0,NULL,0));
    ESP_ERROR_CHECK(uart_param_config(UART_NUM_0,&uart));
    // Explicitly select this board's USB-UART pins.
    ESP_ERROR_CHECK(uart_set_pin(UART_NUM_0,43,44,UART_PIN_NO_CHANGE,UART_PIN_NO_CHANGE));
    reply(0,true,cJSON_CreateString("uart_ready"),NULL);
    ESP_ERROR_CHECK(nvs_flash_init()); // Never erase user settings as an automatic recovery step.
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    wifi_events=xEventGroupCreate();
    station=esp_netif_create_default_wifi_sta();
    esp_netif_set_hostname(station,"smart-charging-esp32");
    wifi_init_config_t wifi=WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&wifi));
    ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT,ESP_EVENT_ANY_ID,wifi_event,NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT,IP_EVENT_STA_GOT_IP,wifi_event,NULL));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_start());
    configured=sc_load_config(&settings)==ESP_OK;
    settings_saved=configured;
    if (configured) start_connection();
    esp_sntp_config_t sntp=ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    sntp.start=false;
    sntp_ready=esp_netif_sntp_init(&sntp)==ESP_OK;
    if (sntp_ready && (xEventGroupGetBits(wifi_events)&CONNECTED)) esp_netif_sntp_start();
    network_io=xSemaphoreCreateMutex();
    sc_config_access_init();
    sc_runtime_init();
    sc_service_setup_init();
    sc_dashboard_port_init();
    httpd_config_t http=HTTPD_DEFAULT_CONFIG();
    http.server_port=sc_dashboard_port_active();
    http.uri_match_fn=httpd_uri_match_wildcard;
    http.stack_size=12288;
    http.max_uri_handlers=12;
    http.max_open_sockets=3;
    http.lru_purge_enable=true;
    httpd_handle_t server=NULL;
    if (httpd_start(&server,&http)==ESP_OK) {
        sc_runtime_register(server);
        httpd_uri_t licence={.uri="/licence",.method=HTTP_GET,.handler=legal_page};
        httpd_uri_t notices={.uri="/notices",.method=HTTP_GET,.handler=legal_page};
        httpd_uri_t sdk_notices={.uri="/sdk-notices",.method=HTTP_GET,.handler=legal_page};
        httpd_register_uri_handler(server,&licence);
        httpd_register_uri_handler(server,&notices);
        httpd_register_uri_handler(server,&sdk_notices);
    }
    sc_ota_init(server!=NULL);
    if(xTaskCreate(runtime_task,"sc-worker",24576,NULL,4,NULL)!=pdPASS)esp_restart();
    reply(0,true,cJSON_CreateString("setup_ready"),NULL);
    char *line=calloc(MAX_LINE+1,1);
    size_t used=0;
    bool overflow=false;
    int64_t recovery_after=esp_timer_get_time()+10000000;
    while (line) {
        if(configured && esp_timer_get_time()>=recovery_after && (xEventGroupGetBits(wifi_events)&CONNECTED) && time(NULL)>=1700000000 && sc_schedule_recovery_pending() && !sc_runtime_paused() && !sc_ota_blocks_control()){
            xSemaphoreTake(network_io,portMAX_DELAY);
            cJSON *restoration=sc_schedule_recover(&settings);
            xSemaphoreGive(network_io);
            reply(0,true,restoration,NULL);
            recovery_after=esp_timer_get_time()+120000000;
        }
        uint8_t byte;
        if (uart_read_bytes(UART_NUM_0,&byte,1,pdMS_TO_TICKS(100))!=1) continue;
        if (byte=='\n') {
            if (!overflow && used) { line[used]=0; handle_command(line); }
            mbedtls_platform_zeroize(line,MAX_LINE+1); used=0; overflow=false;
        } else if (byte!='\r') {
            if (used<MAX_LINE && !overflow) line[used++]=byte;
            else overflow=true;
        }
    }
}
