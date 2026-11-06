// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';import os from 'node:os';
const root=process.cwd(),sdk=path.join(root,'.build/esp32-sdk/esp-idf-v5.5.2/components'),mbed=path.join(sdk,'mbedtls/mbedtls'),json=path.join(sdk,'json/cJSON');
const temp=await mkdtemp(path.join(os.tmpdir(),'sc-ota-'));
try{
 await writeFile(path.join(temp,'test_config.h'),'#define MBEDTLS_SHA256_C\n');
 const output=path.join(temp,'test');
 const build=spawnSync('cc',['-std=c11','-D_DARWIN_C_SOURCE','-D_DEFAULT_SOURCE','-Wall','-Wextra','-Werror','-DMBEDTLS_CONFIG_FILE="test_config.h"','-I'+temp,'-I'+path.join(mbed,'include'),'-I'+path.join(mbed,'library'),'-I'+path.join(root,'esp32/tests/debug_stubs'),'-I'+path.join(root,'esp32/tests/ota_stubs'),'-I'+path.join(root,'esp32/tests/stubs'),'-I'+path.join(root,'esp32/main'),'-I'+json,path.join(root,'esp32/tests/debug_test.c'),path.join(root,'esp32/main/debug_log.c'),path.join(json,'cJSON.c'),path.join(mbed,'library/sha256.c'),path.join(mbed,'library/platform_util.c'),'-o',output],{encoding:'utf8'});
 assert.equal(build.status,0,build.stderr);const run=spawnSync(output,[],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);process.stdout.write(run.stdout);
}finally{await rm(temp,{recursive:true,force:true});}
