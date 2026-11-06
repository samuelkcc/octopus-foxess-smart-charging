#include "debug_log.h"
void sc_debug_problem(enum sc_debug_source source,bool failed,int code){(void)source;(void)failed;(void)code;}
// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../main/ota_update.c"
static esp_app_desc_t app={.project_name="smart_charging_esp32",.version="2.5.0"};
static esp_partition_t factory={0x10000,0x300000},slot={0x310000,0x300000},history={0x920000,0x20000};
static const esp_partition_t *running=&factory;
static int selected,aborts,ends,writes,restarts,erases,history_erases,marked,rollbacks,requests;
static bool enabled,paused=true,recovery,store_fail,corrupt,short_read,wrong_description,bad_redirect;
static int image_state;static int64_t ticks=40000000;static boot_intent_t intent;static bool has_intent;
static auto_policy_t auto_saved;static bool has_auto;
static unsigned char image[64]={0xe9,1,2,3};static char manifest_text[1024];
static esp_http_client_config_t options;static const char *payload;static size_t length,position;
const esp_app_desc_t *esp_app_get_description(void){return &app;}
void sc_runtime_after_ota(void){}
bool sc_runtime_enabled(void){return enabled;}bool sc_runtime_paused(void){return paused;}bool sc_schedule_recovery_pending(void){return recovery;}
int64_t esp_timer_get_time(void){return ticks;}
void esp_restart(void){restarts++;}
const esp_partition_t *esp_ota_get_next_update_partition(const esp_partition_t *p){(void)p;return &slot;}
const esp_partition_t *esp_ota_get_running_partition(void){return running;}
esp_err_t esp_ota_get_state_partition(const esp_partition_t *p,esp_ota_img_states_t *out){(void)p;*out=image_state;return ESP_OK;}
esp_err_t esp_ota_begin(const esp_partition_t *p,size_t size,esp_ota_handle_t *handle){assert(p==&slot&&size==64&&p!=running);*handle=1;return ESP_OK;}
esp_err_t esp_ota_write(esp_ota_handle_t h,const void *data,size_t n){assert(h==1&&data&&n);writes++;return ESP_OK;}
esp_err_t esp_ota_end(esp_ota_handle_t h){assert(h==1);ends++;return ESP_OK;}
esp_err_t esp_ota_abort(esp_ota_handle_t h){assert(h==1);aborts++;return ESP_OK;}
esp_err_t esp_ota_get_partition_description(const esp_partition_t *p,esp_app_desc_t *out){assert(p==&slot);*out=app;strcpy(out->version,wrong_description?"2.4.0":"2.5.1");return ESP_OK;}
esp_err_t esp_ota_set_boot_partition(const esp_partition_t *p){assert(p==&slot);selected++;return ESP_OK;}
esp_err_t esp_ota_mark_app_valid_cancel_rollback(void){marked++;image_state=0;return ESP_OK;}
esp_err_t esp_ota_mark_app_invalid_rollback_and_reboot(void){rollbacks++;return ESP_OK;}
const esp_partition_t *esp_partition_find_first(int type,int subtype,const char *label){assert(type==1&&subtype==0x40&&!strcmp(label,"history"));return &history;}
esp_err_t esp_partition_erase_range(const esp_partition_t *p,size_t offset,size_t size){assert(p==&history&&!offset&&size==history.size);history_erases++;return ESP_OK;}
esp_err_t nvs_flash_erase(void){erases++;has_intent=false;return ESP_OK;}
esp_err_t nvs_open(const char *ns,int mode,nvs_handle_t *h){(void)mode;assert(!strcmp(ns,"sc_ota"));*h=1;return ESP_OK;}
esp_err_t nvs_get_blob(nvs_handle_t h,const char *key,void *value,size_t *size){(void)h;if(!strcmp(key,"auto_check")){if(!has_auto)return ESP_ERR_NVS_NOT_FOUND;assert(*size==sizeof(auto_saved));memcpy(value,&auto_saved,*size);return ESP_OK;}assert(!strcmp(key,"intent"));if(!has_intent)return ESP_ERR_NVS_NOT_FOUND;assert(*size==sizeof(intent));memcpy(value,&intent,*size);return ESP_OK;}
esp_err_t nvs_set_blob(nvs_handle_t h,const char *key,const void *value,size_t size){(void)h;if(!strcmp(key,"auto_check")){if(store_fail)return ESP_FAIL;assert(size==sizeof(auto_saved));memcpy(&auto_saved,value,size);has_auto=true;return ESP_OK;}assert(!strcmp(key,"intent")&&size==sizeof(intent));if(store_fail)return ESP_FAIL;memcpy(&intent,value,size);has_intent=true;return ESP_OK;}
esp_err_t nvs_commit(nvs_handle_t h){(void)h;return ESP_OK;}
void nvs_close(nvs_handle_t h){(void)h;}
esp_err_t nvs_erase_key(nvs_handle_t h,const char *key){(void)h;(void)key;has_intent=false;return ESP_OK;}
esp_http_client_handle_t esp_http_client_init(const esp_http_client_config_t *config){assert(sc_ota_url_allowed(config->url)&&config->disable_auto_redirect&&config->crt_bundle_attach);options=*config;requests++;payload=strstr(config->url,"ota.json")?manifest_text:(const char *)image;length=payload==manifest_text?strlen(payload):64;position=0;return (void *)1;}
esp_err_t esp_http_client_open(esp_http_client_handle_t c,int n){(void)c;assert(!n);return ESP_OK;}
int64_t esp_http_client_fetch_headers(esp_http_client_handle_t c){(void)c;if(bad_redirect){esp_http_client_event_t event={.event_id=HTTP_EVENT_ON_HEADER,.header_key="Location",.header_value="http://attacker.invalid/firmware",.user_data=options.user_data};headers_event(&event);}return length;}
int esp_http_client_get_status_code(esp_http_client_handle_t c){(void)c;return bad_redirect?302:200;}
int esp_http_client_read(esp_http_client_handle_t c,char *out,int capacity){(void)c;size_t limit=short_read&&payload!=manifest_text?32:length;size_t n=limit-position;if(n>(size_t)capacity)n=capacity;memcpy(out,payload+position,n);if(corrupt&&payload!=manifest_text&&n)out[0]^=1;position+=n;return (int)n;}
bool esp_http_client_is_complete_data_received(esp_http_client_handle_t c){(void)c;return position==length;}
esp_err_t esp_http_client_close(esp_http_client_handle_t c){(void)c;return ESP_OK;}
esp_err_t esp_http_client_cleanup(esp_http_client_handle_t c){(void)c;return ESP_OK;}
esp_err_t esp_http_client_set_user_data(esp_http_client_handle_t c,void *p){(void)c;options.user_data=p;return ESP_OK;}
static void request(const char *text,bool accepted){cJSON *json=cJSON_Parse(text);assert(sc_ota_submit(json)==accepted);cJSON_Delete(json);}
static void prepare_manifest(void){unsigned char digest[32];mbedtls_sha256(image,64,digest,0);char hash[65];for(int i=0;i<32;i++)snprintf(hash+i*2,3,"%02x",digest[i]);snprintf(manifest_text,sizeof(manifest_text),"{\"schema\":1,\"board\":\"ESP32-S3-N16R8\",\"version\":\"2.5.1\",\"size\":64,\"sha256\":\"%s\",\"url\":\"https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-2.5.1/SmartCharging-ESP32-Firmware-2.5.1.bin\"}",hash);}
int main(void){
 prepare_manifest();sc_ota_init(true);assert(auto_check);request("{\"action\":\"auto_settings\",\"enabled\":false}",true);sc_ota_tick(true);assert(!requests&&!writes&&!erases);
 request("{\"action\":\"install\"}",false);request("{\"action\":\"check\",\"url\":\"https://attacker.invalid\"}",false);
 request("{\"action\":\"check\"}",true);request("{\"action\":\"check\"}",false);sc_ota_tick(true);assert(manifest.size==64&&!strcmp(manifest.version,"2.5.1"));
  const char *install="{\"action\":\"install\",\"version\":\"2.5.1\",\"confirmation\":\"INSTALL_OTA_UPDATE\"}";
 enabled=true;paused=false;recovery=true;request(install,false);recovery=false;
 request("{\"action\":\"install\",\"version\":\"2.5.1\",\"confirmation\":\"INSTALL_OTA_UPDATE\",\"erase_settings\":true}",false);
 corrupt=true;request(install,true);assert(sc_ota_blocks_control()&&enabled&&!paused);sc_ota_tick(true);assert(!selected&&aborts==1&&!erases&&!sc_ota_blocks_control()&&enabled&&!paused);corrupt=false;paused=true;
 short_read=true;request(install,true);sc_ota_tick(true);assert(!selected&&aborts==2&&!erases);short_read=false;
 wrong_description=true;request(install,true);sc_ota_tick(true);assert(!selected&&!erases);wrong_description=false;
 store_fail=true;request(install,true);sc_ota_tick(true);assert(!selected&&!erases);store_fail=false;
 bad_redirect=true;request(install,true);sc_ota_tick(true);assert(!selected&&!erases);bad_redirect=false;
 request(install,true);sc_ota_tick(true);assert(selected==1&&restarts==1&&!erases&&sc_ota_blocks_control()&&paused);
 // A normal boot keeps the existing operator Pause, and holds writes until healthy.
 running=&slot;strcpy(app.version,"2.5.1");image_state=1;ticks=10000000;sc_ota_init(true);
 assert(sc_ota_blocks_control());sc_ota_tick(true);assert(sc_ota_blocks_control()&&!marked);
 ticks=40000000;sc_ota_tick(true);assert(marked==1&&!sc_ota_blocks_control()&&paused&&!erases);
 running=&factory;strcpy(app.version,"2.5.0");image_state=0;sc_ota_init(true);sc_ota_tick(true);
 // A clean intent does not erase anything until the target image proves healthy.
 request("{\"action\":\"install\",\"version\":\"2.5.1\",\"confirmation\":\"INSTALL_OTA_UPDATE\",\"erase_settings\":true,\"erase_confirmation\":\"ERASE\"}",true);sc_ota_tick(true);assert(selected==2&&!erases);
 boot_checked=false;running=&factory;confirm_boot(true);assert(!erases);
 // Repeat to retain intent for the intended target, then simulate pending verification.
 request("{\"action\":\"install\",\"version\":\"2.5.1\",\"confirmation\":\"INSTALL_OTA_UPDATE\",\"erase_settings\":true,\"erase_confirmation\":\"ERASE\"}",true);sc_ota_tick(true);
 running=&slot;strcpy(app.version,"2.5.1");image_state=1;boot_checked=false;ticks=10000000;confirm_boot(true);assert(marked==1&&!erases);
 ticks=40000000;confirm_boot(true);assert(marked==2&&erases==1&&history_erases==1);
 boot_checked=false;image_state=1;ticks=121000000;confirm_boot(false);assert(rollbacks==1);
 assert(!sc_ota_url_allowed("http://github.com/x")&&!sc_ota_url_allowed("https://github.com.attacker.invalid/x")&&!sc_ota_url_allowed("https://github.com@attacker.invalid/x"));
 cJSON *json=cJSON_Parse(manifest_text);sc_ota_manifest_t out;assert(!sc_ota_manifest_parse(json,"3.0.0",&out));cJSON_Delete(json);
 running=&factory;image_state=0;sc_ota_init(true);assert(!auto_check);int count=requests;sc_ota_tick(true);assert(requests==count);
 request("{\"action\":\"auto_settings\",\"enabled\":true}",true);sc_ota_tick(true);assert(requests==count+1&&!sc_ota_blocks_control());
 sc_ota_tick(true);assert(requests==count+1);ticks+=86399000000LL;sc_ota_tick(true);assert(requests==count+1);ticks+=1000000;sc_ota_tick(true);assert(requests==count+2&&!sc_ota_blocks_control());
 request("{\"action\":\"auto_settings\",\"enabled\":false}",true);sc_ota_init(true);ticks+=86400000000LL;sc_ota_tick(true);assert(!auto_check&&requests==count+2);
 puts("OTA mocks: persistent daily automatic checks, disabled restart behaviour, no automatic installation, strict release manifest, HTTPS allowlist, serialized admission, automatic control suspension, operator Pause preservation, recovery barrier, corrupt/truncated downloads, descriptor mismatch, storage failure, inactive-slot writes, explicit clean consent, healthy boot confirmation and rollback passed.");
}
