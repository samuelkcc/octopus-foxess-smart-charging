// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "schedule_transaction.h"

static const char *fixture="["
 "{\"startHour\":23,\"startMinute\":30,\"endHour\":23,\"endMinute\":59,\"workMode\":\"ForceCharge\",\"extraParam\":{\"fdSoc\":100,\"minSocOnGrid\":11,\"fdPwr\":5000,\"maxSoc\":100,\"retainedControl\":7}},"
 "{\"startHour\":0,\"startMinute\":0,\"endHour\":5,\"endMinute\":30,\"workMode\":\"ForceCharge\",\"extraParam\":{\"fdSoc\":100,\"minSocOnGrid\":11,\"fdPwr\":5000,\"maxSoc\":100}},"
 "{\"startHour\":0,\"startMinute\":0,\"endHour\":0,\"endMinute\":0,\"workMode\":\"SelfUse\"},"
 "{\"startHour\":0,\"startMinute\":0,\"endHour\":0,\"endMinute\":0,\"workMode\":\"SelfUse\"},"
 "{\"startHour\":0,\"startMinute\":0,\"endHour\":0,\"endMinute\":0,\"workMode\":\"SelfUse\"}]";
static int allocation,fail_at;
static void *fault_malloc(size_t size){return ++allocation==fail_at?NULL:malloc(size);}
static bool flag(const cJSON *r,const char *name){return cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(r,name));}
static void change_power(cJSON *groups){
 cJSON *extra=cJSON_GetObjectItemCaseSensitive(cJSON_GetArrayItem(groups,0),"extraParam");
 cJSON_ReplaceItemInObjectCaseSensitive(extra,"fdPwr",cJSON_CreateNumber(4000));
}
typedef struct {
 cJSON *original,*actual;int reads,writes;bool saved,cleared;
 bool backup_failure,ignore_write,lost_reply,restore_failure,clear_failure,prepare_conflict,restore_conflict,reverse;
 int failed_reads;
} mock_t;
static cJSON *read_mock(void *arg){
 mock_t *m=arg;m->reads++;
 if(m->prepare_conflict&&m->reads==2)change_power(m->actual);
 if(m->restore_conflict&&m->reads==4)change_power(m->actual);
 if(m->writes&&m->failed_reads>0){m->failed_reads--;return NULL;}
 cJSON *copy=cJSON_Duplicate(m->actual,true);
 if(m->reverse){cJSON *reversed=cJSON_CreateArray();for(int i=cJSON_GetArraySize(copy)-1;i>=0;i--)cJSON_AddItemToArray(reversed,cJSON_Duplicate(cJSON_GetArrayItem(copy,i),true));cJSON_Delete(copy);copy=reversed;}
 return copy;
}
static bool write_mock(void *arg,const cJSON *groups){
 mock_t *m=arg;m->writes++;
 if(m->restore_failure&&m->writes>1)return false;
 if(!(m->ignore_write&&m->writes==1)){cJSON_Delete(m->actual);m->actual=cJSON_Duplicate(groups,true);}
 return !(m->lost_reply&&m->writes==1);
}
static bool save_mock(void *arg,const cJSON *original,const cJSON *candidate){
 mock_t *m=arg;assert(sc_schedules_equal(original,m->original));
 assert(!sc_schedules_equal(original,candidate));m->saved=!m->backup_failure;return m->saved;
}
static bool clear_mock(void *arg){mock_t *m=arg;m->cleared=!m->clear_failure;return m->cleared;}
static void wait_mock(void *arg){}
static mock_t mock(void){mock_t m={0};m.original=cJSON_Parse(fixture);m.actual=cJSON_Duplicate(m.original,true);return m;}
static cJSON *run(mock_t *m){sc_schedule_ops_t ops={m,read_mock,write_mock,save_mock,clear_mock,wait_mock};return sc_run_schedule_test(&ops,600,840);}
static void cleanup(mock_t *m,cJSON *result){cJSON_Delete(m->original);cJSON_Delete(m->actual);cJSON_Delete(result);}

int main(void){
 const char *error=NULL;cJSON *original=cJSON_Parse(fixture);
 cJSON *plan=sc_future_test_plan(original,600,840,&error);assert(plan&&!error);
 assert(cJSON_GetArraySize(plan)==5);
 assert(cJSON_Compare(cJSON_GetArrayItem(original,0),cJSON_GetArrayItem(plan,0),true));
 assert(cJSON_Compare(cJSON_GetArrayItem(original,1),cJSON_GetArrayItem(plan,1),true));
 assert(cJSON_GetObjectItemCaseSensitive(cJSON_GetArrayItem(plan,2),"startHour")->valueint==14);
 assert(cJSON_GetObjectItemCaseSensitive(cJSON_GetObjectItemCaseSensitive(cJSON_GetArrayItem(plan,2),"extraParam"),"retainedControl")->valueint==7);
 assert(!sc_schedules_equal(original,plan));
 assert(!sc_future_test_plan(original,600,660,&error));
 assert(!sc_future_test_plan(original,600,1410,&error));
 assert(!sc_future_test_plan(original,600,INT_MAX-7,&error));
 assert(!sc_future_test_plan(original,0,120,&error)); // Existing 00:00-05:30 period wins.
 cJSON *full=cJSON_CreateArray();
 for(int i=0;i<5;i++){
  cJSON *g=cJSON_Duplicate(cJSON_GetArrayItem(original,0),true);
  cJSON_ReplaceItemInObjectCaseSensitive(g,"startHour",cJSON_CreateNumber(i*2));
  cJSON_ReplaceItemInObjectCaseSensitive(g,"startMinute",cJSON_CreateNumber(0));
  cJSON_ReplaceItemInObjectCaseSensitive(g,"endHour",cJSON_CreateNumber(i*2+1));
  cJSON_ReplaceItemInObjectCaseSensitive(g,"endMinute",cJSON_CreateNumber(0));cJSON_AddItemToArray(full,g);
 }
 assert(!sc_future_test_plan(full,600,840,&error));cJSON_Delete(full);
 for(int failure=1;failure<200;failure++){
  allocation=0;fail_at=failure;cJSON_Hooks hooks={fault_malloc,free};cJSON_InitHooks(&hooks);
  cJSON *fault_plan=sc_future_test_plan(original,600,840,&error);
  cJSON_InitHooks(NULL);
  if(fault_plan){
   cJSON *period=cJSON_GetArrayItem(fault_plan,2);
   assert(cJSON_GetObjectItemCaseSensitive(period,"startHour")->valueint==14);
   assert(cJSON_GetObjectItemCaseSensitive(period,"startMinute")->valueint==0);
   assert(cJSON_GetObjectItemCaseSensitive(period,"endHour")->valueint==14);
   assert(cJSON_GetObjectItemCaseSensitive(period,"endMinute")->valueint==30);
   assert(cJSON_GetObjectItemCaseSensitive(period,"enable")->valueint==1);
  }
  cJSON_Delete(fault_plan);
 }
 cJSON_Delete(plan);cJSON_Delete(original);

 mock_t m=mock();cJSON *result=run(&m);
 assert(flag(result,"test_schedule_confirmed")&&flag(result,"original_schedule_restored")&&!flag(result,"recovery_pending"));
 assert(m.writes==2&&m.saved&&m.cleared&&sc_schedules_equal(m.original,m.actual));cleanup(&m,result);
 m=mock();m.backup_failure=true;result=run(&m);assert(m.writes==0&&!m.saved);cleanup(&m,result);
 m=mock();m.prepare_conflict=true;result=run(&m);assert(m.writes==0&&!m.saved);cleanup(&m,result);
 m=mock();m.ignore_write=true;result=run(&m);assert(flag(result,"test_write_accepted")&&!flag(result,"test_schedule_confirmed")&&flag(result,"original_schedule_restored"));cleanup(&m,result);
 m=mock();m.lost_reply=true;result=run(&m);assert(!flag(result,"test_write_accepted")&&flag(result,"test_schedule_confirmed")&&flag(result,"original_schedule_restored"));cleanup(&m,result);
 m=mock();m.restore_failure=true;result=run(&m);assert(flag(result,"test_schedule_confirmed")&&!flag(result,"original_schedule_restored")&&flag(result,"recovery_pending")&&!m.cleared);cleanup(&m,result);
 m=mock();m.clear_failure=true;result=run(&m);assert(flag(result,"original_schedule_restored")&&flag(result,"recovery_pending"));cleanup(&m,result);
 m=mock();m.failed_reads=4;result=run(&m);assert(!flag(result,"test_schedule_confirmed")&&flag(result,"original_schedule_restored"));cleanup(&m,result);
 m=mock();m.restore_conflict=true;result=run(&m);assert(m.writes==1&&flag(result,"recovery_pending")&&!m.cleared);cleanup(&m,result);
 m=mock();m.reverse=true;result=run(&m);assert(flag(result,"test_schedule_confirmed")&&flag(result,"original_schedule_restored"));cleanup(&m,result);
 puts("Native schedule tests passed: future-only planning, five-period capacity, overnight preservation, control parameters, fresh readback, backup failure, ambiguous writes, rollback failures and concurrent revisions.");
 return 0;
}
