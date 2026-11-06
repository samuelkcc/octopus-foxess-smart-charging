// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import {mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';import os from 'node:os';
const root=path.resolve(import.meta.dirname,'..'),json=path.join(root,'.build/esp32-sdk/esp-idf-v5.5.2/components/json/cJSON');
const temp=await mkdtemp(path.join(os.tmpdir(),'sc-runtime-'));
try{
 const output=path.join(temp,'test');
 const flags=['-std=c11','-D_DARWIN_C_SOURCE','-Dtime=sc_test_time','-Wall','-Wextra','-Werror','-I'+path.join(root,'esp32/tests/stubs'),'-I'+path.join(root,'esp32/main'),'-I'+json];
 const built=spawnSync('cc',[...flags,...['esp32/tests/runtime_test.c','esp32/main/runtime.c','esp32/main/history_store.c','esp32/main/automation_policy.c','esp32/main/schedule_policy.c'].map(file=>path.join(root,file)),path.join(json,'cJSON.c'),'-lm','-o',output],{encoding:'utf8'});
 if(built.status!==0)throw Error(built.stderr||built.stdout);
 const result=spawnSync(output,[],{encoding:'utf8'});process.stdout.write(result.stdout);if(result.status!==0)throw Error(result.stderr||'Worker mock tests failed');

 const resume=spawnSync(output,['resume'],{encoding:'utf8'});process.stdout.write(resume.stdout);if(resume.status!==0)throw Error(resume.stderr||'Completion-memory integration failed');
 const budget=spawnSync(output,['setup-budget'],{encoding:'utf8'});process.stdout.write(budget.stdout);if(budget.status!==0)throw Error(budget.stderr||'Shared setup/worker budget failed');
 const timestamp=spawnSync(output,['timestamp'],{encoding:'utf8'});process.stdout.write(timestamp.stdout);if(timestamp.status!==0)throw Error(timestamp.stderr||'Live timestamp regression failed');
 const refresh=spawnSync(output,['refresh'],{encoding:'utf8'});process.stdout.write(refresh.stdout);if(refresh.status!==0)throw Error(refresh.stderr||'Manual refresh / token recovery failed');
 const account=spawnSync(output,['account'],{encoding:'utf8'});process.stdout.write(account.stdout);if(account.status!==0)throw Error(account.stderr||'Account snapshot test failed');
 const mirror=spawnSync(output,['mirror'],{encoding:'utf8'});process.stdout.write(mirror.stdout);if(mirror.status!==0)throw Error(mirror.stderr||'Dashboard RAM mirror test failed');
 const fixed=spawnSync(output,['fixed'],{encoding:'utf8'});process.stdout.write(fixed.stdout);if(fixed.status!==0)throw Error(fixed.stderr||'Fixed IOG fallback failed');
 const hourly=spawnSync(output,['history'],{encoding:'utf8'});process.stdout.write(hourly.stdout);if(hourly.status!==0)throw Error(hourly.stderr||'Hourly History opt-in test failed');
 const legacy=spawnSync(output,['legacy'],{encoding:'utf8'});process.stdout.write(legacy.stdout);if(legacy.status!==0)throw Error(legacy.stderr||'Legacy-rule migration failed');
 const portTest=path.join(temp,'port-test');
 const portBuilt=spawnSync('cc',[...flags,path.join(root,'esp32/tests/port_test.c'),'-o',portTest],{encoding:'utf8'});
 if(portBuilt.status!==0)throw Error(portBuilt.stderr||portBuilt.stdout);
 const portResult=spawnSync(portTest,[],{encoding:'utf8'});process.stdout.write(portResult.stdout);if(portResult.status!==0)throw Error(portResult.stderr||'Port persistence tests failed');
 const http=path.join(temp,'http-test');
 const httpBuilt=spawnSync('cc',['-std=gnu11','-D_DARWIN_C_SOURCE','-Wall','-Wextra','-Werror','-I'+path.join(root,'esp32/tests/stubs'),'-I'+path.join(root,'esp32/main'),'-I'+json,path.join(root,'esp32/tests/http_test.c'),path.join(json,'cJSON.c'),'-o',http],{encoding:'utf8'});
 if(httpBuilt.status!==0)throw Error(httpBuilt.stderr||httpBuilt.stdout);
 const httpTest=spawnSync(http,[],{encoding:'utf8'});process.stdout.write(httpTest.stdout);if(httpTest.status!==0)throw Error(httpTest.stderr||'HTTP tests failed');

 const setup=path.join(temp,'setup-test');
 const setupBuilt=spawnSync('cc',[...flags,path.join(root,'esp32/tests/service_setup_test.c'),path.join(json,'cJSON.c'),'-o',setup],{encoding:'utf8'});if(setupBuilt.status)throw Error(setupBuilt.stderr);
 const setupTest=spawnSync(setup,[],{encoding:'utf8'});process.stdout.write(setupTest.stdout);if(setupTest.status)throw Error(setupTest.stderr);
 const cloud=path.join(temp,'cloud-test');
 const cloudBuilt=spawnSync('cc',['-std=c11','-D_DARWIN_C_SOURCE','-Wall','-Wextra','-Werror','-I'+path.join(root,'esp32/tests/stubs'),'-I'+path.join(root,'esp32/main'),'-I'+json,path.join(root,'esp32/tests/cloud_test.c'),path.join(root,'esp32/main/cloud_read.c'),path.join(json,'cJSON.c'),'-o',cloud],{encoding:'utf8'});
 if(cloudBuilt.status!==0)throw Error(cloudBuilt.stderr||cloudBuilt.stdout);
 const cloudTest=spawnSync(cloud,[],{encoding:'utf8'});process.stdout.write(cloudTest.stdout);if(cloudTest.status!==0)throw Error(cloudTest.stderr||'Cloud transport test failed');
}finally{await rm(temp,{recursive:true,force:true});}
