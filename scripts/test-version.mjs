import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
const run = promisify(execFile);
const directory = await mkdtemp(path.join(os.tmpdir(),'charging-version-'));
const script = new URL('./set-version.mjs',import.meta.url).pathname;
try {
  await mkdir(path.join(directory,'src'));
  await mkdir(path.join(directory,'docs/editions'),{recursive:true});
  await writeFile(path.join(directory,'README.md'),'**Version 2.4.4** https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/tag/esp32-2.4.4');
  await writeFile(path.join(directory,'docs/editions/ESP32.md'),'https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-2.4.4/SmartCharging-ESP32-Setup-2.4.4-macOS-universal.zip\nOTA requires 2.5.0 or later.');
  await mkdir(path.join(directory,'prototype/esp32-usb-test'),{recursive:true});
  await mkdir(path.join(directory,'esp32/main'),{recursive:true});
  await writeFile(path.join(directory,'prototype/esp32-usb-test/index.html'),'Smart Charging 2.2.0');
  await writeFile(path.join(directory,'esp32/CMakeLists.txt'),'project(smart_charging_esp32 VERSION 2.2.0)');
  await writeFile(path.join(directory,'esp32/main/main.c'),'cJSON_AddStringToObject(object,"version","2.2.0");');
  await mkdir(path.join(directory,'.github/workflows'),{recursive:true});
  await writeFile(path.join(directory,'package.json'),JSON.stringify({version:'2026.10.26.7'}));
  await writeFile(path.join(directory,'package-lock.json'),JSON.stringify({version:'2026.10.26.7',packages:{'':{version:'2026.10.26.7'}}}));
  await writeFile(path.join(directory,'src/index.html'),'<link href="style.css?v=2026.10.26.7"><div>Build v2026.10.26.7</div><span data-app-version>2026.10.26.7</span>');
  await writeFile(path.join(directory,'.github/workflows/release.yml'),'default: v2026.10.26.7\n');
  for (const version of ['2.0.0','2.0.1','2.1.0','3.0.0']) {
    await run(process.execPath,[script,version],{cwd:directory});
    const pkg=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
    const lock=JSON.parse(await readFile(path.join(directory,'package-lock.json'),'utf8'));
    const html=await readFile(path.join(directory,'src/index.html'),'utf8');
    const readme=await readFile(path.join(directory,'README.md'),'utf8'),guide=await readFile(path.join(directory,'docs/editions/ESP32.md'),'utf8');
    assert(readme.includes(`Version ${version}`)&&readme.includes(`/tag/esp32-${version}`));
    assert(guide.includes(`/esp32-${version}/SmartCharging-ESP32-Setup-${version}-macOS-universal.zip`));assert(guide.includes('OTA requires 2.5.0 or later.'));
    assert.equal(pkg.version,version);assert.equal(lock.version,version);assert.equal(lock.packages[''].version,version);
    assert.ok(html.includes(`?v=${version}`));assert.ok(html.includes(`Build v${version}`));assert.ok(html.includes(`data-app-version>${version}<`));
    assert.equal(await readFile(path.join(directory,'.github/workflows/release.yml'),'utf8'),`default: v${version}\n`);
    assert.equal(await readFile(path.join(directory,'prototype/esp32-usb-test/index.html'),'utf8'),`Smart Charging ${version}`);
    assert.equal(await readFile(path.join(directory,'esp32/CMakeLists.txt'),'utf8'),`project(smart_charging_esp32 VERSION ${version})`);
    assert.equal(await readFile(path.join(directory,'esp32/main/main.c'),'utf8'),`cJSON_AddStringToObject(object,"version","${version}");`);
  }
  for (const invalid of ['2026.10.26.7','v2.0.0','2.0','02.0.0','2.0.0-rc.1','2.0.0;anything']) {
    await assert.rejects(run(process.execPath,[script,invalid],{cwd:directory}));
    assert.equal(JSON.parse(await readFile(path.join(directory,'package.json'),'utf8')).version,'3.0.0','Invalid input must not partially change the version');
  }
  console.log('Calendar-to-semantic version migration, later patch/minor/major versions, labels, lock metadata, tags and invalid-input safety passed.');
} finally {await rm(directory,{recursive:true,force:true});}
