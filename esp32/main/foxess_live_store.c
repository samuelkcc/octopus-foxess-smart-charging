// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Development AES-GCM protection. A physical Flash dump also contains the key.
#include "foxess_live.h"
#include "esp_random.h"
#include "mbedtls/gcm.h"
#include "mbedtls/platform_util.h"
#include "nvs.h"
#include <stdint.h>
#include <string.h>
typedef struct {uint32_t version;unsigned char iv[12],tag[16],bytes[sizeof(sc_live_config_t)];} blob_t;
static esp_err_t key(nvs_handle_t handle,unsigned char out[32],bool create){
 size_t size=32;esp_err_t result=nvs_get_blob(handle,"local_key",out,&size);
 if(result==ESP_ERR_NVS_NOT_FOUND&&create){esp_fill_random(out,32);result=nvs_set_blob(handle,"local_key",out,32);if(result==ESP_OK)result=nvs_commit(handle);}
 else if(result==ESP_OK&&size!=32)result=ESP_FAIL;
 return result;
}
esp_err_t sc_live_save(const sc_live_config_t *config){
 nvs_handle_t h;esp_err_t result=nvs_open("sc_fox_live",NVS_READWRITE,&h);if(result!=ESP_OK)return result;
 unsigned char secret[32]={0};blob_t blob={.version=1};esp_fill_random(blob.iv,sizeof(blob.iv));
 mbedtls_gcm_context context;mbedtls_gcm_init(&context);result=key(h,secret,true);
 if(result==ESP_OK&&(mbedtls_gcm_setkey(&context,MBEDTLS_CIPHER_ID_AES,secret,256)||mbedtls_gcm_crypt_and_tag(&context,MBEDTLS_GCM_ENCRYPT,sizeof(*config),blob.iv,sizeof(blob.iv),(unsigned char *)&blob.version,sizeof(blob.version),(const unsigned char *)config,blob.bytes,sizeof(blob.tag),blob.tag)))result=ESP_FAIL;
 if(result==ESP_OK)result=nvs_set_blob(h,"settings",&blob,sizeof(blob));
 if(result==ESP_OK)result=nvs_commit(h);
 nvs_close(h);mbedtls_gcm_free(&context);mbedtls_platform_zeroize(secret,sizeof(secret));mbedtls_platform_zeroize(&blob,sizeof(blob));return result;
}
esp_err_t sc_live_load(sc_live_config_t *config){
 memset(config,0,sizeof(*config));nvs_handle_t h;esp_err_t result=nvs_open("sc_fox_live",NVS_READONLY,&h);if(result!=ESP_OK)return result;
 unsigned char secret[32]={0};blob_t blob={0};size_t size=sizeof(blob);result=nvs_get_blob(h,"settings",&blob,&size);
 if(result==ESP_OK&&(size!=sizeof(blob)||blob.version!=1))result=ESP_FAIL;
 if(result==ESP_OK)result=key(h,secret,false);
 mbedtls_gcm_context context;mbedtls_gcm_init(&context);
 if(result==ESP_OK&&(mbedtls_gcm_setkey(&context,MBEDTLS_CIPHER_ID_AES,secret,256)||mbedtls_gcm_auth_decrypt(&context,sizeof(*config),blob.iv,sizeof(blob.iv),(unsigned char *)&blob.version,sizeof(blob.version),blob.tag,sizeof(blob.tag),blob.bytes,(unsigned char *)config)))result=ESP_FAIL;
 if(result==ESP_OK&&(!memchr(config->username,0,sizeof(config->username))||!memchr(config->password_hash,0,sizeof(config->password_hash))))result=ESP_FAIL;
 nvs_close(h);mbedtls_gcm_free(&context);mbedtls_platform_zeroize(secret,sizeof(secret));mbedtls_platform_zeroize(&blob,sizeof(blob));if(result!=ESP_OK)mbedtls_platform_zeroize(config,sizeof(*config));return result;
}
