// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Only this serialized worker writes inactive firmware. LAN handlers enqueue work.
#include "ota_update.h"
#include "ota_policy.h"
#include "runtime.h"
#include "foxess_schedule.h"
#include "esp_app_desc.h"
#include "esp_ota_ops.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "esp_timer.h"
#include "esp_system.h"
#include "esp_partition.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "mbedtls/sha256.h"
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <stdatomic.h>
#define MANIFEST_URL "https://samuelkcc.github.io/octopus-foxess-smart-charging/esp32/firmware/ota.json"
static SemaphoreHandle_t guard;
static sc_ota_manifest_t manifest;
static int pending,progress;
static bool busy,erase_next,server_ok,boot_checked;
static _Atomic bool control_hold;
bool sc_ota_blocks_control(void){return control_hold;}
static const char *phase="idle",*message="Check GitHub for an ESP32 firmware update.";
typedef struct{uint32_t schema,address,erase;char version[24];} boot_intent_t;
static void state(const char *next,const char *text){xSemaphoreTake(guard,portMAX_DELAY);phase=next;message=text;xSemaphoreGive(guard);}
void sc_ota_init(bool ready){
 guard=xSemaphoreCreateMutex();server_ok=ready;boot_checked=false;
 const esp_partition_t *running=esp_ota_get_running_partition();esp_ota_img_states_t image_state;
 control_hold=running&&esp_ota_get_state_partition(running,&image_state)==ESP_OK&&image_state==ESP_OTA_IMG_PENDING_VERIFY;
}
static const char *string(const cJSON *o,const char *key){const cJSON *v=cJSON_GetObjectItemCaseSensitive(o,key);return cJSON_IsString(v)?v->valuestring:"";}
cJSON *sc_ota_status(void){
 cJSON *out=cJSON_CreateObject();if(!guard)return out;
 xSemaphoreTake(guard,portMAX_DELAY);
 cJSON_AddStringToObject(out,"current",esp_app_get_description()->version);cJSON_AddStringToObject(out,"version",manifest.version);
 cJSON_AddStringToObject(out,"phase",phase);cJSON_AddStringToObject(out,"status",message);cJSON_AddNumberToObject(out,"progress",progress);
 cJSON_AddBoolToObject(out,"busy",busy||pending);cJSON_AddBoolToObject(out,"available",manifest.size>0);
 cJSON_AddBoolToObject(out,"newer",manifest.size&&strcmp(manifest.version,esp_app_get_description()->version));
 xSemaphoreGive(guard);return out;
}
bool sc_ota_submit(const cJSON *request){
 if(!guard||!cJSON_IsObject(request))return false;
 const char *action=string(request,"action");bool check=!strcmp(action,"check"),install=!strcmp(action,"install");
 if(!check&&!install)return false;
 const cJSON *item;cJSON_ArrayForEach(item,request){
  if(strcmp(item->string,"action")&&(check||(strcmp(item->string,"version")&&strcmp(item->string,"confirmation")&&strcmp(item->string,"erase_settings")&&strcmp(item->string,"erase_confirmation"))))return false;
  for(const cJSON *other=item->next;other;other=other->next)if(!strcmp(item->string,other->string))return false;
 }
 const cJSON *erase_field=cJSON_GetObjectItemCaseSensitive(request,"erase_settings");
 if(erase_field&&!cJSON_IsBool(erase_field))return false;
 bool erase=cJSON_IsTrue(erase_field);
 if(install&&(sc_schedule_recovery_pending()||strcmp(string(request,"confirmation"),"INSTALL_OTA_UPDATE")||(erase&&strcmp(string(request,"erase_confirmation"),"ERASE"))))return false;
 xSemaphoreTake(guard,portMAX_DELAY);
 bool accepted=!busy&&!pending&&(!install||(manifest.size&&!strcmp(string(request,"version"),manifest.version)));
 if(accepted){if(install)control_hold=true;pending=check?1:2;erase_next=erase;phase="queued";message=check?"GitHub update check queued.":"Firmware update queued. Keep power connected.";progress=0;}
 xSemaphoreGive(guard);return accepted;
}
static esp_err_t headers_event(esp_http_client_event_t *event){
 if(event->event_id==HTTP_EVENT_ON_HEADER&&event->header_key&&event->header_value&&event->user_data&&!strcasecmp(event->header_key,"Location")){
  char *location=event->user_data;size_t n=strlen(event->header_value);if(n<=3000)memcpy(location,event->header_value,n+1);
 }
 return ESP_OK;
}
static esp_http_client_handle_t open_download(const char *start,int64_t *length){
 char *url=calloc(3001,1),*location=calloc(3001,1);if(!url||!location){free(url);free(location);return NULL;}strcpy(url,start);
 esp_http_client_handle_t client=NULL;
 for(unsigned i=0;i<5&&sc_ota_url_allowed(url);i++){
  location[0]=0;esp_http_client_config_t config={.url=url,.timeout_ms=15000,.crt_bundle_attach=esp_crt_bundle_attach,.disable_auto_redirect=true,.event_handler=headers_event,.user_data=location,.buffer_size=2048,.buffer_size_tx=4096,.user_agent="SmartCharging-ESP32-OTA"};
  client=esp_http_client_init(&config);if(!client)break;
  if(esp_http_client_open(client,0)!=ESP_OK){esp_http_client_cleanup(client);client=NULL;break;}
  *length=esp_http_client_fetch_headers(client);int code=esp_http_client_get_status_code(client);
  if(code==200)break;
  esp_http_client_close(client);esp_http_client_cleanup(client);client=NULL;
  if(code<300||code>399||!sc_ota_url_allowed(location))break;
  strcpy(url,location);
 }
 // HTTP header callbacks occur only during fetch_headers, before these buffers are freed.
 if(client)esp_http_client_set_user_data(client,NULL);
 free(url);free(location);return client;
}
static void close_download(esp_http_client_handle_t client){esp_http_client_close(client);esp_http_client_cleanup(client);}
static bool check_release(void){
 int64_t length=0;esp_http_client_handle_t client=open_download(MANIFEST_URL,&length);if(!client)return false;
 char bytes[1537];int used=0,got=0;bool ok=length<=1536;
 while(ok&&(got=esp_http_client_read(client,bytes+used,1536-used))>0){used+=got;if(used==1536){ok=false;break;}}
 ok=ok&&got>=0&&esp_http_client_is_complete_data_received(client);close_download(client);bytes[used]=0;
 cJSON *json=ok?cJSON_Parse(bytes):NULL;sc_ota_manifest_t candidate;
 ok=sc_ota_manifest_parse(json,esp_app_get_description()->version,&candidate);cJSON_Delete(json);
 xSemaphoreTake(guard,portMAX_DELAY);if(ok)manifest=candidate;else memset(&manifest,0,sizeof(manifest));xSemaphoreGive(guard);return ok;
}
static bool intent_save(const esp_partition_t *target,bool erase){
 boot_intent_t value={.schema=1,.address=target->address,.erase=erase};strcpy(value.version,manifest.version);
 nvs_handle_t h;if(nvs_open("sc_ota",NVS_READWRITE,&h)!=ESP_OK)return false;
 bool ok=nvs_set_blob(h,"intent",&value,sizeof(value))==ESP_OK&&nvs_commit(h)==ESP_OK;nvs_close(h);return ok;
}
static bool install_release(bool erase){
 const esp_partition_t *target=esp_ota_get_next_update_partition(NULL),*running=esp_ota_get_running_partition();
 if(!target||!running||target->address==running->address||manifest.size>target->size)return false;
 int64_t length=0;esp_http_client_handle_t client=open_download(manifest.url,&length);if(!client)return false;
 bool ok=length<0||(size_t)length==manifest.size;esp_ota_handle_t handle=0;bool begun=false;
 if(ok){ok=esp_ota_begin(target,manifest.size,&handle)==ESP_OK;begun=ok;}
 mbedtls_sha256_context hash;mbedtls_sha256_init(&hash);if(ok)ok=mbedtls_sha256_starts(&hash,0)==0;
 unsigned char *buffer=malloc(4096),digest[32]={0};size_t received=0;int got=0;
 if(!buffer)ok=false;
 while(ok&&(got=esp_http_client_read(client,(char *)buffer,4096))>0){
  if(received+(size_t)got>manifest.size){ok=false;break;}
  ok=mbedtls_sha256_update(&hash,buffer,got)==0&&esp_ota_write(handle,buffer,got)==ESP_OK;received+=got;
  xSemaphoreTake(guard,portMAX_DELAY);progress=(int)(received*100/manifest.size);xSemaphoreGive(guard);
 }
 ok=ok&&got>=0&&received==manifest.size&&esp_http_client_is_complete_data_received(client)&&mbedtls_sha256_finish(&hash,digest)==0;
 char actual[65];for(unsigned i=0;i<32;i++)snprintf(actual+2*i,3,"%02x",digest[i]);ok=ok&&!strcmp(actual,manifest.sha256);
 mbedtls_sha256_free(&hash);free(buffer);close_download(client);
 if(begun){if(ok)ok=esp_ota_end(handle)==ESP_OK;else esp_ota_abort(handle);}
 esp_app_desc_t description;if(ok)ok=esp_ota_get_partition_description(target,&description)==ESP_OK&&!strcmp(description.project_name,"smart_charging_esp32")&&!strcmp(description.version,manifest.version);
 if(ok)ok=intent_save(target,erase)&&esp_ota_set_boot_partition(target)==ESP_OK;
 return ok;
}
static void confirm_boot(bool online){
 if(boot_checked)return;
 const esp_partition_t *running=esp_ota_get_running_partition();esp_ota_img_states_t image_state;
 bool unconfirmed=running&&esp_ota_get_state_partition(running,&image_state)==ESP_OK&&image_state==ESP_OTA_IMG_PENDING_VERIFY;
 if(unconfirmed){
  int64_t age=esp_timer_get_time();if(!server_ok||!online||age<30000000){if(age>=120000000)esp_ota_mark_app_invalid_rollback_and_reboot();return;}
  if(esp_ota_mark_app_valid_cancel_rollback()!=ESP_OK)return;
 }
 boot_checked=true;nvs_handle_t h;boot_intent_t intent={0};size_t size=sizeof(intent);
 if(nvs_open("sc_ota",NVS_READWRITE,&h)!=ESP_OK){control_hold=false;return;}
 bool clean=nvs_get_blob(h,"intent",&intent,&size)==ESP_OK&&size==sizeof(intent)&&intent.schema==1&&intent.erase==1&&memchr(intent.version,0,sizeof(intent.version))&&running&&intent.address==running->address&&!strcmp(intent.version,esp_app_get_description()->version);
 if(!clean){nvs_erase_key(h,"intent");nvs_commit(h);nvs_close(h);if(!busy&&!pending)control_hold=false;return;}
 nvs_close(h);
 // Explicit Clean OTA only. Rollback boots do not match the intended image and never erase settings.
 const esp_partition_t *history=esp_partition_find_first(ESP_PARTITION_TYPE_DATA,0x40,"history");
 if(history&&esp_partition_erase_range(history,0,history->size)!=ESP_OK){state("error","Firmware updated, but History reset failed. Use USB setup.");return;}
 if(nvs_flash_erase()!=ESP_OK){state("error","Firmware updated, but settings reset failed. Use USB setup.");return;}
 esp_restart();
}
void sc_ota_tick(bool online){
 if(!guard)return;
 confirm_boot(online);
 xSemaphoreTake(guard,portMAX_DELAY);int action=pending;bool erase=erase_next;pending=0;if(action)busy=true;xSemaphoreGive(guard);
 if(!action)return;
 if(!online){state("error","Connect Wi-Fi and synchronize the clock before updating.");goto done;}
 if(action==1){state("checking","Checking the project firmware manifest on GitHub…");bool ok=check_release();state(ok?"ready":"error",ok?"Firmware details verified. Automation will suspend automatically during installation.":"GitHub update check failed. Retry later; current firmware is unchanged.");}
 else{
  if(sc_schedule_recovery_pending()){state("error","Resolve schedule recovery before updating.");goto done;}
  state("updating","Downloading and verifying inactive firmware. Keep power connected.");
  if(install_release(erase)){state("restarting",erase?"Verified. Restarting, then clearing settings. USB setup will be required.":"Verified. Restarting with existing settings. Reconnect shortly.");vTaskDelay(pdMS_TO_TICKS(2000));esp_restart();}
  else state("error","Update failed verification or storage. Current firmware remains selected.");
 }
 done:xSemaphoreTake(guard,portMAX_DELAY);busy=false;if(action==2&&strcmp(phase,"restarting")){sc_runtime_after_ota();control_hold=false;}xSemaphoreGive(guard);
}
