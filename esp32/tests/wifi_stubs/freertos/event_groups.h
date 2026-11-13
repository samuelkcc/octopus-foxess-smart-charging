#pragma once
#include "FreeRTOS.h"
typedef struct sc_test_events { unsigned bits; } *EventGroupHandle_t;
unsigned xEventGroupSetBits(EventGroupHandle_t events,unsigned bits);
unsigned xEventGroupClearBits(EventGroupHandle_t events,unsigned bits);
