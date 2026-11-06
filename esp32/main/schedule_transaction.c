// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "schedule_transaction.h"

static bool verify(const sc_schedule_ops_t *ops,const cJSON *expected) {
    for(int attempt=0;attempt<4;attempt++){
        ops->wait(ops->context);
        cJSON *actual=ops->read(ops->context);
        bool match=sc_schedules_equal(actual,expected);
        cJSON_Delete(actual);
        if(match)return true;
    }
    return false;
}

cJSON *sc_restore_schedule(const sc_schedule_ops_t *ops,const cJSON *original,const cJSON *candidate) {
    cJSON *result=cJSON_CreateObject();
    if(!result)return NULL;
    cJSON *actual=ops->read(ops->context);
    bool unchanged=sc_schedules_equal(actual,original);
    bool ours=sc_schedules_equal(actual,candidate);
    if(actual&&!unchanged&&!ours){
        cJSON_AddBoolToObject(result,"original_schedule_restored",false);
        cJSON_AddBoolToObject(result,"recovery_pending",true);
        cJSON_AddStringToObject(result,"status","A different schedule was found; automatic restoration stopped to preserve that revision");
        cJSON_Delete(actual);return result;
    }
    cJSON_Delete(actual);
    bool restored=false,accepted=false;
    // Always re-submit the original after a test write, even if a delayed read still shows it.
    for(int attempt=0;attempt<2&&!restored;attempt++){
        accepted=ops->write(ops->context,original)||accepted;
        restored=verify(ops,original);
    }
    bool cleared=restored&&ops->clear(ops->context);
    cJSON_AddBoolToObject(result,"restore_write_accepted",accepted);
    cJSON_AddBoolToObject(result,"original_schedule_restored",restored);
    cJSON_AddBoolToObject(result,"recovery_pending",!cleared);
    cJSON_AddStringToObject(result,"status",restored?(cleared?"Original schedule confirmed by fresh REST readback":"Original schedule confirmed; recovery journal could not be cleared"):
        "Restoration is not confirmed; the original schedule remains in the recovery journal");
    return result;
}

cJSON *sc_run_schedule_test(const sc_schedule_ops_t *ops,int now,int start) {
    cJSON *result=cJSON_CreateObject();
    if(!result)return NULL;
    cJSON_AddBoolToObject(result,"test_write_accepted",false);
    cJSON_AddBoolToObject(result,"test_schedule_confirmed",false);
    cJSON_AddBoolToObject(result,"original_schedule_restored",false);
    cJSON_AddBoolToObject(result,"recovery_pending",false);
    cJSON *original=ops->read(ops->context);
    const char *error=NULL;
    cJSON *candidate=sc_future_test_plan(original,now,start,&error);
    if(!candidate){cJSON_AddStringToObject(result,"status",error?error:"Fresh schedule unavailable");cJSON_Delete(original);return result;}
    ops->wait(ops->context);
    cJSON *fresh=ops->read(ops->context);
    bool unchanged=sc_schedules_equal(original,fresh);
    cJSON_Delete(fresh);
    if(!unchanged){cJSON_AddStringToObject(result,"status","Schedule changed during preparation; no write sent");goto done;}
    if(!ops->save(ops->context,original,candidate)){cJSON_AddStringToObject(result,"status","Durable recovery backup could not be saved; no write sent");goto done;}
    bool accepted=ops->write(ops->context,candidate);
    bool confirmed=verify(ops,candidate);
    cJSON_ReplaceItemInObjectCaseSensitive(result,"test_write_accepted",cJSON_CreateBool(accepted));
    cJSON_ReplaceItemInObjectCaseSensitive(result,"test_schedule_confirmed",cJSON_CreateBool(confirmed));
    // A failed or ambiguous test write still requires restoration.
    cJSON *restoration=sc_restore_schedule(ops,original,candidate);
    if(!restoration){
        cJSON_SetBoolValue(cJSON_GetObjectItemCaseSensitive(result,"recovery_pending"),true);
        cJSON_AddStringToObject(result,"status","Restoration could not be started; recovery journal retained");
        goto done;
    }
    cJSON *field;
    cJSON_ArrayForEach(field,restoration){
        cJSON_DeleteItemFromObjectCaseSensitive(result,field->string);
        cJSON_AddItemToObject(result,field->string,cJSON_Duplicate(field,true));
    }
    cJSON_Delete(restoration);
done:
    cJSON_Delete(original);cJSON_Delete(candidate);return result;
}
