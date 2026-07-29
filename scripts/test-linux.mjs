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
const [installerSource, uninstallerSource, stylesSource, markupSource, appSource, linuxBuildSource, traySource, dashboardLauncherSource, pagesWorkflow, releaseWorkflow] = await Promise.all([
  readFile(path.join(root, 'linux', 'install.sh'), 'utf8'),
  readFile(path.join(root, 'linux', 'uninstall.sh'), 'utf8'),
  readFile(path.join(root, 'src', 'styles.css'), 'utf8'),
  readFile(path.join(root, 'src', 'index.html'), 'utf8'),
  readFile(path.join(root, 'src', 'app.js'), 'utf8'),
  readFile(path.join(root, 'scripts', 'build-linux.mjs'), 'utf8'),
  readFile(path.join(root, 'linux', 'tray.py'), 'utf8'),
  readFile(path.join(root, 'linux', 'open-dashboard.sh'), 'utf8'),
  readFile(path.join(root, '.github', 'workflows', 'pages.yml'), 'utf8'),
  readFile(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8')
]);

assert.match(installerSource, /systemctl enable octopus-foxess\.service octopus-foxess-worker\.service octopus-foxess-inhibit\.service/);
assert.match(installerSource, /systemctl restart octopus-foxess\.service octopus-foxess-worker\.service octopus-foxess-inhibit\.service/);
assert.match(installerSource, /octopus-foxess-inhibit\.service/);
assert.match(installerSource, /ExecStart=\/usr\/bin\/systemd-inhibit --what=sleep:idle/);
assert.match(installerSource, /ExecStart=\/usr\/bin\/chromium --headless=new/);
assert.match(installerSource, /releases\/latest\/download/);
assert.match(installerSource, /\(umask 077 && printf/);
assert.match(installerSource, /chmod -R u=rwX,go=rX "\$RELEASE_ROOT"/);
assert.doesNotMatch(installerSource, /install -m 0755 .*octopus-foxess-settings/);
assert.match(installerSource, /octopus-foxess-dashboard/);
assert.match(installerSource, /octopus-foxess-tray/);
assert.match(installerSource, /pkill -u "\$DESKTOP_UID" -f 'octopus-foxess-tray'/);
assert.match(installerSource, /gir1\.2-ayatanaappindicator3-0\.1/);
assert.match(installerSource, /Octopus FoxESS Dashboard\.desktop/);
assert.match(installerSource, /OCTOPUS_ACCESS_KEY_FILE=\$ACCESS_KEY_FILE/);
assert.match(uninstallerSource, /systemctl disable --now octopus-foxess-inhibit\.service octopus-foxess-worker\.service octopus-foxess\.service/);
assert.match(uninstallerSource, /usr\/share\/applications\/octopus-foxess\.desktop/);
assert.match(uninstallerSource, /etc\/xdg\/autostart\/octopus-foxess-tray\.desktop/);
assert.match(stylesSource, /@media \(max-width: 600px\)/);
assert.match(stylesSource, /font-size: 16px/);
assert.match(stylesSource, /\.fox-live-settings-heading > div \{ flex: 1 1 12rem/);
assert.match(stylesSource, /\.fox-live-source-row \.badge/);
assert.match(stylesSource, /\.energy-flow-grid/);
assert.match(stylesSource, /\.dashboard-column-primary \{ order: -1; \}/);
assert.match(markupSource, /no Google Apps Script/);
assert.match(markupSource, /Dashboard Access Code/);
assert.match(markupSource, /Mobile \/ LAN dashboard client/);
assert.match(markupSource, /Home Energy Protection/);
assert.match(markupSource, /Dynamic Charge Schedule/);
assert.match(markupSource, /Remove Access Code/);
assert.match(markupSource, /toggle-live-on-demand/);
assert.match(markupSource, /Octopus and FoxESS credentials stay managed by the Pi service/);
assert.match(markupSource, /class="input-group pi-config-only"/);
assert.match(markupSource, /id="octopus-account-toggle"/);
assert.match(markupSource, /rel="apple-touch-icon"/);
assert.match(markupSource, /rel="manifest"/);
assert.match(markupSource, /styles\.css\?v=2026\.7\.29\.1/);
assert.match(markupSource, /app\.js\?v=2026\.7\.29\.1/);
assert.match(stylesSource, /\.linux-runtime \.pi-config-only \{ display: none !important; \}/);
assert.match(stylesSource, /\.account-number-row \.account-secret-control \.val \{ max-width: none; white-space: nowrap/);
assert.match(appSource, /LINUX_OCTOPUS_ENDPOINT = '\/api\/octopus'/);
assert.match(appSource, /LINUX_FOX_LIVE_ENDPOINT = '\/api\/foxess\/live'/);
assert.match(appSource, /startLinuxLiveTelemetryPoll/);
assert.match(appSource, /octopusFoxessDashboardAccessCode/);
assert.match(appSource, /localStorage\.setItem\(LINUX_ACCESS_STORAGE_KEY, key\)/);
assert.match(appSource, /function removeSavedAccessCode/);
assert.match(appSource, /function renderProtectionOverview/);
assert.match(appSource, /async function updateLinuxLiveDemand/);
assert.match(appSource, /const credentials = window\.linuxRuntime\s*\?\s*activeCredentials/);
assert.match(appSource, /OPEN DASHBOARD/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /function getClientState\(state\)/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /api: credentials\.api \? 'pi-managed' : ''/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /Service credentials can only be changed from the Raspberry Pi Settings app/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /async function proxyOctopusRequest/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /createHash\('md5'\)/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /FoxessLiveTelemetry/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /\/api\/foxess\/live\/test/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /\/api\/service-status/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /\/api\/native-config/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /\/api\/live-demand/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /lanAccessRequired/);
assert.match(await readFile(path.join(root, 'linux', 'server.mjs'), 'utf8'), /'Cache-Control': 'no-cache'/);
assert.match(linuxBuildSource, /octopus-foxess\.desktop/);
assert.match(linuxBuildSource, /octopus-foxess-tray\.desktop/);
assert.match(linuxBuildSource, /open-dashboard\.sh/);
assert.match(linuxBuildSource, /tray\.py/);
assert.match(linuxBuildSource, /octopus-foxess\.svg/);
assert.match(linuxBuildSource, /packageRoot, 'web', 'octopus-foxess\.svg'/);
assert.match(linuxBuildSource, /site\.webmanifest/);
assert.match(linuxBuildSource, /packageRoot, 'web', 'icons'/);
assert.match(linuxBuildSource, /foxess-signature\.wasm/);
assert.match(linuxBuildSource, /node_modules', 'ws'/);
assert.match(traySource, /AyatanaAppIndicator3/);
assert.match(traySource, /set_icon_theme_path\(ICON_ROOT\)/);
assert.doesNotMatch(traySource, /ICONS = \{[\s\S]*scalable\/apps/);
assert.match(installerSource, /gtk-update-icon-cache/);
assert.match(traySource, /Octopus API/);
assert.match(traySource, /FoxESS REST/);
assert.match(traySource, /FoxESS Live WS/);
assert.match(traySource, /live\.get\("state"\) in \("connected", "live"\)/);
assert.match(traySource, /LAN access code/);
assert.match(traySource, /Require an access code from Mobile \/ LAN dashboard clients/);
assert.match(traySource, /Octopus account/);
assert.match(traySource, /FoxESS web-login email/);
assert.match(traySource, /Save & Test Live WS/);
assert.doesNotMatch(traySource, /Integration Settings/);
assert.match(dashboardLauncherSource, /\?client=1/);
assert.match(dashboardLauncherSource, /octopus-foxess-dashboard/);
assert.match(pagesWorkflow, /npm ci[\s\S]*npm run check/);
assert.match(pagesWorkflow, /src\/site\.webmanifest/);
assert.match(pagesWorkflow, /src\/icons/);
assert.match(releaseWorkflow, /npm ci[\s\S]*npm run check/);

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
  assert.equal(runtime.accessRequired, true);
  assert.ok(Array.isArray(runtime.lanUrls));

  const clientRuntime = await fetch(`http://127.0.0.1:${port}/api/runtime?client=1`).then(response => response.json());
  assert.equal(clientRuntime.role, 'dashboard');
  assert.equal(clientRuntime.authRequired, true);
  assert.equal(clientRuntime.localConfiguration, false);
  const rejectedLocalClient = await fetch(`http://127.0.0.1:${port}/api/auth`, {
    method: 'POST',
    headers: { Referer: `http://127.0.0.1:${port}/?client=1` }
  });
  assert.equal(rejectedLocalClient.status, 401);
  const acceptedLocalClient = await fetch(`http://127.0.0.1:${port}/api/auth`, {
    method: 'POST',
    headers: {
      Referer: `http://127.0.0.1:${port}/?client=1`,
      'X-Octopus-Access-Key': accessKey
    }
  });
  assert.equal(acceptedLocalClient.status, 204);

  const currentAccessKey = await fetch(`http://127.0.0.1:${port}/api/access-key`).then(response => response.json());
  assert.equal(currentAccessKey.accessKey, accessKey);
  const changedAccessKey = 'new-lan-access-code';
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
    foxLiveMode: 'live-ws',
    foxWebUsername: '',
    foxWebPassword: '',
    gasUrl: '/api/foxess'
  };
  const automationResponse = await fetch(`http://127.0.0.1:${port}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ automations: { dispatchCheck: true } })
  });
  assert.equal(automationResponse.status, 200);

  const nativeSaveResponse = await fetch(`http://127.0.0.1:${port}/api/native-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessRequired: true,
      accessKey: changedAccessKey,
      credentials
    })
  });
  assert.equal(nativeSaveResponse.status, 200);

  const rejectedLiveDemand = await fetch(`http://127.0.0.1:${port}/api/live-demand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: true, startsAt: '2026-07-29T11:00:00.000Z', endsAt: '2026-07-29T12:00:00.000Z' })
  });
  assert.equal(rejectedLiveDemand.status, 403);
  const acceptedLiveDemand = await fetch(`http://127.0.0.1:${port}/api/live-demand`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Referer: `http://127.0.0.1:${port}/?worker=1`
    },
    body: JSON.stringify({ active: true, startsAt: '2026-07-29T11:00:00.000Z', endsAt: '2026-07-29T12:00:00.000Z' })
  });
  assert.equal(acceptedLiveDemand.status, 200);

  const nativeConfig = await fetch(`http://127.0.0.1:${port}/api/native-config`).then(response => response.json());
  assert.equal(nativeConfig.accessRequired, true);
  assert.equal(nativeConfig.accessKey, changedAccessKey);
  assert.deepEqual(nativeConfig.credentials, credentials);

  const workerState = await fetch(`http://127.0.0.1:${port}/api/config`, {
    headers: { Referer: `http://127.0.0.1:${port}/?worker=1` }
  }).then(response => response.json());
  assert.equal(workerState.credentials.api, 'pi-managed');
  assert.equal(workerState.credentials.foxToken, 'pi-managed');
  assert.equal(workerState.automations.dispatchCheck, true);
  assert.equal(workerState.liveWsDemandActive, true);
  assert.equal(typeof workerState.revision, 'number');

  const clientState = await fetch(`http://127.0.0.1:${port}/api/config`, {
    headers: {
      Referer: `http://127.0.0.1:${port}/?client=1`,
      'X-Octopus-Access-Key': changedAccessKey
    }
  }).then(response => response.json());
  assert.equal(clientState.credentials.api, 'pi-managed');
  assert.equal(clientState.credentials.foxToken, 'pi-managed');

  const encryptedFile = await readFile(path.join(stateRoot, 'config.enc'), 'utf8');
  assert.doesNotMatch(encryptedFile, /sk_live_test|fox-test|A-TEST/);

  const liveStatus = await fetch(`http://127.0.0.1:${port}/api/foxess/live/status`).then(response => response.json());
  assert.equal(liveStatus.mode, 'live-ws');
  assert.equal(liveStatus.source, 'rest-fallback');
  assert.equal(liveStatus.reason, 'live-credentials-empty');

  const serviceStatus = await fetch(`http://127.0.0.1:${port}/api/service-status`).then(response => response.json());
  assert.equal(serviceStatus.status, 'ok');
  assert.equal(serviceStatus.octopus.configured, true);
  assert.equal(serviceStatus.foxRest.configured, true);
  assert.equal(serviceStatus.foxLive.reason, 'live-credentials-empty');
  assert.ok(Array.isArray(serviceStatus.lanUrls));
  assert.equal(serviceStatus.accessRequired, true);

  const rejectedProxy = await fetch(`http://127.0.0.1:${port}/api/foxess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com/op/test', body: {} })
  });
  assert.equal(rejectedProxy.status, 400);

  const passwordFreeResponse = await fetch(`http://127.0.0.1:${port}/api/native-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessRequired: false,
      accessKey: '',
      credentials
    })
  });
  assert.equal(passwordFreeResponse.status, 200);
  const openClientRuntime = await fetch(`http://127.0.0.1:${port}/api/runtime?client=1`)
    .then(response => response.json());
  assert.equal(openClientRuntime.accessRequired, false);
  assert.equal(openClientRuntime.authRequired, false);
  const passwordFreeAuth = await fetch(`http://127.0.0.1:${port}/api/auth`, {
    method: 'POST',
    headers: { Referer: `http://127.0.0.1:${port}/?client=1` }
  });
  assert.equal(passwordFreeAuth.status, 204);

  const page = await fetch(`http://127.0.0.1:${port}/`).then(response => response.text());
  assert.match(page, /Smart Charging Detector/);
  assert.match(page, /Mobile \/ LAN access: detecting local address/);

  console.log('Linux server, LAN access-code settings, native tray, encrypted state, launchers, proxy restriction, and static GUI checks passed.');
} finally {
  child.kill('SIGTERM');
}
