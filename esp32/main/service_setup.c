// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Read-only service validation is shared by LAN setup and the USB setup tools.
#include "service_setup.h"
#include "automation_policy.h"
#include "cloud_read.h"
#include "foxess_live.h"
#include "foxess_schedule.h"
#include "runtime.h"
#include "esp_random.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "mbedtls/platform_util.h"
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static SemaphoreHandle_t guard;
static cJSON *pending,*last_result;
static unsigned job_id;
static const char *phase="idle";
static bool octopus_reserved;
static const char *string(const cJSON *o,const char *name){const cJSON *v=cJSON_GetObjectItemCaseSensitive(o,name);return cJSON_IsString(v)?v->valuestring:"";}
static int kind(const char *action){return !strcmp(action,"test_octopus")||!strcmp(action,"save_octopus")?1:!strcmp(action,"test_foxess")||!strcmp(action,"save_foxess")?2:!strcmp(action,"test_websocket")||!strcmp(action,"save_websocket")?3:0;}
static bool valid(const cJSON *request){
 if(!cJSON_IsObject(request))return false;
 int service=kind(string(request,"action"));if(!service)return false;
 const cJSON *v;cJSON_ArrayForEach(v,request){
  bool allowed=!strcmp(v->string,"action")||(service==1&&(!strcmp(v->string,"account")||!strcmp(v->string,"key")))||(service==2&&(!strcmp(v->string,"serial")||!strcmp(v->string,"key")))||(service==3&&(!strcmp(v->string,"username")||!strcmp(v->string,"password")||!strcmp(v->string,"mode")));
  if(!allowed||!cJSON_IsString(v)||strlen(v->valuestring)>256)return false;
  for(const cJSON *other=v->next;other;other=other->next)if(!strcmp(v->string,other->string))return false;
 }return true;
}
static void destroy(cJSON *object){const cJSON *v;cJSON_ArrayForEach(v,object)if(cJSON_IsString(v))mbedtls_platform_zeroize(v->valuestring,strlen(v->valuestring));cJSON_Delete(object);}
static cJSON *result(bool connected,bool saved,const char *message){cJSON *out=cJSON_CreateObject();cJSON_AddBoolToObject(out,"connected",connected);cJSON_AddBoolToObject(out,"saved",saved);cJSON_AddStringToObject(out,"status",message);return out;}
static bool field(const cJSON *request,const char *name,char *out,size_t size,bool identifier){
 const char *value=string(request,name);if(!*value)return out[0]!=0;
 size_t n=strlen(value);if(n>=size)return false;
 for(size_t i=0;i<n;i++)if((unsigned char)value[i]<33||(unsigned char)value[i]>126||(identifier&&!isalnum((unsigned char)value[i])&&value[i]!='-'&&value[i]!='_'))return false;
 memcpy(out,value,n+1);return true;
}
static bool octopus(const sc_config_t *config,int *http){
 char path[96];snprintf(path,sizeof(path),"/v1/accounts/%s/",config->account);int retry=0;
 cJSON *response=sc_cloud_read(config,false,path,NULL,NULL,http,&retry);
 bool ok=*http==200&&!strcmp(string(response,"number"),config->account);
 cJSON_Delete(response);sc_runtime_octopus_setup_result(*http,retry);return ok;
}
static bool foxess(const sc_config_t *config,int *http){
 cJSON *body=cJSON_CreateObject();if(!body)return false;cJSON_AddStringToObject(body,"sn",config->foxess_sn);cJSON *vars=cJSON_AddArrayToObject(body,"variables");cJSON_AddItemToArray(vars,cJSON_CreateString("SoC"));
 int retry=0;cJSON *response=sc_cloud_read(config,true,"/op/v0/device/real/query",body,NULL,http,&retry);cJSON_Delete(body);
 const cJSON *error=cJSON_GetObjectItemCaseSensitive(response,"errno"),*rows=cJSON_GetObjectItemCaseSensitive(response,"result");
 bool ok=*http==200&&cJSON_IsNumber(error)&&error->valuedouble==0&&cJSON_IsArray(rows)&&cJSON_GetArraySize(rows)>0;cJSON_Delete(response);return ok;
}
cJSON *sc_service_setup_execute(const cJSON *request,const sc_config_t *active,sc_service_save_t save){
 if(!valid(request))return result(false,false,"Invalid setup fields. Wi-Fi and IP can only be changed through USB setup.");
 int service=kind(string(request,"action"));bool commit=!strncmp(string(request,"action"),"save_",5);
 if(service==3){
  cJSON *config=cJSON_Duplicate(request,true);if(!config)return NULL;cJSON_DeleteItemFromObjectCaseSensitive(config,"action");
  cJSON *out=commit?sc_live_configure(config,active):sc_live_test(config,active);destroy(config);return out?out:result(false,false,"Enter the optional FoxESS login and a valid telemetry mode.");
 }
 if(commit&&((sc_runtime_enabled()&&!sc_runtime_paused())||sc_schedule_recovery_pending()))return result(false,false,"Pause automation before saving API credentials. Resolve any pending schedule recovery first.");
 sc_config_t *candidate=malloc(sizeof(*candidate));if(!candidate)return NULL;*candidate=*active;
 bool parsed=service==1?(field(request,"account",candidate->account,sizeof(candidate->account),true)&&field(request,"key",candidate->octopus_key,sizeof(candidate->octopus_key),false)):(field(request,"serial",candidate->foxess_sn,sizeof(candidate->foxess_sn),true)&&field(request,"key",candidate->foxess_key,sizeof(candidate->foxess_key),false));
 int http=0;bool ok=parsed&&(service==1?octopus(candidate,&http):foxess(candidate,&http));bool saved=ok&&commit&&sc_runtime_apply_services(candidate,save);
 cJSON *out=result(ok,saved,!parsed?"Enter valid service details.":!ok?(http==429?"Service rate limited. Wait before testing again. Previous settings are retained.":"API validation failed. Previous settings are retained."):commit?(saved?"API settings validated and saved. Wi-Fi, IP and automation rules are unchanged.":"Settings were not saved. Pause automation and check device storage."):service==1?"Octopus account REST test passed. Nothing saved. Smart Dispatch access is checked by the worker.":"FoxESS REST telemetry test passed. Nothing saved.");
 mbedtls_platform_zeroize(candidate,sizeof(*candidate));free(candidate);return out;
}
void sc_service_setup_init(void){if(!guard)guard=xSemaphoreCreateMutex();}
bool sc_service_setup_submit(const cJSON *request,unsigned *id){
 if(!valid(request))return false;
 xSemaphoreTake(guard,portMAX_DELAY);
 bool ok=strcmp(phase,"queued")&&strcmp(phase,"running");
 if(ok){pending=cJSON_Duplicate(request,true);ok=pending!=NULL;if(ok){cJSON_Delete(last_result);last_result=NULL;job_id=esp_random();if(!job_id)job_id=1;phase="queued";octopus_reserved=false;*id=job_id;}}
 xSemaphoreGive(guard);return ok;
}
cJSON *sc_service_setup_status(unsigned id){
 xSemaphoreTake(guard,portMAX_DELAY);cJSON *out=NULL;if(id&&id==job_id){out=cJSON_CreateObject();cJSON_AddNumberToObject(out,"id",job_id);cJSON_AddStringToObject(out,"phase",phase);if(!strcmp(phase,"running")){cJSON *live=sc_live_status();const cJSON *step=cJSON_GetObjectItemCaseSensitive(live,"test_stage");if(cJSON_IsString(step)&&strcmp(step->valuestring,"idle"))cJSON_AddStringToObject(out,"progress",step->valuestring);cJSON_Delete(live);}if(last_result)cJSON_AddItemToObject(out,"result",cJSON_Duplicate(last_result,true));}xSemaphoreGive(guard);return out;
}
void sc_service_setup_prepare(void){
 xSemaphoreTake(guard,portMAX_DELAY);
 if(pending&&kind(string(pending,"action"))==1&&!octopus_reserved)
  octopus_reserved=sc_runtime_claim_octopus_setup();
 xSemaphoreGive(guard);
}
void sc_service_setup_tick(const sc_config_t *active,bool online,sc_service_save_t save){
 xSemaphoreTake(guard,portMAX_DELAY);cJSON *request=pending;if(request&&kind(string(request,"action"))==1&&!octopus_reserved)request=NULL;if(request){pending=NULL;phase="running";}xSemaphoreGive(guard);if(!request)return;
 cJSON *out=online?sc_service_setup_execute(request,active,save):result(false,false,"Connect Wi-Fi before testing service settings.");destroy(request);if(!out)out=result(false,false,"The device could not complete the setup test. Previous settings are retained.");
 xSemaphoreTake(guard,portMAX_DELAY);last_result=out;phase="done";xSemaphoreGive(guard);
}
