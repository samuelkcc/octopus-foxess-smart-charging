import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const dist = path.join(root, 'dist');
const stagingRoot = path.join(dist, 'linux-package');
const packageRoot = path.join(stagingRoot, 'octopus-foxess');
const packageInfo = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

await rm(stagingRoot, { recursive: true, force: true });
await mkdir(path.join(packageRoot, 'web'), { recursive: true });

await Promise.all([
  cp(path.join(root, 'linux', 'server.mjs'), path.join(packageRoot, 'server.mjs')),
  cp(path.join(root, 'linux', 'README-RASPBERRY-PI.md'), path.join(packageRoot, 'README-RASPBERRY-PI.md')),
  cp(path.join(root, 'linux', 'open-settings.sh'), path.join(packageRoot, 'open-settings.sh')),
  cp(path.join(root, 'linux', 'octopus-foxess.desktop'), path.join(packageRoot, 'octopus-foxess.desktop')),
  cp(path.join(root, 'linux', 'octopus-foxess.svg'), path.join(packageRoot, 'octopus-foxess.svg')),
  cp(path.join(root, 'LICENSE'), path.join(packageRoot, 'LICENSE')),
  cp(
    path.join(dist, 'Octopus_IGO_Smart_Charging_Detector.html'),
    path.join(packageRoot, 'web', 'index.html')
  ),
  writeFile(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({ name: packageInfo.name, version: packageInfo.version, type: 'module' }, null, 2)}\n`
  )
]);

const archivePath = path.join(dist, 'Octopus_FoxESS_Raspberry_Pi.tar.gz');
await rm(archivePath, { force: true });
await execFileAsync('tar', ['-czf', archivePath, '-C', stagingRoot, 'octopus-foxess']);
await cp(path.join(root, 'linux', 'install.sh'), path.join(dist, 'install.sh'));
await cp(path.join(root, 'linux', 'uninstall.sh'), path.join(dist, 'uninstall.sh'));

console.log(`Built ${path.relative(root, archivePath)} for v${packageInfo.version}`);
