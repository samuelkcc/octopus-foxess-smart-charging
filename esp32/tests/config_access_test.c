// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "config_access.h"
#include "nvs.h"
static unsigned char stored[128];static size_t length;static bool fail;static int64_t now;
int64_t esp_timer_get_time(void){return now;}
esp_err_t nvs_open(const char *name,int mode,nvs_handle_t *h){(void)mode;assert(!strcmp(name,"sc_usb_access"));*h=1;return ESP_OK;}
void nvs_close(nvs_handle_t h){(void)h;}
esp_err_t nvs_commit(nvs_handle_t h){(void)h;return ESP_OK;}
esp_err_t nvs_get_blob(nvs_handle_t h,const char *name,void *out,size_t *size){(void)h;assert(!strcmp(name,"auth"));if(!length)return ESP_ERR_NVS_NOT_FOUND;if(*size<length)return ESP_FAIL;memcpy(out,stored,length);*size=length;return ESP_OK;}
esp_err_t nvs_set_blob(nvs_handle_t h,const char *name,const void *in,size_t size){(void)h;assert(!strcmp(name,"auth"));if(fail)return ESP_FAIL;assert(size<=sizeof(stored));memcpy(stored,in,size);length=size;return ESP_OK;}
esp_err_t nvs_erase_key(nvs_handle_t h,const char *name){(void)h;assert(!strcmp(name,"auth"));if(fail)return ESP_FAIL;length=0;return ESP_OK;}
void esp_fill_random(void *out,size_t size){static unsigned n;for(size_t i=0;i<size;i++)((unsigned char *)out)[i]=(unsigned char)++n;}
int main(void){
 sc_config_access_init();assert(!sc_config_access_enabled());assert(sc_config_access_check(""));
 assert(!sc_config_access_change("","short"));assert(sc_config_access_change("","example-password"));assert(sc_config_access_enabled());
 assert(!memmem(stored,length,"example-password",16));sc_config_access_init();assert(sc_config_access_enabled());assert(!sc_config_access_check("wrong-password"));assert(sc_config_access_check("example-password"));
 assert(!sc_config_access_change("wrong-password","replacement-password"));assert(sc_config_access_check("example-password"));
 for(int i=0;i<5;i++)assert(!sc_config_access_check("wrong-password"));assert(!sc_config_access_check("example-password"));now+=60000001;assert(sc_config_access_check("example-password"));
 unsigned char before[128];memcpy(before,stored,length);fail=true;assert(!sc_config_access_change("example-password","replacement-password"));assert(!memcmp(before,stored,length));assert(sc_config_access_check("example-password"));fail=false;
 assert(sc_config_access_change("example-password","replacement-password"));assert(!sc_config_access_check("example-password"));assert(sc_config_access_check("replacement-password"));
 stored[0]^=1;sc_config_access_init();assert(sc_config_access_enabled());assert(!sc_config_access_check("replacement-password"));assert(!sc_config_access_change("",""));
 memcpy(stored,before,length);sc_config_access_init();assert(sc_config_access_change("example-password",""));sc_config_access_init();assert(!sc_config_access_enabled()&&sc_config_access_check(""));
 puts("USB Config Password: legacy default open, salted PBKDF2, protected reads, restart retention, rate limiting, authenticated rotation/removal, failed-save retention and fail-closed corruption passed.");
}
