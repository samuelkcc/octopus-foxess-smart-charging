// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
const expected=[['bootloader.bin',0,0x8000],['partition-table.bin',0x8000,0x1000],['application.bin',0x10000,0x300000],['ota-data.bin',0x910000,0x2000]];
export function validateManifest(manifest){
  if(manifest?.schema!==1 || manifest.chip!=='ESP32-S3' || manifest.flash_size!=='16MB' || manifest.psram_bytes!==8388608 || manifest.automation_enabled!==false || manifest.parts?.length!==4)throw Error('Unsupported firmware manifest.');
  for(const [index,[file,offset,max]] of expected.entries()){
    const part=manifest.parts[index];
    if(part?.file!==file || part.offset!==offset || !Number.isSafeInteger(part.size) || part.size<=0 || part.size>max || part.size%4 || !/^[a-f0-9]{64}$/.test(part.sha256) || !/^[a-f0-9]{32}$/.test(part.md5))throw Error('Invalid firmware part. Installation stopped.');
  }
  return manifest;
}
export async function verifyPart(part,data,crypto){
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(data.length!==part.size || digest!==part.sha256)throw Error('Firmware download verification failed. Nothing written.');
}
export function flashOptions(part,data,reportProgress){
  return {fileArray:[{data,address:part.offset}],flashMode:'keep',flashFreq:'keep',flashSize:'keep',eraseAll:false,compress:true,calculateMD5Hash:()=>part.md5,reportProgress};
}
export async function resetToApplication(transport,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
  // Release BOOT, pulse EN, then release EN. The pinned loader's after() does not pulse EN on UART boards.
  await transport.setDTR(false);
  await transport.setRTS(true);
  await pause(100);
  await transport.setRTS(false);
}
