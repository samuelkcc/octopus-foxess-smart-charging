#pragma once
typedef int SemaphoreHandle_t;
SemaphoreHandle_t xSemaphoreCreateMutex(void);
int xSemaphoreTake(SemaphoreHandle_t guard,unsigned timeout);
void xSemaphoreGive(SemaphoreHandle_t guard);
