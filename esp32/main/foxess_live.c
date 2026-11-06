// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Optional, read-only FoxESS portal transport. See THIRD_PARTY_NOTICES.md.
#include "foxess_live.h"
#include "foxess_live_policy.h"
#include "cloud_read.h"
#include "esp_crt_bundle.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_transport.h"
#include "esp_transport_ssl.h"
#include "esp_transport_ws.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "mbedtls/md5.h"
#include "mbedtls/platform_util.h"
#include <ctype.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#define FRAME_LIMIT 32768
static SemaphoreHandle_t guard;
static sc_live_config_t selected,verified_config;
static int64_t verified_at;
static unsigned verified_generation;
static unsigned generation,connected_generation;
static bool testing;
static _Atomic bool restart_requested;
static esp_transport_handle_t socket_transport,ssl_transport;
static cJSON *latest;
static time_t latest_at;
static unsigned frame_sequence,connect_sequence;
static int64_t next_attempt,next_ping,connected_at,portal_not_before;
static unsigned failures;
static char token[2048],plant[65];
static time_t token_at;
static char *message;
static size_t used,frame_left;
static const char *status="REST selected",*source="rest";
static int login_http_code,login_error_code,plant_http_code;
static const char *test_stage="idle";
static void state(const char *text,const char *kind){xSemaphoreTake(guard,portMAX_DELAY);status=text;source=kind;xSemaphoreGive(guard);}
static bool configured(const sc_live_config_t *config){return config->username[0]&&strlen(config->password_hash)==32;}
static void close_socket(void){
 if(socket_transport){esp_transport_close(socket_transport);esp_transport_destroy(socket_transport);socket_transport=NULL;}
 if(ssl_transport){esp_transport_destroy(ssl_transport);ssl_transport=NULL;}
 if(message){mbedtls_platform_zeroize(message,FRAME_LIMIT+1);free(message);message=NULL;}
 used=frame_left=0;
}
static void forget_session(void){mbedtls_platform_zeroize(token,sizeof(token));plant[0]=0;token_at=0;}
void sc_live_init(void){
 if(guard)return;
 guard=xSemaphoreCreateMutex();sc_live_load(&selected);
 // The SDK can log a complete upgrade request on failure. Its path contains
 // a FoxESS session token, so this transport must never emit those logs.
 esp_log_level_set("transport_ws",ESP_LOG_NONE);
}
cJSON *sc_live_status(void){
 cJSON *out=cJSON_CreateObject();xSemaphoreTake(guard,portMAX_DELAY);
 cJSON_AddStringToObject(out,"mode",selected.websocket?"live-ws":"rest");cJSON_AddBoolToObject(out,"configured",configured(&selected));
 cJSON_AddStringToObject(out,"status",status);cJSON_AddStringToObject(out,"source",source);cJSON_AddNumberToObject(out,"updated_at",latest_at);
 cJSON_AddBoolToObject(out,"testing",testing);cJSON_AddStringToObject(out,"test_stage",test_stage);cJSON_AddNumberToObject(out,"login_http",login_http_code);cJSON_AddNumberToObject(out,"login_errno",login_error_code);cJSON_AddNumberToObject(out,"plant_http",plant_http_code);
 cJSON_AddBoolToObject(out,"fresh",!testing&&selected.websocket&&latest_at&&time(NULL)-latest_at<=30&&!strcmp(source,"live-ws"));
 xSemaphoreGive(guard);return out;
}
cJSON *sc_live_reading(void){
 xSemaphoreTake(guard,portMAX_DELAY);cJSON *out=!testing&&selected.websocket&&latest_at&&time(NULL)-latest_at<=30&&!strcmp(source,"live-ws")?cJSON_Duplicate(latest,true):NULL;xSemaphoreGive(guard);return out;
}
bool sc_live_set_mode(const char *mode){
 if(!mode||(strcmp(mode,"rest")&&strcmp(mode,"live-ws")))return false;
 xSemaphoreTake(guard,portMAX_DELAY);sc_live_config_t candidate=selected;candidate.websocket=!strcmp(mode,"live-ws");
 bool ok=!testing&&(!candidate.websocket||configured(&candidate))&&sc_live_save(&candidate)==ESP_OK;
 if(ok){selected=candidate;generation++;restart_requested=true;status=candidate.websocket?"WebSocket connection queued":"REST selected";source=candidate.websocket?"rest-fallback":"rest";}
 mbedtls_platform_zeroize(&candidate,sizeof(candidate));xSemaphoreGive(guard);return ok;
}
typedef struct{char *bytes;size_t length;bool overflow;} response_t;
static esp_err_t receive(esp_http_client_event_t *event){
 response_t *out=event->user_data;if(event->event_id==HTTP_EVENT_ON_DATA){
  if(event->data_len<0||out->length+(size_t)event->data_len>FRAME_LIMIT){out->overflow=true;return ESP_FAIL;}
  memcpy(out->bytes+out->length,event->data,event->data_len);out->length+=event->data_len;out->bytes[out->length]=0;
 }return ESP_OK;
}
static bool login(const sc_live_config_t *config){
 test_stage="Checking FoxESS cloud login";
 if(token[0]&&time(NULL)-token_at<12*3600)return true;
 if(esp_timer_get_time()<portal_not_before)return false;
 portal_not_before=esp_timer_get_time()+60000000;
 const char *path="/basic/v0/user/login";char stamp[32],signature[64],date[32],dt[100];
 snprintf(stamp,sizeof(stamp),"%lld",(long long)time(NULL)*1000);struct tm utc;time_t now=time(NULL);gmtime_r(&now,&utc);strftime(date,sizeof(date),"%Y-%m-%d %H:%M:%S",&utc);snprintf(dt,sizeof(dt),"Europe/London@%s@%s",stamp,date);
 if(!sc_fox_web_signature(path,"","en",stamp,signature))return false;
 cJSON *body=cJSON_CreateObject();if(!body)return false;cJSON_AddStringToObject(body,"user",config->username);cJSON_AddStringToObject(body,"password",config->password_hash);cJSON_AddNumberToObject(body,"type",1);cJSON_AddNumberToObject(body,"verification",1);
 char *text=cJSON_PrintUnformatted(body);cJSON_Delete(body);response_t response={.bytes=calloc(FRAME_LIMIT+1,1)};
 if(!text||!response.bytes){free(text);free(response.bytes);return false;}
 esp_http_client_config_t options={.url="https://www.foxesscloud.com/basic/v0/user/login",.timeout_ms=15000,.crt_bundle_attach=esp_crt_bundle_attach,.disable_auto_redirect=true,.event_handler=receive,.user_data=&response};
 esp_http_client_handle_t client=esp_http_client_init(&options);bool ok=false;
 if(client){
  esp_http_client_set_method(client,HTTP_METHOD_POST);esp_http_client_set_post_field(client,text,strlen(text));
  const char *names[]={"Content-Type","User-Agent","Accept","lang","timestamp","signature","token","timezone","dt","platform"};
  const char *values[]={"application/json","Mozilla/5.0","application/json, text/plain, */*","en",stamp,signature,"","Europe/London",dt,"web"};
  for(unsigned i=0;i<10;i++)esp_http_client_set_header(client,names[i],values[i]);
  esp_err_t result=esp_http_client_perform(client);int http=esp_http_client_get_status_code(client);login_http_code=http;login_error_code=0;
  if(result==ESP_OK&&http==200&&!response.overflow){
   cJSON *data=cJSON_Parse(response.bytes);const cJSON *error=cJSON_GetObjectItemCaseSensitive(data,"errno"),*value=cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(data,"result"),"token");
   login_error_code=cJSON_IsNumber(error)?error->valueint:-1;
   if(cJSON_IsNumber(error)&&error->valuedouble==0&&cJSON_IsString(value)&&value->valuestring[0]&&strlen(value->valuestring)<sizeof(token)){
    strcpy(token,value->valuestring);token_at=time(NULL);ok=true;
   }cJSON_Delete(data);
  }
  if(http==429){portal_not_before=esp_timer_get_time()+900000000LL;next_attempt=portal_not_before;}
  esp_http_client_cleanup(client);
 }
 mbedtls_platform_zeroize(text,strlen(text));free(text);mbedtls_platform_zeroize(response.bytes,FRAME_LIMIT+1);free(response.bytes);return ok;
}
static bool discover(const sc_config_t *device){
 test_stage="Checking FoxESS plant access";
 if(plant[0])return true;
 cJSON *body=cJSON_CreateObject();if(!body)return false;
 cJSON_AddNumberToObject(body,"currentPage",1);cJSON_AddNumberToObject(body,"pageSize",10);int http=0,retry=0;
 cJSON *data=sc_cloud_read(device,true,"/op/v0/plant/list",body,NULL,&http,&retry);plant_http_code=http;cJSON_Delete(body);
 const cJSON *rows=cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(data,"result"),"data"),*id=cJSON_GetObjectItemCaseSensitive(cJSON_GetArrayItem(rows,0),"stationID");
 bool ok=false;if(http==200&&cJSON_IsString(id)&&id->valuestring[0]&&strlen(id->valuestring)<sizeof(plant)){strcpy(plant,id->valuestring);ok=true;}
 else if(http==200&&cJSON_IsNumber(id)&&id->valuedouble>0){snprintf(plant,sizeof(plant),"%.0f",id->valuedouble);ok=true;}
 if(http==429)next_attempt=esp_timer_get_time()+(int64_t)(retry>60?retry:600)*1000000;
 cJSON_Delete(data);return ok;
}
static char *encode(const char *text){
 size_t length=strlen(text);char *out=calloc(length*3+1,1);if(!out)return NULL;char *at=out;
 for(size_t i=0;i<length;i++){unsigned char c=text[i];if(isalnum(c)||c=='-'||c=='_'||c=='.'||c=='~')*at++=c;else{snprintf(at,4,"%%%02X",c);at+=3;}}return out;
}
static bool connect_socket(const sc_live_config_t *config,const sc_config_t *device,unsigned revision){
 close_socket();if(!discover(device)||!login(config))return false;
 char *safe_token=encode(token),*safe_plant=encode(plant);if(!safe_token||!safe_plant){free(safe_token);free(safe_plant);return false;}
 size_t size=strlen(safe_token)+strlen(safe_plant)+96;char *path=calloc(size,1);
 if(!path){free(safe_token);free(safe_plant);return false;}
 snprintf(path,size,"/dew/v0/wsmaitian?plantId=%s&token=%s&platform=web&lang=en",safe_plant,safe_token);
 ssl_transport=esp_transport_ssl_init();if(ssl_transport){esp_transport_ssl_crt_bundle_attach(ssl_transport,esp_crt_bundle_attach);socket_transport=esp_transport_ws_init(ssl_transport);}
 bool ok=false;
 test_stage="Opening the secure WebSocket";
 if(socket_transport){esp_transport_ws_set_path(socket_transport,path);esp_transport_ws_set_user_agent(socket_transport,"Mozilla/5.0");ok=esp_transport_connect(socket_transport,"www.foxesscloud.com",443,15000)==0;}
 mbedtls_platform_zeroize(safe_token,strlen(safe_token));free(safe_token);free(safe_plant);mbedtls_platform_zeroize(path,size);free(path);
 // IDF masks payload bytes in place despite its const-qualified API. Never pass Flash literals.
 if(ok){char request[]="getdata";message=calloc(FRAME_LIMIT+1,1);ok=message&&esp_transport_ws_send_raw(socket_transport,WS_TRANSPORT_OPCODES_TEXT|WS_TRANSPORT_OPCODES_FIN,request,sizeof(request)-1,2000)==sizeof(request)-1;}
 if(!ok){close_socket();forget_session();return false;}
 connected_generation=revision;connect_sequence=frame_sequence;connected_at=esp_timer_get_time();next_ping=connected_at+20000000;state("Waiting for a fresh WebSocket frame","rest-fallback");return true;
}
static bool read_socket(void){
 if(esp_transport_poll_read(socket_transport,0)<=0)return true;
 char chunk[2048];int length=esp_transport_read(socket_transport,chunk,sizeof(chunk),100);
 if(length<0)return false;
 ws_transport_opcodes_t opcode=esp_transport_ws_get_read_opcode(socket_transport);
 if(opcode==WS_TRANSPORT_OPCODES_CLOSE)return false;
 if(length==0)return true;
 if(opcode!=WS_TRANSPORT_OPCODES_TEXT&&opcode!=WS_TRANSPORT_OPCODES_CONT)return true;
 if(!frame_left)frame_left=esp_transport_ws_get_read_payload_len(socket_transport);
 if((size_t)length>frame_left||used+(size_t)length>FRAME_LIMIT)return false;
 memcpy(message+used,chunk,length);used+=length;frame_left-=length;message[used]=0;
 if(!frame_left&&esp_transport_ws_get_fin_flag(socket_transport)){
  cJSON *frame=cJSON_Parse(message),*values=sc_fox_live_values(frame);cJSON_Delete(frame);
  if(values){xSemaphoreTake(guard,portMAX_DELAY);cJSON_Delete(latest);latest=values;latest_at=time(NULL);frame_sequence++;status="Live WebSocket telemetry";source="live-ws";xSemaphoreGive(guard);failures=0;}
  mbedtls_platform_zeroize(message,used);used=0;
 }return true;
}
void sc_live_poll(const sc_config_t *device,bool online){
 if(verified_at&&esp_timer_get_time()-verified_at>300000000LL){verified_at=0;mbedtls_platform_zeroize(&verified_config,sizeof(verified_config));}
 sc_live_config_t config;xSemaphoreTake(guard,portMAX_DELAY);config=selected;unsigned revision=generation;xSemaphoreGive(guard);
 bool reset=restart_requested;restart_requested=false;if(reset){close_socket();next_attempt=0;}
 if(!online||!config.websocket||!configured(&config)){
  close_socket();state(!online?"Network unavailable":!config.websocket?"REST selected":"Optional FoxESS login is not configured",config.websocket?"rest-fallback":"rest");goto done;
 }
 if(!socket_transport){
  if(esp_timer_get_time()<next_attempt)goto done;
  next_attempt=esp_timer_get_time()+60000000;
  if(!connect_socket(&config,device,revision)){state("WebSocket unavailable; REST fallback active","rest-fallback");failures++;int64_t delay=(int64_t)(60U<<(failures>4?4:failures-1))*1000000;if(next_attempt<esp_timer_get_time()+delay)next_attempt=esp_timer_get_time()+delay;goto done;}
 }
 if(connected_generation!=revision){close_socket();forget_session();goto done;}
 if(esp_timer_get_time()>=next_ping){
  if(esp_transport_ws_send_raw(socket_transport,WS_TRANSPORT_OPCODES_PING|WS_TRANSPORT_OPCODES_FIN,"",0,1000)<0){close_socket();state("WebSocket disconnected; REST fallback active","rest-fallback");goto done;}
  next_ping=esp_timer_get_time()+20000000;
 }
 bool healthy=true;int64_t deadline=esp_timer_get_time()+200000;
 for(unsigned i=0;i<32&&esp_timer_get_time()<deadline&&esp_transport_poll_read(socket_transport,0)>0;i++)
  if(!read_socket()){healthy=false;break;}
 if(!healthy||(frame_sequence!=connect_sequence?time(NULL)-latest_at>30:esp_timer_get_time()-connected_at>30000000)){
  close_socket();state("WebSocket stale; REST fallback active","rest-fallback");next_attempt=esp_timer_get_time()+60000000;
 }
done:mbedtls_platform_zeroize(&config,sizeof(config));
}
static cJSON *configure(const cJSON *request,const sc_config_t *device,bool commit,bool verify){
 const cJSON *mode=cJSON_GetObjectItemCaseSensitive(request,"mode"),*username=cJSON_GetObjectItemCaseSensitive(request,"username"),*password=cJSON_GetObjectItemCaseSensitive(request,"password");
 if(!cJSON_IsObject(request)||!cJSON_IsString(mode)||(strcmp(mode->valuestring,"rest")&&strcmp(mode->valuestring,"live-ws")))return NULL;
 const cJSON *field;cJSON_ArrayForEach(field,request){if(strcmp(field->string,"mode")&&strcmp(field->string,"username")&&strcmp(field->string,"password"))return NULL;for(const cJSON *other=field->next;other;other=other->next)if(!strcmp(field->string,other->string))return NULL;}
 sc_live_config_t candidate;xSemaphoreTake(guard,portMAX_DELAY);candidate=selected;unsigned revision=generation;xSemaphoreGive(guard);
 bool replacement=(cJSON_IsString(username)&&username->valuestring[0]&&strcmp(username->valuestring,candidate.username))||(cJSON_IsString(password)&&password->valuestring[0]);
 bool ok=true;if(replacement){
  ok=cJSON_IsString(username)&&username->valuestring[0]&&strlen(username->valuestring)<sizeof(candidate.username)&&cJSON_IsString(password)&&password->valuestring[0]&&strlen(password->valuestring)<=256;
  if(ok){for(const unsigned char *p=(unsigned char *)username->valuestring;*p;p++)if(*p<32||*p==127)ok=false;}
  if(ok){strcpy(candidate.username,username->valuestring);bool hash=strlen(password->valuestring)==32;for(const char *p=password->valuestring;hash&&*p;p++)if(!isxdigit((unsigned char)*p))hash=false;
   if(hash){for(unsigned i=0;i<32;i++)candidate.password_hash[i]=tolower((unsigned char)password->valuestring[i]);candidate.password_hash[32]=0;}
   else{unsigned char digest[16];ok=mbedtls_md5((unsigned char *)password->valuestring,strlen(password->valuestring),digest)==0;for(unsigned i=0;i<16;i++)snprintf(candidate.password_hash+2*i,3,"%02x",digest[i]);mbedtls_platform_zeroize(digest,sizeof(digest));}
  }
 }
 candidate.websocket=!commit||!strcmp(mode->valuestring,"live-ws");if(candidate.websocket&&!configured(&candidate))ok=false;
 if(cJSON_IsString(password))mbedtls_platform_zeroize(password->valuestring,strlen(password->valuestring));
 if(!ok){mbedtls_platform_zeroize(&candidate,sizeof(candidate));return NULL;}
 // USB and Account setup can persist credentials without an upstream login test.
 if(commit&&!verify){
  xSemaphoreTake(guard,portMAX_DELAY);
  bool saved=!testing&&revision==generation&&sc_live_save(&candidate)==ESP_OK;
  if(saved){selected=candidate;generation++;restart_requested=true;verified_at=0;mbedtls_platform_zeroize(&verified_config,sizeof(verified_config));status=candidate.websocket?"WebSocket saved; connection pending":"REST selected";source=candidate.websocket?"rest-fallback":"rest";}
  xSemaphoreGive(guard);
  cJSON *out=cJSON_CreateObject();cJSON_AddBoolToObject(out,"saved",saved);cJSON_AddBoolToObject(out,"tested",false);
  cJSON_AddStringToObject(out,"status",saved?"Telemetry settings saved. Not tested.":"Telemetry settings were not saved. Retry after any active test.");
  mbedtls_platform_zeroize(&candidate,sizeof(candidate));return out;
 }
 cJSON *previous=NULL;time_t previous_at=0;
 xSemaphoreTake(guard,portMAX_DELAY);bool occupied=testing;previous=cJSON_Duplicate(latest,true);previous_at=latest_at;bool no_memory=latest&&!previous;if(!occupied&&!no_memory)testing=true;xSemaphoreGive(guard);
 if(occupied||no_memory){cJSON_Delete(previous);mbedtls_platform_zeroize(&candidate,sizeof(candidate));return NULL;}
 if(!commit){verified_at=0;mbedtls_platform_zeroize(&verified_config,sizeof(verified_config));}
 login_http_code=login_error_code=plant_http_code=0;test_stage="Preparing WebSocket test";
 bool cached=commit&&verified_at>0&&esp_timer_get_time()-verified_at<=300000000LL&&verified_generation==revision&&!strcmp(candidate.username,verified_config.username)&&!strcmp(candidate.password_hash,verified_config.password_hash);
 bool tested=cached;if(!cached&&(replacement||candidate.websocket)){
  if(replacement&&esp_timer_get_time()<portal_not_before){xSemaphoreTake(guard,portMAX_DELAY);testing=false;xSemaphoreGive(guard);cJSON_Delete(previous);mbedtls_platform_zeroize(&candidate,sizeof(candidate));cJSON *wait=cJSON_CreateObject();cJSON_AddBoolToObject(wait,"saved",false);cJSON_AddStringToObject(wait,"status","FoxESS login cooldown is active. Wait before testing again. Existing settings are retained.");return wait;}
  close_socket();if(replacement)forget_session();tested=true;ok=login(&candidate);
  if(ok&&candidate.websocket){ok=connect_socket(&candidate,device,revision+1);if(ok)test_stage="Waiting for a fresh WebSocket frame";int64_t until=esp_timer_get_time()+25000000;unsigned before=frame_sequence;
   while(ok&&esp_timer_get_time()<until&&frame_sequence==before){ok=read_socket();vTaskDelay(pdMS_TO_TICKS(50));}ok=ok&&frame_sequence!=before;
  }
 }
 xSemaphoreTake(guard,portMAX_DELAY);
 if(!commit&&ok&&revision==generation){verified_config=candidate;verified_at=esp_timer_get_time();verified_generation=revision;}
 bool saved=commit&&ok&&revision==generation&&sc_live_save(&candidate)==ESP_OK;
 if(saved){selected=candidate;generation++;connected_generation=generation;restart_requested=cached||!candidate.websocket;status=candidate.websocket?(cached?"WebSocket connection queued":"Live WebSocket telemetry"):"REST selected";source=candidate.websocket?(cached?"rest-fallback":"live-ws"):"rest";verified_at=0;mbedtls_platform_zeroize(&verified_config,sizeof(verified_config));}
 if(!saved){cJSON_Delete(latest);latest=previous;previous=NULL;latest_at=previous_at;}
 testing=false;xSemaphoreGive(guard);cJSON_Delete(previous);
 if(!saved){close_socket();forget_session();state(ok?"Telemetry test complete; existing settings retained":"Optional login test failed; previous settings retained",selected.websocket?"rest-fallback":"rest");}
 char detail[240];snprintf(detail,sizeof(detail),"%s. Login HTTP %d, portal code %d, plant HTTP %d. Previous settings retained.",test_stage,login_http_code,login_error_code,plant_http_code);
 test_stage="idle";
 cJSON *result=cJSON_CreateObject();cJSON_AddBoolToObject(result,"saved",saved);cJSON_AddBoolToObject(result,"tested",tested);cJSON_AddBoolToObject(result,"connected",ok);cJSON_AddStringToObject(result,"status",!commit?(ok?"WebSocket test passed. Nothing saved.":detail):saved?"Optional telemetry settings saved":detail);
 mbedtls_platform_zeroize(&candidate,sizeof(candidate));return result;
}

cJSON *sc_live_configure(const cJSON *request,const sc_config_t *device){return configure(request,device,true,true);}
cJSON *sc_live_test(const cJSON *request,const sc_config_t *device){return configure(request,device,false,true);}

cJSON *sc_live_store(const cJSON *request){return configure(request,NULL,true,false);}
