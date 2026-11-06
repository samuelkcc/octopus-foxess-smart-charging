// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
#include "automation_policy.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
int main(void){
 setenv("TZ","GMT0BST,M3.5.0/1,M10.5.0",1);tzset();
 char line[32768];while(fgets(line,sizeof(line),stdin)){
  cJSON *input=cJSON_Parse(line);if(!input)return 2;
  cJSON *plan=sc_automation_plan(cJSON_GetObjectItem(input,"rules"),cJSON_GetObjectItem(input,"dispatches"),cJSON_GetObjectItem(input,"imports"),cJSON_GetObjectItem(input,"exports"),NULL,(time_t)cJSON_GetObjectItem(input,"now")->valuedouble,NAN);
  if(!plan)return 3;char *text=cJSON_PrintUnformatted(plan);puts(text);free(text);cJSON_Delete(plan);cJSON_Delete(input);
 }return 0;
}
