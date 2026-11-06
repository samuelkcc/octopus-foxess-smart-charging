#include "debug_log.h"
void sc_debug_problem(enum sc_debug_source source,bool failed,int code){(void)source;(void)failed;(void)code;}
// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "nvs.h"
#include "runtime.h"

#include "foxess_live.h"
void sc_live_init(void){}
void sc_live_poll(const sc_config_t *device,bool online){(void)device;(void)online;}
cJSON *sc_live_reading(void){return NULL;}
cJSON *sc_service_setup_health(void){return cJSON_CreateObject();}
cJSON *sc_live_status(void){return cJSON_Parse("{\"mode\":\"rest\",\"configured\":false,\"source\":\"rest\",\"status\":\"REST selected\"}");}
bool sc_live_set_mode(const char *mode){return mode&&!strcmp(mode,"rest");}
#include "history_store.h"
static bool ota_held;
bool sc_ota_blocks_control(void){return ota_held;}
static bool flash_present;
static unsigned flash_writes, flash_erases;
static unsigned char flash_memory[0x20000];
size_t sc_history_flash_size(void){return flash_present?sizeof(flash_memory):0;}
bool sc_history_flash_read(size_t o,void *d,size_t n){assert(o+n<=sizeof(flash_memory));memcpy(d,flash_memory+o,n);return true;}
bool sc_history_flash_write(size_t o,const void *d,size_t n){assert(o+n<=sizeof(flash_memory));memcpy(flash_memory+o,d,n);flash_writes++;return true;}
bool sc_history_flash_erase(size_t o,size_t n){assert(o+n<=sizeof(flash_memory));memset(flash_memory+o,0xff,n);flash_erases++;return true;}
#include "automation_policy.h"
static time_t wall;
static int64_t ticks;
static int writes,reads,octopus_reads,telemetry_reads,tariff_reads;
static double mock_soc=65;
static bool rule_store_failure;
static bool invalid_dispatch,limited,intent_failure,bad_readback,revise_on_write,fixed_tariff,mirror_mode;
static bool delayed_confirm;static unsigned stale_reads;
static int day_reads,night_reads;static int64_t last_octopus_read=-60000000;
static bool device_error, expired_token; static int device_reads,auth_reads;
static cJSON *inverter,*new_dispatch;
static char *stored_rules,*stored_intent,*stored_manual;
time_t sc_test_time(time_t *out){if(out)*out=wall;return wall;}
int64_t esp_timer_get_time(void){return ticks;}
esp_err_t nvs_open(const char *name,int mode,nvs_handle_t *handle){(void)name;(void)mode;*handle=1;return ESP_OK;}
static char **slot(const char *key){return !strcmp(key,"rules")?&stored_rules:!strcmp(key,"intent")?&stored_intent:&stored_manual;}
esp_err_t nvs_get_str(nvs_handle_t h,const char *key,char *out,size_t *size){(void)h;char *value=*slot(key);if(!value)return ESP_ERR_NVS_NOT_FOUND;if(out){if(*size<strlen(value)+1)return ESP_FAIL;strcpy(out,value);}*size=strlen(value)+1;return ESP_OK;}
esp_err_t nvs_set_str(nvs_handle_t h,const char *key,const char *value){(void)h;if(rule_store_failure&&!strcmp(key,"rules"))return ESP_FAIL;if(intent_failure&&!strcmp(key,"intent"))return ESP_FAIL;free(*slot(key));*slot(key)=strdup(value);return ESP_OK;}
esp_err_t nvs_erase_key(nvs_handle_t h,const char *key){(void)h;free(*slot(key));*slot(key)=NULL;return ESP_OK;}
esp_err_t nvs_commit(nvs_handle_t h){(void)h;return ESP_OK;}
void nvs_close(nvs_handle_t h){(void)h;}
bool sc_schedule_recovery_pending(void){return false;}
cJSON *sc_schedule_read(const sc_config_t *config,int *http){(void)config;reads++;*http=200;if((bad_readback&&writes)||stale_reads){if(stale_reads)stale_reads--;return cJSON_CreateArray();}return cJSON_Duplicate(inverter,true);}
bool sc_schedule_program(const sc_config_t *config,const cJSON *groups,int *http){(void)config;assert(stored_intent&&"Durable intent required before any write");assert(!sc_runtime_paused());assert(cJSON_GetArraySize(groups)<=5);writes++;if(delayed_confirm)stale_reads=2;*http=200;cJSON_Delete(inverter);inverter=cJSON_Duplicate(groups,true);if(revise_on_write){revise_on_write=false;cJSON *state=sc_runtime_state();cJSON *rules=cJSON_Duplicate(cJSON_GetObjectItem(state,"rules"),true);cJSON_SetNumberValue(cJSON_GetObjectItem(rules,"dispatch_soc"),80);cJSON_SetBoolValue(cJSON_GetObjectItem(rules,"dispatch_soc_enabled"),true);assert(sc_runtime_update(rules));cJSON_Delete(rules);cJSON_Delete(state);}return true;}
cJSON *sc_cloud_read(const sc_config_t *config,bool fox,const char *path,const cJSON *body,const char *token,int *http,int *retry){(void)config;(void)token;*http=200;*retry=0;
 if(fox){telemetry_reads++;cJSON *out=cJSON_Parse("{\"errno\":0,\"result\":[{\"datas\":[{\"variable\":\"SoC\",\"value\":65},{\"variable\":\"pvPower\",\"value\":0},{\"variable\":\"loadsPower\",\"value\":0.5}]}]}");cJSON_SetNumberValue(cJSON_GetObjectItem(cJSON_GetArrayItem(cJSON_GetObjectItem(cJSON_GetArrayItem(cJSON_GetObjectItem(out,"result"),0),"datas"),0),"value"),mock_soc);return out;}
 assert(ticks-last_octopus_read>=60000000);last_octopus_read=ticks;octopus_reads++;if(limited){*http=429;*retry=900;return cJSON_CreateObject();}
 const cJSON *query=cJSON_GetObjectItem(body,"query");
 if(cJSON_IsString(query)&&strstr(query->valuestring,"obtainKrakenToken")){auth_reads++;expired_token=false;return cJSON_Parse("{\"data\":{\"obtainKrakenToken\":{\"token\":\"test-token-not-a-real-key\"}}}");}
 if(cJSON_IsString(query)&&expired_token)return cJSON_Parse("{\"errors\":[{\"extensions\":{\"errorCode\":\"KT-CT-1124\"},\"message\":\"Signature has expired\"}],\"data\":null}");
 if(cJSON_IsString(query)&&strstr(query->valuestring,"getDeviceDetails")){device_reads++;if(device_error)return cJSON_Parse("{\"data\":null,\"errors\":[{\"message\":\"private failure\"}]}");return cJSON_Parse("{\"data\":{\"registeredKrakenflexDevice\":{\"provider\":\"OHME\",\"vehicleMake\":\"Peugeot\",\"vehicleModel\":\"e-5008\",\"chargePointMake\":\"Ohme\",\"chargePointModel\":\"home pro\",\"status\":\"LIVE\",\"secret\":\"must-not-publish\"},\"vehicleChargingPreferences\":{\"weekdayTargetTime\":\"08:46\",\"weekdayTargetSoc\":80},\"address\":\"must-not-publish\"}}");}
 if(cJSON_IsString(query)){if(invalid_dispatch)return cJSON_Parse("{\"data\":{\"plannedDispatches\":null},\"errors\":[{\"message\":\"secret raw message\"}]}");cJSON *out=cJSON_CreateObject();cJSON_AddItemToObject(cJSON_AddObjectToObject(out,"data"),"plannedDispatches",cJSON_Duplicate(new_dispatch,true));return out;}
 if(strstr(path,"accounts")){if(mirror_mode)return cJSON_Parse("{\"properties\":[{\"electricity_meter_points\":[{\"is_export\":false,\"agreements\":[{\"tariff_code\":\"E-1R-TEST-IMPORT-A\",\"valid_from\":\"2020-01-01T00:00:00Z\",\"valid_to\":null}]},{\"is_export\":true,\"agreements\":[{\"tariff_code\":\"E-1R-TEST-EXPORT-A\",\"valid_from\":\"2020-01-01T00:00:00Z\",\"valid_to\":null}]}]}]}");if(fixed_tariff)return cJSON_Parse("{\"properties\":[{\"electricity_meter_points\":[{\"is_export\":false,\"agreements\":[{\"tariff_code\":\"E-1R-IOG-FIX-26-10-01-A\",\"valid_from\":\"2026-01-01T00:00:00Z\",\"valid_to\":null}]}]}]}");return cJSON_Parse("{\"properties\":[{\"electricity_meter_points\":[{\"is_export\":false,\"agreements\":[{\"tariff_code\":\"E-1R-TEST-IMPORT-A\",\"valid_from\":\"2020-01-01T00:00:00Z\",\"valid_to\":null}]}]}]}");
 }
 if(fixed_tariff&&strstr(path,"/day-unit-rates/")){assert(strstr(path,"period_from=2026-11-05T00:00:00Z"));day_reads++;return cJSON_Parse("{\"results\":[{\"valid_from\":\"2026-01-01T00:00:00Z\",\"valid_to\":null,\"value_inc_vat\":30}]}");}
 if(fixed_tariff&&strstr(path,"/night-unit-rates/")){night_reads++;return cJSON_Parse("{\"results\":[{\"valid_from\":\"2026-01-01T00:00:00Z\",\"valid_to\":null,\"value_inc_vat\":7}]}");}
 tariff_reads++;if(mirror_mode)return cJSON_Parse("{\"results\":[{\"valid_from\":\"2026-01-01T00:00:00Z\",\"valid_to\":null,\"value_inc_vat\":12}]}");return cJSON_Parse("{\"results\":[]}");
}
static void step(int seconds){wall+=seconds;ticks+=(int64_t)seconds*1000000;sc_config_t config={0};strcpy(config.account,"A-TEST");sc_runtime_tick(&config,true);}
static cJSON *rules(void){cJSON *s=sc_runtime_state(),*r=cJSON_Duplicate(cJSON_GetObjectItem(s,"rules"),true);cJSON_Delete(s);return r;}
int main(int argc,char **argv){fixed_tariff=argc>1&&!strcmp(argv[1],"fixed");setenv("TZ","GMT0BST,M3.5.0/1,M10.5.0",1);tzset();wall=sc_timestamp("2026-11-05T12:00:00Z");inverter=cJSON_CreateArray();new_dispatch=cJSON_Parse("[{\"startDt\":\"2026-11-05T14:00:00Z\",\"endDt\":\"2026-11-05T14:30:00Z\"}]");bool history_mode=argc>1&&!strcmp(argv[1],"history");
 if(history_mode){flash_present=true;memset(flash_memory,0xff,sizeof(flash_memory));}
 bool legacy_mode=argc>1&&!strcmp(argv[1],"legacy");
 if(legacy_mode){cJSON *old=sc_rules_default();cJSON_DeleteItemFromObjectCaseSensitive(old,"charge_soc_enabled");cJSON_DeleteItemFromObjectCaseSensitive(old,"history_flash_enabled");cJSON_DeleteItemFromObjectCaseSensitive(old,"pause_discharge_dispatch");cJSON_DeleteItemFromObjectCaseSensitive(old,"discharge_overrides_charge");cJSON_SetBoolValue(cJSON_GetObjectItem(old,"enabled"),true);cJSON_SetBoolValue(cJSON_GetObjectItem(old,"paused"),true);cJSON_SetNumberValue(cJSON_GetObjectItem(old,"history_days"),90);stored_rules=cJSON_PrintUnformatted(old);cJSON_Delete(old);}
 mirror_mode=argc>1&&!strcmp(argv[1],"mirror");
 bool deployment_mode=argc>1&&!strcmp(argv[1],"deployment");
 if(!legacy_mode&&!deployment_mode){cJSON *r=sc_rules_default();stored_rules=cJSON_PrintUnformatted(r);cJSON_Delete(r);}
 sc_runtime_init();assert(!sc_runtime_claim_octopus_setup());
 if(deployment_mode){
  sc_config_t c={0};strcpy(c.account,"A-TEST");
  sc_runtime_tick(&c,false);assert(!sc_runtime_enabled()&&!writes&&!stored_rules);
  ticks+=5000000;rule_store_failure=true;sc_runtime_tick(&c,true);assert(!sc_runtime_enabled()&&!writes&&!stored_rules);
  ticks+=60000000;rule_store_failure=false;sc_runtime_tick(&c,true);assert(sc_runtime_enabled()&&stored_rules&&!writes);
  cJSON *r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"paused"),true);assert(sc_runtime_update(r));cJSON_Delete(r);
  sc_runtime_init();assert(sc_runtime_enabled()&&sc_runtime_paused());
  r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"enabled"),false);assert(sc_runtime_update(r));cJSON_Delete(r);
  sc_runtime_init();step(60);assert(!sc_runtime_enabled()&&sc_runtime_paused()&&!writes);
  puts("First deployment: no activation before network save, persistent activation, storage retry, reboot and existing disabled/Pause preservation passed.");return 0;
 }

 if(argc>1&&!strcmp(argv[1],"resume")){
  wall=sc_timestamp("2026-11-06T02:00:00Z");cJSON_Delete(new_dispatch);new_dispatch=cJSON_CreateArray();
  cJSON *r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"enabled"),true);cJSON_SetBoolValue(cJSON_GetObjectItem(r,"weekly_charge"),true);cJSON_SetBoolValue(cJSON_GetObjectItem(r,"auto_resume"),true);cJSON_SetBoolValue(cJSON_GetObjectItem(r,"charge_soc_enabled"),true);cJSON_SetNumberValue(cJSON_GetObjectItem(r,"target_soc"),60);assert(sc_runtime_update(r));cJSON_Delete(r);
  for(int i=0;i<36;i++)step(5);
  assert(cJSON_GetArraySize(inverter)==1&&cJSON_GetObjectItem(cJSON_GetArrayItem(inverter,0),"startHour")->valueint==23);
  mock_soc=59;assert(sc_runtime_request_refresh("foxess"));step(5);step(60);
  assert(cJSON_GetArraySize(inverter)==1&&"Falling fresh SOC must not restart the fulfilled charge");
  r=rules();cJSON_SetNumberValue(cJSON_GetObjectItem(r,"history_days"),30);assert(sc_runtime_update(r));cJSON_Delete(r);step(60);
  assert(cJSON_GetArraySize(inverter)==1&&"General settings must retain completion memory");
  r=rules();cJSON_SetNumberValue(cJSON_GetObjectItem(r,"target_soc"),70);assert(sc_runtime_update(r));cJSON_Delete(r);step(60);
  assert(cJSON_GetArraySize(inverter)==2&&"Changed control rules must clear completion memory");
  puts("Worker Auto-Resume: fresh target reading, falling SOC, General settings retention and deliberate control-rule reset passed.");return 0;
 }
 if(argc>1&&!strcmp(argv[1],"delayed-confirm")){
  step(1);step(60);delayed_confirm=true;
  cJSON *r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"enabled"),true);cJSON_SetBoolValue(cJSON_GetObjectItem(r,"weekly_charge"),true);assert(sc_runtime_update(r));cJSON_Delete(r);
  step(60);cJSON *s=sc_runtime_state();assert(writes==1&&cJSON_IsTrue(cJSON_GetObjectItem(s,"confirmed")));
  assert(cJSON_GetObjectItem(s,"schedule_read_attempts")->valueint==3);assert(cJSON_IsTrue(cJSON_GetObjectItem(s,"schedule_write_accepted")));assert(cJSON_GetObjectItem(s,"rules")&&wall-sc_timestamp("2026-11-05T12:00:00Z")<600);cJSON_Delete(s);
  puts("Rule commit: one write, two stale official responses, third fresh confirmation; independent of 600-second telemetry interval.");return 0;
 }
 if(argc>1&&!strcmp(argv[1],"startup-schedule")){
  cJSON_Delete(inverter);inverter=cJSON_Parse("[{\"enable\":1,\"startHour\":23,\"startMinute\":30,\"endHour\":23,\"endMinute\":59,\"workMode\":\"ForceCharge\"},{\"enable\":1,\"startHour\":0,\"startMinute\":0,\"endHour\":5,\"endMinute\":30,\"workMode\":\"ForceCharge\"}]");
  cJSON *r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"enabled"),true);assert(sc_runtime_update(r));cJSON_Delete(r);
  step(1);step(5);cJSON *s=sc_runtime_state();assert(!octopus_reads&&!writes&&reads>0);assert(!cJSON_IsTrue(cJSON_GetObjectItem(s,"dispatch_valid")));assert(cJSON_GetArraySize(cJSON_GetObjectItem(s,"groups"))==2);assert(cJSON_GetObjectItem(s,"schedule_at")->valuedouble>0);cJSON_Delete(s);
  puts("Startup schedule monitoring reads FoxESS independently before the first Octopus request, without writing or claiming confirmation.");return 0;
 }
 if(mirror_mode){
  // Real five-second worker cadence; multiple dashboards only read published RAM.
  for(int i=0;i<180;i++)step(5);
  cJSON *before=sc_runtime_state();
  assert(cJSON_GetArraySize(cJSON_GetObjectItem(before,"import_rates"))>0);
  assert(cJSON_GetArraySize(cJSON_GetObjectItem(before,"export_rates"))>0);
  assert(cJSON_GetObjectItem(before,"import_rates_at")->valuedouble>0);
  assert(cJSON_GetObjectItem(before,"export_rates_at")->valuedouble>0);
  int old_oct=octopus_reads,old_fox=telemetry_reads,old_reads=reads;
  for(int i=0;i<100;i++){
   cJSON *snapshot=sc_runtime_state(),*account=sc_runtime_account(),*history=sc_runtime_history(14);
   assert(cJSON_Compare(cJSON_GetObjectItem(before,"import_rates"),cJSON_GetObjectItem(snapshot,"import_rates"),true));
   assert(cJSON_Compare(cJSON_GetObjectItem(before,"export_rates"),cJSON_GetObjectItem(snapshot,"export_rates"),true));
   // A client receives its own JSON copy, never ownership of the worker cache.
   cJSON_DeleteItemFromObjectCaseSensitive(snapshot,"import_rates");
   cJSON_Delete(snapshot);cJSON_Delete(account);cJSON_Delete(history);
  }
  assert(octopus_reads==old_oct&&telemetry_reads==old_fox&&reads==old_reads&&!writes);
  limited=true;step(600);cJSON *after=sc_runtime_state();
  assert(cJSON_Compare(cJSON_GetObjectItem(before,"import_rates"),cJSON_GetObjectItem(after,"import_rates"),true));
  assert(cJSON_Compare(cJSON_GetObjectItem(before,"export_rates"),cJSON_GetObjectItem(after,"export_rates"),true));
  cJSON_Delete(before);cJSON_Delete(after);
  puts("Multiple dashboards mirror independent RAM snapshots: 100 state/account/history reads cause zero cloud requests or schedule writes; 429 retains both tariff caches.");return 0;
 }
 if(argc>1&&!strcmp(argv[1],"ota-hold")){
  cJSON *r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"enabled"),true);assert(sc_runtime_update(r));cJSON_Delete(r);
  ota_held=true;for(int i=0;i<36;i++)step(5);assert(!writes&&sc_runtime_enabled()&&!sc_runtime_paused());
  sc_runtime_after_ota();ota_held=false;step(60);assert(writes==1);
  puts("OTA hold blocks schedule writes without changing persisted operator state; fresh dispatch resumes control.");return 0;
 }
 if(argc>1&&!strcmp(argv[1],"setup-budget")){
  ticks+=60000000;wall+=60;assert(sc_runtime_claim_octopus_setup());assert(!sc_runtime_claim_octopus_setup());
  step(5);assert(!octopus_reads);sc_runtime_octopus_setup_result(429,900);step(60);assert(!octopus_reads);step(840);assert(octopus_reads==1);
  puts("Octopus setup and worker share restart spacing, one reservation and Retry-After cooldown; all mocked Octopus sends remain at least 60 seconds apart.");return 0;
 }

 if(argc>1&&!strcmp(argv[1],"network-setup")){
  cJSON *r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"enabled"),true);cJSON_SetBoolValue(cJSON_GetObjectItem(r,"paused"),true);assert(sc_runtime_update(r));
  cJSON_SetBoolValue(cJSON_GetObjectItem(r,"enabled"),false);
  int previous_writes=writes;assert(sc_runtime_disable_for_setup());assert(!sc_runtime_enabled());assert(sc_runtime_paused());
  cJSON *after=rules();assert(cJSON_Compare(r,after,true));cJSON_Delete(after);cJSON_Delete(r);
  step(120);assert(writes==previous_writes);assert(stored_rules);cJSON *saved=cJSON_Parse(stored_rules);assert(cJSON_IsFalse(cJSON_GetObjectItem(saved,"enabled")));cJSON_Delete(saved);
  puts("USB network setup disables only enablement, preserves Pause/rules, persists and blocks schedule writes.");return 0;
 }
 if(legacy_mode){cJSON *r=rules();assert(cJSON_IsTrue(cJSON_GetObjectItem(r,"enabled")));assert(cJSON_IsTrue(cJSON_GetObjectItem(r,"paused")));assert(cJSON_IsFalse(cJSON_GetObjectItem(r,"history_flash_enabled")));assert(cJSON_GetObjectItem(r,"history_days")->valueint==60);cJSON_Delete(r);assert(!flash_writes&&!flash_erases);puts("Legacy rules migrated without resetting automation or Pause; new History saving remains off.");return 0;}
 if(argc>1&&!strcmp(argv[1],"timestamp")){
  cJSON_Delete(new_dispatch);new_dispatch=cJSON_Parse("[{\"startDt\":\"2026-11-06 03:30:00+00:00\",\"endDt\":\"2026-11-06 04:00:00+00:00\"},{\"startDt\":\"2026-11-06 05:00:00+00:00\",\"endDt\":\"2026-11-06 05:26:00+00:00\"}]");
  step(1);step(60);step(60);cJSON *s=sc_runtime_state();assert(cJSON_IsTrue(cJSON_GetObjectItem(s,"dispatch_valid")));const cJSON *rows=cJSON_GetObjectItem(s,"dispatches");assert(cJSON_GetArraySize(rows)==2);assert(!strcmp(cJSON_GetObjectItem(cJSON_GetArrayItem(rows,0),"startDt")->valuestring,"2026-11-06T03:30:00+00:00"));assert(!writes);cJSON_Delete(s);
  puts("Live Kraken timestamp regression: SQL-style UTC offsets accepted; both charging windows retained and canonical ISO sent to browsers.");return 0;
 }
 if(argc>1&&!strcmp(argv[1],"refresh")){
  for(int i=0;i<5;i++)step(60);
  cJSON *r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"paused"),true);cJSON_SetNumberValue(cJSON_GetObjectItem(r,"octopus_seconds"),3600);assert(sc_runtime_update(r));cJSON_Delete(r);
  int old_oct=octopus_reads,old_fox=telemetry_reads,old_reads=reads;
  assert(!sc_runtime_request_refresh("unknown"));assert(sc_runtime_request_refresh("octopus"));
  step(5);assert(octopus_reads==old_oct&&telemetry_reads>old_fox);step(55);assert(octopus_reads>old_oct);step(5);assert(reads>old_reads&&!writes&&sc_runtime_paused());
  expired_token=true;assert(sc_runtime_request_refresh("foxess"));step(60);cJSON *s=sc_runtime_state();assert(!cJSON_IsTrue(cJSON_GetObjectItem(s,"dispatch_valid")));assert(cJSON_IsTrue(cJSON_GetObjectItem(s,"octopus_fault")));assert(cJSON_GetArraySize(cJSON_GetObjectItem(s,"dispatches"))==1);assert(!strcmp(cJSON_GetObjectItem(s,"dispatch_error_code")->valuestring,"KT-CT-1124"));cJSON_Delete(s);
  int old_auth=auth_reads;assert(sc_runtime_request_refresh("octopus"));step(60);assert(auth_reads>old_auth);assert(sc_runtime_request_refresh("octopus"));step(60);s=sc_runtime_state();assert(cJSON_IsTrue(cJSON_GetObjectItem(s,"dispatch_valid")));assert(!cJSON_IsTrue(cJSON_GetObjectItem(s,"octopus_fault")));cJSON_Delete(s);
  limited=true;assert(sc_runtime_request_refresh("octopus"));step(60);old_oct=octopus_reads;assert(sc_runtime_request_refresh("octopus"));step(60);assert(octopus_reads==old_oct&&!writes&&sc_runtime_paused());
  puts("Manual API refresh: coalesced worker reads, both services and official schedule, Pause preserved, cooldown enforced, HTTP-200 expired JWT recovery retains valid dispatches.");return 0;
 }
 if(argc>1&&!strcmp(argv[1],"account")){
  for(int i=0;i<12;i++)step(60);
  assert(device_reads==1&&!writes);
  cJSON *a=sc_runtime_account();assert(!strcmp(cJSON_GetObjectItem(a,"account_number")->valuestring,"A-TEST"));
  assert(!strcmp(cJSON_GetObjectItem(a,"provider")->valuestring,"OHME"));
  assert(cJSON_GetObjectItem(a,"charge_limit")->valueint==80);
  assert(strlen(cJSON_GetObjectItem(a,"import_tariff")->valuestring)>0);
  char *json=cJSON_PrintUnformatted(a);assert(!strstr(json,"must-not-publish")&&!strstr(json,"token"));free(json);cJSON_Delete(a);
  cJSON *r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"paused"),true);assert(sc_runtime_update(r));cJSON_Delete(r);
  device_error=true;step(3600);for(int i=0;i<12;i++)step(60);
  a=sc_runtime_account();assert(cJSON_IsTrue(cJSON_GetObjectItem(a,"update_error")));
  assert(!strcmp(cJSON_GetObjectItem(a,"provider")->valuestring,"OHME"));cJSON_Delete(a);
  assert(sc_runtime_paused()&&!writes);a=sc_runtime_state();assert(cJSON_IsTrue(cJSON_GetObjectItem(a,"dispatch_valid")));assert(!cJSON_HasObjectItem(a,"account_number"));cJSON_Delete(a);
  puts("LAN account snapshot: allowlisted metadata, cached reads, optional-query failures preserve dispatches and account data; Pause retained.");return 0;
 }
 if(history_mode){
  for(int i=0;i<24;i++)step(600);
  assert(!flash_writes&&!flash_erases); // Default off, even while telemetry and RAM History change.
  cJSON *r=rules();assert(cJSON_IsFalse(cJSON_GetObjectItem(r,"history_flash_enabled")));
  cJSON_SetBoolValue(cJSON_GetObjectItem(r,"history_flash_enabled"),true);assert(sc_runtime_update(r));cJSON_Delete(r);
  step(5);step(3590);assert(!flash_writes);step(5);assert(flash_writes==2&&flash_erases==1);
  for(int i=0;i<10;i++){step(5);}
  assert(flash_writes==2);step(3545);assert(flash_writes==2);step(5);assert(flash_writes==4);
  cJSON *state=sc_runtime_state();assert(cJSON_GetObjectItem(state,"history_saved_records")->valueint==2);cJSON_Delete(state);
  r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"history_flash_enabled"),false);assert(sc_runtime_update(r));cJSON_Delete(r);step(7200);assert(flash_writes==4);
  r=rules();cJSON_SetNumberValue(cJSON_GetObjectItem(r,"history_days"),1);assert(sc_runtime_update(r));cJSON_Delete(r);step(2*86400);
  cJSON *all=sc_runtime_history(60),*point;int restored=0;cJSON_ArrayForEach(point,all){if(!strcmp(cJSON_GetObjectItem(point,"storage")->valuestring,"flash")){restored++;assert(cJSON_GetObjectItem(point,"interval_seconds")->valueint==3600);assert(cJSON_GetObjectItem(point,"solar")->valuedouble==0);assert(cJSON_GetObjectItem(point,"home")->valuedouble==.5);assert(cJSON_IsNull(cJSON_GetObjectItem(point,"grid")));}}
  assert(restored==2&&flash_writes==4);cJSON_Delete(all);
  puts("Runtime History opt-in: default zero writes, one hourly batch, no per-sample writes, disable stops writes, monitoring remains active.");return 0;
 }

 if(fixed_tariff){for(int i=0;i<12;i++)step(60);cJSON *state=sc_runtime_state(),*rates=cJSON_GetObjectItem(state,"import_rates");assert(day_reads>0&&night_reads>0&&cJSON_GetArraySize(rates)>48);assert(cJSON_GetObjectItem(cJSON_GetArrayItem(rates,0),"start")->valuedouble==sc_timestamp("2026-11-05T00:00:00Z"));bool day=false,night=false;const cJSON *rate;cJSON_ArrayForEach(rate,rates){double v=cJSON_GetObjectItem(rate,"value")->valuedouble;assert(v==7||v==30);day|=v==30;night|=v==7;}assert(day&&night);assert(!writes);cJSON_Delete(state);puts("Fixed Intelligent Octopus Go day/night fallback and non-starving dispatch queue passed.");return 0;}
 step(1);assert(writes==0&&telemetry_reads==1);step(60);assert(writes==0);
 cJSON *r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"enabled"),true);assert(sc_runtime_update(r));cJSON_Delete(r);step(60);assert(writes==1);cJSON *s=sc_runtime_state();assert(cJSON_IsTrue(cJSON_GetObjectItem(s,"confirmed")));char *safe=cJSON_PrintUnformatted(s);assert(!strstr(safe,"test-token")&&!strstr(safe,"secret raw"));free(safe);cJSON_Delete(s);
 int old_writes=writes;invalid_dispatch=true;step(60);assert(writes==old_writes);s=sc_runtime_state();assert(cJSON_GetArraySize(cJSON_GetObjectItem(s,"dispatches"))==1);cJSON_Delete(s);
 r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"paused"),true);assert(sc_runtime_update(r));cJSON_Delete(r);step(120);assert(writes==old_writes);s=sc_runtime_state();assert(strstr(cJSON_GetObjectItem(s,"control_status")->valuestring,"Paused"));cJSON_Delete(s);
 invalid_dispatch=false;r=rules();cJSON_SetBoolValue(cJSON_GetObjectItem(r,"paused"),false);cJSON_SetBoolValue(cJSON_GetObjectItem(r,"dispatch_soc_enabled"),true);cJSON_SetNumberValue(cJSON_GetObjectItem(r,"dispatch_soc"),90);assert(sc_runtime_update(r));cJSON_Delete(r);
 intent_failure=true;step(60);assert(writes==old_writes);intent_failure=false;revise_on_write=true;step(60);assert(writes==old_writes+1);s=sc_runtime_state();assert(!cJSON_IsTrue(cJSON_GetObjectItem(s,"confirmed")));assert(cJSON_GetObjectItem(s,"revision")->valueint!=cJSON_GetObjectItem(s,"confirmed_revision")->valueint);cJSON_Delete(s);
 step(5);assert(writes==old_writes+2);s=sc_runtime_state();assert(cJSON_IsTrue(cJSON_GetObjectItem(s,"confirmed")));cJSON_Delete(s);
 r=rules();cJSON_SetNumberValue(cJSON_GetObjectItem(r,"dispatch_soc"),70);assert(sc_runtime_update(r));cJSON_Delete(r);bad_readback=true;step(5);int attempted=writes;s=sc_runtime_state();assert(!cJSON_IsTrue(cJSON_GetObjectItem(s,"confirmed")));cJSON_Delete(s);step(5);assert(writes==attempted&&"Failed readback must back off rather than retrying each five-second tick");bad_readback=false;
 limited=true;int before=octopus_reads;step(120);int after=octopus_reads;assert(after>=before);step(60);assert(octopus_reads==after&&"429 cooldown applies to all Octopus operations");
 puts("ESP32 worker mock tests passed: real command path, durable intent, fresh readback, invalid dispatch preservation, persistent Pause, queued revisions, failed readback backoff, rate limiting and credential-free snapshots.");
}
