// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#include "ota_policy.h"
#include <stdio.h>
#include <string.h>
#include <ctype.h>
static const char *text(const cJSON *o,const char *key){const cJSON *v=cJSON_GetObjectItemCaseSensitive(o,key);return cJSON_IsString(v)?v->valuestring:"";}
static bool version(const char *v,unsigned out[3]){
 char tail;int used=0;
 if(sscanf(v,"%u.%u.%u%n%c",out,out+1,out+2,&used,&tail)!=3||used!=(int)strlen(v))return false;
 char canonical[24];snprintf(canonical,sizeof(canonical),"%u.%u.%u",out[0],out[1],out[2]);
 return !strcmp(canonical,v)&&strlen(v)<24&&out[0]<10000&&out[1]<10000&&out[2]<10000;
}
bool sc_ota_url_allowed(const char *url){
 const char *hosts[]={"https://samuelkcc.github.io/","https://github.com/","https://release-assets.githubusercontent.com/","https://objects.githubusercontent.com/"};
 if(!url||strlen(url)>3000)return false;
 for(const unsigned char *p=(const unsigned char *)url;*p;p++)if(*p<33||*p>126||*p=='\\')return false;
 for(unsigned i=0;i<sizeof(hosts)/sizeof(*hosts);i++)if(!strncmp(url,hosts[i],strlen(hosts[i])))return true;
 return false;
}
bool sc_ota_manifest_parse(const cJSON *json,const char *current,sc_ota_manifest_t *out){
 if(!cJSON_IsObject(json)||cJSON_GetArraySize(json)!=6)return false;
 const cJSON *item;cJSON_ArrayForEach(item,json)for(const cJSON *other=item->next;other;other=other->next)if(!strcmp(item->string,other->string))return false;
 unsigned next[3],old[3];const char *v=text(json,"version"),*hash=text(json,"sha256"),*url=text(json,"url");
 const cJSON *schema=cJSON_GetObjectItemCaseSensitive(json,"schema"),*size=cJSON_GetObjectItemCaseSensitive(json,"size");
 if(!cJSON_IsNumber(schema)||schema->valuedouble!=1||strcmp(text(json,"board"),"ESP32-S3-N16R8")||!version(v,next)||!version(current,old))return false;
 for(unsigned i=0;i<3;i++){if(next[i]<old[i])return false;if(next[i]>old[i])break;}
 if(strlen(hash)!=64||!cJSON_IsNumber(size)||size->valuedouble<32||size->valuedouble>0x300000||size->valuedouble!=(size_t)size->valuedouble)return false;
 for(const char *p=hash;*p;p++)if(!isxdigit((unsigned char)*p)||isupper((unsigned char)*p))return false;
 char expected[256];snprintf(expected,sizeof(expected),"https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-%s/SmartCharging-ESP32-Firmware-%s.bin",v,v);
 if(strcmp(url,expected))return false;
 memset(out,0,sizeof(*out));strcpy(out->version,v);strcpy(out->url,url);strcpy(out->sha256,hash);out->size=(size_t)size->valuedouble;return true;
}
