// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Keep only the requested user-facing files in dist. Preserve build work separately.
import { mkdir, mkdtemp, readFile, readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function prepareDeliverables(root = process.cwd()) {
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const dist = path.join(root, 'dist');
  const html = `Smart_Charging_v${version}.html`;
  const exe = `SmartCharging-${version}-Windows-x64.exe`;
  const nestedExe = path.join(dist, 'windows', exe);
  let executable = path.join(dist, exe);
  try { await stat(executable); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    executable = nestedExe;
  }
  // Validate both deliverables before moving any files.
  for (const file of [path.join(dist, html), executable]) {
    const info = await stat(file);
    if (!info.isFile() || !info.size) throw new Error(`Missing deliverable: ${file}`);
  }
  const mac = `SmartCharging-${version}-macOS-universal.zip`;
  let macFile;
  for(const candidate of [path.join(dist,mac),path.join(dist,'macos',mac)]) {
    try{if((await stat(candidate)).isFile()){macFile=candidate;break;}}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const keep = new Set([html, exe, ...(macFile?[mac]:[])]);
  const extras = (await readdir(dist)).filter(name => !keep.has(name));
  let archive;
  if (extras.length) {
    const work = path.join(root, '.build');
    await mkdir(work, { recursive: true });
    archive = await mkdtemp(path.join(work, 'artifacts-'));
  }
  if (executable !== path.join(dist, exe)) await rename(executable, path.join(dist, exe));
  if(macFile && macFile!==path.join(dist,mac))await rename(macFile,path.join(dist,mac));
  for (const name of extras) await rename(path.join(dist, name), path.join(archive, name));
  return { html: path.join(dist, html), exe: path.join(dist, exe), mac:macFile?path.join(dist,mac):null, archive };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await prepareDeliverables();
  console.log(`Ready: ${result.html}\nReady: ${result.exe}`);
  if(result.mac)console.log(`Ready: ${result.mac}`);
  if (result.archive) console.log(`Build files retained: ${result.archive}`);
}
