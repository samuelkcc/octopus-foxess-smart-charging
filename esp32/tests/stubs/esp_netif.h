#pragma once
#include "esp_err.h"
typedef int esp_netif_t;
typedef struct {unsigned char bytes[4];} esp_ip4_addr_t;
typedef struct {esp_ip4_addr_t ip;} esp_netif_ip_info_t;
#define IPSTR "%u.%u.%u.%u"
#define IP2STR(ip) (ip)->bytes[0],(ip)->bytes[1],(ip)->bytes[2],(ip)->bytes[3]
esp_netif_t *esp_netif_get_handle_from_ifkey(const char *);
esp_err_t esp_netif_get_ip_info(esp_netif_t *,esp_netif_ip_info_t *);
