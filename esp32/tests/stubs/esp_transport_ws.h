#pragma once
#include <stdbool.h>
#include "esp_transport.h"
typedef enum{WS_TRANSPORT_OPCODES_CONT=0,WS_TRANSPORT_OPCODES_TEXT=1,WS_TRANSPORT_OPCODES_CLOSE=8,WS_TRANSPORT_OPCODES_PING=9,WS_TRANSPORT_OPCODES_FIN=128}ws_transport_opcodes_t;
esp_transport_handle_t esp_transport_ws_init(esp_transport_handle_t);
void esp_transport_ws_set_path(esp_transport_handle_t,const char *);
esp_err_t esp_transport_ws_set_user_agent(esp_transport_handle_t,const char *);
int esp_transport_ws_send_raw(esp_transport_handle_t,ws_transport_opcodes_t,const char *,int,int);
ws_transport_opcodes_t esp_transport_ws_get_read_opcode(esp_transport_handle_t);
int esp_transport_ws_get_read_payload_len(esp_transport_handle_t);
bool esp_transport_ws_get_fin_flag(esp_transport_handle_t);
