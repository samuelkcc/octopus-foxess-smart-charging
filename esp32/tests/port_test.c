// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "../main/dashboard_port.c"
static port_record_t durable, pending;
static bool exists, fail_open, fail_write, fail_commit;
esp_err_t nvs_open(const char *name,int mode,nvs_handle_t *h){(void)mode;assert(!strcmp(name,"sc_http"));*h=1;return fail_open?ESP_FAIL:ESP_OK;}
esp_err_t nvs_get_blob(nvs_handle_t h,const char *key,void *out,size_t *size){(void)h;assert(!strcmp(key,"port"));if(!exists)return ESP_ERR_NVS_NOT_FOUND;assert(*size==sizeof(durable));memcpy(out,&durable,sizeof(durable));return ESP_OK;}
esp_err_t nvs_set_blob(nvs_handle_t h,const char *key,const void *value,size_t size){(void)h;assert(!strcmp(key,"port")&&size==sizeof(pending));if(fail_write)return ESP_FAIL;memcpy(&pending,value,size);return ESP_OK;}
esp_err_t nvs_commit(nvs_handle_t h){(void)h;if(fail_commit)return ESP_FAIL;durable=pending;exists=true;return ESP_OK;}
void nvs_close(nvs_handle_t h){(void)h;}
int main(void){
 sc_dashboard_port_init();assert(sc_dashboard_port_active()==8787&&sc_dashboard_port_saved()==8787);
 assert(!sc_dashboard_port_save(0)&&!sc_dashboard_port_save(65536));
 assert(sc_dashboard_port_save(8123));assert(sc_dashboard_port_active()==8787&&sc_dashboard_port_saved()==8123);
 sc_dashboard_port_init();assert(sc_dashboard_port_active()==8123);
 fail_write=true;assert(!sc_dashboard_port_save(8989)&&sc_dashboard_port_saved()==8123);fail_write=false;
 fail_commit=true;assert(!sc_dashboard_port_save(8989)&&sc_dashboard_port_saved()==8123);fail_commit=false;
 sc_dashboard_port_init();assert(sc_dashboard_port_active()==8123);
 fail_open=true;assert(!sc_dashboard_port_save(8989));fail_open=false;
 assert(sc_dashboard_port_save(80));sc_dashboard_port_init();assert(sc_dashboard_port_active()==80);
 durable.version=99;sc_dashboard_port_init();assert(sc_dashboard_port_active()==8787);
 durable=(port_record_t){1,65536};sc_dashboard_port_init();assert(sc_dashboard_port_active()==8787);
 puts("Dashboard port: legacy default 8787, restart application, bounds, corrupt record and failed storage; credential storage remains untouched.");
}
