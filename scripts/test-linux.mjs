import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'octopus-foxess-test-'));
const stateRoot = path.join(temporaryRoot, 'state');
const accessKeyFile = path.join(temporaryRoot, 'access.key');
const port = 18_000 + Math.floor(Math.random() * 10_000);
const accessKey = 'test-access-key';
const [installerSource, uninstallerSource, stylesSource, markupSource, appSource, linuxBuildSource] = await Promise.all([
  readFile(path.join(root, 'linux', 'install.sh'), 'utf8'),
  readFile(path.join(root, 'linux', 'uninstall.sh'), 'utf8'),
  readFile(path.join(root, 'src', 'styles.css'), 'utf8'),
  readFile(path.join(root, 'src', 'index.html'), 'utf8'),
  readFile(path.join(root, 'src', 'app.js'), 'utf8'),
  readFile(path.join(root, 'scripts', 'build-linux.mjs'), 'utf8')
]);

assert.match(installerSource, /systemctl enable octopus-foxess\.service octopus-foxess-worker\.service octopus-foxess-inhibit\.service/);
assert.match(installerSource, /systemctl restart octopus-foxess\.service octopus-foxess-worker\.service octopus-foxess-inhibit\.service/);
assert.match(installerSource, /octopus-foxess-inhibit\.service/);
assert.match(installerSource, /ExecStart=\/usr\/bin\/systemd-inhibit --what=sleep:idle/);
assert.match(installerSource, /ExecStart=\/usr\/bin\/chromium --headless=new/);
assert.match(installerSource, /releases\/latest\/download/);
assert.match(installerSource, /\(umask 077 && printf/);
assert.match(installerSource, /chmod -R u=rwX,go=rX "\$RELEASE_ROOT"/);
assert.match(installerSource, /octopus-foxess-settings/);
assert.match(installerSource, /Octopus FoxESS Settings\.desktop/);
assert.match(installerSource, /OCTOPUS_ACCESS_KEY_FILE=\$ACCESS_KEY_FILE/);
assert.match(uninstallerSource, /systemctl disable --now octopus-foxess-inhibit\.service octopus-foxess-worker\.service octopus-foxess\.service/);
assert.match(uninstallerSource, /usr\/share\/applications\/octopus-foxess\.desktop/);
assert.match(stylesSource, /@media \(max-width: 600px\)/);
assert.match(stylesSource, /font-size: 16px/);
assert.match(markupSource, /no Google Apps Script/);
assert.match(markupSource, /iPhone LAN Access Key/);
assert.match(markupSource, /iPhone Dashboard Access Key/);
assert.match(markupSource, /Octopus and FoxESS credentials stay managed by the Pi service/);
assert.match(markupSource, /class="input-group pi-config-only"/);
assert.match(markupSource, /styles\.css\?v=2026\.7\.26\.6/);
assert.match(markupSource, /app\.js\?v=2026\.7\.26\.6/);
assert.match(stylesSource, /\.linux-runtime\.linux-auth-required \.pi-config-only \{ display: none !important; \}/);
assert.match(stylesSource, /\.linux-runtime \.linux-local-only \{ display: none !important; \}/);
assert.match(appSource, /\/api\/access-key/);
assert.match(appSource, /LINUX_OCTOPUS_ENDPOINT = '\/api\/octopus'/);
assert.match(appSource, /window\.linuxRuntime && window\.linuxAuthRequired\s*\?\s*activeCredentials/);
assert.match(appSource, /SAVE SETTINGS & OPEN DASHBOARD/);
assert.match(appSource, /OPEN DASHBOARD/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /function getClientState\(state\)/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /api: credentials\.api \? 'pi-managed' : ''/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /Service credentials can only be changed from the Raspberry Pi Settings app/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /async function proxyOctopusRequest/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /createHash\('md5'\)/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /'Cache-Control': 'no-cache'/);
assert.match(linuxBuildSource, /octopus-foxess\.desktop/);
assert.match(linuxBuildSource, /octopus-foxess\.svg/);
assert.match(linuxBuildSource, /packageRoot, 'web', 'octopus-foxess\.svg'/);

await mkdir(stateRoot);
await writeFile(accessKeyFile, `${accessKey}\n`, { mode: 0o600 });

const child = spawn(process.execPath, [path.join(root, 'linux', 'server.mjs')], {
  env: {
    ...process.env,
    OCTOPUS_HOST: '127.0.0.1',
    OCTOPUS_PORT: String(port),
    OCTOPUS_STATE_DIR: stateRoot,
    OCTOPUS_ACCESS_KEY_FILE: accessKeyFile,
    OCTOPUS_WEB_ROOT: path.join(root, 'src')
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Linux server did not start: ${stderr}`);
}

try {
  await waitForServer();

  const runtime = await fetch(`http://127.0.0.1:${port}/api/runtime?worker=1`).then(response => response.json());
  assert.equal(runtime.mode, 'linux');
  assert.equal(runtime.role, 'worker');
  assert.equal(runtime.authRequired, false);
  assert.ok(Array.isArray(runtime.lanUrls));

  const currentAccessKey = await fetch(`http://127.0.0.1:${port}/api/access-key`).then(response => response.json());
  assert.equal(currentAccessKey.accessKey, accessKey);
  const changedAccessKey = 'new-iphone-access-key';
  const accessKeyResponse = await fetch(`http://127.0.0.1:${port}/api/access-key`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessKey: changedAccessKey })
  });
  assert.equal(accessKeyResponse.status, 200);
  assert.equal((await readFile(accessKeyFile, 'utf8')).trim(), changedAccessKey);
  const invalidAccessKeyResponse = await fetch(`http://127.0.0.1:${port}/api/access-key`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessKey: 'short' })
  });
  assert.equal(invalidAccessKeyResponse.status, 400);

  const credentials = {
    acc: 'A-TEST',
    api: 'sk_live_test',
    foxSN: 'SN-TEST',
    foxToken: 'fox-test',
    gasUrl: '/api/foxess'
  };
  const saveResponse = await fetch(`http://127.0.0.1:${port}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentials, automations: { dispatchCheck: true } })
  });
  assert.equal(saveResponse.status, 200);

  const stored = await fetch(`http://127.0.0.1:${port}/api/config`).then(response => response.json());
  assert.deepEqual(stored.credentials, credentials);
  assert.equal(stored.automations.dispatchCheck, true);
  assert.equal(typeof stored.revision, 'number');

  const encryptedFile = await readFile(path.join(stateRoot, 'config.enc'), 'utf8');
  assert.doesNotMatch(encryptedFile, /sk_live_test|fox-test|A-TEST/);

  const rejectedProxy = await fetch(`http://127.0.0.1:${port}/api/foxess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/op/test', body: {} })
  });
  assert.equal(rejectedProxy.status, 400);

  const page = await fetch(`http://127.0.0.1:${port}/`).then(response => response.text());
  assert.match(page, /Smart Charging Detector/);
  assert.match(page, /Open on iPhone: detecting local address/);

  console.log('Linux server, local access-key settings, encrypted state, launcher, proxy restriction, and static GUI checks passed.');
} finally {
  child.kill('SIGTERM');
}
