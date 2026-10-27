// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Run the standard check and all three builds before this packaging step.
import { readFile, writeFile, mkdir, copyFile, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
const root=process.cwd();
const version=JSON.parse(await readFile('package.json','utf8')).version;
const pkg=JSON.parse(await readFile('desktop/package.json','utf8'));pkg.version=version;
await writeFile('desktop/package.json',JSON.stringify(pkg,null,2)+'\n');
const assets=path.join(root,'dist/desktop-assets');await mkdir(assets,{recursive:true});
const vendor=JSON.parse(await readFile('desktop/vendor.json','utf8')).cloudflared;
const cached=path.join(root,'desktop/.cache');await mkdir(cached,{recursive:true});
const executable=path.join(cached,`cloudflared-${vendor.version}.exe`);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
let binary;try{binary=await readFile(executable);}catch{}
if(!binary || digest(binary)!==vendor.sha256){
  const response=await fetch(vendor.url);if(!response.ok)throw new Error(`Cloudflare download HTTP ${response.status}`);
  binary=Buffer.from(await response.arrayBuffer());
  if(digest(binary)!==vendor.sha256)throw new Error('Cloudflare binary checksum did not match.');
  await writeFile(executable,binary);
}
await writeFile(path.join(assets,'cloudflared.exe'),binary);
const license=await fetch(vendor.license);if(!license.ok)throw new Error('Cloudflare licence download failed.');
await writeFile(path.join(assets,'cloudflared-LICENSE.txt'),await license.text());
await copyFile('desktop/vendor.json',path.join(assets,'vendor.json'));
await rm('dist/desktop-service',{recursive:true,force:true});
await cp('dist/linux-package/octopus-foxess','dist/desktop-service',{recursive:true});
await copyFile('dist/Smart_Charging_Desktop.html','dist/desktop-service/web/app/index.html');
const builder=path.join(root,'desktop/node_modules/electron-builder/cli.js');
const child=spawn(process.execPath,[builder,'--win','portable','--x64','--publish','never'],{cwd:path.join(root,'desktop'),stdio:'inherit',env:{...process.env,CSC_IDENTITY_AUTO_DISCOVERY:'false'}});
const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
if(exit!==0)throw new Error(`Windows packaging exited ${exit}`);
await import('./test-desktop-package.mjs');
console.log(`Portable Windows ${version} built. Windows runtime verification is still required.`);
