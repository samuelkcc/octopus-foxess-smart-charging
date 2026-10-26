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
    assert.equal(pkg.version,version);assert.equal(lock.version,version);assert.equal(lock.packages[''].version,version);
    assert.ok(html.includes(`?v=${version}`));assert.ok(html.includes(`Build v${version}`));assert.ok(html.includes(`data-app-version>${version}<`));
    assert.equal(await readFile(path.join(directory,'.github/workflows/release.yml'),'utf8'),`default: v${version}\n`);
  }
  for (const invalid of ['2026.10.26.7','v2.0.0','2.0','02.0.0','2.0.0-rc.1','2.0.0;anything']) {
    await assert.rejects(run(process.execPath,[script,invalid],{cwd:directory}));
    assert.equal(JSON.parse(await readFile(path.join(directory,'package.json'),'utf8')).version,'3.0.0','Invalid input must not partially change the version');
  }
  console.log('Calendar-to-semantic version migration, later patch/minor/major versions, labels, lock metadata, tags and invalid-input safety passed.');
} finally {await rm(directory,{recursive:true,force:true});}
