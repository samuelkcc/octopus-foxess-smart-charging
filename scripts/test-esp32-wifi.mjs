// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';import os from 'node:os';
const root=path.resolve(import.meta.dirname,'..'),temp=await mkdtemp(path.join(os.tmpdir(),'sc-wifi-'));
try{
 const binary=path.join(temp,'wifi-test');
 const built=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror','-I'+path.join(root,'esp32/tests/wifi_stubs'),'-I'+path.join(root,'esp32/main'),path.join(root,'esp32/tests/wifi_test.c'),path.join(root,'esp32/main/wifi_reconnect.c'),'-o',binary],{encoding:'utf8'});
 assert.equal(built.status,0,built.stderr||built.stdout);
 const run=spawnSync(binary,[],{encoding:'utf8'});process.stdout.write(run.stdout);assert.equal(run.status,0,run.stderr);
 const main=await readFile(path.join(root,'esp32/main/main.c'),'utf8');
 assert(main.includes('IP_EVENT_STA_LOST_IP,wifi_event'));
 assert(main.includes('xTaskCreate(wifi_reconnect_task,"sc-wifi"'),'Recovery must run independently of cloud and USB test locks.');
 assert(!/retries\+\+\s*<\s*5/.test(main),'The finite retry limit must not return.');
}finally{await rm(temp,{recursive:true,force:true});}
