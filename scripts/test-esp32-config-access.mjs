// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import {mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';import os from 'node:os';
const root=process.cwd(),json=path.join(root,'.build/esp32-sdk/esp-idf-v5.5.2/components/json/cJSON'),temp=await mkdtemp(path.join(os.tmpdir(),'sc-config-access-'));
try{
 const output=path.join(temp,'test');const build=spawnSync('cc',['-std=c11','-D_DARWIN_C_SOURCE','-Wall','-Wextra','-Werror','-I'+path.join(root,'esp32/tests/stubs'),'-I'+path.join(root,'esp32/main'),'-I'+json,'esp32/tests/config_access_test.c','esp32/main/config_access.c',path.join(json,'cJSON.c'),'-o',output],{encoding:'utf8'});if(build.status)throw Error(build.stderr);
 const result=spawnSync(output,[],{encoding:'utf8'});if(result.status)throw Error(result.stderr);process.stdout.write(result.stdout);
}finally{await rm(temp,{recursive:true,force:true});}
