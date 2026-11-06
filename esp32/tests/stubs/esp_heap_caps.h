#pragma once
#include <stdlib.h>
#define MALLOC_CAP_SPIRAM 1
#define MALLOC_CAP_8BIT 2
static inline void *heap_caps_calloc(size_t a,size_t b,int flags){(void)flags;return calloc(a,b);}
static inline size_t heap_caps_get_free_size(int flags){(void)flags;return 8000000;}
