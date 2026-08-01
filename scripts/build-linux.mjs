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
await mkdir(path.join(packageRoot, 'node_modules'), { recursive: true });

await Promise.all([
  cp(path.join(root, 'linux', 'server.mjs'), path.join(packageRoot, 'server.mjs')),
  cp(path.join(root, 'linux', 'foxess-live.mjs'), path.join(packageRoot, 'foxess-live.mjs')),
  cp(path.join(root, 'linux', 'foxess-web-signature.mjs'), path.join(packageRoot, 'foxess-web-signature.mjs')),
  cp(path.join(root, 'linux', 'foxess-signature.wasm'), path.join(packageRoot, 'foxess-signature.wasm')),
  cp(path.join(root, 'linux', 'README-RASPBERRY-PI.md'), path.join(packageRoot, 'README-RASPBERRY-PI.md')),
  cp(path.join(root, 'linux', 'open-dashboard.sh'), path.join(packageRoot, 'open-dashboard.sh')),
  cp(path.join(root, 'linux', 'tray.py'), path.join(packageRoot, 'tray.py')),
  cp(path.join(root, 'linux', 'update.sh'), path.join(packageRoot, 'update.sh')),
  cp(path.join(root, 'linux', 'octopus-foxess.desktop'), path.join(packageRoot, 'octopus-foxess.desktop')),
  cp(path.join(root, 'linux', 'octopus-foxess-tray.desktop'), path.join(packageRoot, 'octopus-foxess-tray.desktop')),
  cp(path.join(root, 'linux', 'octopus-foxess.svg'), path.join(packageRoot, 'octopus-foxess.svg')),
  cp(path.join(root, 'linux', 'octopus-foxess-status-green.svg'), path.join(packageRoot, 'octopus-foxess-status-green.svg')),
  cp(path.join(root, 'linux', 'octopus-foxess-status-amber.svg'), path.join(packageRoot, 'octopus-foxess-status-amber.svg')),
  cp(path.join(root, 'linux', 'octopus-foxess-status-red.svg'), path.join(packageRoot, 'octopus-foxess-status-red.svg')),
  cp(path.join(root, 'linux', 'octopus-foxess.svg'), path.join(packageRoot, 'web', 'octopus-foxess.svg')),
  cp(path.join(root, 'src', 'site.webmanifest'), path.join(packageRoot, 'web', 'site.webmanifest')),
  cp(path.join(root, 'src', 'icons'), path.join(packageRoot, 'web', 'icons'), { recursive: true }),
  cp(path.join(root, 'LICENSE'), path.join(packageRoot, 'LICENSE')),
  cp(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(packageRoot, 'THIRD_PARTY_NOTICES.md')),
  cp(path.join(root, 'node_modules', 'ws'), path.join(packageRoot, 'node_modules', 'ws'), { recursive: true }),
  cp(
    path.join(dist, 'Octopus_IGO_Smart_Charging_Detector.html'),
    path.join(packageRoot, 'web', 'index.html')
  ),
  writeFile(
    path.join(packageRoot, 'package.json'),
    `${JSON.stringify({
      name: packageInfo.name,
      version: packageInfo.version,
      type: 'module',
      dependencies: packageInfo.dependencies
    }, null, 2)}\n`
  )
]);

const archivePath = path.join(dist, 'Octopus_FoxESS_Raspberry_Pi.tar.gz');
await rm(archivePath, { force: true });
await execFileAsync('tar', ['-czf', archivePath, '-C', stagingRoot, 'octopus-foxess']);
await cp(path.join(root, 'linux', 'install.sh'), path.join(dist, 'install.sh'));
await cp(path.join(root, 'linux', 'uninstall.sh'), path.join(dist, 'uninstall.sh'));

console.log(`Built ${path.relative(root, archivePath)} for v${packageInfo.version}`);
