// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Independent read-only listener. Dashboard cookies and forwarded headers grant no access.
#include "debug_http.h"
#include "debug_log.h"
#include "dashboard_port.h"
#include "runtime.h"
#include "ota_update.h"
#include "esp_app_desc.h"
#include "esp_heap_caps.h"
#include "esp_http_server.h"
#include "esp_netif.h"
#include "esp_timer.h"
#include "mbedtls/platform_util.h"
#include "lwip/sockets.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static httpd_handle_t listener;
static _Atomic unsigned debug_port=8788;
static SemaphoreHandle_t lifecycle;
void sc_debug_http_init(void){lifecycle=xSemaphoreCreateMutex();}
static bool local_host(httpd_req_t *r){
 const char *blocked[]={"Origin","Forwarded","X-Forwarded-For","X-Forwarded-Host","X-Forwarded-Proto","CF-Connecting-IP"};
 for(unsigned i=0;i<sizeof(blocked)/sizeof(*blocked);i++)if(httpd_req_get_hdr_value_len(r,blocked[i]))return false;
 struct sockaddr_in peer={0};socklen_t length=sizeof(peer);
 if(getpeername(httpd_req_to_sockfd(r),(struct sockaddr *)&peer,&length)||peer.sin_family!=AF_INET||!sc_debug_private_ipv4(ntohl(peer.sin_addr.s_addr)))return false;
 esp_netif_ip_info_t info={0};esp_netif_t *net=esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");char host[80],expected[80];
 if(!net||esp_netif_get_ip_info(net,&info)!=ESP_OK||httpd_req_get_hdr_value_str(r,"Host",host,sizeof(host))!=ESP_OK)return false;
 snprintf(expected,sizeof(expected),IPSTR ":%u",IP2STR(&info.ip),debug_port);return !strcmp(host,expected);
}
static cJSON *diagnostics(void){
 cJSON *out=cJSON_CreateObject(),*worker=cJSON_AddObjectToObject(out,"worker"),*s=sc_runtime_state();
 cJSON_AddNumberToObject(out,"schema",1);cJSON_AddStringToObject(out,"version",esp_app_get_description()->version);cJSON_AddBoolToObject(out,"read_only",true);
 cJSON_AddNumberToObject(out,"uptime_seconds",esp_timer_get_time()/1000000);cJSON_AddNumberToObject(out,"free_heap_bytes",heap_caps_get_free_size(MALLOC_CAP_8BIT));cJSON_AddNumberToObject(out,"free_psram_bytes",heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
 const char *fields[]={"revision","confirmed_revision","write_inflight","partial","confirmed","dispatch_valid","dispatch_at","telemetry_at","schedule_at","octopus_http","foxess_http","octopus_fault","foxess_fault","octopus_next","foxess_next","tariff_http","tariff_stage","import_rates_at","export_rates_at","history_records","history_flash_error","import_rate_count","export_rate_count","tariff_attempt_at","tariff_completed_at","tariff_failures","schedule_write_http","schedule_read_http","schedule_read_attempts","schedule_write_accepted"};
 for(unsigned i=0;i<sizeof(fields)/sizeof(*fields);i++){const cJSON *v=cJSON_GetObjectItemCaseSensitive(s,fields[i]);if(cJSON_IsNumber(v)||cJSON_IsBool(v))cJSON_AddItemToObject(worker,fields[i],cJSON_Duplicate(v,true));}
 const cJSON *rules=cJSON_GetObjectItemCaseSensitive(s,"rules");cJSON_AddBoolToObject(worker,"automation_enabled",cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(rules,"enabled")));cJSON_AddBoolToObject(worker,"operator_paused",cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(rules,"paused")));
 cJSON_Delete(s);cJSON_AddItemToObject(out,"debug",sc_debug_access_status());cJSON_AddItemToObject(out,"events",sc_debug_events());
 cJSON *ota=sc_ota_status(),*update=cJSON_AddObjectToObject(out,"ota");const char *ota_fields[]={"current","version","phase","progress","busy"};
 for(unsigned i=0;i<sizeof(ota_fields)/sizeof(*ota_fields);i++){const cJSON *v=cJSON_GetObjectItemCaseSensitive(ota,ota_fields[i]);if(v)cJSON_AddItemToObject(update,ota_fields[i],cJSON_Duplicate(v,true));}cJSON_Delete(ota);return out;
}
static esp_err_t debug_request(httpd_req_t *r){
 const char *status="200 OK";cJSON *out=NULL;char authorization[80]={0};
 if(r->method!=HTTP_GET||!local_host(r)){status="403 Forbidden";out=cJSON_CreateObject();}
 else{
  httpd_req_get_hdr_value_str(r,"Authorization",authorization,sizeof(authorization));int auth=sc_debug_authorize(authorization);
  if(auth!=200){status=auth==429?"429 Too Many Requests":"401 Unauthorized";out=cJSON_CreateObject();}
  else if(!strcmp(r->uri,"/diagnostics"))out=diagnostics();
  else if(!strcmp(r->uri,"/events"))out=sc_debug_events();
  else if(!strcmp(r->uri,"/status"))out=sc_debug_access_status();
  else{status="404 Not Found";out=cJSON_CreateObject();}
 }
 mbedtls_platform_zeroize(authorization,sizeof(authorization));
 char *text=cJSON_PrintUnformatted(out);cJSON_Delete(out);httpd_resp_set_status(r,status);httpd_resp_set_type(r,"application/json");
 httpd_resp_set_hdr(r,"Connection","close");httpd_resp_set_hdr(r,"Cache-Control","no-store");httpd_resp_set_hdr(r,"X-Content-Type-Options","nosniff");httpd_resp_set_hdr(r,"Referrer-Policy","no-referrer");
 httpd_resp_sendstr(r,text?text:"{}");free(text);return ESP_FAIL;
}
static void stop_expired(void){if(listener&&!sc_debug_session_live()){httpd_handle_t old=listener;listener=NULL;httpd_stop(old);sc_debug_session_close();}}
void sc_debug_http_tick(void){if(!lifecycle)return;xSemaphoreTake(lifecycle,portMAX_DELAY);stop_expired();xSemaphoreGive(lifecycle);}
cJSON *sc_debug_access_status(void){cJSON *out=sc_debug_status();cJSON_AddNumberToObject(out,"port",debug_port);return out;}
cJSON *sc_debug_access_update(const cJSON *request){
 const cJSON *on=cJSON_GetObjectItemCaseSensitive(request,"enabled"),*port=cJSON_GetObjectItemCaseSensitive(request,"port");
 if(!cJSON_IsObject(request)||!cJSON_IsBool(on))return NULL;
 const cJSON *item;cJSON_ArrayForEach(item,request){if(strcmp(item->string,"enabled")&&strcmp(item->string,"port"))return NULL;for(const cJSON *other=item->next;other;other=other->next)if(!strcmp(item->string,other->string))return NULL;}
 if(cJSON_IsTrue(on)&&(!cJSON_IsNumber(port)||port->valuedouble<1024||port->valuedouble>65535))return NULL;
 unsigned p=cJSON_IsTrue(on)?(unsigned)port->valuedouble:8788;
 if(cJSON_IsTrue(on)&&(port->valuedouble!=p||p==sc_dashboard_port_active()))return NULL;
 if(!lifecycle)return NULL;
 xSemaphoreTake(lifecycle,portMAX_DELAY);
 sc_debug_session_close();stop_expired();
 if(!cJSON_IsTrue(on)){xSemaphoreGive(lifecycle);return sc_debug_access_status();}
 debug_port=p;httpd_config_t config=HTTPD_DEFAULT_CONFIG();config.server_port=p;config.ctrl_port=32769;config.stack_size=8192;config.max_uri_handlers=1;config.max_open_sockets=1;config.lru_purge_enable=true;config.recv_wait_timeout=3;config.send_wait_timeout=3;config.uri_match_fn=httpd_uri_match_wildcard;
 if(httpd_start(&listener,&config)!=ESP_OK){listener=NULL;xSemaphoreGive(lifecycle);return NULL;}
 httpd_uri_t route={.uri="/*",.method=HTTP_GET,.handler=debug_request};char key[65]={0};
 if(httpd_register_uri_handler(listener,&route)!=ESP_OK||!sc_debug_session_start(key)){sc_debug_session_close();stop_expired();xSemaphoreGive(lifecycle);return NULL;}
 cJSON *out=sc_debug_access_status();cJSON_AddStringToObject(out,"api_key",key);mbedtls_platform_zeroize(key,sizeof(key));xSemaphoreGive(lifecycle);return out;
}
