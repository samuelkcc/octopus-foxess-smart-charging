// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Run the standard check and all three builds before this packaging step.
import { readFile, writeFile, mkdir, copyFile, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import {promisify} from 'node:util';
const run=promisify(execFile);
const mac=process.argv.includes('--mac');
if(mac && process.platform!=='darwin')throw new Error('macOS Universal packaging requires macOS.');
const root=process.cwd();
const version=JSON.parse(await readFile('package.json','utf8')).version;
const pkg=JSON.parse(await readFile('desktop/package.json','utf8'));pkg.version=version;
await writeFile('desktop/package.json',JSON.stringify(pkg,null,2)+'\n');
const assets=path.join(root,'dist/desktop-assets');await rm(assets,{recursive:true,force:true});await mkdir(assets,{recursive:true});
const vendor=JSON.parse(await readFile('desktop/vendor.json','utf8')).cloudflared;
const cached=path.join(root,'desktop/.cache');await mkdir(cached,{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function download(file,source){
  let bytes;try{bytes=await readFile(file);}catch{}
  if(!bytes || digest(bytes)!==source.sha256){
    const response=await fetch(source.url);if(!response.ok)throw new Error(`Cloudflare download HTTP ${response.status}`);
    bytes=Buffer.from(await response.arrayBuffer());
    if(digest(bytes)!==source.sha256)throw new Error('Cloudflare binary checksum did not match.');
    await writeFile(file,bytes);
  }
  return bytes;
}
if(mac){
  const binaries=[];
  for(const arch of ['amd64','arm64']){
    const archive=path.join(cached,`cloudflared-${vendor.version}-${arch}.tgz`);
    await download(archive,vendor.mac[arch]);
    const directory=path.join(cached,`darwin-${arch}`);await mkdir(directory,{recursive:true});
    await run('tar',['-xzf',archive,'-C',directory,'cloudflared']);binaries.push(path.join(directory,'cloudflared'));
  }
  const universal=path.join(assets,'cloudflared');
  await run('/usr/bin/lipo',['-create',...binaries,'-output',universal]);
  await run('/bin/chmod',['755',universal]);
  await run('/usr/bin/codesign',['--force','--sign','-',universal]);
  const archs=(await run('/usr/bin/lipo',['-archs',universal])).stdout.trim().split(/\s+/);
  if(!['arm64','x86_64'].every(arch=>archs.includes(arch)))throw new Error('Tunnel binary is not Universal.');
}else{
  await writeFile(path.join(assets,'cloudflared.exe'),await download(path.join(cached,`cloudflared-${vendor.version}.exe`),vendor));
}
const license=await fetch(vendor.license);if(!license.ok)throw new Error('Cloudflare licence download failed.');
await writeFile(path.join(assets,'cloudflared-LICENSE.txt'),await license.text());
await copyFile('desktop/vendor.json',path.join(assets,'vendor.json'));
await rm('dist/desktop-service',{recursive:true,force:true});
await cp('dist/linux-package/octopus-foxess','dist/desktop-service',{recursive:true});
await copyFile('dist/Smart_Charging_Desktop.html','dist/desktop-service/web/app/index.html');
const builder=path.join(root,'desktop/node_modules/electron-builder/cli.js');
const child=spawn(process.execPath,[builder,...(mac?['--mac','zip','--universal','--config.directories.output=../dist/macos']:['--win','portable','--x64']),'--publish','never'],{cwd:path.join(root,'desktop'),stdio:'inherit',env:{...process.env,CSC_IDENTITY_AUTO_DISCOVERY:'false'}});
const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
if(exit!==0)throw new Error(`Desktop packaging exited ${exit}`);
await import(mac?'./test-mac-package.mjs':'./test-desktop-package.mjs');
console.log(`${mac?'macOS Universal':'Portable Windows'} ${version} built. Native runtime verification is still required.`);
