// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import path from 'node:path';
const run=promisify(execFile),require=createRequire(path.resolve('desktop/package.json')),asar=require('@electron/asar');
const app='dist/macos/mac-universal/Smart Charging.app',contents=app+'/Contents',resources=contents+'/Resources';
for(const binary of [contents+'/MacOS/Smart Charging',contents+'/Frameworks/Electron Framework.framework/Versions/A/Electron Framework',resources+'/desktop-assets/cloudflared']){
 const archs=(await run('/usr/bin/lipo',['-archs',binary])).stdout.trim().split(/\s+/);
 assert(['arm64','x86_64'].every(arch=>archs.includes(arch)),binary);
}
await run('/usr/bin/codesign',['--verify','--deep','--strict',app]);
const archive=resources+'/app.asar';for(const file of ['main.cjs','preload.cjs','service.mjs','policy.cjs'])assert(asar.listPackage(archive).includes('/'+file));
assert(asar.extractFile(archive,'preload.cjs').toString().includes("process.platform === 'darwin'"));
const html=await readFile(resources+'/service/web/app/index.html','utf8');assert(html.includes("dataset.devEdition='desktop'"));assert(!html.includes('LOCAL TEST · MOCK DATA'));
assert((await readFile(resources+'/desktop-assets/cloudflared-LICENSE.txt','utf8')).includes('Apache'));
await stat(resources+'/service/tariff-snapshot-cache.mjs');await stat(resources+'/service/node_modules/ws/package.json');
const {version}=JSON.parse(await readFile('package.json','utf8'));
assert((await stat(`dist/macos/SmartCharging-${version}-macOS-universal.zip`)).size>10_000_000);
console.log('macOS Universal app, Electron framework and tunnel architectures verified; ad-hoc signature, service, desktop UI and licences passed. Native Keychain and Intel execution require operator verification.');
