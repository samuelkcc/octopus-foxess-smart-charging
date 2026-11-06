// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "foxess_live.h"
#include "nvs.h"
static unsigned char secret[32],settings[1024];static size_t length;static bool has_key,fail;
esp_err_t nvs_open(const char *name,int mode,nvs_handle_t *h){(void)mode;assert(!strcmp(name,"sc_fox_live"));*h=1;return ESP_OK;}
void nvs_close(nvs_handle_t h){(void)h;}
esp_err_t nvs_commit(nvs_handle_t h){(void)h;return fail?ESP_FAIL:ESP_OK;}
esp_err_t nvs_get_blob(nvs_handle_t h,const char *key,void *out,size_t *size){(void)h;size_t n=!strcmp(key,"local_key")?(has_key?32:0):length;if(!n)return ESP_ERR_NVS_NOT_FOUND;if(*size<n)return ESP_FAIL;memcpy(out,!strcmp(key,"local_key")?secret:settings,n);*size=n;return ESP_OK;}
esp_err_t nvs_set_blob(nvs_handle_t h,const char *key,const void *value,size_t size){(void)h;if(fail)return ESP_FAIL;if(!strcmp(key,"local_key")){assert(size==32);memcpy(secret,value,32);has_key=true;}else{assert(!strcmp(key,"settings")&&size<=sizeof(settings));memcpy(settings,value,size);length=size;}return ESP_OK;}
void esp_fill_random(void *out,size_t size){static unsigned state=7;for(size_t i=0;i<size;i++){state=state*1664525+1013904223;((unsigned char *)out)[i]=state>>24;}}
int main(void){
 _Static_assert(sizeof(sc_config_t)==647,"Core Wi-Fi credential ABI changed without migration");
 sc_live_config_t value={0},loaded;assert(sc_live_load(&loaded)!=ESP_OK&&!loaded.websocket&&!loaded.username[0]);
 strcpy(value.username,"example-private-login");strcpy(value.password_hash,"0123456789abcdef0123456789abcdef");value.websocket=true;
 assert(sc_live_save(&value)==ESP_OK);assert(sc_live_load(&loaded)==ESP_OK);assert(!memcmp(&value,&loaded,sizeof(value)));
 for(size_t i=0;i+strlen(value.username)<length;i++)assert(memcmp(settings+i,value.username,strlen(value.username)));
 unsigned char before[1024];memcpy(before,settings,length);fail=true;value.websocket=false;assert(sc_live_save(&value)!=ESP_OK);assert(!memcmp(before,settings,length));fail=false;
 settings[length/2]^=1;memset(&loaded,0xff,sizeof(loaded));assert(sc_live_load(&loaded)!=ESP_OK);sc_live_config_t empty={0};assert(!memcmp(&loaded,&empty,sizeof(empty)));
 puts("Optional login store: separate namespace, unchanged Wi-Fi ABI, real AES-GCM round trip, no plaintext, failed-save retention and corruption rejection passed.");
}
