// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Group user-facing downloads. Archive intermediate builds without deleting them.
import {mkdir,mkdtemp,readFile,readdir,rename,stat,cp,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const run=promisify(execFile);
export async function prepareDeliverables(root=process.cwd(),{all=false}={}){
 const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 const dist=path.join(root,'dist'),work=path.join(root,'.build');
 const html=`Smart_Charging_v${version}.html`,exe=`SmartCharging-${version}-Windows-x64.exe`;
 const espMac=`SmartCharging-ESP32-Setup-${version}-macOS-universal.zip`,espWin=`SmartCharging-ESP32-Setup-${version}-Windows-x64.exe`;
 const find=async candidates=>{for(const file of candidates){try{const info=await stat(path.join(root,file));if(info.isDirectory()||info.size>0)return file;}catch(error){if(error.code!=='ENOENT')throw error;}}return null;};
 const plans=[
  {name:'Web HTML',required:true,items:[[html,[`dist/${html}`,`dist/Web HTML/${html}`]]]},
  {name:'Windows Portable',required:true,items:[[exe,[`dist/windows/${exe}`,`dist/${exe}`,`dist/Windows Portable/${exe}`]]]},
  {name:'Pi',required:all,items:[['Octopus_FoxESS_Raspberry_Pi.tar.gz',['dist/Octopus_FoxESS_Raspberry_Pi.tar.gz','dist/Pi/Octopus_FoxESS_Raspberry_Pi.tar.gz']]]},
  {name:'ESP32/macOS',required:all,items:[[espMac,[`dist/esp32-setup/macos/${espMac}`,`dist/ESP32/macOS/${espMac}`]],[`Smart Charging ESP32 Setup.app`,['dist/esp32-setup/macos/mac-universal/Smart Charging ESP32 Setup.app','dist/ESP32/macOS/Smart Charging ESP32 Setup.app']]]},
  {name:'ESP32/Windows',required:all,items:[[espWin,[`dist/esp32-setup/windows/${espWin}`,`dist/ESP32/Windows/${espWin}`]]]},
  {name:'ESP32/Web',required:all,items:[['.',['dist/esp32-deploy','dist/ESP32/Web']]]}
 ];
 // Resolve and validate the full input set before moving the existing dist.
 for(const plan of plans){plan.resolved=[];for(const [name,candidates] of plan.items){const source=await find(candidates);if(!source&&plan.required)throw Error('Missing deliverable: '+plan.name+'/'+name);if(source)plan.resolved.push({name,source});}}
 await mkdir(work,{recursive:true});
 const stage=await mkdtemp(path.join(work,'prepared-dist-'));
 for(const plan of plans){if(!plan.resolved.length)continue;const folder=path.join(stage,plan.name);await mkdir(folder,{recursive:true});for(const item of plan.resolved)await cp(path.join(root,item.source),path.join(folder,item.name),{recursive:true,verbatimSymlinks:true});}
 const exists=async file=>{try{return await stat(file);}catch(error){if(error.code!=='ENOENT')throw error;return null;}};
 const piPackage=path.join(dist,'linux-package');
 if(await exists(piPackage)){
  await mkdir(path.join(stage,'Pi'),{recursive:true});
  // build:dev updates the package after check creates the earlier tarball.
  await run('tar',['-czf',path.join(stage,'Pi/Octopus_FoxESS_Raspberry_Pi.tar.gz'),'-C',piPackage,'octopus-foxess']);
 }
 for(const [source,target] of [['linux/install.sh','Pi/install.sh'],['linux/uninstall.sh','Pi/uninstall.sh'],['linux/README-RASPBERRY-PI.md','Pi/README-RASPBERRY-PI.md'],['esp32/README.md','ESP32/README.md']])if(await exists(path.join(stage,target.split('/')[0]))&&await exists(path.join(root,source)))await cp(path.join(root,source),path.join(stage,target));
 for(const category of ['Web HTML','Windows Portable','Pi','ESP32'])if(await exists(path.join(stage,category)))for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md','docs/USER-GUIDE.md'])if(await exists(path.join(root,name)))await cp(path.join(root,name),path.join(stage,category,path.basename(name)));
 await writeFile(path.join(stage,'README.txt'),`Smart Charging ${version}\n\nESP32/macOS: USB setup app and Universal ZIP.\nESP32/Windows: USB setup EXE.\nESP32/Web: complete USB setup website for HTTPS hosting.\nWindows Portable: standalone Windows charging host.\nWeb HTML: standalone browser edition. Keep the browser awake.\nPi: Raspberry Pi service package and installation guide.\n\nESP32 supports ESP32-S3 N16R8 only: 16 MB Flash, 8 MB Octal PSRAM.\nESP32 access is local-network only.\nUse one active automation host per inverter.\n\nBuild intermediates are archived under .build/artifacts-*.\nNo publication or installation on Pi is performed by this packaging step.\n`);
 const hashes=[];
 const walk=async(dir,prefix='')=>{for(const entry of await readdir(dir,{withFileTypes:true})){const name=path.join(prefix,entry.name);if(entry.isDirectory()){if(!entry.name.endsWith('.app'))await walk(path.join(dir,entry.name),name);}else if(entry.name!=='SHA256SUMS.txt'){const bytes=await readFile(path.join(dir,entry.name));hashes.push(createHash('sha256').update(bytes).digest('hex')+'  '+name);}}};
 await walk(stage);await writeFile(path.join(stage,'SHA256SUMS.txt'),hashes.sort().join('\n')+'\n');
 const archive=await mkdtemp(path.join(work,'artifacts-'));
 await rename(dist,path.join(archive,'dist'));
 try{await rename(stage,dist);}catch(error){await rename(path.join(archive,'dist'),dist);throw error;}
 return {html:path.join(dist,'Web HTML',html),exe:path.join(dist,'Windows Portable',exe),esp32:path.join(dist,'ESP32'),pi:path.join(dist,'Pi'),archive:path.join(archive,'dist')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const result=await prepareDeliverables(process.cwd(),{all:process.argv.includes('--all')});for(const [name,file] of Object.entries(result))console.log(`${name}: ${file}`);}
