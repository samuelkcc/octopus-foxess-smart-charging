// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
const require=createRequire(import.meta.url);
const {sameOrigin,externalUrl,portLabel,isUsbSerial}=require('../esp32/desktop/policy.cjs');
const {startServer,files}=require('../esp32/desktop/server.cjs');
assert(sameOrigin('http://127.0.0.1:1234/index.html','http://127.0.0.1:1234'));
assert(!sameOrigin('http://127.0.0.1:12345/','http://127.0.0.1:1234'));
for(const url of ['file:///etc/passwd','javascript:alert(1)','http://example.com','http://user:password@192.168.8.188','http://127.0.0.1:8789'])assert(!externalUrl(url),url);
for(const url of ['http://192.168.8.188','http://10.1.2.3','https://github.com/samuelkcc/octopus-foxess-smart-charging'])assert(externalUrl(url),url);
assert.equal(portLabel({portName:'USB\nserial'}),'USB serial');
assert(!isUsbSerial({portName:'/dev/cu.Bluetooth-Incoming-Port'}));assert(isUsbSerial({portName:'/dev/cu.usbserial-110',vendorId:'1a86',productId:'7523'}));
const assets=await mkdtemp(path.join(os.tmpdir(),'esp32-setup-test-'));
for(const file of files){await mkdir(path.dirname(path.join(assets,file)),{recursive:true});await writeFile(path.join(assets,file),'ESP32 Deploy fixture: '+file);}
const host=await startServer(assets);
try{
 const page=await fetch(host.origin);assert.equal(page.status,200);assert((await page.text()).includes('ESP32 Deploy'));
 assert.equal((await fetch(host.origin,{method:'POST'})).status,404);
 assert.equal((await fetch(host.origin+'/../package.json')).status,404);
 const wrongHost=await new Promise((resolve,reject)=>{http.get(host.origin,{headers:{Host:'attacker.example'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject);});assert.equal(wrongHost,404);
 for(const file of files)assert.equal((await fetch(host.origin+'/'+file)).status,200,file);
 assert.equal(host.server.address().address,'127.0.0.1');
}finally{await new Promise(resolve=>host.server.close(resolve));await rm(assets,{recursive:true,force:true});}
let mainWindow,selected=0,opened=[];
class FakeSession extends EventEmitter{setPermissionCheckHandler(fn){this.check=fn;}setPermissionRequestHandler(fn){this.permission=fn;}}
class FakeWindow extends EventEmitter{constructor(options){super();this.options=options;this.webContents=new EventEmitter();this.webContents.session=new FakeSession();this.webContents.getURL=()=>this.url||'';this.webContents.setWindowOpenHandler=fn=>{this.open=fn;};mainWindow=this;}async loadURL(url){this.url=url;}}
const app=new EventEmitter();Object.assign(app,{setName(){},requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),isPackaged:false,quit(){}});
const electron={app,BrowserWindow:FakeWindow,Menu:{buildFromTemplate:x=>x,setApplicationMenu(){}},shell:{openExternal:async url=>opened.push(url)},dialog:{showMessageBox:async()=>({response:selected}),showErrorBox:()=>assert.fail('Unexpected startup error')}};
const code=await readFile(new URL('../esp32/desktop/main.cjs',import.meta.url),'utf8');
vm.runInNewContext(code,{require:name=>name==='electron'?electron:name==='./server.cjs'?{startServer:async()=>({origin:'http://127.0.0.1:1234',server:{close(){}}})}:name==='./policy.cjs'?{sameOrigin,externalUrl,portLabel,isUsbSerial}:require(name),__dirname:'/test/esp32/desktop',process:{platform:'darwin',resourcesPath:'/test/resources'}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(mainWindow.options.webPreferences.backgroundThrottling,false,'USB test polling must continue while the window is in the background');
assert.equal(mainWindow.options.webPreferences.nodeIntegration,false);assert.equal(mainWindow.options.webPreferences.sandbox,true);
const wc=mainWindow.webContents,ses=wc.session,origin='http://127.0.0.1:1234';
assert(ses.check(wc,'serial',origin,{securityOrigin:origin}));assert(!ses.check(wc,'camera',origin,{securityOrigin:origin}));assert(!ses.check(wc,'serial','https://attacker.example',{securityOrigin:'https://attacker.example'}));assert(!ses.check({getURL:()=>origin},'serial',origin,{securityOrigin:origin}));
let choice;const choose=ses.listeners('select-serial-port')[0],event={preventDefault(){}};
selected=1;await choose(event,[{portId:'first',portName:'USB Serial first'},{portId:'second',portName:'USB Serial second'}],wc,id=>{choice=id;});assert.equal(choice,'second');
selected=2;await choose(event,[{portId:'first',portName:'USB Serial first'},{portId:'second',portName:'USB Serial second'}],wc,id=>{choice=id;});assert.equal(choice,'');
await choose(event,[{portId:'first'}],{getURL:()=>origin},id=>{choice=id;});assert.equal(choice,'');
assert.equal(mainWindow.open({url:'file:///etc/passwd'}).action,'deny');assert.equal(opened.length,0);mainWindow.open({url:'http://192.168.8.188'});assert.equal(opened[0],'http://192.168.8.188');
console.log('ESP32 setup host passed: loopback assets, path/method/Host restrictions, explicit serial selection, origin permissions, sandbox and external-link policy.');
