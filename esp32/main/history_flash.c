// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "esp_partition.h"
#include "history_store.h"
static const esp_partition_t *partition;
size_t sc_history_flash_size(void) {
    partition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, 0x40, "history");
    return partition && !partition->encrypted ? partition->size : 0;
}
static bool fits(size_t offset, size_t size) {
    return partition && !partition->encrypted && offset <= partition->size &&
           size <= partition->size - offset;
}
bool sc_history_flash_read(size_t offset, void *data, size_t size) {
    return fits(offset, size) && esp_partition_read(partition, offset, data, size) == ESP_OK;
}
bool sc_history_flash_write(size_t offset, const void *data, size_t size) {
    return fits(offset, size) && esp_partition_write(partition, offset, data, size) == ESP_OK;
}
bool sc_history_flash_erase(size_t offset, size_t size) {
    return fits(offset, size) && esp_partition_erase_range(partition, offset, size) == ESP_OK;
}
