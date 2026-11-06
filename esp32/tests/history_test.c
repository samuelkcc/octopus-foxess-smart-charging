// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "history_store.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#define BYTES 0x20000u
static unsigned char flash[BYTES];
static int fail_write = -1, read_failure, fail_erase;
static unsigned erases, writes;
size_t sc_history_flash_size(void) { return BYTES; }
bool sc_history_flash_read(size_t offset, void *data, size_t size) {
    assert(offset + size <= BYTES);
    if (read_failure) return false;
    memcpy(data, flash + offset, size); return true;
}
bool sc_history_flash_write(size_t offset, const void *data, size_t size) {
    assert(offset + size <= BYTES); writes++;
    const unsigned char *p = data;
    for (size_t i = 0; i < size; i++) {
        if (fail_write == 0) return false;
        if (fail_write > 0) fail_write--;
        assert((flash[offset+i] & p[i]) == p[i]); // Real NOR flash cannot set erased bits back to one.
        flash[offset+i] &= p[i];
    }
    return true;
}
bool sc_history_flash_erase(size_t offset, size_t size) {
    assert(offset % 4096 == 0 && size == 4096 && offset + size <= BYTES);
    erases++; if(fail_erase){memset(flash+offset,0xff,113);return false;} memset(flash + offset, 0xff, size); return true;
}
static sc_history_row_t row(uint32_t at) {
    sc_history_row_t out = {.at=at,.solar=1.5f,.home=.6f,.grid=-.2f,.battery=NAN,.soc=75,
                            .counts={6,6,6,0,6}};
    return out;
}
int main(void) {
    uint32_t first=1793880000u / 3600 * 3600;
    sc_history_store_t store;
    sc_history_row_t loaded[SC_HISTORY_SAVED_CAPACITY];
    memset(flash,0xff,sizeof(flash));
    assert(sc_history_store_init(&store));
    assert(!writes && !erases); // Opening History never writes or formats storage.
    for(unsigned hour=0;hour<24;hour++){sc_history_row_t r=row(first+hour*3600);assert(sc_history_store_append(&store,&r));}
    unsigned before=writes;sc_history_row_t duplicate=row(first+23*3600);
    assert(!sc_history_store_append(&store,&duplicate));assert(writes==before);
    assert(sc_history_store_init(&store));
    assert(sc_history_store_load(&store,loaded,SC_HISTORY_SAVED_CAPACITY,first,first+24*3600)==24);
    assert(isnan(loaded[0].battery)&&loaded[0].counts[3]==0&&loaded[23].grid==-.2f);
    // Interrupt each possible byte of both the data write and the commit word.
    unsigned char clean[BYTES];memcpy(clean,flash,sizeof(flash));
    for(int cut=0;cut<64;cut++){
        memcpy(flash,clean,sizeof(flash));assert(sc_history_store_init(&store));
        fail_write=cut;sc_history_row_t torn=row(first+24*3600);assert(!sc_history_store_append(&store,&torn));
        fail_write=-1;assert(sc_history_store_init(&store));
        assert(sc_history_store_load(&store,loaded,SC_HISTORY_SAVED_CAPACITY,first,first+25*3600)==24);
        sc_history_row_t next=row(first+25*3600);assert(sc_history_store_append(&store,&next));
        assert(sc_history_store_init(&store));assert(store.last_at==next.at);
        assert(sc_history_store_load(&store,loaded,SC_HISTORY_SAVED_CAPACITY,first,first+26*3600)==25);
    }
    // Power loss while recycling an old sector cannot damage the newest 60 days.
    memset(flash,0xff,sizeof(flash));assert(sc_history_store_init(&store));
    for(unsigned hour=0;hour<BYTES/64;hour++){sc_history_row_t r=row(first+hour*3600);assert(sc_history_store_append(&store,&r));}
    fail_erase=1;sc_history_row_t boundary=row(first+(BYTES/64)*3600);assert(!sc_history_store_append(&store,&boundary));fail_erase=0;
    assert(sc_history_store_init(&store));assert(sc_history_store_append(&store,&boundary));
    assert(sc_history_store_load(&store,loaded,SC_HISTORY_SAVED_CAPACITY,boundary.at-(SC_HISTORY_SAVED_CAPACITY-1)*3600,boundary.at+3600)==SC_HISTORY_SAVED_CAPACITY);
    // Several complete journal rotations must retain every hour in the latest 60-day window.
    memset(flash,0xff,sizeof(flash));assert(sc_history_store_init(&store));erases=writes=0;
    for(unsigned hour=0;hour<9000;hour++){
        sc_history_row_t r=row(first+hour*3600);assert(sc_history_store_append(&store,&r));
        if(hour>1500 && hour%257==0){
            assert(sc_history_store_init(&store));
            size_t n=sc_history_store_load(&store,loaded,SC_HISTORY_SAVED_CAPACITY,r.at-(SC_HISTORY_SAVED_CAPACITY-1)*3600,r.at+3600);
            assert(n==SC_HISTORY_SAVED_CAPACITY);
            for(size_t i=1;i<n;i++)assert(loaded[i].at==loaded[i-1].at+3600);
        }
    }
    assert(erases==(9000+63)/64 && writes==18000); // Sector erase once per 64 hourly records, not per sample.
    read_failure=1;assert(sc_history_store_load(&store,loaded,SC_HISTORY_SAVED_CAPACITY,first,UINT32_MAX)==SIZE_MAX);
    assert(!sc_history_store_init(&store));read_failure=0;
    puts("History journal: read-only startup, hourly deduplication, missing data, 64 power-cut positions, restart recovery, multi-rotation 60-day retention and bounded sector wear passed.");
}
