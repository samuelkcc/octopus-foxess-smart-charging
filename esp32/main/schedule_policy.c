// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
// Pure policy helpers. No network calls or inverter commands belong here.
#include <stdlib.h>
#include <string.h>
#include "schedule_policy.h"

static int integer(const cJSON *group,const char *key,int maximum) {
    const cJSON *value=cJSON_GetObjectItemCaseSensitive(group,key);
    return cJSON_IsNumber(value)&&value->valuedouble==value->valueint&&value->valueint>=0&&value->valueint<=maximum?value->valueint:-1;
}
bool sc_schedule_group_enabled(const cJSON *group) {
    const cJSON *flag=cJSON_GetObjectItemCaseSensitive(group,"enable");
    if(cJSON_IsFalse(flag)||(cJSON_IsNumber(flag)&&flag->valuedouble==0)||
        (cJSON_IsString(flag)&&(!strcmp(flag->valuestring,"0")||!strcmp(flag->valuestring,"false"))))return false;
    const cJSON *mode=cJSON_GetObjectItemCaseSensitive(group,"workMode");
    return !(cJSON_IsString(mode)&&!strcmp(mode->valuestring,"SelfUse")&&integer(group,"startHour",23)==0&&
        integer(group,"startMinute",59)==0&&integer(group,"endHour",23)==0&&integer(group,"endMinute",59)==0);
}
static bool interval(const cJSON *group,int *start,int *end) {
    int sh=integer(group,"startHour",23),sm=integer(group,"startMinute",59),eh=integer(group,"endHour",23),em=integer(group,"endMinute",59);
    const cJSON *mode=cJSON_GetObjectItemCaseSensitive(group,"workMode");
    if(sh<0||sm<0||eh<0||em<0||!cJSON_IsString(mode)||!mode->valuestring[0])return false;
    *start=sh*60+sm;*end=eh*60+em;
    if(*end==1439)*end=1440;
    return *end>*start;
}
static bool replace_number(cJSON *object,const char *key,int value){
    cJSON *number=cJSON_CreateNumber(value);
    if(!number)return false;
    if(cJSON_ReplaceItemInObjectCaseSensitive(object,key,number))return true;
    cJSON_Delete(number);return false;
}

cJSON *sc_future_test_plan(const cJSON *groups,int now,int start,const char **error) {
    *error="Invalid or unsupported schedule";
    if(!cJSON_IsArray(groups)||cJSON_GetArraySize(groups)>5||now<0||now>=1440)return NULL;
    if(start<0||start>1380||start%30||start<now+120){*error="Test must be a half-hour window at least two hours in the future, without crossing midnight";return NULL;}
    int count=0,free_index=-1,index=0;
    const cJSON *template=NULL,*group;
    cJSON_ArrayForEach(group,groups){
        if(!cJSON_IsObject(group))return NULL;
        if(!sc_schedule_group_enabled(group)){if(free_index<0)free_index=index;index++;continue;}
        int from,to;
        if(!interval(group,&from,&to))return NULL;
        if(from<start+30&&start<to){*error="Test window overlaps an existing schedule";return NULL;}
        const cJSON *other;
        for(other=group->next;other;other=other->next)if(sc_schedule_group_enabled(other)){
            int other_from,other_to;
            if(!interval(other,&other_from,&other_to)|| (from<other_to&&other_from<to)){*error="Existing schedules overlap or are unsupported";return NULL;}
        }
        count++;
        const cJSON *mode=cJSON_GetObjectItemCaseSensitive(group,"workMode");
        if(!template&&!strcmp(mode->valuestring,"ForceCharge"))template=group;
        index++;
    }
    if(count>=5){*error="No free period within the five-period limit";return NULL;}
    if(!template){*error="An existing Force Charge template is required";return NULL;}
    cJSON *candidate=cJSON_Duplicate(groups,true),*test=cJSON_Duplicate(template,true);
    if(!candidate||!test){cJSON_Delete(candidate);cJSON_Delete(test);return NULL;}
    if(!replace_number(test,"startHour",start/60)||!replace_number(test,"startMinute",start%60)||
       !replace_number(test,"endHour",(start+30)/60)||!replace_number(test,"endMinute",(start+30)%60)){
        cJSON_Delete(candidate);cJSON_Delete(test);return NULL;
    }
    cJSON_DeleteItemFromObjectCaseSensitive(test,"enable");
    if(!cJSON_AddNumberToObject(test,"enable",1)){cJSON_Delete(candidate);cJSON_Delete(test);return NULL;}
    if(free_index>=0)cJSON_ReplaceItemInArray(candidate,free_index,test);else cJSON_AddItemToArray(candidate,test);
    *error=NULL;return candidate;
}

static cJSON *canonical(const cJSON *groups) {
    if(!cJSON_IsArray(groups))return NULL;
    cJSON *result=cJSON_CreateArray();
    if(!result)return NULL;
    const cJSON *group;
    cJSON_ArrayForEach(group,groups)if(sc_schedule_group_enabled(group)){
        int start,end;if(!interval(group,&start,&end)){cJSON_Delete(result);return NULL;}
        cJSON *copy=cJSON_Duplicate(group,true);
        if(!copy){cJSON_Delete(result);return NULL;}
        // IDs and labels are server metadata; all returned control parameters are retained.
        const char *metadata[]={"enable","id","groupId","index","name","label","updateTime","createTime"};
        for(size_t i=0;i<sizeof(metadata)/sizeof(metadata[0]);i++)cJSON_DeleteItemFromObjectCaseSensitive(copy,metadata[i]);
        int at=0;const cJSON *existing;
        cJSON_ArrayForEach(existing,result){int a,b;interval(existing,&a,&b);if(a>start)break;at++;}
        cJSON_InsertItemInArray(result,at,copy);
    }
    return result;
}
bool sc_schedules_equal(const cJSON *left,const cJSON *right) {
    cJSON *a=canonical(left),*b=canonical(right);
    bool equal=a&&b&&cJSON_Compare(a,b,true);
    cJSON_Delete(a);cJSON_Delete(b);return equal;
}
