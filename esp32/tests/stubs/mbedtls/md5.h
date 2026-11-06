#pragma once
#include <stddef.h>
static inline int mbedtls_md5(const unsigned char *in,size_t n,unsigned char out[16]){(void)in;(void)n;for(int i=0;i<16;i++)out[i]=0;return 0;}
