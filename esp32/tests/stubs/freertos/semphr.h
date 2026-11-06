#pragma once
typedef int SemaphoreHandle_t;
static inline SemaphoreHandle_t xSemaphoreCreateMutex(void){return 1;}
static inline int xSemaphoreTake(SemaphoreHandle_t guard,unsigned timeout){(void)guard;(void)timeout;return 1;}
static inline void xSemaphoreGive(SemaphoreHandle_t guard){(void)guard;}
