#pragma once
#include <stddef.h>
#include <stdint.h>
#include "esp_err.h"
typedef struct{uint32_t address,size;} esp_partition_t;
#define ESP_PARTITION_TYPE_DATA 1
const esp_partition_t *esp_partition_find_first(int,int,const char *);
esp_err_t esp_partition_erase_range(const esp_partition_t *,size_t,size_t);
