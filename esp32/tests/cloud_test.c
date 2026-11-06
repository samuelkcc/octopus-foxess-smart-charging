// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "cloud_read.h"
#include "esp_http_client.h"
#include "esp_timer.h"
static esp_http_client_config_t options;static char authorization[9000];static int headers;
int64_t esp_timer_get_time(void){return 10000000;}
esp_http_client_handle_t esp_http_client_init(const esp_http_client_config_t *value){options=*value;authorization[0]=0;headers=0;assert(value->disable_auto_redirect);return &options;}
esp_err_t esp_http_client_set_method(esp_http_client_handle_t c,int method){(void)c;(void)method;return ESP_OK;}
esp_err_t esp_http_client_set_header(esp_http_client_handle_t c,const char *name,const char *value){(void)c;if(!strcmp(name,"Authorization")){snprintf(authorization,sizeof(authorization),"%s",value);headers++;}return ESP_OK;}
esp_err_t esp_http_client_set_post_field(esp_http_client_handle_t c,const char *text,int size){(void)c;(void)text;(void)size;return ESP_OK;}
esp_err_t esp_http_client_perform(esp_http_client_handle_t c){(void)c;char reply[]="{}";esp_http_client_event_t event={.event_id=HTTP_EVENT_ON_DATA,.data=reply,.data_len=2,.user_data=options.user_data};return options.event_handler(&event);}
int esp_http_client_get_status_code(esp_http_client_handle_t c){(void)c;return 200;}
esp_err_t esp_http_client_cleanup(esp_http_client_handle_t c){(void)c;return ESP_OK;}
int main(void){sc_config_t config={0};strcpy(config.octopus_key,"test-only-key");int status,retry;cJSON *body=cJSON_CreateObject();cJSON_AddStringToObject(body,"query","mutation { obtainKrakenToken { token } }");
 cJSON *result=sc_cloud_read(&config,false,"/v1/graphql/",body,NULL,&status,&retry);assert(result&&status==200&&headers==0&&"GraphQL sign-in must not receive the REST Basic header");cJSON_Delete(result);
 char token[4001];memset(token,'x',4000);token[4000]=0;result=sc_cloud_read(&config,false,"/v1/graphql/",body,token,&status,&retry);assert(result&&headers==1&&!strcmp(authorization,token)&&options.buffer_size_tx>(int)strlen(token)+512);cJSON_Delete(result);
 result=sc_cloud_read(&config,false,"/v1/accounts/A-TEST/",NULL,NULL,&status,&retry);assert(result&&headers==1&&!strncmp(authorization,"Basic ",6));cJSON_Delete(result);
 result=sc_cloud_read(&config,false,"/v1/products/TEST/electricity-tariffs/E-1R-TEST-A/standard-unit-rates/",NULL,NULL,&status,&retry);assert(result&&headers==0);cJSON_Delete(result);cJSON_Delete(body);
 puts("Cloud transport contract passed: unauthenticated GraphQL sign-in, long JWT data requests, REST-only Basic authentication, public tariff reads and verified HTTPS configuration.");}
