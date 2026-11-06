import {guideBundle} from './guide-bundle.mjs';
// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'dist/esp32-deploy');
const build=path.join(root,'.build/esp32-firmware');
const version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
const files=[['bootloader.bin','bootloader/bootloader.bin',0,0x8000],['partition-table.bin','partition_table/partition-table.bin',0x8000,0x1000],['application.bin','smart_charging_esp32.bin',0x10000,0x300000],['ota-data.bin','ota_data_initial.bin',0x910000,0x2000]];
const parts=[];
for(const [file,source,offset,max] of files){
  const data=await readFile(path.join(build,source));
  if(!data.length || data.length>max || data.length%4)throw Error('Unexpected firmware size: '+file);
  parts.push({file,offset,size:data.length,sha256:createHash('sha256').update(data).digest('hex'),md5:createHash('md5').update(data).digest('hex'),data});
}
await rm(output,{recursive:true,force:true});await mkdir(path.join(output,'firmware'),{recursive:true});
for(const file of ['index.html','client.js','styles.css','flasher.js','flash-policy.js','brand.svg','brand-light.svg','vendor/esptool-0.7.1.js','vendor/esptool-LICENSE.txt','vendor/DEPENDENCY_NOTICES.txt']){
  await mkdir(path.dirname(path.join(output,file)),{recursive:true});
  await cp(path.join(root,'prototype/esp32-usb-test',file),path.join(output,file));
}
const guide=await guideBundle(root);await writeFile(path.join(output,'guide.js'),guide.script);await writeFile(path.join(output,'guide.css'),guide.css);
await cp(path.join(root,'dev/about.js'),path.join(output,'about.js'));
for(const part of parts)await writeFile(path.join(output,'firmware',part.file),part.data);
await writeFile(path.join(output,'firmware/manifest.json'),JSON.stringify({schema:1,chip:'ESP32-S3',flash_size:'16MB',psram_bytes:8388608,version,automation_enabled:false,parts:parts.map(({data,...part})=>part)},null,2)+'\n');
// OTA points to the reviewed release binary, not this possibly rebuilt USB artifact.
try{
 const ota=JSON.parse(await readFile(path.join(root,'esp32/ota-release.json'),'utf8'));
 const expected=`https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-${version}/SmartCharging-ESP32-Firmware-${version}.bin`;
 if(ota.schema!==1||ota.board!=='ESP32-S3-N16R8'||ota.version!==version||ota.url!==expected||!/^[a-f0-9]{64}$/.test(ota.sha256)||!Number.isInteger(ota.size)||ota.size<32||ota.size>0x300000)throw Error('Invalid frozen OTA release record');
 await writeFile(path.join(output,'firmware/ota.json'),JSON.stringify(ota,null,2)+'\n');
}catch(error){if(error.code!=='ENOENT')throw error;console.log('OTA metadata not frozen yet. Run prepare-esp32-ota.mjs before release.');}
await cp(path.join(root,'esp32/SDK_NOTICES.txt'),path.join(output,'firmware/SDK_NOTICES.txt'));
await writeFile(path.join(output,'.nojekyll'),'');
console.log('Built local ESP32 Deploy artifact: dist/esp32-deploy. Configuration sectors are excluded. Nothing published.');
