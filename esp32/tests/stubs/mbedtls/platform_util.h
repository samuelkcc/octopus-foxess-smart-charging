#pragma once
#include <string.h>
static inline void mbedtls_platform_zeroize(void *pointer,size_t length){memset(pointer,0,length);}
