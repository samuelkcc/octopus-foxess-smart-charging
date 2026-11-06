// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
const {app,BrowserWindow,dialog,Menu,shell}=require('electron');
const path=require('node:path');
const {startServer}=require('./server.cjs');
const {sameOrigin,externalUrl,portLabel,isUsbSerial}=require('./policy.cjs');
let window,host;
app.setName('Smart Charging ESP32 Setup');
if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.whenReady().then(async()=>{
    const directory=app.isPackaged?path.join(process.resourcesPath,'setup'):path.resolve(__dirname,'../../dist/esp32-deploy');
    host=await startServer(directory);
    window=new BrowserWindow({width:1180,height:850,minWidth:760,minHeight:600,title:'Smart Charging ESP32 Setup',backgroundColor:'#10002b',autoHideMenuBar:true,webPreferences:{backgroundThrottling:false,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false,partition:'esp32-setup',spellcheck:false}});
    const contents=window.webContents,ses=contents.session;
    const trusted=wc=>wc===contents&&sameOrigin(wc.getURL(),host.origin);
    ses.setPermissionCheckHandler((wc,permission,origin,details)=>trusted(wc)&&permission==='serial'&&sameOrigin(details.securityOrigin||origin,host.origin));
    ses.setPermissionRequestHandler((wc,permission,callback,details)=>callback(trusted(wc)&&permission==='serial'&&sameOrigin(details.requestingUrl||wc.getURL(),host.origin)));
    ses.on('select-serial-port',async(event,ports,wc,callback)=>{
      event.preventDefault();if(!trusted(wc)){callback('');return;}
      const choices=ports.filter(isUsbSerial).slice(0,8);
      try{
        if(!choices.length){await dialog.showMessageBox(window,{type:'info',message:'No USB serial device found',detail:'Connect the ESP32 with a USB data cable. Close other serial tools. Select Connect ESP32 again.',buttons:['OK']});callback('');return;}
        const result=await dialog.showMessageBox(window,{type:'question',message:'Select your ESP32 USB serial port',detail:'Choose the USB-UART port for setup and firmware installation.',buttons:[...choices.map(portLabel),'Cancel'],cancelId:choices.length,defaultId:choices.length,noLink:true});
        callback(choices[result.response]?.portId||'');
      }catch{callback('');}
    });
    contents.setWindowOpenHandler(({url})=>{if(externalUrl(url))void shell.openExternal(url);return {action:'deny'};});
    contents.on('will-navigate',(event,url)=>{if(!sameOrigin(url,host.origin)){event.preventDefault();if(externalUrl(url))void shell.openExternal(url);}});
    contents.on('will-redirect',(event,url)=>{if(!sameOrigin(url,host.origin))event.preventDefault();});
    const menu=[...(process.platform==='darwin'?[{role:'appMenu'}]:[]),{role:'editMenu'},{label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{type:'separator'},{role:'togglefullscreen'}]},{role:'windowMenu'}];
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
    window.on('closed',()=>{window=null;app.quit();});
    await window.loadURL(host.origin);
  }).catch(error=>{dialog.showErrorBox('ESP32 Setup could not start',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
  app.on('will-quit',()=>host?.server.close());
}
