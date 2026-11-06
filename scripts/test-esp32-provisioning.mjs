// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {validateManifest,verifyPart,flashOptions,resetToApplication,installationRequirements,installVerifiedParts} from '../prototype/esp32-usb-test/flash-policy.js';

const source = await readFile(new URL('../prototype/esp32-usb-test/client.js',import.meta.url),'utf8');
const html = await readFile(new URL('../prototype/esp32-usb-test/index.html',import.meta.url),'utf8');
const firmware = await readFile(new URL('../esp32/main/main.c',import.meta.url),'utf8');

function harness({ chooseTask=true, supported=true, rejectSelection=false, rejectSave=false, oldFirmware=false, existing=false, protectedConfig=false, failedJob=false, automation=false, rejectApiTest=false, rejectOptionalSave=false, savedStatic=false, missingJob=false, queuedJob=false, rejectNetworkSetup=false, rejectNetworkTrial=false }={}) {
  const elements=new Map();
  const windowEvents={};
  for (const [,id] of html.matchAll(/\bid="([^"]+)"/g)) elements.set(id,{
    id,type:'password',value:'',textContent:'',dataset:{},hidden:false,disabled:false,required:false,checked:false,strong:{textContent:''},querySelector(){return this.strong;},options:[{value:''}],handlers:{},validity:'',
    addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(name,value){this[name]=value;},removeAttribute(name){delete this[name];},
    setCustomValidity(message){this.validity=message;},
    replaceChildren(...children){this.options=children;this.textContent='';},
    append(child){this.options.push(child);}
  });
  const get=id=>elements.get(id);
  const inputIds=['ssid','wifi-password','ip','gateway','netmask','dns','octopus-account','octopus-key','foxess-serial','foxess-key','fox-web-user','fox-web-password'];
  get('ssid').required=true;
  get('network-mode').value='dhcp';
  get('static-fields').querySelectorAll=()=>['ip','gateway','netmask','dns'].map(get);
  get('config-form').querySelectorAll=()=>inputIds.map(get);
  get('config-form').reset=()=>{inputIds.forEach(id=>get(id).value='');get('network-mode').value='dhcp';};
  get('config-form').reportValidity=()=>!inputIds.map(get).some(e=>!e.disabled&&(e.validity||e.required&&!e.value));
  const commands=[];
  let controller,configured=existing,closeCount=0,foxConfigured=false,liveMode='rest';
  let savedPort=8787;let protection=protectedConfig;let jobRequest,jobPoll=0;
  const status=()=>({config_access:{enabled:protection},firmware:oldFirmware?'Smart Charging ESP32 connection test':'Smart Charging ESP32',dashboard_port:8787,configured_dashboard_port:savedPort,dashboard_restart_required:savedPort!==8787,version:'2.2.0',configured,automation_enabled:automation,wifi_connected:configured,ip:configured?"192.168.8.188":undefined,psram_bytes:8388608,foxess_telemetry:{configured:foxConfigured,mode:liveMode},capabilities:oldFirmware?{}:{usb_network_setup:true,wifi_scan_while_running:true,dashboard_port_configuration:true,production_controller:true,usb_config_readback:true,optional_foxess_websocket:true,validate_before_save:true,network_only_save:true,network_trial:true,ip_suggestion:true}});
  const device={
    async open(){
      this.readable=new ReadableStream({start(value){controller=value;}});
      this.writable=new WritableStream({write(bytes){
        const request=JSON.parse(new TextDecoder().decode(bytes));
        commands.push(request);
        let result;
        let ok=true;
        switch(request.command){
          case 'hello':case 'status': result=status();break;
          case 'network_setup':assert.equal(request.confirmation,'DISABLE_AUTOMATION_FOR_NETWORK_SETUP');if(rejectNetworkSetup){ok=false;break;}automation=false;result=status();break;
          case 'dashboard_port':savedPort=request.port;result=status();break;
          case 'runtime_state':result={now:1793916000};break;
          case 'scan':result=[{ssid:'Example-IoT',rssi:-45,security:'Secured'},{ssid:'Example-IoT',rssi:-70,security:'Secured'}];break;
          case 'config_read':if(protection&&request.config_password!=='example-config-password'){ok=false;break;}result={ssid:'saved-wifi',password:'saved-private-wifi',account:'saved-account',octopus_key:'saved-private-octopus',foxess_sn:'saved-serial',foxess_key:'saved-private-foxess',ip_mode:savedStatic?'static':'dhcp',ip:'192.168.8.188',gateway:'192.168.8.1',netmask:'255.255.255.0',dns:'192.168.8.1'};break;
          case 'config_access_set':if(protection&&request.config_password!=='example-config-password'){ok=false;break;}protection=!!request.new_password;result={enabled:protection};break;
          case 'service_setup':jobRequest=request.config;jobPoll=0;result={id:4294967295};break;
          case 'service_setup_status':assert.equal(request.job_id,4294967295);if(queuedJob&&jobPoll++<2){result={phase:jobPoll===1?'queued':'running'};break;}if(missingJob){controller.enqueue(new TextEncoder().encode('SCESP1 '+JSON.stringify({protocol:'sc-esp32',version:1,id:request.id,ok:false,error:'Setup test not found'})+'\n'));return;}if(failedJob){ok=false;break;}foxConfigured=!!jobRequest.username||foxConfigured;liveMode=jobRequest.mode||liveMode;result={id:77,phase:'done',result:{saved:jobRequest.action.startsWith('save_')&&!rejectOptionalSave,connected:!rejectApiTest,status:rejectApiTest?'API validation failed':rejectOptionalSave?'Optional settings not saved':'Service test passed'}};break;
          case 'foxess_live_store':case 'foxess_live_configure':foxConfigured=!!request.config.username||foxConfigured;liveMode=request.config.mode;result={saved:!rejectOptionalSave,status:rejectOptionalSave?'Optional settings not saved':'Optional telemetry settings saved'};break;
          case 'configure_network':case 'configure':configured=!rejectSave;result={saved:configured,checks:{wifi_connected:true,ip_valid:configured,clock_synced:true,octopus:{connected:true},foxess:{connected:configured}},status:configured?'All checks passed. Saved.':'Validation failed. Not saved.'};break;
          case 'network_trial':if(rejectNetworkTrial){ok=false;break;}result={connected:true,ip:'192.168.1.42',gateway:'192.168.1.1',netmask:'255.255.255.0',dns:'192.168.1.1',saved:false};break;
          case 'suggest_ip':result={candidate:'192.168.1.188',status:'No response detected',network:{gateway:'192.168.1.1',netmask:'255.255.255.0',dns:'192.168.1.1'}};break;
          case 'test':result={wifi_connected:true,octopus:{connected:true},foxess:{connected:true},automation_enabled:false};break;
          case 'reboot':break;
          default:throw new Error('Unexpected command');
        }
        // Unframed output must never appear in the interface.
        controller.enqueue(new TextEncoder().encode('untrusted raw console text\nSCESP1 '+JSON.stringify({protocol:'sc-esp32',version:1,id:request.id,ok,result,error:ok?undefined:'Invalid configuration'})+'\n'));
      }});
    },
    getInfo(){return {usbVendorId:0x1a86,usbProductId:0x7523};},
    async close(){closeCount++;try{controller.close();}catch{}}
  };
  const serial={async requestPort(){if(rejectSelection)throw {name:'NotFoundError'};return device;},addEventListener(){}};
  const testWindow={isSecureContext:true,addEventListener(type,fn){windowEvents[type]=fn;}};
  vm.runInNewContext(source,{
    document:{getElementById:get,createElement:()=>({}),documentElement:{dataset:{theme:'dark'}}},navigator:supported?{serial}:{},
    window:testWindow,
    TextEncoder,TextDecoder,Event,JSON,Number,Object,String,Map,Set,setTimeout,clearTimeout,
    Option:class{constructor(text,value){this.text=text;this.value=value;}}
  });
  const click=id=>get(id).handlers.click({preventDefault(){}});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const fill=()=>{for(const id of ['ssid','wifi-password','octopus-account','octopus-key','foxess-serial','foxess-key'])get(id).value='example-'+id;};
  if(chooseTask)click('mode-edit');
  return {get,click,flush,fill,commands,windowEvents,bridge:testWindow.esp32Setup,closeCount:()=>closeCount};
}

const newFlow=harness({chooseTask:false});
assert(newFlow.get('connect').disabled&&newFlow.get('setup-connection').hidden,'Choose a task before any setup serial connection');
newFlow.click('mode-new');assert(!newFlow.get('firmware-install-panel').hidden,'New setup includes the installer');
assert(newFlow.get('connect').disabled&&newFlow.get('connect').hidden,'A blank board must install before Connect ESP32');
await newFlow.click('connect');assert.equal(newFlow.commands.length,0,'No serial handshake before installation');
newFlow.click('nav-network');assert(!newFlow.get('device').hidden,'Installation cannot skip directly to network settings');
newFlow.bridge.afterInstall();assert(newFlow.get('firmware-install-panel').hidden);assert(!newFlow.get('setup-connection').hidden);assert(!newFlow.get('connect').disabled);
assert(newFlow.get('connection-instructions').textContent.includes('Firmware installed and verified'));
await newFlow.click('connect');assert.equal(newFlow.get('handshake').textContent,'Verified');assert.equal(newFlow.get('ssid').value,'');
assert(!newFlow.commands.some(r=>r.command==='config_read'||r.command==='configure'),'Fresh installation does not restore old secrets or save before tests');
newFlow.click('wizard-next');assert(!newFlow.get('network').hidden);await newFlow.click('disconnect');
const editFlow=harness({existing:true});await editFlow.click('connect');assert.equal(editFlow.get('ssid').value,'saved-wifi');assert(editFlow.get('firmware-install-panel').hidden);
editFlow.click('mode-new');assert(!editFlow.get('firmware-install-panel').hidden);assert(!editFlow.get('disconnect').disabled,'Connected users can release USB before erasure');
assert(editFlow.get('wizard-next').disabled);assert.equal(editFlow.get('ssid').value,'');await editFlow.click('disconnect');
assert(!html.includes('id="mode-reinstall"'),'Two task entries replace the separate recovery route');
const flashSource=await readFile(new URL('../prototype/esp32-usb-test/flasher.js',import.meta.url),'utf8');
assert(flashSource.includes("const mode='clean',confirmation="),'The public installer always selects clean installation');
assert(!html.includes('value="keep"'),'No preservation choice in the new public installation workflow');
console.log('Two-task setup: installation-first, blocked premature serial access, verified-install continuation, blank setup and non-erasing Edit settings passed.');

const failedNetwork=harness({rejectNetworkTrial:true});await failedNetwork.click('connect');failedNetwork.fill();await failedNetwork.click('network-test');assert(failedNetwork.get('network-info').textContent.startsWith('Wi-Fi test failed:'));assert(failedNetwork.get('step-feedback').textContent.includes('Invalid configuration'));assert.equal(failedNetwork.get('wifi-password').value,'example-wifi-password');failedNetwork.click('wizard-next');failedNetwork.click('wizard-next');assert(failedNetwork.get('step-feedback').textContent.includes('Network check required'));await failedNetwork.click('disconnect');
const h=harness();
assert(h.get('save').disabled);
assert(!h.get('device').hidden && h.get('network').hidden && h.get('accounts').hidden && h.get('verify').hidden);
assert(h.get('wizard-next').disabled);
await h.click('connect');
assert.equal(h.get('handshake').textContent,'Verified');
assert.equal(h.get('vendor').textContent,'0x1A86');
assert(!h.get('save').disabled);
assert(h.get('test').disabled);
h.click('wizard-next');assert(h.get('device').hidden && !h.get('network').hidden);
h.click('wizard-next');assert(!h.get('network').hidden,'The network trial is required before advancing');
await h.click('scan-wifi');await h.flush();
assert.equal(h.get('wifi-networks').options.length,2,'Duplicate SSIDs should have one option');
h.fill();
await h.click('network-test');await h.flush();
assert.equal(h.commands.at(-1).command,'network_trial');
assert.deepEqual(Object.keys(h.commands.at(-1).config).sort(),['ip_mode','password','ssid']);
assert(!h.get('suggest-ip').disabled);
await h.click('suggest-ip');await h.flush();h.click('use-suggestion');
assert.equal(h.get('network-mode').value,'static');
assert.equal(h.get('ip').value,'192.168.1.188');
h.get('config-form').handlers.submit({preventDefault(){}});await h.flush();
assert.equal(h.commands.at(-1).command,'suggest_ip','Static IP needs router review before any save command');
h.get('ip-review').checked=true;
h.click('wizard-next');assert(!h.get('accounts').hidden && h.get('network').hidden);
assert.equal(h.get('wifi-password').value,'example-wifi-password','Step changes preserve in-memory fields');
h.click('wizard-back');assert(!h.get('network').hidden);h.click('wizard-next');h.click('wizard-next');assert(!h.get('verify').hidden);
h.click('show-preview');
for(const id of ['wifi-password','octopus-account','octopus-key','foxess-serial','foxess-key'])assert(!h.get('preview-text').textContent.includes('example-'+id));
h.get('config-form').handlers.submit({preventDefault(){}});await h.flush();
const configuredCommand=h.commands.findLast(row=>row.command==='configure_network');
assert(configuredCommand);assert.equal(configuredCommand.config.password,'example-wifi-password');assert.equal(configuredCommand.static_ip_reviewed,true);
assert.equal(h.get('wifi-password').value,'example-wifi-password');assert.equal(h.get('check-ip').dataset.result,'passed');
assert(!h.commands.some(row=>row.command==='service_setup'||row.command==='test'),'Deployment save makes no cloud tests');
assert(!h.get('device-result').textContent.includes('example-wifi-password'));
h.get('fox-web-user').value='example-portal-login';h.get('fox-web-password').value='example-private-password';h.get('fox-web-mode').value='live-ws';
h.get('config-form').handlers.submit({preventDefault(){}});for(let i=0;i<8;i++)await h.flush();
const ws=h.commands.findLast(row=>row.command==='foxess_live_store');assert.equal(ws.config.mode,'live-ws');assert.equal(ws.config.password,'example-private-password');
assert.equal(h.get('fox-web-password').value,'example-private-password');assert(!h.get('device-result').textContent.includes('example-private-password'));
await h.click('disconnect');
assert.equal(h.closeCount(),1);
assert(h.get('save').disabled);

const saved=harness({existing:true});await saved.click('connect');assert.equal(saved.get('ssid').value,'saved-wifi');assert.equal(saved.get('wifi-password').value,'saved-private-wifi');assert.equal(saved.get('wifi-password').type,'password');assert(!saved.get('device-result').textContent.includes('saved-private'));saved.click('eye-wifi-password');assert.equal(saved.get('wifi-password').type,'text');saved.click('eye-wifi-password');assert.equal(saved.get('wifi-password').type,'password');
saved.get('config-new-password').value='example-config-password';saved.get('config-confirm-password').value='example-config-password';await saved.click('config-password-save');await saved.flush();assert.equal(saved.commands.at(-1).command,'config_access_set');assert.equal(saved.get('config-new-password').value,'');await saved.click('disconnect');assert.equal(saved.get('wifi-password').value,'');
const locked=harness({existing:true,protectedConfig:true});await locked.click('connect');assert(!locked.commands.some(row=>row.command==='config_read'));assert.equal(locked.get('ssid').value,'');locked.get('config-current-password').value='wrong';await locked.click('config-unlock-button');await locked.flush();assert.equal(locked.get('ssid').value,'');assert.equal(locked.get('config-current-password').value,'');locked.get('config-current-password').value='example-config-password';await locked.click('config-unlock-button');await locked.flush();assert.equal(locked.get('ssid').value,'saved-wifi');await locked.click('disconnect');
const skip=harness({existing:true,protectedConfig:true});await skip.click('connect');skip.click('config-skip');assert.equal(skip.get('ssid').value,'');assert(!skip.commands.some(row=>row.command==='config_read'||row.command==='config_access_set'));await skip.click('disconnect');
const running=harness({existing:true,automation:true});await running.click('connect');assert(!running.get('scan-wifi').disabled,'Read-only scan remains available during automation');await running.click('scan-wifi');await running.flush();assert.equal(running.get('wifi-networks').options.length,2);assert(running.get('scan-result').textContent.includes('Found 1 networks'));assert(!running.commands.some(row=>row.command==='configure'||row.command==='network_trial'),'Scan must not reconnect or write settings');assert(!running.get('save').disabled,'Unchanged saved settings must be verifiable while automation runs');running.get('fox-web-user').value='optional-user';running.get('fox-web-password').value='optional-password';running.get('fox-web-mode').value='live-ws';running.get('config-form').handlers.submit({preventDefault(){}});for(let i=0;i<12;i++)await running.flush();assert(!running.commands.some(row=>row.command==='configure'||row.command==='network_trial'),'Saved verification must not reconnect or overwrite network/API settings');assert(!running.commands.some(row=>row.command==='service_setup'));assert(running.commands.some(row=>row.command==='foxess_live_store'));assert(running.get('save-status').textContent.includes('APIs have not been tested'));assert.equal(running.get('fox-web-password').value,'optional-password');running.get('ssid').value='changed-network';running.get('config-form').handlers.input({target:running.get('ssid')});assert(running.get('save').disabled);assert(running.get('save-requirements').textContent.includes('Disable automation'));await running.click('disconnect');
const changeNetwork=harness({existing:true,automation:true});await changeNetwork.click('connect');changeNetwork.get('ssid').value='replacement-wifi';changeNetwork.get('wifi-password').value='retain-new-password';assert(!changeNetwork.get('network-test').disabled);await changeNetwork.click('network-test');assert(!changeNetwork.get('network-setup-confirm').hidden);assert(!changeNetwork.commands.some(row=>row.command==='network_setup'||row.command==='network_trial'),'Opening the confirmation must not change automation or Wi-Fi');changeNetwork.click('network-setup-cancel');assert(changeNetwork.get('network-setup-confirm').hidden);await changeNetwork.click('network-test');await changeNetwork.click('network-setup-accept');await changeNetwork.flush();assert.deepEqual(changeNetwork.commands.filter(row=>['network_setup','network_trial'].includes(row.command)).map(row=>row.command),['network_setup','network_trial']);assert.equal(changeNetwork.get('wifi-password').value,'retain-new-password');assert.equal(changeNetwork.get('ssid').value,'replacement-wifi');assert(!changeNetwork.get('suggest-ip').disabled);await changeNetwork.click('disconnect');
const blockedNetwork=harness({existing:true,automation:true,rejectNetworkSetup:true});await blockedNetwork.click('connect');await blockedNetwork.click('network-test');await blockedNetwork.click('network-setup-accept');await blockedNetwork.flush();assert(!blockedNetwork.commands.some(row=>row.command==='network_trial'),'Failed control barrier must never reconnect Wi-Fi');assert.equal(blockedNetwork.get('wifi-password').value,'saved-private-wifi');await blockedNetwork.click('disconnect');
const unchangedStatic=harness({existing:true,automation:true,savedStatic:true});await unchangedStatic.click('connect');assert(!unchangedStatic.get('ip-review').checked);assert.equal(unchangedStatic.get('nav-verify')['aria-disabled'],'false');unchangedStatic.click('wizard-next');unchangedStatic.click('wizard-next');assert(!unchangedStatic.get('accounts').hidden,'Loaded fixed-IP settings can advance without new address consent');assert(!unchangedStatic.get('save').disabled,'An unchanged saved fixed IP does not require new network consent');unchangedStatic.get('config-form').handlers.submit({preventDefault(){}});for(let i=0;i<12;i++)await unchangedStatic.flush();assert(!unchangedStatic.commands.some(row=>row.command==='configure'||row.command==='network_trial'));assert.equal(unchangedStatic.get('check-ip').dataset.result,'passed');assert(unchangedStatic.get('save-status').textContent.includes('Wi-Fi and IP verified'));await unchangedStatic.click('disconnect');
const optionalFailure=harness({existing:true,automation:true,rejectOptionalSave:true});await optionalFailure.click('connect');optionalFailure.get('fox-web-user').value='optional-user';optionalFailure.get('fox-web-password').value='keep-optional-after-failure';optionalFailure.get('config-form').handlers.submit({preventDefault(){}});for(let i=0;i<12;i++)await optionalFailure.flush();assert.equal(optionalFailure.get('fox-web-password').value,'keep-optional-after-failure');assert(optionalFailure.get('save-status').textContent.includes('Optional settings not saved'));assert(!optionalFailure.commands.some(row=>row.command==='configure'));await optionalFailure.click('disconnect');
const rejectedApi=harness({existing:true,automation:true,rejectApiTest:true});await rejectedApi.click('connect');rejectedApi.get('fox-web-user').value='optional-user';rejectedApi.get('fox-web-password').value='keep-on-failure';rejectedApi.get('config-form').handlers.submit({preventDefault(){}});for(let i=0;i<8;i++)await rejectedApi.flush();assert(!rejectedApi.commands.some(row=>row.command==='service_setup'||row.command==='test'));assert(rejectedApi.commands.some(row=>row.command==='foxess_live_store'));assert(rejectedApi.get('save-status').textContent.includes('APIs have not been tested'));await rejectedApi.click('disconnect');
const failure=harness({rejectSave:true});await failure.click('connect');failure.fill();await failure.click('network-test');
failure.get('config-form').handlers.submit({preventDefault(){}});await failure.flush();
assert.equal(failure.get('wifi-password').value,'example-wifi-password','Failed save must preserve the form');
failure.windowEvents.pagehide();await failure.flush();
assert.equal(failure.get('wifi-password').value,'');

assert.equal(failure.get('check-ip').dataset.result,'failed');
const old=harness({oldFirmware:true});await old.click('connect');assert(old.get('save').disabled,'Legacy firmware cannot bypass validate-before-save');await old.click('disconnect');
const cancel=harness({rejectSelection:true});await cancel.click('connect');assert(!cancel.get('connect').disabled);
assert(harness({supported:false}).get('connect').disabled);
assert(!/localStorage|sessionStorage|indexedDB|fetch\(/.test(source),'The USB setup page must not persist or upload credentials');
for(const forbidden of ['/scheduler/enable','/scheduler/set','/setting/set','ForceCharge','ForceDischarge'])assert(!firmware.includes(forbidden));
assert(firmware.includes('.crt_bundle_attach=esp_crt_bundle_attach'));
assert(firmware.includes('.disable_auto_redirect=true'));
assert(!firmware.includes('nvs_flash_erase'));
console.log('ESP32 USB handshake, Wi-Fi scan, secret redaction, configuration transport, success/failure recovery and exit cleanup passed with a mock serial device.');
assert(firmware.includes('FUTURE_CHARGE_TEST_AND_RESTORE'));
assert(firmware.includes('cJSON_IsTrue(ready)'));
console.log('Routine API tests remain read-only. The separate USB schedule diagnostic requires explicit readiness and test-and-restore confirmation.');

const fixture=new Uint8Array([0xe9,0,0,0]);
const manifest={schema:1,chip:'ESP32-S3',flash_size:'16MB',psram_bytes:8388608,automation_enabled:false,parts:[['bootloader.bin',0],['partition-table.bin',0x8000],['application.bin',0x10000],['ota-data.bin',0x910000]].map(([file,offset])=>({file,offset,size:4,sha256:createHash('sha256').update(fixture).digest('hex'),md5:createHash('md5').update(fixture).digest('hex')}))};
validateManifest(manifest);
for(const part of manifest.parts){
  const data=fixture;
  await verifyPart(part,data,webcrypto);
  const options=flashOptions(part,data,()=>{});
  assert.equal(options.eraseAll,false);assert.equal(options.flashMode,'keep');assert.equal(options.calculateMD5Hash(data),part.md5);
  assert(!(part.offset<0xf000 && part.offset+part.size>0x9000),'Never flash NVS sectors');
  const damaged=data.slice();damaged[0]^=1;await assert.rejects(()=>verifyPart(part,damaged,webcrypto));
}
for(const change of [m=>m.parts[0].offset=0x9000,m=>m.parts[0].file='../secret',m=>m.parts[0].size=0x10000,m=>m.chip='ESP32',m=>m.parts.push(m.parts[0])]){
 const damaged=structuredClone(manifest);change(damaged);assert.throws(()=>validateManifest(damaged));
}
console.log('Browser installer verifies SHA-256 downloads, requires flash MD5 verification, validates fixed partition bounds and excludes NVS.');
const readyInstall={supported:true,flashing:false,connected:false,busy:false,board:true,consent:true,mode:'keep',confirmation:''};
assert.deepEqual(installationRequirements(readyInstall),[]);
assert(installationRequirements({...readyInstall,connected:true}).some(x=>x.includes('Disconnect')));
assert(installationRequirements({...readyInstall,consent:false}).some(x=>x.includes('Confirm installation')));
assert(installationRequirements({...readyInstall,mode:'clean'}).some(x=>x.includes('ERASE')));
function loaderFixture(chip='ESP32-S3',size='16MB'){const events=[];return {events,chip:{CHIP_NAME:chip},async detectFlashSize(){return size;},async eraseFlash(){events.push('erase');},async writeFlash(options){events.push('write:'+options.fileArray[0].address);assert.equal(options.eraseAll,false);assert(options.calculateMD5Hash());}};}
const keepLoader=loaderFixture();await installVerifiedParts(keepLoader,manifest,manifest.parts.map(()=>fixture),{mode:'keep',crypto:webcrypto});assert(!keepLoader.events.includes('erase'));assert.equal(keepLoader.events.length,4);
const cleanLoader=loaderFixture();await installVerifiedParts(cleanLoader,manifest,manifest.parts.map(()=>fixture),{mode:'clean',confirmation:'ERASE',crypto:webcrypto});assert.equal(cleanLoader.events[0],'erase');assert.equal(cleanLoader.events.filter(x=>x==='erase').length,1);assert.equal(cleanLoader.events.length,5);
for(const confirmation of ['', 'erase','ERASE ']){const loader=loaderFixture();await assert.rejects(()=>installVerifiedParts(loader,manifest,manifest.parts.map(()=>fixture),{mode:'clean',confirmation,crypto:webcrypto}));assert.equal(loader.events.length,0);}
for(const loader of [loaderFixture('ESP32'),loaderFixture('ESP32-S3','8MB')]){await assert.rejects(()=>installVerifiedParts(loader,manifest,manifest.parts.map(()=>fixture),{mode:'clean',confirmation:'ERASE',crypto:webcrypto}));assert.equal(loader.events.length,0);}
const corruptLoader=loaderFixture();const corruptImages=manifest.parts.map(()=>fixture.slice());corruptImages[3][0]^=1;await assert.rejects(()=>installVerifiedParts(corruptLoader,manifest,corruptImages,{mode:'clean',confirmation:'ERASE',crypto:webcrypto}));assert.equal(corruptLoader.events.length,0,'Verify every image before any erase or write');
const interrupted=loaderFixture();interrupted.eraseFlash=async()=>{interrupted.events.push('erase');throw Error('USB disconnected');};await assert.rejects(()=>installVerifiedParts(interrupted,manifest,manifest.parts.map(()=>fixture),{mode:'clean',confirmation:'ERASE',crypto:webcrypto}));assert.deepEqual(interrupted.events,['erase'],'An erase failure must not continue with programming');
console.log('Install safety: unmet conditions, exact erase confirmation, default preservation, one full erase, chip/Flash checks and verified downloads before erasure passed with mocks.');


const signals=[];
await resetToApplication({async setDTR(value){signals.push(['BOOT',value]);},async setRTS(value){signals.push(['EN',value]);}},async ms=>signals.push(['pause',ms]));
assert.deepEqual(signals,[['BOOT',false],['EN',true],['pause',100],['EN',false]],'Release BOOT before pulsing EN to leave the flashing stub');

const portSetup=harness({existing:true,automation:true});await portSetup.click('connect');
assert.equal(portSetup.get('dashboard-port-save').disabled,false,'USB port edits remain available while automation runs');
portSetup.get('dashboard-port').value='8989';await portSetup.click('dashboard-port-save');
assert.equal(portSetup.commands.at(-1).command,'dashboard_port');assert.equal(portSetup.commands.at(-1).port,8989);
assert.match(portSetup.get('dashboard-port-status').textContent,/Restart/);
assert.equal(portSetup.commands.filter(x=>x.command==='configure'||x.command==='service_setup').length,0,'Port save must not replace credentials or send cloud tests');
assert.equal(portSetup.get('device-link').options[0].href,'http://192.168.8.188:8787/','Pending port does not change active links');
portSetup.get('dashboard-port').value='65536';await portSetup.click('dashboard-port-save');assert.notEqual(portSetup.commands.at(-1).port,65536);
await portSetup.click('disconnect');
console.log('USB dashboard port: active URLs, pending restart, validation and independent save with automation enabled passed.');
