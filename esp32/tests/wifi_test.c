// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include "wifi_reconnect.h"
#include "esp_wifi.h"
#include "freertos/semphr.h"
static int64_t now;
static unsigned connects, disconnects, starts;
static bool driver_running=true, ap_present=true, reject_connect;
static int locked;
static struct sc_test_events group;
int64_t esp_timer_get_time(void){return now;}
SemaphoreHandle_t xSemaphoreCreateMutex(void){return 1;}
int xSemaphoreTake(SemaphoreHandle_t guard,unsigned timeout){(void)guard;(void)timeout;assert(!locked);locked=1;return 1;}
void xSemaphoreGive(SemaphoreHandle_t guard){(void)guard;assert(locked);locked=0;}
unsigned xEventGroupSetBits(EventGroupHandle_t events,unsigned bits){assert(locked);return events->bits|=bits;}
unsigned xEventGroupClearBits(EventGroupHandle_t events,unsigned bits){assert(locked);return events->bits&=~bits;}
esp_err_t esp_wifi_connect(void){assert(locked);++connects;return !driver_running?ESP_ERR_WIFI_NOT_STARTED:reject_connect?ESP_FAIL:ESP_OK;}
esp_err_t esp_wifi_disconnect(void){assert(locked);++disconnects;return ESP_OK;}
esp_err_t esp_wifi_start(void){assert(locked);++starts;driver_running=true;return ESP_OK;}
esp_err_t esp_wifi_sta_get_ap_info(wifi_ap_record_t *ap){assert(locked);(void)ap;return ap_present?ESP_OK:ESP_ERR_WIFI_NOT_CONNECT;}
static void tick_seconds(unsigned seconds){now+=(int64_t)seconds*1000000;sc_wifi_reconnect_tick();}
static void reset(void){
 now=0;connects=disconnects=starts=0;group.bits=0;driver_running=ap_present=true;reject_connect=false;
 assert(sc_wifi_reconnect_init(&group));
}
int main(void){
 reset();tick_seconds(3600);assert(connects==0); // An unconfigured board never attempts Wi-Fi.
 assert(sc_wifi_reconnect_start());assert(connects==1);
 assert(sc_wifi_reconnect_got_ip());assert(group.bits&SC_WIFI_CONNECTED);
 sc_wifi_reconnect_disconnected();assert(!(group.bits&SC_WIFI_CONNECTED));
 const unsigned backoff[]={2,4,8,16,30};
 for(unsigned i=0;i<5;i++){
  unsigned before=connects;
  tick_seconds(backoff[i]-1);assert(connects==before);
  sc_wifi_reconnect_disconnected(); // Duplicate notification must not postpone recovery.
  tick_seconds(1);assert(connects==before+1);
  sc_wifi_reconnect_disconnected();
 }
 assert(group.bits&SC_WIFI_FAILED);
 for(unsigned i=0;i<1000;i++){
  unsigned before=connects;tick_seconds(30);assert(connects==before+1);sc_wifi_reconnect_disconnected();
 }
 assert(connects>1000); // A long router outage cannot exhaust a finite retry budget.
 tick_seconds(30);assert(sc_wifi_reconnect_got_ip());assert(group.bits&SC_WIFI_CONNECTED);assert(!(group.bits&SC_WIFI_FAILED));
 sc_wifi_reconnect_disconnected();unsigned before=connects;tick_seconds(1);assert(connects==before);tick_seconds(1);assert(connects==before+1); // Successful IP acquisition resets the backoff.
 sc_wifi_reconnect_pause();before=connects;sc_wifi_reconnect_disconnected();assert(!sc_wifi_reconnect_got_ip());tick_seconds(3600);assert(connects==before);assert(!(group.bits&SC_WIFI_CONNECTED));
 assert(sc_wifi_reconnect_start());assert(connects==before+1);assert(sc_wifi_reconnect_got_ip());
 puts("Wi-Fi: repeated router outages, indefinite capped backoff, duplicate events, successful recovery and deliberate setup pause passed.");

 reset();assert(sc_wifi_reconnect_start());tick_seconds(44);assert(disconnects==0);tick_seconds(1);assert(disconnects==1);
 sc_wifi_reconnect_disconnected();before=connects;tick_seconds(1);assert(connects==before);tick_seconds(1);assert(connects==before+1);
 tick_seconds(10);sc_wifi_reconnect_associated();assert(!(group.bits&SC_WIFI_CONNECTED));tick_seconds(44);assert(disconnects==1);tick_seconds(1);assert(disconnects==2); // DHCP never supplies an IP.
 tick_seconds(4);assert(sc_wifi_reconnect_got_ip()); // IP events serve DHCP and fixed-IP configurations alike.
 sc_wifi_reconnect_lost_ip();assert(!(group.bits&SC_WIFI_CONNECTED));sc_wifi_reconnect_tick();assert(disconnects==3);tick_seconds(2);assert(sc_wifi_reconnect_got_ip());
 ap_present=false;before=connects;tick_seconds(5);assert(!(group.bits&SC_WIFI_CONNECTED));tick_seconds(2);assert(connects==before+1);
 puts("Wi-Fi: stalled association, DHCP/IP timeout, lost address and missed disconnect event recovery passed.");

 reset();reject_connect=true;assert(!sc_wifi_reconnect_start());
 for(unsigned i=0;i<20;i++)tick_seconds(30);
 assert(connects>5);reject_connect=false;tick_seconds(30);assert(sc_wifi_reconnect_got_ip());
 driver_running=false;sc_wifi_reconnect_disconnected();tick_seconds(2);assert(starts==1);assert(sc_wifi_reconnect_got_ip());
 puts("Wi-Fi: synchronous driver errors and stopped-driver recovery passed without reboot or configuration writes.");
 return 0;
}
