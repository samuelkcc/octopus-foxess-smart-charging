// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "foxess_schedule.h"
#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "mbedtls/md5.h"
#include "mbedtls/platform_util.h"
#include "mbedtls/sha256.h"
#include "schedule_transaction.h"
#include "nvs.h"
#include "esp_timer.h"
#include "runtime.h"
#include "cloud_read.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define RESPONSE_LIMIT 32768
typedef struct { char *text; size_t used; bool overflow; int retry_after; } read_buffer_t;
static int64_t cooldown_until_us;
static esp_err_t on_http(esp_http_client_event_t *event) {
    read_buffer_t *buffer=event->user_data;
    if(event->event_id==HTTP_EVENT_ON_HEADER && event->header_key && event->header_value && !strcasecmp(event->header_key,"Retry-After")){
        char *end;long seconds=strtol(event->header_value,&end,10);
        if(!*end && seconds>0 && seconds<=86400)buffer->retry_after=(int)seconds;
    }
    if (event->event_id==HTTP_EVENT_ON_DATA) {
        if (event->data_len<0 || buffer->used+event->data_len>RESPONSE_LIMIT) { buffer->overflow=true; return ESP_FAIL; }
        memcpy(buffer->text+buffer->used,event->data,event->data_len);
        buffer->used+=event->data_len; buffer->text[buffer->used]=0;
    }
    return ESP_OK;
}

static int64_t last_request_us;
static cJSON *request_schedule(const sc_config_t *settings,const cJSON *groups,int *http_status) {
    if(groups&&sc_runtime_paused()){*http_status=403;return NULL;}
    if(esp_timer_get_time()<cooldown_until_us){*http_status=429;return NULL;}
    const char *path=groups?"/op/v3/device/scheduler/enable":"/op/v3/device/scheduler/get";
    int64_t gap=1500000-(esp_timer_get_time()-last_request_us);
    if(gap>0)vTaskDelay(pdMS_TO_TICKS((gap+999)/1000));
    if(!sc_fox_slot()){*http_status=429;return NULL;}
    last_request_us=esp_timer_get_time();
    char timestamp[32],input[512],signature[33]={0};
    snprintf(timestamp,sizeof(timestamp),"%lld",(long long)time(NULL)*1000);
    snprintf(input,sizeof(input),"%s\\r\\n%s\\r\\n%s",path,settings->foxess_key,timestamp);
    unsigned char digest[16];
    mbedtls_md5((unsigned char *)input,strlen(input),digest);
    for(int i=0;i<16;i++)snprintf(signature+2*i,3,"%02x",digest[i]);
    mbedtls_platform_zeroize(input,sizeof(input));
    read_buffer_t buffer={.text=calloc(RESPONSE_LIMIT+1,1)};
    if(!buffer.text)return NULL;
    char url[128];snprintf(url,sizeof(url),"https://www.foxesscloud.com%s",path);
    esp_http_client_config_t config={.url=url,.timeout_ms=20000,
        .crt_bundle_attach=esp_crt_bundle_attach,.disable_auto_redirect=true,.event_handler=on_http,.user_data=&buffer,.buffer_size=2048,.buffer_size_tx=2048};
    esp_http_client_handle_t client=esp_http_client_init(&config);
    cJSON *response=NULL,*body=cJSON_CreateObject();
    bool body_ok=body&&cJSON_AddStringToObject(body,"deviceSN",settings->foxess_sn);
    if(groups){
        body_ok=body_ok&&cJSON_AddBoolToObject(body,"isDefault",false);
        cJSON *copy=cJSON_Duplicate(groups,true),*group;
        if(!copy)body_ok=false;
        cJSON_ArrayForEach(group,copy){
            bool active=sc_schedule_group_enabled(group);
            cJSON_DeleteItemFromObjectCaseSensitive(group,"enable");
            if(!cJSON_AddNumberToObject(group,"enable",active?1:0))body_ok=false;
        }
        if(!cJSON_AddItemToObject(body,"groups",copy)){cJSON_Delete(copy);body_ok=false;}
    }
    char *text=body_ok?cJSON_PrintUnformatted(body):NULL;
    if(client && text) {
        esp_http_client_set_method(client,HTTP_METHOD_POST);
        esp_http_client_set_header(client,"Content-Type","application/json");
        esp_http_client_set_header(client,"token",settings->foxess_key);
        esp_http_client_set_header(client,"timestamp",timestamp);
        esp_http_client_set_header(client,"signature",signature);
        esp_http_client_set_header(client,"lang","en");
        esp_http_client_set_post_field(client,text,strlen(text));
        esp_err_t result=esp_http_client_perform(client);
        *http_status=esp_http_client_get_status_code(client);
        if(*http_status==429)sc_fox_cooldown(buffer.retry_after);
        if(*http_status==429)cooldown_until_us=esp_timer_get_time()+(int64_t)(buffer.retry_after>60?buffer.retry_after:600)*1000000;
        if(result==ESP_OK && !buffer.overflow)response=cJSON_Parse(buffer.text);
    }
    if(client)esp_http_client_cleanup(client);
    if(text){mbedtls_platform_zeroize(text,strlen(text));free(text);}
    cJSON_Delete(body);
    mbedtls_platform_zeroize(buffer.text,RESPONSE_LIMIT+1);free(buffer.text);
    return response;
}

cJSON *sc_schedule_inspect(const sc_config_t *settings) {
    int status=0;
    cJSON *response=request_schedule(settings,NULL,&status);
    cJSON *out=cJSON_CreateObject();
    cJSON_AddNumberToObject(out,"http_status",status);
    cJSON *error=cJSON_GetObjectItemCaseSensitive(response,"errno");
    if(cJSON_IsNumber(error))cJSON_AddNumberToObject(out,"api_code",error->valuedouble);
    cJSON *result=cJSON_GetObjectItemCaseSensitive(response,"result");
    cJSON *groups=cJSON_GetObjectItemCaseSensitive(result,"groups");
    bool ok=status==200 && cJSON_IsNumber(error) && error->valuedouble==0 && cJSON_IsArray(groups);
    cJSON_AddBoolToObject(out,"read_succeeded",ok);
    if(ok) {
        cJSON *capacity=cJSON_GetObjectItemCaseSensitive(result,"maxGroupCount");
        if(cJSON_IsNumber(capacity))cJSON_AddNumberToObject(out,"reported_max_groups",capacity->valuedouble);
        cJSON *safe=cJSON_AddArrayToObject(out,"groups");
        const char *fields[]={"enable","startHour","startMinute","endHour","endMinute","workMode","fdSoc","minSocOnGrid","fdPwr","maxSoc","secondWorkMode","isRemainMode"};
        cJSON *group;
        cJSON_ArrayForEach(group,groups) {
            cJSON *copy=cJSON_CreateObject();
            for(size_t i=0;i<sizeof(fields)/sizeof(fields[0]);i++){
                const cJSON *value=cJSON_GetObjectItemCaseSensitive(group,fields[i]);
                if(cJSON_IsNumber(value)||cJSON_IsBool(value)||cJSON_IsString(value))cJSON_AddItemToObject(copy,fields[i],cJSON_Duplicate(value,true));
            }
            const cJSON *extra=cJSON_GetObjectItemCaseSensitive(group,"extraParam");
            if(cJSON_IsObject(extra)) {
                cJSON *extra_copy=cJSON_AddObjectToObject(copy,"extraParam");
                for(size_t i=0;i<sizeof(fields)/sizeof(fields[0]);i++){
                    const cJSON *value=cJSON_GetObjectItemCaseSensitive(extra,fields[i]);
                    if(cJSON_IsNumber(value)||cJSON_IsBool(value)||cJSON_IsString(value))cJSON_AddItemToObject(extra_copy,fields[i],cJSON_Duplicate(value,true));
                }
            }
            cJSON_AddItemToArray(safe,copy);
        }
    }
    cJSON_Delete(response);
    return out;
}

typedef struct {
    const sc_config_t *settings;
    cJSON *candidate;
    int start_minute;
    char date[11];
    int reads,writes,last_http,last_api;
} test_context_t;
static void device_fingerprint(const sc_config_t *settings,char out[65]){
    unsigned char digest[32];
    mbedtls_sha256((unsigned char *)settings->foxess_sn,strlen(settings->foxess_sn),digest,0);
    for(int i=0;i<32;i++)snprintf(out+2*i,3,"%02x",digest[i]);
}

static cJSON *transaction_read(void *arg) {
    test_context_t *ctx=arg;
    cJSON *response=request_schedule(ctx->settings,NULL,&ctx->last_http);
    ctx->reads++;
    cJSON *error=cJSON_GetObjectItemCaseSensitive(response,"errno");
    cJSON *groups=cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(response,"result"),"groups");
    ctx->last_api=cJSON_IsNumber(error)?error->valueint:-1;
    cJSON *copy=ctx->last_http==200&&ctx->last_api==0&&cJSON_IsArray(groups)?cJSON_Duplicate(groups,true):NULL;
    cJSON_Delete(response);return copy;
}

static bool arm_journal(void) {
    nvs_handle_t handle;
    if(nvs_open("sc_schedule",NVS_READWRITE,&handle)!=ESP_OK)return false;
    size_t size=0;char *text=NULL,*updated=NULL;cJSON *journal=NULL;bool ok=false;
    if(nvs_get_str(handle,"rollback",NULL,&size)==ESP_OK&&size<=8192){
        text=malloc(size);
        if(text&&nvs_get_str(handle,"rollback",text,&size)==ESP_OK)journal=cJSON_Parse(text);
    }
    if(journal){
        cJSON_DeleteItemFromObjectCaseSensitive(journal,"armed");cJSON_AddBoolToObject(journal,"armed",true);
        updated=cJSON_PrintUnformatted(journal);
        if(updated)ok=nvs_set_str(handle,"rollback",updated)==ESP_OK&&nvs_commit(handle)==ESP_OK;
    }
    free(text);free(updated);cJSON_Delete(journal);nvs_close(handle);return ok;
}

static bool transaction_write(void *arg,const cJSON *groups) {
    test_context_t *ctx=arg;
    if(!cJSON_IsArray(groups)||cJSON_GetArraySize(groups)>5)return false;
    if(ctx->candidate&&sc_schedules_equal(groups,ctx->candidate)){
        time_t now=time(NULL);struct tm local;localtime_r(&now,&local);
        char today[11];strftime(today,sizeof(today),"%Y-%m-%d",&local);
        if(strcmp(today,ctx->date)||ctx->start_minute<local.tm_hour*60+local.tm_min+(local.tm_sec>0)+120)return false;
        if(!arm_journal())return false;
    }
    cJSON *response=request_schedule(ctx->settings,groups,&ctx->last_http);
    ctx->writes++;
    cJSON *error=cJSON_GetObjectItemCaseSensitive(response,"errno");
    ctx->last_api=cJSON_IsNumber(error)?error->valueint:-1;
    bool accepted=ctx->last_http==200&&ctx->last_api==0;
    cJSON_Delete(response);return accepted;
}

bool sc_schedule_recovery_pending(void) {
    nvs_handle_t handle;
    if(nvs_open("sc_schedule",NVS_READONLY,&handle)!=ESP_OK)return false;
    size_t size=0;
    esp_err_t result=nvs_get_str(handle,"rollback",NULL,&size);
    nvs_close(handle);return result==ESP_OK&&size>1;
}

static bool transaction_save(void *arg,const cJSON *original,const cJSON *candidate) {
    test_context_t *ctx=arg;
    if(sc_schedule_recovery_pending())return false;
    cJSON *journal=cJSON_CreateObject();
    cJSON_AddNumberToObject(journal,"version",1);
    cJSON_AddBoolToObject(journal,"armed",false);
    char fingerprint[65];device_fingerprint(ctx->settings,fingerprint);
    cJSON_AddStringToObject(journal,"device_fingerprint",fingerprint);
    cJSON_AddItemToObject(journal,"original",cJSON_Duplicate(original,true));
    cJSON_AddItemToObject(journal,"candidate",cJSON_Duplicate(candidate,true));
    bool complete=journal&&cJSON_IsFalse(cJSON_GetObjectItemCaseSensitive(journal,"armed"))&&
        cJSON_IsString(cJSON_GetObjectItemCaseSensitive(journal,"device_fingerprint"))&&
        cJSON_IsArray(cJSON_GetObjectItemCaseSensitive(journal,"original"))&&cJSON_IsArray(cJSON_GetObjectItemCaseSensitive(journal,"candidate"));
    char *text=complete?cJSON_PrintUnformatted(journal):NULL;
    bool saved=false;
    nvs_handle_t handle;
    if(text&&strlen(text)<8192&&nvs_open("sc_schedule",NVS_READWRITE,&handle)==ESP_OK){
        saved=nvs_set_str(handle,"rollback",text)==ESP_OK&&nvs_commit(handle)==ESP_OK;
        if(saved){
            size_t size=strlen(text)+1;char *readback=malloc(size);
            saved=readback&&nvs_get_str(handle,"rollback",readback,&size)==ESP_OK&&!strcmp(text,readback);
            free(readback);
        }
        nvs_close(handle);
    }
    if(saved)ctx->candidate=cJSON_Duplicate(candidate,true);
    free(text);cJSON_Delete(journal);return saved&&ctx->candidate;
}

static bool transaction_clear(void *arg) {
    nvs_handle_t handle;
    if(nvs_open("sc_schedule",NVS_READWRITE,&handle)!=ESP_OK)return false;
    esp_err_t result=nvs_erase_key(handle,"rollback");
    bool ok=(result==ESP_OK||result==ESP_ERR_NVS_NOT_FOUND)&&nvs_commit(handle)==ESP_OK;
    nvs_close(handle);return ok;
}
static void transaction_wait(void *arg){vTaskDelay(pdMS_TO_TICKS(1500));}
static sc_schedule_ops_t operations(test_context_t *ctx){
    return (sc_schedule_ops_t){.context=ctx,.read=transaction_read,.write=transaction_write,.save=transaction_save,.clear=transaction_clear,.wait=transaction_wait};
}

cJSON *sc_schedule_manual_test(const sc_config_t *settings,int start,const char *date) {
    cJSON *result;
    if(sc_schedule_recovery_pending()){
        result=cJSON_CreateObject();cJSON_AddStringToObject(result,"status","A previous recovery journal must be resolved first");return result;
    }
    time_t now=time(NULL);struct tm local;localtime_r(&now,&local);
    char today[11];strftime(today,sizeof(today),"%Y-%m-%d",&local);
    if(!date||strcmp(today,date)){
        result=cJSON_CreateObject();cJSON_AddStringToObject(result,"status","The test date must be today in Europe/London");return result;
    }
    test_context_t ctx={.settings=settings,.start_minute=start};
    snprintf(ctx.date,sizeof(ctx.date),"%s",date);
    sc_schedule_ops_t ops=operations(&ctx);
    result=sc_run_schedule_test(&ops,local.tm_hour*60+local.tm_min+(local.tm_sec>0),start);
    cJSON_AddNumberToObject(result,"official_rest_reads",ctx.reads);
    cJSON_AddNumberToObject(result,"schedule_write_requests",ctx.writes);
    cJSON_AddNumberToObject(result,"last_http_status",ctx.last_http);
    cJSON_AddNumberToObject(result,"last_api_code",ctx.last_api);
    cJSON_AddNumberToObject(result,"start_minute",start);
    cJSON_AddNumberToObject(result,"end_minute",start+30);
    cJSON_Delete(ctx.candidate);return result;
}

cJSON *sc_schedule_recover(const sc_config_t *settings) {
    nvs_handle_t handle;
    cJSON *result=NULL,*journal=NULL;
    if(nvs_open("sc_schedule",NVS_READONLY,&handle)==ESP_OK){
        size_t size=0;
        if(nvs_get_str(handle,"rollback",NULL,&size)==ESP_OK&&size<=8192){
            char *text=malloc(size);
            if(text&&nvs_get_str(handle,"rollback",text,&size)==ESP_OK)journal=cJSON_Parse(text);
            free(text);
        }
        nvs_close(handle);
    }
    cJSON *original=cJSON_GetObjectItemCaseSensitive(journal,"original"),*candidate=cJSON_GetObjectItemCaseSensitive(journal,"candidate");
    char fingerprint[65];device_fingerprint(settings,fingerprint);
    cJSON *saved_fingerprint=cJSON_GetObjectItemCaseSensitive(journal,"device_fingerprint");
    if(!cJSON_IsString(saved_fingerprint)||strcmp(saved_fingerprint->valuestring,fingerprint)){
        result=cJSON_CreateObject();cJSON_AddBoolToObject(result,"recovery_pending",sc_schedule_recovery_pending());
        cJSON_AddStringToObject(result,"status","Recovery device binding could not be verified; no write sent");
        cJSON_Delete(journal);return result;
    }
    if(cJSON_IsFalse(cJSON_GetObjectItemCaseSensitive(journal,"armed"))){
        bool cleared=transaction_clear(NULL);
        result=cJSON_CreateObject();cJSON_AddBoolToObject(result,"recovery_pending",!cleared);
        cJSON_AddStringToObject(result,"status","The test was never armed; no recovery write was required");
        cJSON_Delete(journal);return result;
    }
    if(cJSON_IsArray(original)&&cJSON_IsArray(candidate)&&cJSON_GetArraySize(original)<=5&&cJSON_GetArraySize(candidate)<=5&&
        sc_schedules_equal(original,original)&&sc_schedules_equal(candidate,candidate)){
        test_context_t ctx={.settings=settings};sc_schedule_ops_t ops=operations(&ctx);
        result=sc_restore_schedule(&ops,original,candidate);
    }else{
        result=cJSON_CreateObject();cJSON_AddBoolToObject(result,"recovery_pending",sc_schedule_recovery_pending());
        cJSON_AddStringToObject(result,"status","No valid recovery journal available");
    }
    cJSON_Delete(journal);return result;
}

cJSON *sc_schedule_read(const sc_config_t *config,int *http){
 cJSON *response=request_schedule(config,NULL,http);const cJSON *error=cJSON_GetObjectItemCaseSensitive(response,"errno");
 const cJSON *groups=cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(response,"result"),"groups");
 cJSON *out=*http==200&&cJSON_IsNumber(error)&&error->valueint==0&&cJSON_IsArray(groups)?cJSON_Duplicate(groups,true):NULL;cJSON_Delete(response);return out;
}
bool sc_schedule_program(const sc_config_t *config,const cJSON *groups,int *http){
 if(!cJSON_IsArray(groups)||cJSON_GetArraySize(groups)>5||sc_runtime_paused())return false;
 cJSON *response=request_schedule(config,groups,http);const cJSON *error=cJSON_GetObjectItemCaseSensitive(response,"errno");
 bool ok=*http==200&&cJSON_IsNumber(error)&&error->valueint==0;cJSON_Delete(response);return ok;
}
