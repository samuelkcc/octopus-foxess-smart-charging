// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// FoxESS portal protocol adapted from nicois/foxess-control, MIT licence.
// See THIRD_PARTY_NOTICES.md. This module performs no network or control writes.
#include "foxess_live_policy.h"
#include "mbedtls/md5.h"
#include "mbedtls/platform_util.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
bool sc_fox_web_signature(const char *path, const char *token, const char *language, const char *timestamp, char out[64]) {
    if (!path || !token || !language || !timestamp || !out) return false;
    char input[1024];unsigned char digest[16];
    int length=snprintf(input,sizeof(input),"%s\\r\\n%s\\r\\n%s\\r\\n%s",path,token,language,timestamp);
    bool ok=length>=0 && (size_t)length<sizeof(input) && mbedtls_md5((unsigned char *)input,length,digest)==0;
    if(ok){
        for(int i=0;i<16;i++)snprintf(out+2*i,3,"%02x",digest[i]);
        // The upstream wrapper appends its result allocation address. A fresh
        // upstream instance always returns 5245784 for this bounded input ABI.
        // Preserve that exact wire value without reserving a WebAssembly heap.
        strcpy(out+32,".5245784");
    }else out[0]=0;
    mbedtls_platform_zeroize(input,sizeof(input));mbedtls_platform_zeroize(digest,sizeof(digest));return ok;
}
static double number(const cJSON *value){
    if(cJSON_IsNumber(value))return isfinite(value->valuedouble)?value->valuedouble:NAN;
    if(cJSON_IsString(value)&&value->valuestring[0]){char *end;double n=strtod(value->valuestring,&end);if(!*end&&isfinite(n))return n;}
    return NAN;
}
static double power(const cJSON *node){
    const cJSON *object=cJSON_GetObjectItemCaseSensitive(node,"power");
    double n=number(cJSON_GetObjectItemCaseSensitive(object,"value"));
    const cJSON *unit=cJSON_GetObjectItemCaseSensitive(object,"unit");
    if(!cJSON_IsString(unit))return NAN;
    return !strcmp(unit->valuestring,"kW")?n:!strcmp(unit->valuestring,"W")?n/1000:NAN;
}
static void add(cJSON *out,const char *key,double value){if(isfinite(value))cJSON_AddNumberToObject(out,key,value);}
cJSON *sc_fox_live_values(const cJSON *frame){
    const cJSON *error=cJSON_GetObjectItemCaseSensitive(frame,"errno");
    if(error && number(error)!=0)return NULL;
    const cJSON *result=cJSON_GetObjectItemCaseSensitive(frame,"result");
    double age=number(cJSON_GetObjectItemCaseSensitive(result,"timeDiff"));
    if(isfinite(age)&&age>30)return NULL;
    const cJSON *node=cJSON_GetObjectItemCaseSensitive(result,"node");
    if(!cJSON_IsObject(node))return NULL;
    const cJSON *bat=cJSON_GetObjectItemCaseSensitive(node,"bat"),*grid=cJSON_GetObjectItemCaseSensitive(node,"grid");
    cJSON *out=cJSON_CreateObject();if(!out)return NULL;
    double soc=number(cJSON_GetObjectItemCaseSensitive(bat,"soc"));if(soc>=0&&soc<=100)add(out,"soc",soc);
    add(out,"solar",power(cJSON_GetObjectItemCaseSensitive(node,"solar")));
    add(out,"home",power(cJSON_GetObjectItemCaseSensitive(node,"load")));
    double battery=power(bat),grid_power=power(grid);
    if(isfinite(battery))add(out,"battery",number(cJSON_GetObjectItemCaseSensitive(bat,"charge"))==1?battery:-battery);
    if(isfinite(grid_power))add(out,"grid",number(cJSON_GetObjectItemCaseSensitive(grid,"gridStatus"))==3?grid_power:-grid_power);
    if(!cJSON_GetArraySize(out)){cJSON_Delete(out);return NULL;}
    return out;
}
