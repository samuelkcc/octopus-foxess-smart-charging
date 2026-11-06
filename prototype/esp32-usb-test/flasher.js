// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import {validateManifest,verifyPart,resetToApplication,installationRequirements,installVerifiedParts} from './flash-policy.js';
const $=id=>document.getElementById(id);
let completedMode='keep';
function controls(){
  const mode=$('flash-mode').value;
  const requirements=installationRequirements({supported:!!(window.isSecureContext&&navigator.serial&&window.crypto?.subtle),flashing:window.esp32Flashing===true,connected:window.esp32Setup?.isConnected()===true,busy:window.esp32Setup?.isBusy()===true,board:$('flash-board').checked,consent:$('flash-consent').checked,mode,confirmation:$('flash-erase-confirmation').value});
  $('install-firmware').disabled=requirements.length>0;
  $('flash-requirements').textContent=requirements.length?'Before installation: '+requirements.join(' '):'Ready. Select the installation button, then choose the USB-UART port.';
  for(const id of ['flash-mode','flash-board','flash-consent','flash-erase-confirmation'])$(id).disabled=window.esp32Flashing===true;
  $('install-firmware').textContent=mode==='clean'?'Erase all & install':'Reinstall · Keep settings';
}
for(const id of ['flash-board','flash-consent','flash-erase-confirmation'])$(id).addEventListener('input',controls);
for(const id of ['flash-board','flash-consent'])$(id).addEventListener('change',controls);
$('flash-mode').addEventListener('change',()=>{
  const clean=$('flash-mode').value==='clean';
  $('flash-consent').checked=false;$('flash-erase-confirmation').value='';$('flash-continue').hidden=true;
  $('flash-clean-warning').hidden=!clean;
  $('flash-consent-text').textContent=clean?'Permanently delete all settings and History on this ESP32, then install firmware.':'Install firmware on this board. Keep its saved configuration.';
  $('flash-mode-description').textContent=clean?'Erases this board. Complete New setup after installation.':'Keeps saved Wi-Fi, accounts, passwords, rules and Flash History.';
  controls();
});
$('flash-continue').addEventListener('click',()=>window.esp32Setup?.afterInstall(completedMode==='clean'));
window.addEventListener('esp32-controls',controls);
async function download(file,json=false){
  const response=await fetch(new URL('./firmware/'+file,import.meta.url),{credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('Firmware files are unavailable. Build the local deployment artifact first.');
  return json?response.json():new Uint8Array(await response.arrayBuffer());
}
$('install-firmware').addEventListener('click',async()=>{
  if($('install-firmware').disabled)return;
  let transport,eraseStarted=false;
  const mode=$('flash-mode').value,confirmation=$('flash-erase-confirmation').value;
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
    completedMode=mode;
    $('flash-status').textContent=mode==='clean'?'Clean install completed. All ESP32 settings and History were erased. Firmware hashes verified. Continue with New setup.':'Firmware installed and hashes verified. Saved configuration retained. Continue to review saved settings.';
    $('flash-continue').textContent=mode==='clean'?'Continue: New setup':'Continue: Edit settings';$('flash-continue').hidden=false;
  }catch(error){
    $('flash-status').textContent=error?.name==='NotFoundError'?'No device selected.': (eraseStarted?'Clean install did not complete. ESP32 data may already be erased. Keep USB connected and retry installation. ':'Installation did not complete. Keep the board connected and retry. ')+(error?.message || 'USB connection failed.');
  }finally{
    await transport?.disconnect().catch(()=>{});
    $('flash-consent').checked=false;$('flash-erase-confirmation').value='';
    window.esp32Flashing=false;window.esp32Setup?.refreshControls();controls();
  }
});
controls();
