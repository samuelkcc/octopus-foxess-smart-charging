// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile,mkdir,stat,cp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.cwd(),mac=process.argv.includes('--mac');
if(mac&&process.platform!=='darwin')throw Error('Build macOS apps on macOS.');
const {version}=JSON.parse(await readFile('package.json','utf8'));
const file='esp32/desktop/package.json',pkg=JSON.parse(await readFile(file,'utf8'));pkg.version=version;
await writeFile(file,JSON.stringify(pkg,null,2)+'\n');
await import('./build-esp32-deploy.mjs');
const output=path.join(root,'dist/esp32-setup',mac?'macos':'windows');
await mkdir(output,{recursive:true});
const builder=path.join(root,'desktop/node_modules/electron-builder/cli.js');
await stat(builder);
const args=[builder,'--projectDir',path.join(root,'esp32/desktop'),...(mac?['--mac','zip','--universal']:['--win','portable','--x64']),'--config.directories.output='+output,'--publish','never'];
const cachedElectron=process.env.SC_ESP32_ELECTRON_DIST;
if(cachedElectron){
  const checksums=JSON.parse(await readFile(path.join(root,'desktop/node_modules/electron/checksums.json'),'utf8'));
  for(const arch of (mac?['darwin-x64','darwin-arm64']:['win32-x64'])){
    const file=`electron-v${pkg.build.electronVersion}-${arch}.zip`;
    if(createHash('sha256').update(await readFile(path.join(cachedElectron,file))).digest('hex')!==checksums[file])throw Error('Cached Electron checksum mismatch: '+file);
  }
  args.push('--config.electronDist='+path.resolve(cachedElectron));
}
const processHandle=spawn(process.execPath,args,{cwd:root,stdio:'inherit',env:{...process.env,CSC_IDENTITY_AUTO_DISCOVERY:'false'}});
const code=await new Promise((resolve,reject)=>{processHandle.once('error',reject);processHandle.once('exit',resolve);});
if(code!==0)throw Error('ESP32 setup packaging failed: '+code);
const name=mac?`SmartCharging-ESP32-Setup-${version}-macOS-universal.zip`:`SmartCharging-ESP32-Setup-${version}-Windows-x64.exe`;
const sha256=createHash('sha256').update(await readFile(path.join(output,name))).digest('hex');
await writeFile(path.join(output,'SHA256SUMS.txt'),sha256+'  '+name+'\n');
const retained=path.join(root,'.build',`esp32-setup-v${version}`);await mkdir(retained,{recursive:true});
await cp(path.join(output,name),path.join(retained,name));
if(mac){
  const appName='Smart Charging ESP32 Setup.app',target=path.join(retained,appName);
  await rm(target,{recursive:true,force:true});
  await cp(path.join(output,'mac-universal',appName),target,{recursive:true,verbatimSymlinks:true});
}
const hashes=new Map();
try{for(const line of (await readFile(path.join(retained,'SHA256SUMS.txt'),'utf8')).trim().split('\n')){const match=line.match(/^([a-f0-9]{64})  (.+)$/);if(match)hashes.set(match[2],match[1]);}}catch{}
hashes.set(name,sha256);await writeFile(path.join(retained,'SHA256SUMS.txt'),[...hashes].sort().map(([file,hash])=>hash+'  '+file).join('\n')+'\n');
console.log('Built '+path.join(retained,name)+'. No publication was performed.');
