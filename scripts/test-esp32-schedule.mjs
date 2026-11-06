// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import { access,mkdtemp,rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve(import.meta.dirname,'..');
const sdk=process.env.IDF_PATH||path.join(root,'.build/esp32-sdk/esp-idf-v5.5.2');
const json=path.join(sdk,'components/json/cJSON');
await access(path.join(json,'cJSON.c'));
const temp=await mkdtemp(path.join(os.tmpdir(),'sc-esp32-schedule-'));
try {
  for(const suite of ['schedule','provision','automation']){
  const output=path.join(temp,suite+'-tests');
  const built=spawnSync('cc',['-std=c11','-D_DEFAULT_SOURCE','-Wall','-Wextra','-Werror','-Wno-unused-parameter','-I'+path.join(root,'esp32/main'),'-I'+json,
    path.join(root,'esp32/tests/'+suite+'_test.c'),...(suite==='schedule'?['schedule_policy.c','schedule_transaction.c']:suite==='provision'?['provision_policy.c']:['automation_policy.c','schedule_policy.c']).map(file=>path.join(root,'esp32/main',file)),path.join(json,'cJSON.c'),'-lm','-o',output],{encoding:'utf8'});
  if(built.status!==0)throw new Error(built.stderr||built.stdout||'Native compilation failed');
  const tested=spawnSync(output,[],{encoding:'utf8'});
  process.stdout.write(tested.stdout);
  if(tested.status!==0)throw new Error(tested.stderr||'Native schedule tests failed');
}
}finally{await rm(temp,{recursive:true,force:true});}
