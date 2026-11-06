// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "automation_policy.h"
static void boolean(cJSON *o,const char *key,bool value){cJSON_SetBoolValue(cJSON_GetObjectItemCaseSensitive(o,key),value);}
static void number(cJSON *o,const char *key,int value){cJSON_SetNumberValue(cJSON_GetObjectItemCaseSensitive(o,key),value);}
static const cJSON *groups(const cJSON *plan){return cJSON_GetObjectItemCaseSensitive(plan,"groups");}
static const cJSON *at(const cJSON *plan,int minute){const cJSON *g;cJSON_ArrayForEach(g,groups(plan)){int a=cJSON_GetObjectItem(g,"startHour")->valueint*60+cJSON_GetObjectItem(g,"startMinute")->valueint,b=cJSON_GetObjectItem(g,"endHour")->valueint*60+cJSON_GetObjectItem(g,"endMinute")->valueint;if(b==1439)b=1440;if(minute>=a&&minute<b)return g;}return NULL;}
static int target(const cJSON *g){return cJSON_GetObjectItem(cJSON_GetObjectItem(g,"extraParam"),"fdSoc")->valueint;}
static long allocation_index,fail_at;
static void *fault_malloc(size_t size){if(++allocation_index==fail_at)return NULL;return malloc(size);}
static void fault_free(void *value){free(value);}
int main(void){
 setenv("TZ","GMT0BST,M3.5.0/1,M10.5.0",1);tzset();
 assert(sc_timestamp("2026-11-05T12:00:00Z")==sc_timestamp("2026-11-05T13:00:00+01:00"));
 assert(sc_timestamp("2026-11-06 03:30:00+00:00")==sc_timestamp("2026-11-06T03:30:00Z"));
 assert(sc_timestamp("2026-11-06 05:26:00.000000+00:00")==sc_timestamp("2026-11-06T05:26:00Z"));
 assert(!sc_timestamp("2026-11-06 03:30:00"));
 assert(!sc_timestamp("2026-02-31T12:00:00Z"));assert(!sc_timestamp("2026-11-05T25:00:00Z"));
 cJSON *rules=sc_rules_default(),*empty=cJSON_CreateArray();assert(sc_rules_valid(rules));
 cJSON *bad=cJSON_Duplicate(rules,true);cJSON_AddStringToObject(bad,"octopus_key","forbidden");assert(!sc_rules_valid(bad));cJSON_Delete(bad);
 cJSON *dispatch=cJSON_Parse("[{\"startDt\":\"2026-11-05T12:12:00Z\",\"endDt\":\"2026-11-05T13:02:00Z\"}]");
 assert(sc_dispatch_valid(dispatch));assert(!sc_dispatch_valid(NULL));
 time_t now=sc_timestamp("2026-11-05T12:15:00Z");
 cJSON *plan=sc_automation_plan(rules,dispatch,empty,empty,NULL,now,100);
 assert(cJSON_GetArraySize(groups(plan))==1);assert(at(plan,720)&&at(plan,809)&&!at(plan,810));assert(target(at(plan,735))==100);cJSON_Delete(plan);
 // An active Smart Dispatch wins over a discharge and Auto-Resume at a full battery.
 boolean(rules,"weekly_discharge",true);number(rules,"discharge_start",0);number(rules,"discharge_end",1439);
 plan=sc_automation_plan(rules,dispatch,empty,empty,NULL,now,100);assert(!strcmp(cJSON_GetObjectItem(at(plan,735),"workMode")->valuestring,"ForceCharge"));assert(!strcmp(cJSON_GetObjectItem(at(plan,900),"workMode")->valuestring,"ForceDischarge"));assert(target(at(plan,900))==11);cJSON_Delete(plan);
 boolean(rules,"pause_discharge_dispatch",false);plan=sc_automation_plan(rules,dispatch,empty,empty,NULL,now,100);assert(!strcmp(cJSON_GetObjectItem(at(plan,735),"workMode")->valuestring,"ForceDischarge"));cJSON_Delete(plan);boolean(rules,"pause_discharge_dispatch",true);
 boolean(rules,"weekly_discharge",false);boolean(rules,"weekly_charge",true);number(rules,"charge_start",1410);number(rules,"charge_end",330);
 now=sc_timestamp("2026-11-06T02:15:00Z");plan=sc_automation_plan(rules,empty,empty,empty,NULL,now,NAN);assert(at(plan,0)&&at(plan,329)&&at(plan,1410));assert(!at(plan,330));cJSON_Delete(plan);
 // Thursday-only overnight charging carries into Friday morning.
 number(rules,"charge_days",1<<4);plan=sc_automation_plan(rules,empty,empty,empty,NULL,now,NAN);assert(at(plan,0)&&!at(plan,1410));cJSON_Delete(plan);
 // Actual ordinary charging can end at target. Future Smart Dispatch remains protected.
 number(rules,"charge_days",127);number(rules,"target_soc",80);boolean(rules,"charge_soc_enabled",true);boolean(rules,"auto_resume",true);plan=sc_automation_plan(rules,empty,empty,empty,NULL,now,80);assert(!at(plan,135)&&at(plan,1410));cJSON_Delete(plan);
 boolean(rules,"weekly_charge",false);boolean(rules,"charge_price_enabled",true);boolean(rules,"discharge_price_enabled",true);
 cJSON *imports=cJSON_CreateArray(),*exports=cJSON_CreateArray(),*r=cJSON_CreateObject();cJSON_AddNumberToObject(r,"start",now-900);cJSON_AddNumberToObject(r,"end",now+900);cJSON_AddNumberToObject(r,"value",-2);cJSON_AddItemToArray(imports,r);
 r=cJSON_Duplicate(r,true);cJSON_SetNumberValue(cJSON_GetObjectItem(r,"value"),40);cJSON_AddItemToArray(exports,r);
 plan=sc_automation_plan(rules,empty,imports,exports,NULL,now,NAN);assert(!strcmp(cJSON_GetObjectItem(at(plan,135),"workMode")->valuestring,"ForceDischarge"));cJSON_Delete(plan);
 boolean(rules,"discharge_overrides_charge",false);
 plan=sc_automation_plan(rules,empty,imports,exports,NULL,now,NAN);assert(!strcmp(cJSON_GetObjectItem(at(plan,135),"workMode")->valuestring,"ForceCharge"));assert(sc_plan_matches(groups(plan),groups(plan)));cJSON *different=cJSON_Duplicate(groups(plan),true);cJSON_SetNumberValue(cJSON_GetObjectItem(cJSON_GetObjectItem(cJSON_GetArrayItem(different,0),"extraParam"),"fdPwr"),1000);assert(!sc_plan_matches(groups(plan),different));cJSON_Delete(different);cJSON_Delete(plan);
 // Six distinct Smart Dispatch periods cannot be represented as fully protected by five periods.
 cJSON_Delete(dispatch);dispatch=cJSON_CreateArray();for(int i=0;i<6;i++){char a[32],z[32];snprintf(a,sizeof(a),"2026-11-06T%02d:00:00Z",3+i*2);snprintf(z,sizeof(z),"2026-11-06T%02d:30:00Z",3+i*2);r=cJSON_CreateObject();cJSON_AddStringToObject(r,"startDt",a);cJSON_AddStringToObject(r,"endDt",z);cJSON_AddItemToArray(dispatch,r);}
 plan=sc_automation_plan(rules,dispatch,empty,empty,NULL,now,NAN);assert(cJSON_IsTrue(cJSON_GetObjectItem(plan,"dispatch_capacity_exceeded")));assert(cJSON_GetArraySize(groups(plan))==5);cJSON_Delete(plan);
 now=sc_timestamp("2026-10-24T12:00:00Z");plan=sc_automation_plan(rules,empty,empty,empty,NULL,now,NAN);assert(!cJSON_HasObjectItem(plan,"clock_transition_unsupported"));cJSON_Delete(plan);
 // Multi-cycle completion memory must survive falling SOC, missing telemetry and midnight.
 cJSON *latched=sc_rules_default();boolean(latched,"weekly_charge",true);boolean(latched,"auto_resume",true);boolean(latched,"charge_soc_enabled",true);
 sc_resume_state_t memory={0};time_t late=sc_timestamp("2026-11-05T23:45:00Z");
 plan=sc_automation_plan_stateful(latched,empty,empty,empty,NULL,late,80,&memory);assert(!at(plan,1425));assert(memory.until==sc_timestamp("2026-11-06T05:30:00Z"));cJSON_Delete(plan);
 plan=sc_automation_plan_stateful(latched,empty,empty,empty,NULL,now=sc_timestamp("2026-11-06T02:00:00Z"),79,&memory);assert(!at(plan,120)&&at(plan,1410));cJSON_Delete(plan);
 plan=sc_automation_plan_stateful(latched,empty,empty,empty,NULL,now+60,NAN,&memory);assert(!at(plan,121));cJSON_Delete(plan);
 cJSON *overlap=cJSON_Parse("[{\"startDt\":\"2026-11-06T02:00:00Z\",\"endDt\":\"2026-11-06T02:30:00Z\"}]");
 plan=sc_automation_plan_stateful(latched,overlap,empty,empty,NULL,now,100,&memory);assert(at(plan,120)&&target(at(plan,120))==100&&!at(plan,180));cJSON_Delete(plan);cJSON_Delete(overlap);
 plan=sc_automation_plan_stateful(latched,empty,empty,empty,NULL,sc_timestamp("2026-11-06T23:45:00Z"),79,&memory);assert(at(plan,1425)&&memory.source==0);cJSON_Delete(plan);
 // Price completion is source-specific and ends at the original price block boundary.
 boolean(latched,"weekly_charge",false);boolean(latched,"charge_price_enabled",true);
 plan=sc_automation_plan_stateful(latched,empty,imports,empty,NULL,now=sc_timestamp("2026-11-06T02:15:00Z"),80,&memory);assert(!at(plan,135)&&memory.source==1);cJSON_Delete(plan);
 plan=sc_automation_plan_stateful(latched,empty,imports,empty,NULL,now+60,79,&memory);assert(!at(plan,136));cJSON_Delete(plan);
 // A full battery during Smart Dispatch must not create ordinary completion memory.
 memory=(sc_resume_state_t){0};boolean(latched,"weekly_charge",true);
 overlap=cJSON_Parse("[{\"startDt\":\"2026-11-06T02:00:00Z\",\"endDt\":\"2026-11-06T02:30:00Z\"}]");
 plan=sc_automation_plan_stateful(latched,overlap,empty,empty,NULL,now,100,&memory);assert(memory.source==0&&at(plan,135));cJSON_Delete(plan);cJSON_Delete(overlap);
 // Spring and autumn transitions retain civil weekly hours without a 24-hour write blackout.
 boolean(latched,"auto_resume",false);boolean(latched,"charge_price_enabled",false);
 const char *dates[]={"2026-03-28T23:45:00Z","2026-03-29T00:30:00Z","2026-03-29T01:30:00Z","2026-10-24T22:45:00Z","2026-10-25T00:30:00Z","2026-10-25T01:30:00Z"};
 for(unsigned i=0;i<sizeof(dates)/sizeof(*dates);i++){plan=sc_automation_plan(latched,empty,empty,empty,NULL,sc_timestamp(dates[i]),40);assert(plan&&at(plan,0)&&at(plan,329)&&at(plan,1410)&&!at(plan,330));assert(!cJSON_HasObjectItem(plan,"clock_transition_unsupported"));cJSON_Delete(plan);}
 // A dispatch spanning the repeated hour maps to that hour, never an all-day charge.
 overlap=cJSON_Parse("[{\"startDt\":\"2026-10-25T00:30:00Z\",\"endDt\":\"2026-10-25T01:30:00Z\"}]");boolean(latched,"weekly_charge",false);
 plan=sc_automation_plan(latched,overlap,empty,empty,NULL,sc_timestamp("2026-10-25T00:00:00Z"),40);assert(at(plan,60)&&at(plan,119)&&!at(plan,120)&&!at(plan,600));cJSON_Delete(plan);cJSON_Delete(overlap);
 // Ambiguous weekly start selects the first occurrence, as JavaScript Date does.
 boolean(latched,"weekly_charge",true);number(latched,"charge_start",90);number(latched,"charge_end",150);
 plan=sc_automation_plan(latched,empty,empty,empty,NULL,sc_timestamp("2026-10-25T00:40:00Z"),40);assert(at(plan,100));cJSON_Delete(plan);cJSON_Delete(latched);
 // Allocation failure must never turn a required Smart Dispatch into an empty or incomplete schedule.
 cJSON *protected=cJSON_Parse("[{\"startDt\":\"2026-11-06T12:12:00Z\",\"endDt\":\"2026-11-06T13:02:00Z\"}]");now=sc_timestamp("2026-11-06T12:15:00Z");
 for(fail_at=1;fail_at<300;fail_at++){allocation_index=0;cJSON_Hooks hooks={fault_malloc,fault_free};cJSON_InitHooks(&hooks);cJSON *candidate=sc_automation_plan(rules,protected,empty,empty,NULL,now,NAN);cJSON_InitHooks(NULL);if(candidate){assert(at(candidate,735)&&target(at(candidate,735))==100);cJSON_Delete(candidate);}}
 cJSON_Delete(protected);
 cJSON_Delete(imports);cJSON_Delete(exports);cJSON_Delete(rules);cJSON_Delete(empty);cJSON_Delete(dispatch);
 puts("Automation policy passed: active outward rounding, overnight weekdays, dispatch priority, SOC resume, import/export rules, capacity, readback parameters stateful source completion, and UK spring/autumn clock transitions.");
}
