// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Freeze the release binary digest so CI-rebuilt USB firmware cannot change its OTA digest.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const binary=await readFile('.build/esp32-firmware/smart_charging_esp32.bin');
if(!binary.length||binary.length>0x300000)throw Error('Invalid application size');
const record={schema:1,board:'ESP32-S3-N16R8',version,size:binary.length,sha256:createHash('sha256').update(binary).digest('hex'),url:`https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-${version}/SmartCharging-ESP32-Firmware-${version}.bin`};
await writeFile('esp32/ota-release.json',JSON.stringify(record,null,2)+'\n');
console.log('Frozen release OTA metadata. Publish the matching binary with this source revision.');
