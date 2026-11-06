#pragma once
#include <stddef.h>
static inline int mbedtls_sha256(const unsigned char *in,size_t len,unsigned char out[32],int is224){(void)is224;for(unsigned i=0;i<32;i++)out[i]=0;for(size_t i=0;i<len;i++)out[i%32]=(out[i%32]*31)^in[i];return 0;}
