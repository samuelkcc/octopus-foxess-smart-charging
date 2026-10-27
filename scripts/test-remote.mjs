import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { RemoteSessions, createRemoteKey, QuickTunnel } from '../linux/remote-access.mjs';

const sessions = new RemoteSessions();
const sessionKey = createRemoteKey();
const sessionToken = sessions.issue(sessionKey);
const request = { headers: { cookie: `__Host-octopus-remote=${sessionToken}` } };
assert.equal(sessions.valid(request, sessionKey), true);
assert.equal(sessions.valid(request, createRemoteKey()), false, 'Key rotation invalidates sessions');
sessions.sessions.values().next().value.until = Date.now() - 1;
assert.equal(sessions.valid(request, sessionKey), false, 'Expired sessions must fail');

// A printed URL alone does not prove that Cloudflare has connected.
const spawned=[];
const tunnel=new QuickTunnel({url:'http://127.0.0.1:8788',spawnProcess:(_binary,args)=>{
 const process=new EventEmitter();process.stdout=new EventEmitter();process.stderr=new EventEmitter();process.kill=()=>{process.killed=true;};spawned.push({process,args});return process;
}});
tunnel.start();const old=spawned[0].process;
old.stderr.emit('data','https://first.trycloudflare.com\n');
assert.equal(tunnel.status.state,'connecting');assert.equal(tunnel.status.url,null);
old.stderr.emit('data','Registered tunnel connec');old.stderr.emit('data','tion\n');
assert.equal(tunnel.status.state,'running');assert.equal(tunnel.status.url,'https://first.trycloudflare.com');
assert.equal(spawned[0].args.at(-1),'http://127.0.0.1:8788');
tunnel.restart();assert.equal(old.killed,true);assert.equal(tunnel.status.url,null);
old.stderr.emit('data','Registered tunnel connection\n');assert.equal(tunnel.status.state,'starting','Old process output cannot restore a stale URL');
spawned[1].process.stderr.emit('data','https://second.trycloudflare.com\nRegistered tunnel connection\n');
assert.equal(tunnel.status.url,'https://second.trycloudflare.com');
spawned[1].process.stderr.emit('data','failed to serve tunnel connection\n');assert.equal(tunnel.status.url,null);
spawned[1].process.stderr.emit('data','Registered tunnel connection\n');assert.equal(tunnel.status.state,'running');
tunnel.stop();

const root = await mkdtemp(path.join(os.tmpdir(), 'octopus-remote-test-'));
const port = 30000 + Math.floor(Math.random() * 10000);
const remotePort = port + 1;
const binary = path.join(root, 'cloudflared-test');
await writeFile(binary, `#!${process.execPath}\nprocess.stderr.write('https://test-only.trycloudflare.com\\nRegistered tunnel connection\\n'); setInterval(() => {}, 1000);\n`, { mode: 0o700 });
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
  for (const route of ['/api/history/settings', '/api/automation/pause', '/api/integration-status']) {
    assert.equal((await call(remote, route)).status,401,'New controls require authentication');
    assert.equal((await call(remote, route, { ...put(route.includes('history') ? {retentionMonths:6} : {action:'pause',hours:6}), headers:{...sessionHeaders,Origin:'https://attacker.invalid'} })).status,403);
    assert.equal((await call(remote, route, { method:'DELETE',headers:sessionHeaders })).status,405);
  }
  assert.equal((await call(remote,'/api/history/settings',{headers:sessionHeaders})).status,200);
  assert.equal((await call(remote,'/api/history/settings',{...put(null),headers:sessionHeaders})).status,400);
  assert.equal((await call(remote,'/api/history/settings',{...put({retentionMonths:25}),headers:sessionHeaders})).status,400);
  assert.equal((await call(remote,'/api/history/settings',{...put({retentionMonths:6}),headers:sessionHeaders})).status,200);
  assert.equal((await call(remote,'/api/history/settings',{headers:sessionHeaders}).then(r=>r.json())).retentionMonths,6);
  assert.equal((await call(remote,'/api/history/settings',{...put({saveIntervalMinutes:30}),headers:sessionHeaders})).status,200);
  assert.equal((await call(remote,'/api/history/settings',{...put({saveIntervalMinutes:5}),headers:sessionHeaders})).status,400);
  assert.equal((await call(remote,'/api/history/clear',{method:'POST',body:JSON.stringify({action:'clear'})})).status,401);
  assert.equal((await call(remote,'/api/history/clear',{method:'POST',headers:{...sessionHeaders,Origin:'https://evil.invalid'},body:JSON.stringify({action:'clear'})})).status,403);
  assert.equal((await call(remote,'/api/history/clear',{method:'POST',headers:sessionHeaders,body:JSON.stringify({action:'invalid'})})).status,400);
  assert.equal((await call(remote,'/api/history/clear',{method:'POST',headers:sessionHeaders,body:JSON.stringify({action:'clear'})})).status,200);
  await call(local,'/api/native-config',put({accessRequired:false,credentials:{foxSN:'mock-device',foxToken:'mock-token'}}));
  assert.equal((await call(remote,'/api/automation/pause',{...put({action:'pause',hours:null}),headers:sessionHeaders})).status,200);
  assert.equal((await call(local,'/api/config').then(r=>r.json())).automationPause.paused,true,'Worker sees the same global pause');
  const schedulerRequest = {url:'https://www.foxesscloud.com/op/v3/device/scheduler/enable',body:{deviceSN:'ignored',groups:[]}};
  for (const headers of [sessionHeaders,{...keyHeaders,'X-Octopus-Worker':'1','X-Forwarded-For':'127.0.0.1'}]) {
    assert.equal((await call(remote,'/api/foxess',{method:'POST',headers,body:JSON.stringify(schedulerRequest)})).status,423,'Remote/manual schedule writes cannot bypass pause');
  }
  assert.equal((await call(local,'/api/foxess',{method:'POST',headers:{'X-Octopus-Worker':'1'},body:JSON.stringify(schedulerRequest)})).status,423,'Worker schedule writes are blocked too');
  assert.equal((await call(remote,'/api/automation/pause',{...put({action:'resume'}),headers:sessionHeaders})).status,200);
  const activity = await call(remote,'/api/history',{headers:sessionHeaders}).then(r=>r.json());
  assert.deepEqual(activity.events.map(event=>event.type).sort(),['automation_paused','automation_resumed']);
  assert.equal((await call(remote,'/api/integration-status',{...put({action:'refresh'}),headers:sessionHeaders})).status,202);
  const requestedRefresh = await call(remote,'/api/integration-status',{headers:sessionHeaders}).then(r=>r.json());
  assert.ok(requestedRefresh.refreshRequestId>0);
  assert.equal((await call(remote,'/api/integration-status',{method:'POST',headers:{...keyHeaders,'X-Octopus-Worker':'1'},body:JSON.stringify({requestSeen:0,octopusNextAt:null,foxessNextAt:null,octopusBusy:false,foxessBusy:false})})).status,403,'Remote callers cannot publish worker timing');
  const integrationStatus = await call(remote,'/api/integration-status',{headers:sessionHeaders}).then(r=>r.json());
  assert.ok(integrationStatus.services.octopus && integrationStatus.services.foxess);
  assert.equal(JSON.stringify(integrationStatus).includes('mock-token'),false,'Integration status must not disclose service tokens');
  assert.equal((await call(remote,'/api/integration-status',{...put({service:'foxess',alertId:999}),headers:sessionHeaders})).status,409);
  const publicConfig = await call(remote, '/api/config', { headers: sessionHeaders }).then(r => r.json());
  assert.equal(publicConfig.remoteAccess, undefined, 'Remote key must never leak in dashboard state');
  assert.equal(publicConfig.credentials.api, '');
  assert.equal(publicConfig.credentials.foxToken, 'pi-managed');
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
  const renewed = await call(local, '/api/remote-access', put({enabled:true,renewUrl:true})).then(r=>r.json());
  assert.equal(renewed.key,enabled.key,'URL renewal must preserve the remote key');
  assert.equal(renewed.state,'starting','A replacement URL is not ready before edge connection');
  assert.equal((await call(remote,'/api/config',{headers:keyHeaders})).status,200);
  assert.equal((await call(local,'/api/remote-access',put({enabled:true,renewUrl:true,rotateKey:true}))).status,400);
  assert.equal((await call(local,'/api/remote-access',put({enabled:true,renewUrl:'yes'}))).status,400);
  assert.equal((await call(local,'/api/remote-access',{...put({enabled:true}),headers:{Origin:'https://attacker.invalid'}})).status,403);
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
