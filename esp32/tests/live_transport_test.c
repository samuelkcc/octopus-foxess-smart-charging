// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../main/foxess_live.c"
static int64_t ticks;
static int logins,plants,connects,saves,pings,login_http=200;
static bool storage_failure,connect_failure;
static sc_live_config_t stored;
static esp_http_client_config_t http_options;
static const char *frame_text="{\"errno\":0,\"result\":{\"timeDiff\":1,\"node\":{\"bat\":{\"soc\":80,\"charge\":1,\"power\":{\"unit\":\"kW\",\"value\":0.2}}}}}";
static size_t frame_position;static bool frame_ready,fragmented;
int64_t esp_timer_get_time(void){ticks+=10000;return ticks;}
time_t sc_test_time(time_t *out){time_t now=1793916000+ticks/1000000;if(out)*out=now;return now;}
esp_err_t sc_live_load(sc_live_config_t *out){*out=stored;return ESP_OK;}
esp_err_t sc_live_save(const sc_live_config_t *value){if(storage_failure)return ESP_FAIL;stored=*value;saves++;return ESP_OK;}
esp_http_client_handle_t esp_http_client_init(const esp_http_client_config_t *options){assert(!strcmp(options->url,"https://www.foxesscloud.com/basic/v0/user/login"));assert(options->crt_bundle_attach&&options->disable_auto_redirect);http_options=*options;return (void *)1;}
esp_err_t esp_http_client_set_method(esp_http_client_handle_t c,int method){(void)c;assert(method==HTTP_METHOD_POST);return ESP_OK;}
esp_err_t esp_http_client_set_header(esp_http_client_handle_t c,const char *key,const char *value){(void)c;if(!strcmp(key,"token"))assert(!*value);if(!strcmp(key,"signature"))assert(strchr(value,'.'));return ESP_OK;}
esp_err_t esp_http_client_set_post_field(esp_http_client_handle_t c,const char *text,int length){(void)c;(void)length;assert(!strstr(text,"example-private-password"));assert(strstr(text,"password"));return ESP_OK;}
esp_err_t esp_http_client_perform(esp_http_client_handle_t c){(void)c;logins++;const char *text="{\"errno\":0,\"result\":{\"token\":\"private-portal-token\"}}";esp_http_client_event_t e={.event_id=HTTP_EVENT_ON_DATA,.data=(char *)text,.data_len=strlen(text),.user_data=http_options.user_data};return http_options.event_handler(&e);}
int esp_http_client_get_status_code(esp_http_client_handle_t c){(void)c;return login_http;}
esp_err_t esp_http_client_cleanup(esp_http_client_handle_t c){(void)c;return ESP_OK;}
cJSON *sc_cloud_read(const sc_config_t *device,bool fox,const char *path,const cJSON *body,const char *jwt,int *http,int *retry){(void)device;(void)body;(void)jwt;assert(fox&&!strcmp(path,"/op/v0/plant/list"));plants++;*http=200;*retry=0;return cJSON_Parse("{\"errno\":0,\"result\":{\"data\":[{\"stationID\":\"plant-1\"}]}}");}
esp_transport_handle_t esp_transport_ssl_init(void){return (void *)1;}
void esp_transport_ssl_crt_bundle_attach(esp_transport_handle_t t,esp_err_t (*attach)(void *)){(void)t;assert(attach);}
esp_transport_handle_t esp_transport_ws_init(esp_transport_handle_t t){assert(t);return (void *)2;}
void esp_transport_ws_set_path(esp_transport_handle_t t,const char *path){(void)t;assert(strstr(path,"/dew/v0/wsmaitian?plantId=plant-1&token=private-portal-token&platform=web&lang=en"));}
esp_err_t esp_transport_ws_set_user_agent(esp_transport_handle_t t,const char *agent){(void)t;assert(agent);return ESP_OK;}
int esp_transport_connect(esp_transport_handle_t t,const char *host,int port,int timeout){(void)t;(void)timeout;connects++;assert(!strcmp(host,"www.foxesscloud.com")&&port==443);return connect_failure?-1:0;}
int esp_transport_close(esp_transport_handle_t t){(void)t;return 0;}
esp_err_t esp_transport_destroy(esp_transport_handle_t t){(void)t;return ESP_OK;}
int esp_transport_ws_send_raw(esp_transport_handle_t t,ws_transport_opcodes_t opcode,const char *text,int length,int timeout){(void)t;(void)timeout;if((opcode&0x7f)==WS_TRANSPORT_OPCODES_TEXT){assert(length==7&&!strcmp(text,"getdata"));/* IDF masks the caller buffer in place. A Flash/string literal must fail this contract. */for(int i=0;i<length;i++)((char *)text)[i]^=0x5a;for(int i=0;i<length;i++)((char *)text)[i]^=0x5a;assert(!strcmp(text,"getdata"));frame_ready=true;frame_position=0;}else{assert((opcode&0x7f)==WS_TRANSPORT_OPCODES_PING);pings++;}return length;}
int esp_transport_poll_read(esp_transport_handle_t t,int timeout){(void)t;(void)timeout;return frame_ready?1:0;}
int esp_transport_read(esp_transport_handle_t t,char *out,int max,int timeout){(void)t;(void)timeout;size_t remaining=strlen(frame_text)-frame_position,n=fragmented&&frame_position==0?remaining/2:remaining;assert(n<=(size_t)max);memcpy(out,frame_text+frame_position,n);frame_position+=n;if(frame_position==strlen(frame_text))frame_ready=false;return n;}
ws_transport_opcodes_t esp_transport_ws_get_read_opcode(esp_transport_handle_t t){(void)t;return WS_TRANSPORT_OPCODES_TEXT;}
int esp_transport_ws_get_read_payload_len(esp_transport_handle_t t){(void)t;return strlen(frame_text);}
bool esp_transport_ws_get_fin_flag(esp_transport_handle_t t){(void)t;return true;}
int main(void){
 sc_config_t device={0};sc_live_init();for(int i=0;i<30;i++)sc_live_poll(&device,true);assert(!logins&&!plants&&!connects&&!saves);assert(!sc_live_set_mode("live-ws"));
 login_http=401;cJSON *request=cJSON_Parse("{\"mode\":\"rest\",\"username\":\"test-user\",\"password\":\"example-private-password\"}");cJSON *result=sc_live_configure(request,&device);assert(result&&!cJSON_IsTrue(cJSON_GetObjectItem(result,"saved")));assert(!saves&&!stored.username[0]);cJSON_Delete(request);cJSON_Delete(result);
 int attempts=logins;request=cJSON_Parse("{\"mode\":\"rest\",\"username\":\"test-user\",\"password\":\"example-private-password\"}");result=sc_live_configure(request,&device);assert(!cJSON_IsTrue(cJSON_GetObjectItem(result,"saved"))&&logins==attempts);cJSON_Delete(result);cJSON_Delete(request);
 ticks+=60000000;login_http=200;request=cJSON_Parse("{\"mode\":\"rest\",\"username\":\"test-user\",\"password\":\"example-private-password\"}");result=sc_live_configure(request,&device);assert(cJSON_IsTrue(cJSON_GetObjectItem(result,"saved")));assert(!stored.websocket&&strlen(stored.password_hash)==32);assert(!strcmp(cJSON_GetObjectItem(request,"password")->valuestring,""));assert(!connects);cJSON_Delete(result);cJSON_Delete(request);
 assert(sc_live_set_mode("live-ws"));sc_live_poll(&device,true);cJSON *reading=sc_live_reading();assert(reading&&cJSON_GetObjectItem(reading,"soc")->valueint==80);cJSON_Delete(reading);
 cJSON *public=sc_live_status();char *text=cJSON_PrintUnformatted(public);assert(!strstr(text,"test-user")&&!strstr(text,"private-portal-token")&&!strstr(text,"password"));free(text);cJSON_Delete(public);
 unsigned before=frame_sequence;fragmented=true;frame_ready=true;frame_position=0;assert(read_socket());assert(frame_sequence==before);assert(read_socket());assert(frame_sequence==before+1);fragmented=false;
 ticks+=31000000;sc_live_poll(&device,true);assert(!sc_live_reading()&&!socket_transport);public=sc_live_status();assert(!strcmp(cJSON_GetObjectItem(public,"source")->valuestring,"rest-fallback"));cJSON_Delete(public);
 connect_failure=true;ticks+=60000000;sc_live_poll(&device,true);int old=connects;sc_live_poll(&device,true);assert(connects==old);assert(sc_live_set_mode("rest"));sc_live_poll(&device,true);assert(!stored.websocket);
 int old_saves=saves;ticks+=60000000;connect_failure=false;sc_live_config_t previous=stored;request=cJSON_Parse("{\"mode\":\"live-ws\",\"username\":\"test-user\",\"password\":\"\"}");result=sc_live_test(request,&device);assert(result&&cJSON_IsTrue(cJSON_GetObjectItem(result,"connected"))&&!cJSON_IsTrue(cJSON_GetObjectItem(result,"saved")));assert(saves==old_saves&&!memcmp(&stored,&previous,sizeof(stored)));assert(!socket_transport);cJSON_Delete(result);cJSON_Delete(request);
 int cached_logins=logins;request=cJSON_Parse("{\"mode\":\"live-ws\",\"username\":\"test-user\",\"password\":\"\"}");result=sc_live_configure(request,&device);assert(cJSON_IsTrue(cJSON_GetObjectItem(result,"saved"))&&stored.websocket&&logins==cached_logins);assert(!strcmp(source,"rest-fallback")&&restart_requested);cJSON_Delete(result);cJSON_Delete(request);assert(sc_live_set_mode("rest"));
 ticks+=60000000;request=cJSON_Parse("{\"mode\":\"rest\",\"username\":\"new-user\",\"password\":\"new-private-password\"}");result=sc_live_test(request,&device);assert(cJSON_IsTrue(cJSON_GetObjectItem(result,"connected"))&&!cJSON_IsTrue(cJSON_GetObjectItem(result,"saved")));cJSON_Delete(result);cJSON_Delete(request);assert(!strcmp(stored.username,"test-user"));
 cached_logins=logins;request=cJSON_Parse("{\"mode\":\"live-ws\",\"username\":\"new-user\",\"password\":\"different-password\"}");result=sc_live_configure(request,&device);assert(!cJSON_IsTrue(cJSON_GetObjectItem(result,"saved"))&&logins==cached_logins&&!strcmp(stored.username,"test-user"));cJSON_Delete(result);cJSON_Delete(request);
 request=cJSON_Parse("{\"mode\":\"live-ws\",\"username\":\"new-user\",\"password\":\"new-private-password\"}");result=sc_live_configure(request,&device);assert(cJSON_IsTrue(cJSON_GetObjectItem(result,"saved"))&&logins==cached_logins&&!strcmp(stored.username,"new-user"));cJSON_Delete(result);cJSON_Delete(request);assert(sc_live_set_mode("rest"));
 ticks+=60000000;request=cJSON_Parse("{\"mode\":\"live-ws\",\"username\":\"\",\"password\":\"\"}");result=sc_live_test(request,&device);assert(cJSON_IsTrue(cJSON_GetObjectItem(result,"connected")));cJSON_Delete(result);cJSON_Delete(request);cached_logins=logins;ticks+=301000000;
 request=cJSON_Parse("{\"mode\":\"live-ws\",\"username\":\"\",\"password\":\"\"}");result=sc_live_configure(request,&device);assert(cJSON_IsTrue(cJSON_GetObjectItem(result,"saved"))&&logins==cached_logins+1);cJSON_Delete(result);cJSON_Delete(request);assert(sc_live_set_mode("rest"));
 int before_login=logins,before_plants=plants,before_connects=connects;
 request=cJSON_Parse("{\"mode\":\"rest\",\"username\":\"unverified-user\",\"password\":\"unverified-password\"}");
 result=sc_live_store(request);assert(cJSON_IsTrue(cJSON_GetObjectItem(result,"saved"))&&!cJSON_IsTrue(cJSON_GetObjectItem(result,"tested"))&&!cJSON_HasObjectItem(result,"connected"));assert(!strcmp(stored.username,"unverified-user"));assert(logins==before_login&&plants==before_plants&&connects==before_connects);cJSON_Delete(result);cJSON_Delete(request);
 storage_failure=true;previous=stored;request=cJSON_Parse("{\"mode\":\"live-ws\",\"username\":\"failed-user\",\"password\":\"failed-password\"}");result=sc_live_store(request);assert(!cJSON_IsTrue(cJSON_GetObjectItem(result,"saved"))&&!memcmp(&stored,&previous,sizeof(stored)));assert(logins==before_login&&plants==before_plants&&connects==before_connects);cJSON_Delete(result);cJSON_Delete(request);
 assert(!sc_live_set_mode("live-ws")&&!stored.websocket);assert(!sc_live_set_mode("other"));
 puts("Optional telemetry transport: zero requests by default, verified login, saved-login reuse, credential-free status, fresh and fragmented frames, stale fallback, reconnect pacing and failed-save preservation passed.");
}
