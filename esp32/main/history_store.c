// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "history_store.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>
#define SECTOR 4096u
#define MAGIC 0x53434831u
#define COMMITTED 0x434f4d31u
typedef struct {
    uint32_t magic;
    uint16_t version, size;
    uint64_t sequence;
    sc_history_row_t row;
    uint32_t crc, reserved, commit;
} record_t;
_Static_assert(sizeof(sc_history_row_t) == 36, "Stable History row format");
_Static_assert(sizeof(record_t) == 64, "Stable hourly journal format");
static uint32_t crc32(const void *data, size_t size) {
    const unsigned char *bytes = data;
    uint32_t crc = ~0u;
    for (size_t i = 0; i < size; i++) {
        crc ^= bytes[i];
        for (unsigned bit = 0; bit < 8; bit++)
            crc = (crc >> 1) ^ (0xedb88320u & (0u - (crc & 1u)));
    }
    return ~crc;
}
static bool valid_row(const sc_history_row_t *row) {
    if (row->at < 1700000000u || row->at % 3600u)
        return false;
    const float values[] = {row->solar, row->home, row->grid, row->battery, row->soc};
    bool observed = false;
    for (unsigned i = 0; i < 5; i++) {
        if (row->counts[i] && !isfinite(values[i]))
            return false;
        observed |= row->counts[i] != 0;
    }
    return observed;
}
static bool valid(const record_t *r) {
    return r->magic == MAGIC && r->version == 1 && r->size == sizeof(*r) && r->sequence &&
           r->commit == COMMITTED && r->crc == crc32(r, offsetof(record_t, crc)) && valid_row(&r->row);
}
static bool erased(const record_t *r) {
    const unsigned char *bytes = (const unsigned char *)r;
    for (size_t i = 0; i < sizeof(*r); i++)
        if (bytes[i] != 0xff)
            return false;
    return true;
}
bool sc_history_store_init(sc_history_store_t *store) {
    memset(store, 0, sizeof(*store));
    store->slots = (sc_history_flash_size() / SECTOR * SECTOR) / sizeof(record_t);
    // One sector of headroom prevents sector rotation from deleting the retained
    // window.
    if (store->slots < SC_HISTORY_SAVED_CAPACITY + SECTOR / sizeof(record_t))
        return false;
    record_t page[SECTOR / sizeof(record_t)];
    for (size_t base = 0; base < store->slots; base += sizeof(page) / sizeof(*page)) {
        if (!sc_history_flash_read(base * sizeof(record_t), page, sizeof(page)))
            return false;
        for (size_t j = 0; j < sizeof(page) / sizeof(*page); j++) {
            const record_t *r = &page[j];
            if (valid(r) && r->sequence > store->sequence) {
                store->sequence = r->sequence;
                store->last_at = r->row.at;
                store->next_slot = (base + j + 1) % store->slots;
            }
        }
    }
    store->available = true;
    return true;
}
bool sc_history_store_append(sc_history_store_t *store, const sc_history_row_t *row) {
    if (!store->available || !valid_row(row) || row->at <= store->last_at || store->sequence == UINT64_MAX)
        return false;
    record_t r;
    memset(&r, 0, sizeof(r));
    r.magic = MAGIC;
    r.version = 1;
    r.size = sizeof(r);
    r.sequence = store->sequence + 1;
    r.row = *row;
    r.row.reserved = 0;
    r.crc = crc32(&r, offsetof(record_t, crc));
    r.commit = COMMITTED;
    // A torn record is never overwritten. Skip its slot and retain previous
    // committed records.
    size_t index = store->next_slot;
    for (size_t skipped = 0; skipped < SECTOR / sizeof(r); skipped++, index = (index + 1) % store->slots) {
        size_t offset = index * sizeof(r);
        if (!(offset % SECTOR)) {
            if (!sc_history_flash_erase(offset, SECTOR)) {
                store->available = false;
                return false;
            }
        } else {
            record_t previous;
            if (!sc_history_flash_read(offset, &previous, sizeof(previous)))
                return false;
            if (!erased(&previous))
                continue;
        }
        store->next_slot = (index + 1) % store->slots;
        if (!sc_history_flash_write(offset, &r, offsetof(record_t, commit)) ||
            !sc_history_flash_write(offset + offsetof(record_t, commit), &r.commit, sizeof(r.commit))) {
            store->available = false;
            return false;
        }
        record_t checked;
        if (!sc_history_flash_read(offset, &checked, sizeof(checked)) || !valid(&checked)) {
            store->available = false;
            return false;
        }
        store->sequence = r.sequence;
        store->last_at = row->at;
        return true;
    }
    return false;
}
static int by_time(const void *a, const void *b) {
    const sc_history_row_t *left = a, *right = b;
    return left->at > right->at ? 1 : left->at < right->at ? -1 : 0;
}
size_t sc_history_store_load(const sc_history_store_t *store, sc_history_row_t *rows, size_t capacity,
                             uint32_t from, uint32_t until) {
    if (!store->available || !rows || !capacity)
        return 0;
    size_t count = 0;
    record_t page[SECTOR / sizeof(record_t)];
    for (size_t base = 0; base < store->slots; base += sizeof(page) / sizeof(*page)) {
        if (!sc_history_flash_read(base * sizeof(record_t), page, sizeof(page)))
            return SIZE_MAX;
        for (size_t j = 0; j < sizeof(page) / sizeof(*page); j++) {
            record_t r = page[j];
            if (!valid(&r) || r.row.at < from || r.row.at >= until)
                continue;
            size_t at = count;
            for (size_t j = 0; j < count; j++)
                if (rows[j].at == r.row.at) {
                    at = j;
                    break;
                }
            if (at == count && count == capacity) {
                at = 0;
                for (size_t j = 1; j < count; j++)
                    if (rows[j].at < rows[at].at)
                        at = j;
                if (rows[at].at >= r.row.at)
                    continue;
            } else if (at == count)
                count++;
            rows[at] = r.row;
        }
    }
    qsort(rows, count, sizeof(*rows), by_time);
    return count;
}
