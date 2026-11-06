#pragma once
#include "../stubs/esp_http_server.h"
#include <stdbool.h>
typedef struct {unsigned server_port,ctrl_port,stack_size,max_uri_handlers,max_open_sockets,recv_wait_timeout,send_wait_timeout;bool lru_purge_enable;void *uri_match_fn;} httpd_config_t;
#define HTTPD_DEFAULT_CONFIG() ((httpd_config_t){0})
extern void *httpd_uri_match_wildcard;
esp_err_t httpd_start(httpd_handle_t *,const httpd_config_t *);
esp_err_t httpd_stop(httpd_handle_t);
int httpd_req_to_sockfd(httpd_req_t *);
