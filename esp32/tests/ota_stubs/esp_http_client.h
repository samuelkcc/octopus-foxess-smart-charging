#pragma once
#include "esp_err.h"
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>
typedef struct{int event_id;char *header_key,*header_value,*data;int data_len;void *user_data;} esp_http_client_event_t;
typedef struct{const char *url;int timeout_ms;int (*crt_bundle_attach)(void *);int disable_auto_redirect;esp_err_t (*event_handler)(esp_http_client_event_t *);void *user_data;int buffer_size,buffer_size_tx;const char *user_agent;} esp_http_client_config_t;
typedef void *esp_http_client_handle_t;
#define HTTP_EVENT_ON_HEADER 1
#define HTTP_EVENT_ON_DATA 2
#define HTTP_METHOD_POST 1
esp_http_client_handle_t esp_http_client_init(const esp_http_client_config_t *);
esp_err_t esp_http_client_set_method(esp_http_client_handle_t,int);
esp_err_t esp_http_client_set_header(esp_http_client_handle_t,const char *,const char *);
esp_err_t esp_http_client_set_post_field(esp_http_client_handle_t,const char *,int);
esp_err_t esp_http_client_perform(esp_http_client_handle_t);
int esp_http_client_get_status_code(esp_http_client_handle_t);
esp_err_t esp_http_client_cleanup(esp_http_client_handle_t);

esp_err_t esp_http_client_open(esp_http_client_handle_t,int);
int64_t esp_http_client_fetch_headers(esp_http_client_handle_t);
int esp_http_client_read(esp_http_client_handle_t,char *,int);
esp_err_t esp_http_client_close(esp_http_client_handle_t);
esp_err_t esp_http_client_set_user_data(esp_http_client_handle_t,void *);
bool esp_http_client_is_complete_data_received(esp_http_client_handle_t);
