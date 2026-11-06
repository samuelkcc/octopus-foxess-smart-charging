// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';import os from 'node:os';
const root=process.cwd(),sdk=path.join(root,'.build/esp32-sdk/esp-idf-v5.5.2/components'),mbed=path.join(sdk,'mbedtls/mbedtls'),json=path.join(sdk,'json/cJSON');
const temp=await mkdtemp(path.join(os.tmpdir(),'sc-live-'));
try{
 await writeFile(path.join(temp,'test_config.h'),'#define MBEDTLS_MD5_C\n');
 const output=path.join(temp,'test');
 const built=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror','-DMBEDTLS_CONFIG_FILE="test_config.h"','-I'+temp,'-I'+path.join(mbed,'include'),'-I'+path.join(mbed,'library'),'-I'+json,'-I'+path.join(root,'esp32/main'),path.join(root,'esp32/tests/live_policy_test.c'),path.join(root,'esp32/main/foxess_live_policy.c'),path.join(json,'cJSON.c'),path.join(mbed,'library/md5.c'),path.join(mbed,'library/platform_util.c'),'-lm','-o',output],{encoding:'utf8'});
 assert.equal(built.status,0,built.stderr);
 const vectors=Array.from({length:120},(_,i)=>({path:i%2?'/basic/v0/user/login':'/op/v0/plant/list',token:i%3?'test-token-'.repeat(i%25):'',timestamp:String(1793916000000+i)}));
 const result=spawnSync(output,[],{input:JSON.stringify(vectors),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const actual=JSON.parse(result.stdout),module=await WebAssembly.compile(await readFile('linux/foxess-signature.wasm'));
 for(let i=0;i<vectors.length;i++){
  let memory;const instance=await WebAssembly.instantiate(module,{env:{emscripten_memcpy_big:(d,s,l)=>{new Uint8Array(memory.buffer).copyWithin(d,s,s+l);return d;},emscripten_resize_heap:()=>0,setTempRet0(){}}});const x=instance.exports;memory=x.memory;x.__wasm_call_ctors();
  const put=value=>{const bytes=Buffer.from(value+'\0');const pointer=x.stackAlloc(bytes.length);new Uint8Array(memory.buffer,pointer,bytes.length).set(bytes);return pointer;};
  const v=vectors[i],pointer=x.begin_signature(put(v.path),put(v.token),put('en'),put(v.timestamp)),bytes=new Uint8Array(memory.buffer);let end=pointer;while(bytes[end])end++;
  assert.equal(actual[i],Buffer.from(bytes.subarray(pointer,end)).toString(),'Pi signature vector '+i);
 }
 const transport=path.join(temp,'transport');
 const transportBuild=spawnSync('cc',['-std=c11','-D_DARWIN_C_SOURCE','-Dtime=sc_test_time','-Wall','-Wextra','-Werror','-DMBEDTLS_CONFIG_FILE="test_config.h"','-I'+temp,'-I'+path.join(mbed,'include'),'-I'+path.join(mbed,'library'),'-I'+path.join(root,'esp32/tests/stubs'),'-I'+path.join(root,'esp32/main'),'-I'+json,path.join(root,'esp32/tests/live_transport_test.c'),path.join(root,'esp32/main/foxess_live_policy.c'),path.join(json,'cJSON.c'),path.join(mbed,'library/md5.c'),path.join(mbed,'library/platform_util.c'),'-lm','-o',transport],{encoding:'utf8'});assert.equal(transportBuild.status,0,transportBuild.stderr);
 const transportResult=spawnSync(transport,[],{encoding:'utf8'});assert.equal(transportResult.status,0,transportResult.stderr);process.stdout.write(transportResult.stdout);
 await writeFile(path.join(temp,'test_config.h'),'#define MBEDTLS_MD5_C\n#define MBEDTLS_AES_C\n#define MBEDTLS_GCM_C\n#define MBEDTLS_CIPHER_C\n');
 const store=path.join(temp,'store');
 const storeBuild=spawnSync('cc',['-std=c11','-D_DARWIN_C_SOURCE','-Wall','-Wextra','-Werror','-DMBEDTLS_CONFIG_FILE="test_config.h"','-I'+temp,'-I'+path.join(mbed,'include'),'-I'+path.join(mbed,'library'),'-I'+path.join(root,'esp32/tests/stubs'),'-I'+path.join(root,'esp32/main'),'-I'+json,path.join(root,'esp32/tests/live_store_test.c'),path.join(root,'esp32/main/foxess_live_store.c'),...['aes','gcm','cipher','cipher_wrap','constant_time','platform_util'].map(name=>path.join(mbed,'library',name+'.c')),'-o',store],{encoding:'utf8'});assert.equal(storeBuild.status,0,storeBuild.stderr);
 const storeResult=spawnSync(store,[],{encoding:'utf8'});assert.equal(storeResult.status,0,storeResult.stderr);process.stdout.write(storeResult.stdout);
 console.log('ESP32 native signature matches 120 fresh Pi WebAssembly instances exactly; bounded inputs, live direction mapping, zero, missing and stale frames passed.');
}finally{await rm(temp,{recursive:true,force:true});}
