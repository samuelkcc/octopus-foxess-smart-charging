// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareDeliverables} from './prepare-deliverables.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'sc-deliverables-'));
const put=async(file,text=file)=>{await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),text);};
try{
 await put('package.json',JSON.stringify({version:'2.2.0'}));
 await put('dist/keep.txt','original');
 await assert.rejects(prepareDeliverables(root,{all:true}),/Missing deliverable/);
 assert.equal(await readFile(path.join(root,'dist/keep.txt'),'utf8'),'original');
 for(const file of ['dist/Smart_Charging_v2.2.0.html','dist/windows/SmartCharging-2.2.0-Windows-x64.exe','dist/Octopus_FoxESS_Raspberry_Pi.tar.gz','dist/esp32-setup/macos/SmartCharging-ESP32-Setup-2.2.0-macOS-universal.zip','dist/esp32-setup/macos/mac-universal/Smart Charging ESP32 Setup.app/Contents/app.txt','dist/esp32-setup/windows/SmartCharging-ESP32-Setup-2.2.0-Windows-x64.exe','dist/esp32-deploy/index.html','esp32/README.md','linux/install.sh','LICENSE','THIRD_PARTY_NOTICES.md'])await put(file);
 let result=await prepareDeliverables(root,{all:true});
 assert.equal(await readFile(path.join(result.archive,'keep.txt'),'utf8'),'original');
 for(const file of ['ESP32/macOS/Smart Charging ESP32 Setup.app/Contents/app.txt','ESP32/Windows/SmartCharging-ESP32-Setup-2.2.0-Windows-x64.exe','ESP32/Web/index.html','ESP32/README.md','Pi/install.sh','Web HTML/LICENSE','Windows Portable/THIRD_PARTY_NOTICES.md'])assert((await stat(path.join(root,'dist',file))).isFile(),file);
 const hashes=await readFile(path.join(root,'dist/SHA256SUMS.txt'),'utf8');
 assert(hashes.includes('Web HTML/Smart_Charging_v2.2.0.html'));
 result=await prepareDeliverables(root,{all:true});
 assert.equal(await readFile(result.html,'utf8'),'dist/Smart_Charging_v2.2.0.html');
 assert.equal(await readFile(path.join(root,'dist/SHA256SUMS.txt'),'utf8'),hashes);
 console.log('Deliverables: validated inputs, preserved archive, edition folders, notices, checksums and repeatable packaging passed.');
}finally{await rm(root,{recursive:true,force:true});}
