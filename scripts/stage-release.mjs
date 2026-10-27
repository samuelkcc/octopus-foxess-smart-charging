// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Assemble all release assets without cluttering the two-file delivery folder.
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
const run = promisify(execFile);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const destination = path.resolve('.build', `release-v${version}`);
await mkdir(destination, { recursive: true });
const html = `Smart_Charging_v${version}.html`;
const exe = `SmartCharging-${version}-Windows-x64.exe`;
const web = await readFile(path.join('dist', html), 'utf8');
const pi = await readFile('dist/linux-package/octopus-foxess/web/app/index.html', 'utf8');
if (!web.includes("dataset.devEdition='web'") || !pi.includes("dataset.devEdition='pi'")) {
  throw new Error('Build the redesigned web and Pi interfaces before staging a release.');
}
await cp(path.join('dist', html), path.join(destination, html));
// Preserve the download name used by existing users and links.
await cp(path.join('dist', html), path.join(destination, 'Octopus_IGO_Smart_Charging_Detector.html'));
await cp('src/gas-relay.gs', path.join(destination, 'Smart_Charging_Google_Relay.gs'));
await run('tar', ['-czf', path.join(destination, 'Octopus_FoxESS_Raspberry_Pi.tar.gz'), '-C', 'dist/linux-package', 'octopus-foxess']);
for (const name of ['install.sh', 'uninstall.sh']) await cp(path.join('linux', name), path.join(destination, name));
await cp(path.join('dist/windows', exe), path.join(destination, exe));
const hashes = [];
for (const name of (await readdir(destination)).filter(name => name !== 'SHA256SUMS.txt').sort()) {
  const bytes = await readFile(path.join(destination, name));
  hashes.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
}
await writeFile(path.join(destination, 'SHA256SUMS.txt'), hashes.join('\n') + '\n');
console.log(`Release assets: ${destination}`);
