// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
const { app, BrowserWindow, utilityProcess, ipcMain, dialog, powerSaveBlocker, safeStorage, clipboard, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const { isAdminSender } = require('./policy.cjs');
let window, worker, service, origin, accessCode, quitting = false;
const show = () => { if(window){window.restore();window.show();window.focus();} };
if(!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', show);
  app.whenReady().then(start).catch(error => {
    dialog.showErrorBox('Smart Charging could not start', error.message); app.quit();
  });
}
async function freePort(port) {
  return new Promise(resolve=>{
    const probe=net.createServer();probe.once('error',()=>resolve(false));
    probe.listen(port,'0.0.0.0',()=>probe.close(()=>resolve(true)));
  });
}
async function choosePort() {
  for(let port=8787;port<8827;port+=2)if(await freePort(port) && await freePort(port+1))return port;
  throw new Error('No local service port is available.');
}
async function storageKey(directory) {
  if(!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('Windows encrypted storage is unavailable.');
  const file=path.join(directory,'desktop-key.bin');
  try {
    const encrypted=await fs.readFile(file);
    const {result,shouldReEncrypt}=await safeStorage.decryptStringAsync(encrypted);
    if(shouldReEncrypt)await fs.writeFile(file,await safeStorage.encryptStringAsync(result),{mode:0o600});
    return result;
  } catch(error) {
    if(error.code!=='ENOENT')throw error;
    const key=randomBytes(32).toString('base64');
    await fs.writeFile(file,await safeStorage.encryptStringAsync(key),{mode:0o600,flag:'wx'});
    return key;
  }
}
async function local(endpoint, body) {
  const response=await fetch(origin+endpoint,{method:body===undefined?'GET':'PUT',headers:{'Content-Type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  const value=await response.json();
  if(!response.ok)throw new Error(value.error||`Local service returned HTTP ${response.status}`);
  return value;
}
function secureWindow(options) {
  const result=new BrowserWindow({backgroundColor:'#100428',...options,webPreferences:{
    contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,...options.webPreferences
  }});
  result.webContents.setWindowOpenHandler(({url})=>{
    if(url.startsWith('https://'))void shell.openExternal(url);
    return {action:'deny'};
  });
  result.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  result.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  return result;
}
async function start() {
  const directory=path.join(app.getPath('userData'),'service');
  await fs.mkdir(directory,{recursive:true});
  const key=await storageKey(directory);
  const accessFile=path.join(directory,'access.key');
  try {await fs.writeFile(accessFile,randomBytes(18).toString('base64url'),{flag:'wx',mode:0o600});}
  catch(error){if(error.code!=='EEXIST')throw error;}
  accessCode=(await fs.readFile(accessFile,'utf8')).trim();
  const port=await choosePort();origin=`http://127.0.0.1:${port}`;
  const root=app.isPackaged?path.join(process.resourcesPath,'service'):path.resolve(__dirname,'../dist/linux-package/octopus-foxess');
  const assets=app.isPackaged?path.join(process.resourcesPath,'desktop-assets'):path.resolve(__dirname,'../dist/desktop-assets');
  service=utilityProcess.fork(path.join(__dirname,'service.mjs'),[],{
    serviceName:'Smart Charging service',stdio:'ignore',env:{...process.env,OCTOPUS_DESKTOP:'1',OCTOPUS_SERVICE_ROOT:root,
      OCTOPUS_STATE_DIR:directory,OCTOPUS_WEB_ROOT:path.join(root,'web'),OCTOPUS_HOST:'0.0.0.0',OCTOPUS_PORT:String(port),
      OCTOPUS_REMOTE_PORT:String(port+1),OCTOPUS_CLOUDFLARED:path.join(assets,'cloudflared.exe')}
  });
  service.postMessage({kind:'start',key});
  service.on('exit',()=>{service=null;if(!quitting){dialog.showErrorBox('Smart Charging stopped','The local service stopped. Reopen the app to resume monitoring.');app.quit();}});
  let ready=false;
  for(let attempt=0;attempt<100;attempt++){
    try{ready=(await fetch(origin+'/api/health',{signal:AbortSignal.timeout(500)})).ok;if(ready)break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!ready)throw new Error('The local service did not become ready.');
  const blocker=powerSaveBlocker.start('prevent-app-suspension');
  app.once('will-quit',()=>powerSaveBlocker.stop(blocker));
  worker=secureWindow({show:false,width:1280,height:900});
  worker.webContents.setAudioMuted(true);
  worker.webContents.on('render-process-gone',()=>{if(!quitting){dialog.showErrorBox('Automation stopped','The automation worker stopped. Restart Smart Charging.');app.quit();}});
  await worker.loadURL(origin+'/?worker=1');
  window=secureWindow({icon:path.join(root,'web/icons/icon-512.png'),show:false,width:1440,height:960,minWidth:960,minHeight:650,title:'Smart Charging',
    webPreferences:{preload:path.join(__dirname,'preload.cjs')}});
  window.setMenuBarVisibility(false);
  window.webContents.session.webRequest.onBeforeSendHeaders({urls:[origin+'/*']},(details,callback)=>{
    callback({requestHeaders:{...details.requestHeaders,'X-Octopus-Access-Key':accessCode}});
  });
  ipcMain.handle('desktop:service',async(event,operation,value)=>{
    if(!isAdminSender(event,window?.webContents,origin))throw new Error('Desktop administration is unavailable here.');
    if(operation==='configuration')return local('/api/native-config');
    if(operation==='status')return local('/api/service-status');
    if(operation==='saveConfiguration'){
      if(!value || Object.keys(value).some(key=>!['credentials','accessRequired','accessKey','liveWsEnabled'].includes(key)))throw new Error('Invalid configuration.');
      const result=await local('/api/native-config',value);
      accessCode=(await local('/api/native-config')).accessKey;
      return result;
    }
    if(operation==='remoteAccess')return local('/api/remote-access');
    if(operation==='setRemoteAccess'){
      if(!value || Object.keys(value).some(key=>!['enabled','rotateKey'].includes(key)))throw new Error('Invalid remote-access settings.');
      return local('/api/remote-access',value);
    }
    if(operation==='copyRemoteKey'){clipboard.writeText((await local('/api/remote-access')).key);return true;}
    if(operation==='copyPublicUrl'){clipboard.writeText((await local('/api/remote-access')).url||'');return true;}
    if(operation==='copyLanCode'){clipboard.writeText((await local('/api/native-config')).accessKey);return true;}
    throw new Error('Unknown desktop operation.');
  });
  await window.loadURL(origin+'/app/index.html?client=1');
  window.show();
  window.on('closed',()=>{window=null;app.quit();});
}
app.on('before-quit',event=>{
  if(quitting)return;
  event.preventDefault();quitting=true;
  worker?.destroy();
  if(!service){app.exit(0);return;}
  const timeout=setTimeout(()=>{service?.kill();app.exit(0);},7000);
  service.once('exit',()=>{clearTimeout(timeout);service=null;app.exit(0);});
  service.postMessage({kind:'shutdown'});
});
