// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "foxess_live_policy.h"
int main(void){
 char input[200000];size_t length=fread(input,1,sizeof(input)-1,stdin);input[length]=0;
 cJSON *vectors=cJSON_Parse(input),*out=cJSON_CreateArray();assert(cJSON_IsArray(vectors));
 const cJSON *row;cJSON_ArrayForEach(row,vectors){char signature[64];assert(sc_fox_web_signature(cJSON_GetObjectItem(row,"path")->valuestring,cJSON_GetObjectItem(row,"token")->valuestring,"en",cJSON_GetObjectItem(row,"timestamp")->valuestring,signature));cJSON_AddItemToArray(out,cJSON_CreateString(signature));}
 char huge[1100],signature[64];memset(huge,'x',sizeof(huge)-1);huge[sizeof(huge)-1]=0;assert(!sc_fox_web_signature("/path",huge,"en","123",signature));
 cJSON *frame=cJSON_Parse("{\"errno\":0,\"result\":{\"timeDiff\":2,\"node\":{\"bat\":{\"soc\":\"78\",\"charge\":\"1\",\"power\":{\"value\":200,\"unit\":\"W\"}},\"solar\":{\"power\":{\"value\":0,\"unit\":\"kW\"}},\"load\":{\"power\":{\"value\":0.7,\"unit\":\"kW\"}},\"grid\":{\"gridStatus\":\"3\",\"power\":{\"value\":500,\"unit\":\"W\"}}}}}");
 cJSON *values=sc_fox_live_values(frame);assert(values);assert(cJSON_GetObjectItem(values,"soc")->valueint==78);assert(cJSON_GetObjectItem(values,"solar")->valuedouble==0);assert(cJSON_GetObjectItem(values,"battery")->valuedouble==.2);assert(cJSON_GetObjectItem(values,"grid")->valuedouble==.5);cJSON_Delete(values);
 cJSON_SetNumberValue(cJSON_GetObjectItem(cJSON_GetObjectItem(frame,"result"),"timeDiff"),31);assert(!sc_fox_live_values(frame));cJSON_Delete(frame);
 frame=cJSON_Parse("{\"result\":{\"node\":{\"bat\":{\"soc\":null}}}}");assert(!sc_fox_live_values(frame));cJSON_Delete(frame);
 char *text=cJSON_PrintUnformatted(out);puts(text);free(text);cJSON_Delete(out);cJSON_Delete(vectors);
}
