// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "provision_policy.h"

static bool passed(const cJSON *object,const char *key){return cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(object,key));}
cJSON *sc_validate_and_save(const sc_provision_ops_t *ops){
    cJSON *result=cJSON_CreateObject();
    if(!result)return NULL;
    if(!cJSON_AddBoolToObject(result,"saved",false)){cJSON_Delete(result);return NULL;}
    bool activated=ops->activate(ops->context);
    cJSON *checks=activated?ops->test(ops->context):NULL;
    const cJSON *octopus=cJSON_GetObjectItemCaseSensitive(checks,"octopus");
    const cJSON *foxess=cJSON_GetObjectItemCaseSensitive(checks,"foxess");
    bool all_passed=activated&&passed(checks,"wifi_connected")&&passed(checks,"ip_valid")&&passed(checks,"clock_synced")&&
        passed(octopus,"connected")&&passed(foxess,"connected");
    if(checks)cJSON_AddItemToObject(result,"checks",checks);
    if(all_passed&&ops->save(ops->context)){
        cJSON_SetBoolValue(cJSON_GetObjectItemCaseSensitive(result,"saved"),true);
        cJSON_AddStringToObject(result,"status","Wi-Fi, IP and both APIs passed. Configuration saved on the ESP32.");
    }else{
        bool restored=ops->restore(ops->context);
        cJSON_AddBoolToObject(result,"previous_runtime_restored",restored);
        cJSON_AddStringToObject(result,"status",all_passed?"Checks passed but persistent storage failed. Previous settings retained.":
            "Validation failed. Nothing was saved; previous persistent settings were retained.");
    }
    return result;
}

static bool available_host(uint32_t address,uint32_t current,uint32_t mask,uint32_t gateway,uint32_t dns){
    uint32_t network=current&mask,broadcast=network|~mask;
    return (address&mask)==network&&address!=network&&address!=broadcast&&address!=current&&address!=gateway&&address!=dns;
}
size_t sc_ip_candidates(uint32_t current,uint32_t mask,uint32_t gateway,uint32_t dns,uint32_t *out,size_t capacity){
    uint32_t hosts=~mask;
    if(!out||!capacity||hosts<3||hosts==UINT32_MAX||(hosts&(hosts+1)))return 0;
    size_t count=0;
    uint32_t prefix=current&0xffffff00u;
    for(unsigned tail=188;tail<255&&count<capacity;tail++){
        uint32_t address=prefix|tail;
        if(available_host(address,current,mask,gateway,dns))out[count++]=address;
    }
    // Small subnets may not contain .188. Offer high usable hosts inside the actual subnet.
    uint32_t network=current&mask,start=hosts>20?hosts-20:1;
    for(uint32_t host=start;host<hosts&&count<capacity;host++){
        uint32_t address=network|host;bool duplicate=false;
        for(size_t i=0;i<count;i++)if(out[i]==address)duplicate=true;
        if(!duplicate&&available_host(address,current,mask,gateway,dns))out[count++]=address;
    }
    return count;
}
