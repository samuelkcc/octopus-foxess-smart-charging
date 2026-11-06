// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import {validateManifest,verifyPart,flashOptions,resetToApplication} from './flash-policy.js';
const $=id=>document.getElementById(id);
function controls(){
  $('install-firmware').disabled= !window.isSecureContext || !navigator.serial || !window.crypto?.subtle || window.esp32Flashing || window.esp32Setup?.isConnected() || window.esp32Setup?.isBusy() || !$('flash-board').checked || !$('flash-consent').checked;
}
for(const id of ['flash-board','flash-consent'])$(id).addEventListener('change',controls);
window.addEventListener('esp32-controls',controls);
async function download(file,json=false){
  const response=await fetch(new URL('./firmware/'+file,import.meta.url),{credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('Firmware files are unavailable. Build the local deployment artifact first.');
  return json?response.json():new Uint8Array(await response.arrayBuffer());
}
$('install-firmware').addEventListener('click',async()=>{
  if($('install-firmware').disabled)return;
  let transport;
  window.esp32Flashing=true;window.esp32Setup?.refreshControls();controls();
  $('flash-progress').hidden=false;$('flash-progress').value=0;
  $('flash-status').textContent='Select the ESP32 USB-UART port. Checking firmware files before writing…';
  try{
    // Request within the user gesture, before network work consumes transient activation.
    const port=await navigator.serial.requestPort({filters:[{usbVendorId:0x1a86},{usbVendorId:0x303a},{usbVendorId:0x10c4},{usbVendorId:0x0403}]});
    const manifest=validateManifest(await download('manifest.json',true));
    const images=[];
    for(const part of manifest.parts){const data=await download(part.file);await verifyPart(part,data,window.crypto);images.push(data);}
    const {ESPLoader,Transport}=await import('./vendor/esptool-0.7.1.js');
    transport=new Transport(port,false);
    const loader=new ESPLoader({transport,baudrate:460800,debugLogging:false,enableTracing:false,terminal:{clean(){},write(){},writeLine(){}}});
    $('flash-status').textContent='Connecting to the bootloader…';
    await loader.main();
    if(loader.chip?.CHIP_NAME!=='ESP32-S3' || await loader.detectFlashSize()!=='16MB')throw Error('This installer requires an ESP32-S3 with 16 MB flash. Nothing written.');
    for(let index=0;index<manifest.parts.length;index++){
      const part=manifest.parts[index];
      $('flash-status').textContent=`Installing and verifying ${part.file} (${index+1}/4)…`;
      await loader.writeFlash(flashOptions(part,images[index],(_file,written,total)=>{
        $('flash-progress').value=(index+written/total)*25;
      }));
    }
    await resetToApplication(transport);
    $('flash-progress').value=100;
    $('flash-status').textContent='Firmware installed and flash hashes verified. Saved configuration retained. Select Connect ESP32 to continue.';
  }catch(error){
    $('flash-status').textContent=error?.name==='NotFoundError'?'No device selected.': 'Installation did not complete. Keep the board connected and retry. '+(error?.message || 'USB connection failed.');
  }finally{
    await transport?.disconnect().catch(()=>{});
    window.esp32Flashing=false;window.esp32Setup?.refreshControls();controls();
  }
});
controls();
