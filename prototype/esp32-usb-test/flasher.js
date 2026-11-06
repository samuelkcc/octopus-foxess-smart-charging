// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import {validateManifest,verifyPart,resetToApplication,installationRequirements,installVerifiedParts} from './flash-policy.js';
const $=id=>document.getElementById(id);
function controls(){
  const mode='clean';
  const requirements=installationRequirements({supported:!!(window.isSecureContext&&navigator.serial&&window.crypto?.subtle),flashing:window.esp32Flashing===true,connected:window.esp32Setup?.isConnected()===true,busy:window.esp32Setup?.isBusy()===true,board:$('flash-board').checked,consent:$('flash-consent').checked,mode,confirmation:$('flash-erase-confirmation').value});
  $('install-firmware').disabled=requirements.length>0||!$('flash-continue').hidden;
  $('flash-requirements').textContent=!$('flash-continue').hidden?'Installation verified. Select Continue: Connect ESP32.':requirements.length?'Before installation: '+requirements.join(' '):'Ready. Select the installation button, then choose the USB-UART port.';
  for(const id of ['flash-mode','flash-board','flash-consent','flash-erase-confirmation'])$(id).disabled=window.esp32Flashing===true;
  $('install-firmware').textContent='Erase all & install';
}
for(const id of ['flash-board','flash-consent','flash-erase-confirmation'])$(id).addEventListener('input',controls);
for(const id of ['flash-board','flash-consent'])$(id).addEventListener('change',controls);
$('flash-continue').addEventListener('click',()=>window.esp32Setup?.afterInstall());
window.addEventListener('esp32-controls',controls);
async function download(file,json=false){
  const response=await fetch(new URL('./firmware/'+file,import.meta.url),{credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('Firmware files are unavailable. Build the local deployment artifact first.');
  return json?response.json():new Uint8Array(await response.arrayBuffer());
}
$('install-firmware').addEventListener('click',async()=>{
  if($('install-firmware').disabled)return;
  let transport,eraseStarted=false;
  const mode='clean',confirmation=$('flash-erase-confirmation').value;
  $('flash-continue').hidden=true;
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
    await installVerifiedParts(loader,manifest,images,{mode,confirmation,crypto:window.crypto,
      onErase(){eraseStarted=true;$('flash-status').textContent='Erasing all ESP32 Flash data… Keep USB connected.';},
      onPart(part,index,total){$('flash-status').textContent=`Installing and verifying ${part.file} (${index+1}/${total})…`;},
      onProgress(index,written,total){$('flash-progress').value=(index+written/total)*25;}
    });
    await resetToApplication(transport);
    $('flash-progress').value=100;
    $('flash-status').textContent='Clean install completed. All ESP32 settings and History were erased. Firmware hashes verified. Continue to connect and configure.';
    $('flash-continue').textContent='Continue: Connect ESP32';$('flash-continue').hidden=false;
  }catch(error){
    $('flash-status').textContent=error?.name==='NotFoundError'?'No device selected.': (eraseStarted?'Clean install did not complete. ESP32 data may already be erased. Keep USB connected and retry installation. ':'Installation did not complete. Keep the board connected and retry. ')+(error?.message || 'USB connection failed.');
  }finally{
    await transport?.disconnect().catch(()=>{});
    $('flash-consent').checked=false;$('flash-erase-confirmation').value='';
    window.esp32Flashing=false;window.esp32Setup?.refreshControls();controls();
  }
});
controls();
