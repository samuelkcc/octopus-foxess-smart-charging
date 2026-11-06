// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Structured events only: this module accepts no arbitrary text or credentials.
#include "debug_log.h"
#include "esp_heap_caps.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "mbedtls/sha256.h"
#include "mbedtls/platform_util.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#define CAPACITY 512
#define DAY_US 86400000000LL
typedef struct {int64_t first,last;time_t at;unsigned count;int code;unsigned char source,failed;} event_t;
static event_t *events;
static unsigned head,used,dropped;
static int previous_code[SC_DEBUG_SOURCES];
static bool previous_failed[SC_DEBUG_SOURCES],seen[SC_DEBUG_SOURCES];
static SemaphoreHandle_t guard;
static unsigned char key_hash[32];
static int64_t expires,window_start;
static unsigned rejected,accepted;
static const char *names[]={"boot","wifi","octopus","foxess","storage","ota","tariff"};
static void prune(int64_t now){while(used&&now-events[head].last>DAY_US){head=(head+1)%CAPACITY;used--;}}
void sc_debug_init(void){
 guard=xSemaphoreCreateMutex();events=heap_caps_calloc(CAPACITY,sizeof(*events),MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
 head=used=dropped=0;expires=0;memset(seen,0,sizeof(seen));memset(key_hash,0,sizeof(key_hash));
 sc_debug_problem(SC_DEBUG_BOOT,false,0);
}
void sc_debug_problem(enum sc_debug_source source,bool failed,int code){
 if(!guard||!events||source<0||source>=SC_DEBUG_SOURCES)return;
 int64_t now=esp_timer_get_time();xSemaphoreTake(guard,portMAX_DELAY);prune(now);
 bool same=seen[source]&&previous_failed[source]==failed&&previous_code[source]==code;
 if(same&&!failed){xSemaphoreGive(guard);return;}
 if(same&&used){
  event_t *last=&events[(head+used-1)%CAPACITY];
  if(last->source==source&&last->failed&&last->code==code&&now-last->first<=60000000){
   last->last=now;last->count++;xSemaphoreGive(guard);return;
  }
 }
 seen[source]=true;previous_failed[source]=failed;previous_code[source]=code;
 if(used==CAPACITY){head=(head+1)%CAPACITY;used--;dropped++;}
 time_t wall=time(NULL);events[(head+used++)%CAPACITY]=(event_t){.first=now,.last=now,.at=wall>=1700000000?wall:0,.count=1,.code=code,.source=source,.failed=failed};
 xSemaphoreGive(guard);
}
bool sc_debug_private_ipv4(unsigned long a){return (a>>24)==10||(a>>20)==0xac1||(a>>16)==0xc0a8;}
void sc_debug_session_close(void){if(!guard)return;xSemaphoreTake(guard,portMAX_DELAY);expires=0;mbedtls_platform_zeroize(key_hash,sizeof(key_hash));xSemaphoreGive(guard);}
bool sc_debug_session_start(char key[65]){
 if(!guard||!events)return false;
 unsigned char raw[32];esp_fill_random(raw,sizeof(raw));
 for(unsigned i=0;i<32;i++){snprintf(key+2*i,3,"%02x",raw[i]);}
 mbedtls_platform_zeroize(raw,sizeof(raw));
 xSemaphoreTake(guard,portMAX_DELAY);mbedtls_sha256((unsigned char *)key,64,key_hash,0);window_start=esp_timer_get_time();expires=window_start+3600000000LL;rejected=accepted=0;xSemaphoreGive(guard);return true;
}
bool sc_debug_session_live(void){if(!guard)return false;xSemaphoreTake(guard,portMAX_DELAY);bool live=expires>esp_timer_get_time();xSemaphoreGive(guard);return live;}
int sc_debug_authorize(const char *authorization){
 if(!guard)return 401;
 int64_t now=esp_timer_get_time();xSemaphoreTake(guard,portMAX_DELAY);
 if(now>=expires){mbedtls_platform_zeroize(key_hash,sizeof(key_hash));expires=0;xSemaphoreGive(guard);return 401;}
 if(now-window_start>=60000000){window_start=now;rejected=accepted=0;}
 if(rejected>=10||accepted>=60){xSemaphoreGive(guard);return 429;}
 unsigned char candidate[32]={0};bool shape=authorization&&strlen(authorization)==71&&!strncmp(authorization,"Bearer ",7);
 if(shape)mbedtls_sha256((const unsigned char *)authorization+7,64,candidate,0);
 unsigned difference=0;for(unsigned i=0;i<32;i++)difference|=candidate[i]^key_hash[i];
 mbedtls_platform_zeroize(candidate,sizeof(candidate));bool ok=shape&&!difference;
 if(ok)accepted++;else rejected++;xSemaphoreGive(guard);return ok?200:401;
}
cJSON *sc_debug_status(void){
 cJSON *out=cJSON_CreateObject();if(!guard)return out;xSemaphoreTake(guard,portMAX_DELAY);int64_t now=esp_timer_get_time();prune(now);
 cJSON_AddBoolToObject(out,"enabled",expires>now);cJSON_AddBoolToObject(out,"available",events!=NULL);cJSON_AddNumberToObject(out,"expires_in_seconds",expires>now?(expires-now)/1000000:0);
 cJSON_AddNumberToObject(out,"records",used);cJSON_AddNumberToObject(out,"capacity",CAPACITY);cJSON_AddNumberToObject(out,"dropped",dropped);cJSON_AddNumberToObject(out,"retention_hours",24);
 xSemaphoreGive(guard);return out;
}
cJSON *sc_debug_events(void){
 cJSON *out=cJSON_CreateArray();if(!guard||!events)return out;xSemaphoreTake(guard,portMAX_DELAY);prune(esp_timer_get_time());
 for(unsigned i=0;i<used;i++){event_t *e=&events[(head+i)%CAPACITY];cJSON *row=cJSON_CreateObject();
  cJSON_AddStringToObject(row,"source",names[e->source]);cJSON_AddStringToObject(row,"level",e->failed?"error":"info");cJSON_AddNumberToObject(row,"code",e->code);
  cJSON_AddNumberToObject(row,"at",e->at);cJSON_AddNumberToObject(row,"first_uptime_seconds",e->first/1000000);cJSON_AddNumberToObject(row,"last_uptime_seconds",e->last/1000000);cJSON_AddNumberToObject(row,"count",e->count);cJSON_AddItemToArray(out,row);
 }xSemaphoreGive(guard);return out;
}
