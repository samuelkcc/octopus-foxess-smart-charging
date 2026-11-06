// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#include "config_access.h"
#include "nvs.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "mbedtls/pkcs5.h"
#include "mbedtls/platform_util.h"
#include <stdint.h>
#include <string.h>
typedef struct {uint32_t version,iterations;unsigned char salt[16],hash[32];} access_t;
static access_t saved;
static bool enabled,invalid;
static int64_t retry_at;
static unsigned failures;
static bool derive(const char *password,const access_t *access,unsigned char out[32]){
 return mbedtls_pkcs5_pbkdf2_hmac_ext(MBEDTLS_MD_SHA256,(const unsigned char *)password,strlen(password),access->salt,sizeof(access->salt),access->iterations,32,out)==0;
}
void sc_config_access_init(void){
 memset(&saved,0,sizeof(saved));enabled=false;invalid=false;failures=0;retry_at=0;
 nvs_handle_t handle;esp_err_t opened=nvs_open("sc_usb_access",NVS_READONLY,&handle);
 if(opened==ESP_ERR_NVS_NOT_FOUND)return;
 if(opened!=ESP_OK){invalid=true;return;}
 size_t size=sizeof(saved);esp_err_t result=nvs_get_blob(handle,"auth",&saved,&size);nvs_close(handle);
 if(result==ESP_ERR_NVS_NOT_FOUND)return;
 if(result!=ESP_OK||size!=sizeof(saved)||saved.version!=1||saved.iterations!=100000){invalid=true;return;}
 enabled=true;
}
bool sc_config_access_enabled(void){return enabled||invalid;}
bool sc_config_access_check(const char *password){
 if(invalid)return false;
 if(!enabled)return true; // Existing devices without a record remain unprotected.
 if(esp_timer_get_time()<retry_at)return false;
 bool valid=password&&strlen(password)>=8&&strlen(password)<=128;
 unsigned char hash[32]={0},difference=0;
 if(valid){valid=derive(password,&saved,hash);for(unsigned i=0;i<32;i++)difference|=hash[i]^saved.hash[i];valid=valid&&!difference;}
 mbedtls_platform_zeroize(hash,sizeof(hash));
 if(valid){failures=0;return true;}
 if(++failures>=5){retry_at=esp_timer_get_time()+60000000;failures=0;}
 return false;
}
bool sc_config_access_change(const char *current,const char *replacement){
 if(!replacement||(*replacement&&(strlen(replacement)<8||strlen(replacement)>128)))return false;
 if(!sc_config_access_check(current))return false;
 access_t next={.version=1,.iterations=100000};
 if(*replacement){esp_fill_random(next.salt,sizeof(next.salt));if(!derive(replacement,&next,next.hash))return false;}
 nvs_handle_t handle;bool ok=nvs_open("sc_usb_access",NVS_READWRITE,&handle)==ESP_OK;
 if(ok){esp_err_t result=*replacement?nvs_set_blob(handle,"auth",&next,sizeof(next)):nvs_erase_key(handle,"auth");ok=(result==ESP_OK||(!*replacement&&result==ESP_ERR_NVS_NOT_FOUND))&&nvs_commit(handle)==ESP_OK;nvs_close(handle);}
 if(ok){saved=next;enabled=*replacement!=0;invalid=false;}
 mbedtls_platform_zeroize(&next,sizeof(next));return ok;
}
cJSON *sc_config_access_status(void){
 cJSON *out=cJSON_CreateObject();cJSON_AddBoolToObject(out,"enabled",sc_config_access_enabled());cJSON_AddBoolToObject(out,"storage_error",invalid);
 int64_t remaining=retry_at-esp_timer_get_time();cJSON_AddNumberToObject(out,"retry_after_seconds",remaining>0?(remaining+999999)/1000000:0);return out;
}
