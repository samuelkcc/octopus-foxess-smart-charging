// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../main/dashboard_http.c"
static uint16_t active_test_port=8787;
uint16_t sc_dashboard_port_active(void){return active_test_port;}
const unsigned char dashboard_start[] asm("_binary_dashboard_html_gz_start")={0};
const unsigned char dashboard_end[] asm("_binary_dashboard_html_gz_end")={0};
const unsigned char touch_icon_start[] asm("_binary_apple_touch_icon_png_start")={137,80,78,71,0};
const unsigned char touch_icon_end[] asm("_binary_apple_touch_icon_png_end")={0};
const unsigned char icon192_start[] asm("_binary_icon_192_png_start")={137,80,78,71,0};
const unsigned char icon192_end[] asm("_binary_icon_192_png_end")={0};
const unsigned char icon512_start[] asm("_binary_icon_512_png_start")={137,80,78,71,0};
const unsigned char icon512_end[] asm("_binary_icon_512_png_end")={0};
static unsigned char session_store[sizeof(sessions)], auth_store[sizeof(auth_store_t)];static bool session_exists, auth_exists, fail_storage;
esp_err_t nvs_open(const char *name,int mode,nvs_handle_t *handle){(void)name;(void)mode;*handle=1;return ESP_OK;}
esp_err_t nvs_set_blob(nvs_handle_t h,const char *key,const void *value,size_t size){(void)h;if(fail_storage)return ESP_FAIL;assert(!strcmp(key,"auth")&&size==sizeof(auth_store));memcpy(auth_store,value,size);auth_exists=true;return ESP_OK;}
esp_err_t nvs_get_blob(nvs_handle_t h,const char *key,void *value,size_t *size){(void)h;if(!strcmp(key,"sessions")){if(!session_exists)return ESP_ERR_NVS_NOT_FOUND;assert(*size==sizeof(session_store));memcpy(value,session_store,*size);}else{assert(!strcmp(key,"auth"));if(!auth_exists)return ESP_ERR_NVS_NOT_FOUND;assert(*size==sizeof(auth_store));memcpy(value,auth_store,*size);}return ESP_OK;}
esp_err_t nvs_commit(nvs_handle_t h){(void)h;return ESP_OK;}
void nvs_close(nvs_handle_t h){(void)h;}
static int64_t ticks=1000000;static uint32_t random_state=1;
int64_t esp_timer_get_time(void){return ticks;}
uint32_t esp_random(void){random_state=random_state*1664525u+1013904223u;return random_state;}
void esp_fill_random(void *out,size_t size){for(size_t i=0;i<size;i++)((unsigned char *)out)[i]=esp_random()>>24;}
esp_netif_t *esp_netif_get_handle_from_ifkey(const char *key){(void)key;static int netif=1;return &netif;}
esp_err_t esp_netif_get_ip_info(esp_netif_t *netif,esp_netif_ip_info_t *out){(void)netif;out->ip=(esp_ip4_addr_t){{192,168,8,188}};return ESP_OK;}
typedef struct{const char *host,*origin,*cookie,*csrf,*forwarded,*body;bool closes;char status[40],set_cookie[192];char *response;size_t received;} request_data_t;
static const char *header(httpd_req_t *r,const char *key){request_data_t *d=r->user_ctx;if(!strcmp(key,"Host"))return d->host;if(!strcmp(key,"Origin"))return d->origin;if(!strcmp(key,"Cookie"))return d->cookie;if(!strcmp(key,"X-SC-CSRF"))return d->csrf;if(!strcmp(key,"Content-Type"))return "application/json";if(!strcmp(key,"X-Forwarded-For"))return d->forwarded;return NULL;}
size_t httpd_req_get_hdr_value_len(httpd_req_t *r,const char *key){const char *v=header(r,key);return v?strlen(v):0;}
esp_err_t httpd_req_get_hdr_value_str(httpd_req_t *r,const char *key,char *out,size_t size){const char *v=header(r,key);if(!v||strlen(v)>=size)return ESP_FAIL;strcpy(out,v);return ESP_OK;}
esp_err_t httpd_resp_set_hdr(httpd_req_t *r,const char *key,const char *value){request_data_t *d=r->user_ctx;if(!strcmp(key,"Connection")){assert(!strcmp(value,"close"));d->closes=true;}if(!strcmp(key,"Set-Cookie"))snprintf(d->set_cookie,sizeof(d->set_cookie),"%s",value);return ESP_OK;}
esp_err_t httpd_resp_set_type(httpd_req_t *r,const char *type){(void)r;(void)type;return ESP_OK;}
esp_err_t httpd_resp_set_status(httpd_req_t *r,const char *status){snprintf(((request_data_t *)r->user_ctx)->status,40,"%s",status);return ESP_OK;}
esp_err_t httpd_resp_sendstr(httpd_req_t *r,const char *text){request_data_t *d=r->user_ctx;free(d->response);d->response=strdup(text);return ESP_OK;}
esp_err_t httpd_resp_send(httpd_req_t *r,const char *text,int len){(void)len;return httpd_resp_sendstr(r,text);}
int httpd_req_recv(httpd_req_t *r,char *out,size_t size){request_data_t *d=r->user_ctx;size_t n=strlen(d->body)-d->received;if(n>size)n=size;memcpy(out,d->body+d->received,n);d->received+=n;return (int)n;}
esp_err_t httpd_req_get_url_query_str(httpd_req_t *r,char *out,size_t size){(void)r;(void)out;(void)size;return ESP_FAIL;}
esp_err_t httpd_query_key_value(const char *q,const char *key,char *out,size_t size){(void)q;(void)key;(void)out;(void)size;return ESP_FAIL;}
esp_err_t httpd_register_uri_handler(httpd_handle_t h,const httpd_uri_t *uri){(void)h;(void)uri;return ESP_OK;}
cJSON *sc_runtime_state(void){return cJSON_Parse("{\"schema\":1,\"revision\":1}");}
cJSON *sc_runtime_account(void){return cJSON_Parse("{\"account_number\":\"A-TEST\"}");}
cJSON *sc_runtime_history(int days){(void)days;return cJSON_CreateArray();}
bool sc_runtime_request_refresh(const char *service){return !strcmp(service,"octopus")||!strcmp(service,"foxess");}
bool sc_runtime_manual(const cJSON *value){return cJSON_IsObject(value);}
unsigned sc_runtime_revision(void){return 1;}
bool sc_runtime_update_expected(const cJSON *value,unsigned expected){return cJSON_IsObject(value)&&expected==1;}
static void call(request_data_t *data,const char *path,int method,const char *body){data->body=body?body:"";data->received=0;data->status[0]=0;data->closes=false;httpd_req_t req={.uri=path,.method=method,.content_len=(int)strlen(data->body),.user_ctx=data};assert(api(&req)!=ESP_OK&&data->closes);}
int main(void){sc_runtime_register(NULL);request_data_t d={.host="192.168.8.188:8787",.origin="http://192.168.8.188:8787"};d.host="192.168.8.188";call(&d,"/api/state",HTTP_GET,NULL);assert(strstr(d.status,"403"));
 d.host="192.168.8.188:80";call(&d,"/api/state",HTTP_GET,NULL);assert(strstr(d.status,"403"));
 d.host="192.168.8.188:8787";d.origin="http://192.168.8.188";call(&d,"/api/rules",HTTP_POST,"{}");assert(strstr(d.status,"403"));d.origin="http://192.168.8.188:8787";
 httpd_req_t manifest={.uri="/site.webmanifest",.method=HTTP_GET,.user_ctx=&d};app_asset(&manifest);assert(strstr(d.response,"icon-192.png")&&strstr(d.response,"standalone"));d.host="attacker.example";d.status[0]=0;app_asset(&manifest);assert(!strcmp(d.status,"403 Forbidden"));d.host="192.168.8.188:8787";call(&d,"/api/state",HTTP_GET,NULL);assert(!d.status[0]&&"Fresh deployments are open on LAN");
 cJSON *open_state=cJSON_Parse(d.response);assert(cJSON_IsFalse(cJSON_GetObjectItem(open_state,"lan_access_enabled")));char open_token[65];strcpy(open_token,cJSON_GetObjectItem(open_state,"csrf")->valuestring);cJSON_Delete(open_state);
 call(&d,"/api/rules",HTTP_POST,"{}");assert(strstr(d.status,"401")&&"Open LAN mutations still require CSRF");
 call(&d,"/api/account",HTTP_GET,NULL);assert(!d.status[0]&&strstr(d.response,"A-TEST"));
 call(&d,"/api/refresh",HTTP_POST,"{\"service\":\"octopus\"}");assert(strstr(d.status,"401"));
 call(&d,"/api/telemetry-mode",HTTP_POST,"{\"mode\":\"rest\"}");assert(strstr(d.status,"401"));
 d.csrf=open_token;call(&d,"/api/telemetry-mode",HTTP_POST,"{\"mode\":\"rest\",\"password\":\"forbidden\"}");assert(strstr(d.status,"400"));call(&d,"/api/telemetry-mode",HTTP_POST,"{\"mode\":\"live-ws\"}");assert(strstr(d.status,"400"));call(&d,"/api/telemetry-mode",HTTP_POST,"{\"mode\":\"rest\"}");assert(!d.status[0]&&strstr(d.response,"REST selected"));
 d.csrf=open_token;call(&d,"/api/refresh",HTTP_POST,"{\"service\":\"bad\"}");assert(strstr(d.status,"400"));call(&d,"/api/refresh",HTTP_POST,"{\"service\":\"octopus\"}");assert(!d.status[0]&&strstr(d.response,"queued"));call(&d,"/api/lan-access",HTTP_POST,"{\"enabled\":true,\"access_code\":\"short\"}");assert(strstr(d.status,"400"));
 fail_storage=true;call(&d,"/api/lan-access",HTTP_POST,"{\"enabled\":true,\"access_code\":\"mock-access-code\"}");assert(strstr(d.status,"503")&&!protected_lan());fail_storage=false;
 call(&d,"/api/lan-access",HTTP_POST,"{\"enabled\":true,\"access_code\":\"mock-access-code\"}");assert(!d.status[0]&&protected_lan());assert(!memmem(auth_store,sizeof(auth_store),"mock-access-code",16));
 call(&d,"/api/state",HTTP_GET,NULL);assert(strstr(d.status,"401"));
 call(&d,"/api/login",HTTP_POST,"{\"access_code\":\"incorrect-code\"}");assert(strstr(d.status,"401"));
 call(&d,"/api/login",HTTP_POST,"{\"access_code\":\"mock-access-code\"}");assert(!d.status[0]&&"Saved LAN code can sign in");
 memset(&lan_access,0,sizeof(lan_access));load_sessions();assert(protected_lan()&&"LAN protection persists after restart");
 char body[80]="{\"access_code\":\"mock-access-code\"}";
 call(&d,"/api/login",HTTP_POST,body);assert(!d.status[0]);assert(strstr(d.set_cookie,"HttpOnly")&&strstr(d.set_cookie,"SameSite=Strict")&&strstr(d.set_cookie,"Max-Age=2592000"));char cookie[72];snprintf(cookie,sizeof(cookie),"%.71s",d.set_cookie);d.cookie=cookie;
 call(&d,"/api/state",HTTP_GET,NULL);assert(!d.status[0]);cJSON *state=cJSON_Parse(d.response);const cJSON *csrf=cJSON_GetObjectItem(state,"csrf");assert(cJSON_IsString(csrf)&&strlen(csrf->valuestring)==64);char csrf_copy[65];strcpy(csrf_copy,csrf->valuestring);d.csrf=csrf_copy;cJSON_Delete(state);

 call(&d,"/api/rules",HTTP_POST,"{\"revision\":1,\"rules\":{\"enabled\":true},\"acknowledge_control\":true}");assert(!d.status[0]);
 d.csrf=NULL;call(&d,"/api/rules",HTTP_POST,"{}");assert(strstr(d.status,"401"));d.csrf=csrf_copy;
 d.origin="https://attacker.example";call(&d,"/api/rules",HTTP_POST,"{}");assert(strstr(d.status,"403"));d.origin="http://192.168.8.188:8787";
 d.forwarded="127.0.0.1";call(&d,"/api/state",HTTP_GET,NULL);assert(strstr(d.status,"403"));d.forwarded=NULL;
 d.host="attacker.example";call(&d,"/api/state",HTTP_GET,NULL);assert(strstr(d.status,"403"));d.host="192.168.8.188:8787";
 d.forwarded="127.0.0.1";call(&d,"/api/account",HTTP_GET,NULL);assert(strstr(d.status,"403"));d.forwarded=NULL;
 call(&d,"/api/config",HTTP_GET,NULL);assert(strstr(d.status,"404"));
 memset(sessions,0,sizeof(sessions));load_sessions();call(&d,"/api/state",HTTP_GET,NULL);assert(!d.status[0]&&"Hashed browser session survives device restart");state=cJSON_Parse(d.response);strcpy(csrf_copy,cJSON_GetObjectItem(state,"csrf")->valuestring);cJSON_Delete(state);

 call(&d,"/api/logout",HTTP_POST,"{}");assert(strstr(d.set_cookie,"Max-Age=0"));call(&d,"/api/state",HTTP_GET,NULL);assert(strstr(d.status,"401"));call(&d,"/api/account",HTTP_GET,NULL);assert(strstr(d.status,"401"));
 ticks+=61000000;for(int i=0;i<6;i++)call(&d,"/api/login",HTTP_POST,"{\"access_code\":\"incorrect\"}");assert(strstr(d.status,"429"));
 ticks+=61000000;call(&d,"/api/login",HTTP_POST,"{\"access_code\":\"mock-access-code\"}");assert(!d.status[0]);snprintf(cookie,sizeof(cookie),"%.71s",d.set_cookie);d.cookie=cookie;
 call(&d,"/api/state",HTTP_GET,NULL);state=cJSON_Parse(d.response);strcpy(csrf_copy,cJSON_GetObjectItem(state,"csrf")->valuestring);cJSON_Delete(state);d.csrf=csrf_copy;
 call(&d,"/api/lan-access",HTTP_POST,"{\"enabled\":false,\"access_code\":\"\"}");assert(!d.status[0]&&!protected_lan());d.cookie=NULL;d.csrf=NULL;
 load_sessions();call(&d,"/api/state",HTTP_GET,NULL);assert(!d.status[0]&&!protected_lan()&&"Disabling survives restart and opens LAN");
 d.forwarded="127.0.0.1";call(&d,"/api/state",HTTP_GET,NULL);assert(strstr(d.status,"403")&&"Open LAN never grants proxy access");d.forwarded=NULL;
 auth_store[0]=99;load_sessions();assert(protected_lan()&&"Corrupt access settings fail closed");call(&d,"/api/state",HTTP_GET,NULL);assert(strstr(d.status,"401"));
 fail_storage=true;assert(!sc_runtime_reset_lan_access()&&protected_lan());fail_storage=false;
 assert(sc_runtime_reset_lan_access()&&!protected_lan());load_sessions();call(&d,"/api/state",HTTP_GET,NULL);assert(!d.status[0]&&!protected_lan()&&"Physical USB recovery removes protection without a PIN");
 free(d.response);
 puts("ESP32 HTTP access tests passed: default-open LAN, optional persistent access code, protected-code login, fail-closed corruption, physical-USB recovery without pairing codes, HttpOnly session, CSRF, Origin/Host validation, proxy denial, logout, key separation and login rate limiting.");
}

#include "foxess_live.h"
void sc_live_init(void){}
void sc_live_poll(const sc_config_t *device,bool online){(void)device;(void)online;}
cJSON *sc_live_reading(void){return NULL;}
cJSON *sc_live_status(void){return cJSON_Parse("{\"mode\":\"rest\",\"configured\":false,\"source\":\"rest\",\"status\":\"REST selected\"}");}
bool sc_live_set_mode(const char *mode){return mode&&!strcmp(mode,"rest");}

void sc_service_setup_init(void){}
bool sc_service_setup_submit(const cJSON *body,unsigned *id){(void)body;*id=77;return true;}
cJSON *sc_service_setup_status(unsigned id){return id==77?cJSON_Parse("{\"id\":77,\"phase\":\"done\",\"result\":{\"connected\":true}} "):NULL;}
