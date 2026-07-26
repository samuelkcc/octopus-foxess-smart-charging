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
const [installerSource, uninstallerSource, stylesSource, markupSource] = await Promise.all([
  readFile(path.join(root, 'linux', 'install.sh'), 'utf8'),
  readFile(path.join(root, 'linux', 'uninstall.sh'), 'utf8'),
  readFile(path.join(root, 'src', 'styles.css'), 'utf8'),
  readFile(path.join(root, 'src', 'index.html'), 'utf8')
]);

assert.match(installerSource, /systemctl enable --now octopus-foxess\.service octopus-foxess-worker\.service/);
assert.match(installerSource, /systemd-inhibit --what=sleep:idle/);
assert.match(installerSource, /releases\/latest\/download/);
assert.match(uninstallerSource, /systemctl disable --now octopus-foxess-worker\.service octopus-foxess\.service/);
assert.match(stylesSource, /@media \(max-width: 600px\)/);
assert.match(stylesSource, /font-size: 16px/);
assert.match(markupSource, /no Google Apps Script/);
assert.match(markupSource, /Raspberry Pi Access Key/);

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

  console.log('Linux server, encrypted state, proxy restriction, and static GUI checks passed.');
} finally {
  child.kill('SIGTERM');
}
