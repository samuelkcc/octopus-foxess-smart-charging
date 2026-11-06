#pragma once
#include "esp_err.h"
typedef void *esp_transport_handle_t;
int esp_transport_connect(esp_transport_handle_t,const char *,int,int);
int esp_transport_close(esp_transport_handle_t);
esp_err_t esp_transport_destroy(esp_transport_handle_t);
int esp_transport_poll_read(esp_transport_handle_t,int);
int esp_transport_read(esp_transport_handle_t,char *,int,int);
