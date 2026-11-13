#pragma once
typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1
#define ESP_ERR_WIFI_NOT_STARTED 10
#define ESP_ERR_WIFI_NOT_CONNECT 11
typedef struct { int unused; } wifi_ap_record_t;
esp_err_t esp_wifi_connect(void);
esp_err_t esp_wifi_disconnect(void);
esp_err_t esp_wifi_start(void);
esp_err_t esp_wifi_sta_get_ap_info(wifi_ap_record_t *ap);
