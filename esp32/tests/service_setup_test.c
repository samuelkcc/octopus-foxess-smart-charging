// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../main/service_setup.c"
static bool enabled=true,paused=false,recovery,claim=true,rate_limit;static int reads,saves;
bool sc_runtime_enabled(void){return enabled;}bool sc_runtime_paused(void){return paused;}bool sc_schedule_recovery_pending(void){return recovery;}
bool sc_runtime_claim_octopus_setup(void){return claim;}
void sc_runtime_octopus_setup_result(int status,int retry){(void)status;(void)retry;}
uint32_t esp_random(void){return 77;}
static bool save(const sc_config_t *config){assert(!strcmp(config->ssid,"original-wifi"));assert(!strcmp(config->ip,"192.168.8.188"));saves++;return true;}
bool sc_runtime_apply_services(const sc_config_t *config,sc_service_save_t callback){return (!enabled||paused)&&callback(config);}
cJSON *sc_cloud_read(const sc_config_t *config,bool fox,const char *path,const cJSON *body,const char *jwt,int *http,int *retry){(void)body;(void)jwt;reads++;*http=rate_limit?429:200;*retry=60;if(rate_limit)return NULL;if(fox){assert(!strcmp(path,"/op/v0/device/real/query"));return cJSON_Parse("{\"errno\":0,\"result\":[{}]}");}assert(!strcmp(config->account,"A-TEST"));return cJSON_Parse("{\"number\":\"A-TEST\"}");}
cJSON *sc_live_status(void){return cJSON_Parse("{\"test_stage\":\"idle\"}");}
cJSON *sc_live_configure(const cJSON *request,const sc_config_t *config){(void)request;(void)config;return cJSON_Parse("{\"saved\":true}");}
cJSON *sc_live_test(const cJSON *request,const sc_config_t *config){(void)request;(void)config;return cJSON_Parse("{\"saved\":false,\"connected\":true}");}
int main(void){
 sc_config_t config={0};strcpy(config.ssid,"original-wifi");strcpy(config.ip,"192.168.8.188");strcpy(config.account,"A-TEST");strcpy(config.octopus_key,"private-octopus-key");strcpy(config.foxess_sn,"SN-TEST");strcpy(config.foxess_key,"private-fox-key");sc_service_setup_init();
 cJSON *request=cJSON_Parse("{\"action\":\"test_octopus\",\"account\":\"A-TEST\",\"key\":\"candidate-private-key\"}");unsigned id;
 assert(sc_service_setup_submit(request,&id));assert(!sc_service_setup_submit(request,&id));char *text=cJSON_PrintUnformatted(sc_service_setup_status(id));assert(!strstr(text,"private")&&!strstr(text,"A-TEST"));free(text);
 claim=false;sc_service_setup_prepare();sc_service_setup_tick(&config,true,save);assert(!reads);claim=true;sc_service_setup_prepare();sc_service_setup_tick(&config,true,save);assert(reads==1&&!saves);
 cJSON *status=sc_service_setup_status(id);assert(!strcmp(string(status,"phase"),"done"));assert(cJSON_IsTrue(cJSON_GetObjectItem(cJSON_GetObjectItem(status,"result"),"connected")));cJSON_Delete(status);cJSON_Delete(request);
 request=cJSON_Parse("{\"action\":\"save_foxess\",\"key\":\"replacement-key\"}");cJSON *out=sc_service_setup_execute(request,&config,save);assert(!cJSON_IsTrue(cJSON_GetObjectItem(out,"saved"))&&!saves&&reads==1);cJSON_Delete(out);paused=true;out=sc_service_setup_execute(request,&config,save);assert(cJSON_IsTrue(cJSON_GetObjectItem(out,"saved"))&&saves==1);cJSON_Delete(out);
 recovery=true;out=sc_service_setup_execute(request,&config,save);assert(!cJSON_IsTrue(cJSON_GetObjectItem(out,"saved"))&&saves==1);cJSON_Delete(out);recovery=false;rate_limit=true;out=sc_service_setup_execute(request,&config,save);assert(!cJSON_IsTrue(cJSON_GetObjectItem(out,"saved"))&&saves==1);cJSON_Delete(out);cJSON_Delete(request);
 const char *invalid[]={"{\"action\":\"test_octopus\",\"ssid\":\"bad\"}","{\"action\":\"test_foxess\",\"ip\":\"bad\"}","{\"action\":\"test_octopus\",\"key\":1}","{\"action\":\"save_foxess\",\"key\":\"one\",\"key\":\"two\"}"};
 for(unsigned i=0;i<sizeof(invalid)/sizeof(*invalid);i++){request=cJSON_Parse(invalid[i]);assert(!sc_service_setup_submit(request,&id));cJSON_Delete(request);}
 puts("Service setup actor: strict allowlists, no network edits, queued cooldown, secret-free status, read-only tests, Pause/recovery save barrier and failed-test retention passed.");
}
