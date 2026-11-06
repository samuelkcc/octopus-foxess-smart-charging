// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#include <assert.h>
#include <arpa/inet.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
static int test_peer(int socket,struct sockaddr *address,socklen_t *size);
#define getpeername test_peer
#include "../main/debug_http.c"
static int64_t ticks=1000000;
int64_t esp_timer_get_time(void){return ticks;}
void esp_fill_random(void *out,size_t size){static unsigned n;for(size_t i=0;i<size;i++)((unsigned char *)out)[i]=(unsigned char)++n;}
static unsigned starts,stops;
static httpd_uri_t registered;
void *httpd_uri_match_wildcard;
esp_err_t httpd_start(httpd_handle_t *out,const httpd_config_t *c){assert(c->server_port==8788&&c->max_open_sockets==1);*out=(void *)1;starts++;return ESP_OK;}
esp_err_t httpd_stop(httpd_handle_t server){(void)server;stops++;return ESP_OK;}
esp_err_t httpd_register_uri_handler(httpd_handle_t h,const httpd_uri_t *r){(void)h;registered=*r;return ESP_OK;}
int httpd_req_to_sockfd(httpd_req_t *r){(void)r;return 1;}
static unsigned long peer_ip=0xc0a80805;
static int test_peer(int socket,struct sockaddr *address,socklen_t *size){(void)socket;(void)size;struct sockaddr_in *peer=(void *)address;peer->sin_family=AF_INET;peer->sin_addr.s_addr=htonl(peer_ip);return 0;}
uint16_t sc_dashboard_port_active(void){return 8787;}
esp_netif_t *esp_netif_get_handle_from_ifkey(const char *key){(void)key;static int net;return &net;}
esp_err_t esp_netif_get_ip_info(esp_netif_t *n,esp_netif_ip_info_t *out){(void)n;out->ip=(esp_ip4_addr_t){{192,168,8,188}};return ESP_OK;}
const esp_app_desc_t *esp_app_get_description(void){static esp_app_desc_t a={.version="2.5.2"};return &a;}
cJSON *sc_runtime_state(void){return cJSON_Parse("{\"revision\":3,\"tariff_stage\":4,\"octopus_http\":200,\"rules\":{\"enabled\":true,\"paused\":false,\"password\":\"PRIVATE\"},\"account\":\"PRIVATE\",\"csrf\":\"PRIVATE\",\"octopus_status\":\"PRIVATE\",\"raw_response\":\"PRIVATE\"}");}
cJSON *sc_ota_status(void){return cJSON_Parse("{\"phase\":\"idle\",\"status\":\"PRIVATE\",\"manifest\":\"PRIVATE\"}");}
static const char *host="192.168.8.188:8788",*origin,*forward,*authorization;
static char status[40],*response;
static const char *header(const char *key){if(!strcmp(key,"Host"))return host;if(!strcmp(key,"Origin"))return origin;if(!strcmp(key,"Forwarded"))return forward;if(!strcmp(key,"Authorization"))return authorization;return NULL;}
size_t httpd_req_get_hdr_value_len(httpd_req_t *r,const char *key){(void)r;const char *v=header(key);return v?strlen(v):0;}
esp_err_t httpd_req_get_hdr_value_str(httpd_req_t *r,const char *key,char *out,size_t n){(void)r;const char *v=header(key);if(!v||strlen(v)>=n)return ESP_FAIL;strcpy(out,v);return ESP_OK;}
esp_err_t httpd_resp_set_status(httpd_req_t *r,const char *s){(void)r;snprintf(status,sizeof(status),"%s",s);return ESP_OK;}
esp_err_t httpd_resp_set_type(httpd_req_t *r,const char *s){(void)r;assert(!strcmp(s,"application/json"));return ESP_OK;}
esp_err_t httpd_resp_set_hdr(httpd_req_t *r,const char *k,const char *v){(void)r;(void)k;(void)v;return ESP_OK;}
esp_err_t httpd_resp_sendstr(httpd_req_t *r,const char *s){(void)r;free(response);response=strdup(s);return ESP_OK;}
static void call(const char *path,int method){httpd_req_t r={.uri=path,.method=method};registered.handler(&r);}
static cJSON *enable(void){cJSON *r=cJSON_Parse("{\"enabled\":true,\"port\":8788}");cJSON *s=sc_debug_access_update(r);cJSON_Delete(r);assert(s);return s;}
int main(void){
 sc_debug_init();sc_debug_http_init();assert(!sc_debug_session_live()&&!starts);
 assert(sc_debug_private_ipv4(0x0a000001)&&sc_debug_private_ipv4(0xac100001)&&sc_debug_private_ipv4(0xc0a80001));
 assert(!sc_debug_private_ipv4(0x7f000001)&&!sc_debug_private_ipv4(0xac200001)&&!sc_debug_private_ipv4(0x08080808));
 cJSON *s=enable();char auth[80];snprintf(auth,sizeof(auth),"Bearer %s",cJSON_GetObjectItem(s,"api_key")->valuestring);cJSON_Delete(s);
 s=sc_debug_access_status();char *safe=cJSON_PrintUnformatted(s);assert(!strstr(safe,auth+7)&&!cJSON_HasObjectItem(s,"api_key"));free(safe);cJSON_Delete(s);
 call("/diagnostics",HTTP_GET);assert(strstr(status,"401"));authorization=auth;call("/diagnostics",HTTP_GET);assert(strstr(status,"200")&&!strstr(response,"PRIVATE")&&!strstr(response,auth+7));assert(strstr(response,"tariff_stage"));
 call("/api/rules",HTTP_POST);assert(strstr(status,"403"));call("/api/rules",HTTP_GET);assert(strstr(status,"404"));call("/diagnostics?api_key=bad",HTTP_GET);assert(strstr(status,"404"));
 origin="http://192.168.8.188:8787";call("/diagnostics",HTTP_GET);assert(strstr(status,"403"));origin=NULL;
 forward="for=127.0.0.1";call("/diagnostics",HTTP_GET);assert(strstr(status,"403"));forward=NULL;
 host="attacker.example";call("/status",HTTP_GET);assert(strstr(status,"403"));host="192.168.8.188:8788";
 peer_ip=0x08080808;call("/events",HTTP_GET);assert(strstr(status,"403"));peer_ip=0xc0a80805;
 for(int i=0;i<600;i++){ticks+=61000000;sc_debug_problem(SC_DEBUG_OCTOPUS,true,429);}
 s=sc_debug_events();assert(cJSON_GetArraySize(s)==512);cJSON_Delete(s);ticks+=86401000000LL;s=sc_debug_events();assert(!cJSON_GetArraySize(s));cJSON_Delete(s);
 call("/diagnostics",HTTP_GET);assert(strstr(status,"401"));sc_debug_http_tick();assert(stops==1);
 s=enable();cJSON_Delete(s);call("/diagnostics",HTTP_GET);assert(strstr(status,"401")&&"Rotation revokes old keys");authorization="Bearer wrong";for(int i=0;i<10;i++)call("/status",HTTP_GET);assert(strstr(status,"429"));
 cJSON *off=cJSON_Parse("{\"enabled\":false}");s=sc_debug_access_update(off);assert(s&&!sc_debug_session_live()&&stops==2);cJSON_Delete(s);cJSON_Delete(off);
 const char *bad[]={"{\"enabled\":true,\"port\":8787}","{\"enabled\":true,\"port\":8788,\"port\":8789}","{\"enabled\":true,\"port\":8788,\"command\":\"write\"}","{\"enabled\":true,\"port\":80}"};
 for(unsigned i=0;i<sizeof(bad)/sizeof(*bad);i++){s=cJSON_Parse(bad[i]);assert(!sc_debug_access_update(s));cJSON_Delete(s);}
 puts("Diagnostics: default-off listener, private-peer/Host/proxy barriers, independent Bearer authentication, expiry, revocation, rate limit, bounded 24-hour RAM events, explicit redaction and no mutation routes passed.");free(response);return 0;
}
