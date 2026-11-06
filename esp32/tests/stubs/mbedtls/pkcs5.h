#pragma once
#include <stddef.h>
#include <stdint.h>
#ifdef __APPLE__
#include <CommonCrypto/CommonKeyDerivation.h>
#endif
#define MBEDTLS_MD_SHA256 6
static inline int mbedtls_pkcs5_pbkdf2_hmac_ext(int type,const unsigned char *password,size_t plen,const unsigned char *salt,size_t slen,unsigned int iterations,uint32_t length,unsigned char *out){(void)type;
#ifdef __APPLE__
return CCKeyDerivationPBKDF(kCCPBKDF2,(const char *)password,plen,salt,slen,kCCPRFHmacAlgSHA256,iterations,out,length);
#else
/* Deterministic transport-test double. Firmware uses the SDK's PBKDF2 implementation. */
for(uint32_t i=0;i<length;i++)out[i]=(unsigned char)(iterations+i);
for(size_t i=0;i<plen;i++)out[i%length]=(out[i%length]*31)^password[i];
for(size_t i=0;i<slen;i++)out[i%length]^=salt[i];
return 0;
#endif
}
