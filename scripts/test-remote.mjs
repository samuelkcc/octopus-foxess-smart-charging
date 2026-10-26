import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { RemoteSessions, createRemoteKey } from '../linux/remote-access.mjs';

const sessions = new RemoteSessions();
const sessionKey = createRemoteKey();
const sessionToken = sessions.issue(sessionKey);
const request = { headers: { cookie: `__Host-octopus-remote=${sessionToken}` } };
assert.equal(sessions.valid(request, sessionKey), true);
assert.equal(sessions.valid(request, createRemoteKey()), false, 'Key rotation invalidates sessions');
sessions.sessions.values().next().value.until = Date.now() - 1;
assert.equal(sessions.valid(request, sessionKey), false, 'Expired sessions must fail');

const root = await mkdtemp(path.join(os.tmpdir(), 'octopus-remote-test-'));
const port = 30000 + Math.floor(Math.random() * 10000);
const remotePort = port + 1;
const binary = path.join(root, 'cloudflared-test');
await writeFile(binary, `#!${process.execPath}\nprocess.stderr.write('https://test-only.trycloudflare.com\\n'); setInterval(() => {}, 1000);\n`, { mode: 0o700 });
await writeFile(path.join(root, 'access.key'), 'dummy-lan-key');
const child = spawn(process.execPath, ['linux/server.mjs'], {
  env: { ...process.env, OCTOPUS_HOST: '127.0.0.1', OCTOPUS_PORT: String(port), OCTOPUS_REMOTE_PORT: String(remotePort), OCTOPUS_STATE_DIR: root, OCTOPUS_WEB_ROOT: path.resolve('src'), OCTOPUS_CLOUDFLARED: binary },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
child.stderr.on('data', data => { output += data; });
const local = `http://127.0.0.1:${port}`;
const remote = `http://127.0.0.1:${remotePort}`;
const call = (base, route, options = {}) => fetch(base + route, options);
const put = data => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { ready = (await call(local, '/api/health')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  assert.equal((await call(remote, '/api/runtime')).status, 503);
  // LAN protection is deliberately disabled, to prove remote access is independent.
  assert.equal((await call(local, '/api/native-config', put({ accessRequired: false, credentials: {} }))).status, 200);
  const enabled = await call(local, '/api/remote-access', put({ enabled: true })).then(r => r.json());
  assert.match(enabled.key, /^[a-zA-Z0-9_-]{43}$/);
  const runtime = await call(remote, '/api/runtime?worker=1', { headers: { 'X-Octopus-Worker': '1', 'X-Forwarded-For': '127.0.0.1' } }).then(r => r.json());
  assert.equal(runtime.role, 'dashboard');
  assert.equal(runtime.localConfiguration, false);
  assert.equal(runtime.authRequired, true);
  assert.equal(runtime.remoteAccess, true);
  assert.equal((await call(remote, '/api/config')).status, 401);
  assert.equal((await call(remote, '/api/history')).status, 401, 'History requires remote authentication');
  assert.equal((await call(remote, '/api/auth', { method: 'POST', headers: { 'X-Octopus-Access-Key': 'dummy-lan-key' } })).status, 401, 'LAN code never authenticates remote requests');
  const keyHeaders = { 'X-Octopus-Remote-Key': enabled.key };
  for (const route of ['/api/native-config', '/api/access-key', '/api/remote-access', '/api/service-status', '/api/live-demand', '/api/foxess/live/test']) {
    assert.equal((await call(remote, route, { headers: keyHeaders })).status, 403, route);
  }
  const login = await call(remote, '/api/auth', { method: 'POST', headers: keyHeaders });
  assert.equal(login.status, 204);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /Secure; HttpOnly; SameSite=Strict; Path=\//);
  const sessionHeaders = { Cookie: cookie.split(';')[0] };
  assert.equal((await call(remote, '/api/history', { headers: sessionHeaders })).status, 200);
  assert.equal((await call(remote, '/api/history?month=../../config', { headers: sessionHeaders })).status, 400);
  assert.equal((await call(remote, '/api/history', { method:'DELETE', headers:sessionHeaders })).status, 405);
  const publicConfig = await call(remote, '/api/config', { headers: sessionHeaders }).then(r => r.json());
  assert.equal(publicConfig.remoteAccess, undefined, 'Remote key must never leak in dashboard state');
  assert.equal(publicConfig.credentials.api, '');
  assert.equal((await call(local, '/api/config')).status, 200, 'Local worker stays available');
  const proxyHostStatus = await new Promise((resolve, reject) => {
    http.get(local + '/api/native-config', { headers: { Host: 'public-tunnel.invalid' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(proxyHostStatus, 403, 'Public proxy Hosts must not inherit native privileges on the LAN port either');
  assert.equal((await call(remote, '/api/config', { ...put({ remoteAccess: { enabled: false } }), headers: { ...keyHeaders, 'Content-Type': 'application/json' } })).status, 403);
  assert.equal((await call(remote, '/api/config', { ...put({ automations: {} }), headers: { ...sessionHeaders, Origin: 'https://attacker.invalid' } })).status, 403);
  assert.equal((await call(remote, '/api/dispatch-snapshot', { method: 'POST', headers: { ...keyHeaders, 'X-Octopus-Worker': '1' }, body: '{}' })).status, 403);
  assert.equal((await call(remote, '/api/config', { method: 'DELETE', headers: keyHeaders })).status, 403);
  assert.equal((await call(remote, '/api/logout', { method: 'POST', headers: sessionHeaders })).status, 204);
  assert.equal((await call(remote, '/api/config', { headers: sessionHeaders })).status, 401);
  const rotated = await call(local, '/api/remote-access', put({ enabled: true, rotateKey: true })).then(r => r.json());
  assert.notEqual(rotated.key, enabled.key);
  assert.equal((await call(remote, '/api/config', { headers: keyHeaders })).status, 401);
  for (let i = 0; i < 10; i++) await call(remote, '/api/auth', { method: 'POST' });
  assert.equal((await call(remote, '/api/auth', { method: 'POST' })).status, 429);
  await call(local, '/api/remote-access', put({ enabled: false }));
  assert.equal((await call(remote, '/api/config', { headers: { 'X-Octopus-Remote-Key': rotated.key } })).status, 503);
  console.log('Remote listener isolation, separate 256-bit keys, secure sessions, expiry, rotation, logout, rate limiting, CSRF, worker/admin blocking, and disabled-LAN independence passed (mock tunnel only).');
} finally {
  const stopped = once(child, 'exit');
  child.kill('SIGTERM');
  await stopped;
  await rm(root, { recursive: true, force: true });
}
