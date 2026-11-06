// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include <assert.h>
#include <stdio.h>
#include "provision_policy.h"
typedef struct{bool activate_ok,save_ok;unsigned failed_check;int activated,tested,saved,restored;} mock_t;
static bool activate(void *arg){mock_t *m=arg;m->activated++;return m->activate_ok;}
static cJSON *test(void *arg){
    mock_t *m=arg;m->tested++;
    if(m->failed_check==6)return NULL;
    cJSON *out=cJSON_CreateObject();
    cJSON_AddBoolToObject(out,"wifi_connected",m->failed_check!=1);
    cJSON_AddBoolToObject(out,"ip_valid",m->failed_check!=2);
    cJSON_AddBoolToObject(out,"clock_synced",m->failed_check!=3);
    cJSON_AddBoolToObject(cJSON_AddObjectToObject(out,"octopus"),"connected",m->failed_check!=4);
    cJSON_AddBoolToObject(cJSON_AddObjectToObject(out,"foxess"),"connected",m->failed_check!=5);
    return out;
}
static bool save(void *arg){mock_t *m=arg;assert(m->tested==1);m->saved++;return m->save_ok;}
static bool restore(void *arg){mock_t *m=arg;m->restored++;return true;}
static void transaction_tests(void){
    for(unsigned failure=0;failure<=8;failure++){
        mock_t mock={.activate_ok=failure!=7,.save_ok=failure!=8,.failed_check=failure};
        sc_provision_ops_t ops={&mock,activate,test,save,restore};cJSON *out=sc_validate_and_save(&ops);
        assert(out);assert(mock.activated==1);
        bool passed=cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(out,"saved"));
        assert(passed==(failure==0));
        assert(mock.saved==((failure==0||failure==8)?1:0));
        assert(mock.restored==(failure!=0));
        assert(mock.tested==(failure!=7));cJSON_Delete(out);
    }
}
static void network_transaction_tests(void){
    for(unsigned failure=0;failure<=8;failure++){
        mock_t mock={.activate_ok=failure!=7,.save_ok=failure!=8,.failed_check=failure};
        sc_provision_ops_t ops={&mock,activate,test,save,restore};cJSON *out=sc_validate_network_and_save(&ops);
        bool passed=failure==0||failure==3||failure==4||failure==5;
        assert(cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(out,"saved"))==passed);
        assert(mock.saved==(passed||failure==8));assert(mock.restored==!passed);cJSON_Delete(out);
    }
}
#define IP(a,b,c,d) (((uint32_t)(a)<<24)|((uint32_t)(b)<<16)|((uint32_t)(c)<<8)|(d))
static void candidate_tests(void){
    uint32_t out[80];
    size_t n=sc_ip_candidates(IP(192,168,8,242),0xffffff00,IP(192,168,8,1),IP(192,168,8,188),out,16);
    assert(n==16&&out[0]==IP(192,168,8,189));
    n=sc_ip_candidates(IP(192,168,8,188),0xffffff00,IP(192,168,8,189),0,out,80);
    assert(n>1&&out[0]==IP(192,168,8,190));
    for(size_t i=0;i<n;i++){
        assert((out[i]&0xffffff00)==IP(192,168,8,0));assert((out[i]&255)!=255);
        assert(out[i]!=IP(192,168,8,188)&&out[i]!=IP(192,168,8,189));
        for(size_t j=0;j<i;j++)assert(out[i]!=out[j]);
    }
    n=sc_ip_candidates(IP(10,1,2,10),0xffffff80,IP(10,1,2,1),0,out,16);
    assert(n==16);for(size_t i=0;i<n;i++)assert(out[i]>IP(10,1,2,1)&&out[i]<IP(10,1,2,127));
    n=sc_ip_candidates(IP(10,1,2,2),0xfffffffc,IP(10,1,2,1),0,out,16);assert(n==0);
    assert(sc_ip_candidates(0x0a010201,0xffffffff,0,0,out,16)==0);
    assert(sc_ip_candidates(0x0a010201,0xff00ff00,0,0,out,16)==0);
    assert(sc_ip_candidates(0x0a010201,0,0,0,out,16)==0);
    assert(sc_ip_candidates(0x0a010201,0xffffff00,0,0,out,0)==0);
}
int main(void){transaction_tests();network_transaction_tests();candidate_tests();puts("ESP32 validate-before-save failure recovery and subnet-safe IP candidate tests passed.");}
