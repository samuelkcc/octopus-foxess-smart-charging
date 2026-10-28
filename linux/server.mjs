import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { QuickTunnel, RemoteSessions, createRemoteKey, matchesRemoteKey, remoteCookie } from './remote-access.mjs';

import { FoxessLiveTelemetry } from './foxess-live.mjs';
import { CompactHistory } from './history.mjs';
import { AutomationPause } from './automation-pause.mjs';
import { IntegrationState } from './integration-state.mjs';
import { ServiceControl } from './service-control.mjs';
import { RequestBudget, retryDelay } from './request-budget.mjs';
import { TariffCache } from './tariff-cache.mjs';
import { TariffSnapshotCache } from './tariff-snapshot-cache.mjs';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const webRoot = process.env.OCTOPUS_WEB_ROOT || path.join(appRoot, 'web');
const stateRoot = process.env.OCTOPUS_STATE_DIR || '/var/lib/octopus-foxess';
const accessKeyFile = process.env.OCTOPUS_ACCESS_KEY_FILE || path.join(stateRoot, 'access.key');
const host = process.env.OCTOPUS_HOST || '0.0.0.0';
const port = Number(process.env.OCTOPUS_PORT || 8787);
const remotePort = Number(process.env.OCTOPUS_REMOTE_PORT || port + 1);
const remoteRequests = new WeakSet();
const remoteSessions = new RemoteSessions();
const lanManagementAttempts = new RemoteSessions();
const quickTunnel = new QuickTunnel({ url: `http://127.0.0.1:${remotePort}` });
const maxBodyBytes = 128 * 1024;
const allowedFoxHost = 'www.foxesscloud.com';
const allowedOctopusHost = 'api.octopus.energy';
const allowedFoxPaths = new Set([
  '/op/v0/device/real/query',
  '/op/v0/device/setting/get',
  '/op/v3/device/scheduler/enable',
  '/op/v3/device/scheduler/get'
]);
const integrationStatus = {
  octopus: { lastSuccessAt: null, lastErrorAt: null, lastError: null },
  foxRest: { lastSuccessAt: null, lastErrorAt: null, lastError: null }
};
const liveWsPolicies = new Set(['on-demand', 'always', 'rest']);
const dispatchSyncStatuses = new Set(['waiting', 'syncing', 'confirmed', 'failed', 'disabled']);
let octopusAuthPromise = null;
let octopusAuthFingerprint = null;
let octopusTokenCache = { apiKeyFingerprint: null, token: null, expiresAt: 0 };
let octopusDisplaySnapshot = null;
let tariffDisplaySnapshot = null;
let tariffSnapshotRevision = 0;
const hostInstance = randomBytes(8).toString('hex');
function tariffTransportStatus() {
  const snapshot=tariffDisplaySnapshot;
  return {hostInstance,revision:snapshot?.revision || 0,publishedAt:snapshot?.publishedAt || null,
    updatedAt:snapshot?.payload.state?.updatedAt || null,pending:snapshot?.payload.pending ?? true,
    problem:snapshot?.payload.problem === true,importCount:snapshot?.payload.state?.importRates.length || 0,
    exportCount:snapshot?.payload.state?.exportRates.length || 0};
}
let packageContents;
try {
  packageContents = await readFile(path.join(appRoot, 'package.json'), 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  packageContents = await readFile(path.join(appRoot, '..', 'package.json'), 'utf8');
}
const packageInfo = JSON.parse(packageContents);
const version = packageInfo.version;

await mkdir(stateRoot, { recursive: true });
const serviceControl = new ServiceControl(path.join(stateRoot, 'service-control.json'));
await serviceControl.load();

// Pi keeps the all-request floor. Desktop login only waits after a real rate limit.
const desktopHost = process.env.OCTOPUS_DESKTOP === '1';
// One second of margin protects the 60-second floor from clock granularity.
const octopusRequestInterval = desktopHost ? 0 : 61_000;
const octopusBudgetFile = path.join(stateRoot, desktopHost ? 'desktop-octopus-cooldown-v2.json' : 'octopus-request-budget.json');
let savedOctopusNextAt = Date.now() + octopusRequestInterval;
try {
  const saved = JSON.parse(await readFile(octopusBudgetFile, 'utf8'));
  if (Number.isFinite(saved.nextAt)) savedOctopusNextAt = Math.max(savedOctopusNextAt, saved.nextAt);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const octopusBudget = new RequestBudget({
  interval: octopusRequestInterval,
  readNext: () => savedOctopusNextAt,
  saveNext: async nextAt => {
    savedOctopusNextAt = nextAt;
    const temporary = `${octopusBudgetFile}.tmp`;
    await writeFile(temporary, JSON.stringify({ nextAt }), { mode: 0o600 });
    await rename(temporary, octopusBudgetFile);
  }
});
const foxReadCache = new RequestBudget({ interval: 0 });
const tariffRestartCache = new TariffCache(path.join(stateRoot, 'public-tariff-cache.json'));
await tariffRestartCache.load();
const tariffDisplayCache = new TariffSnapshotCache(path.join(stateRoot, 'tariff-display-cache.json'));
let tariffRecoverySnapshot = null;
let foxCacheRevision = 0;
let foxReadbackUntil = 0;
let foxReadbackSerial = 0;
const responsePacket = async response => ({ fetchedAt: Date.now(), status: response.status, text: await response.text(),
  type: response.headers.get('content-type'), retryAfter: response.headers.get('retry-after') });
const unpackResponse = packet => new Response(packet.text, { status: packet.status,
  headers: { 'Content-Type': packet.type || 'application/json', 'X-Smart-Charging-Fetched-At': String(packet.fetchedAt), ...(packet.retryAfter ? { 'Retry-After': packet.retryAfter } : {}) } });
const cacheSuccessfulJson = packet => {
  try { const data = JSON.parse(packet.text); return packet.status === 200 && !data.errors && (data.errno === undefined || data.errno === 0); }
  catch { return false; }
};
// Bounded RAM trace. No URLs, credentials, request bodies, or account identifiers.
const octopusRequestTrace = [];
function traceOctopus(kind, source, startedAt, status = null) {
  octopusRequestTrace.push({kind,source,startedAt,finishedAt:Date.now(),status});
  if (octopusRequestTrace.length > 40) octopusRequestTrace.shift();
}
async function octopusFetch(key, target, options, ttl = 0) {
  serviceControl.assertEnabled();
  const publicTariff = key.startsWith('tariff:');
  const restored = publicTariff && tariffRestartCache.get(target.pathname);
  const kind = key.startsWith('tariff:') ? 'tariff' : key.startsWith('account:') ? 'account' : key.startsWith('auth:') ? 'authentication' : 'dispatch';
  if (restored) {traceOctopus(kind,'restart-cache',Date.now(),restored.status);return unpackResponse(restored);}
  const revision=serviceControl.revision;
  const packet = await octopusBudget.run(`${revision}:${key}`, async () => {
    serviceControl.assertEnabled(revision);
    const startedAt=Date.now();
    let result;
    try {result = await responsePacket(await fetch(target, { ...options, signal: AbortSignal.timeout(20_000) }));}
    catch(error){traceOctopus(kind,'network-error',startedAt);throw error;}
    traceOctopus(kind,'upstream',startedAt,result.status);
    let data;
    try { data = JSON.parse(result.text); } catch { /* Invalid upstream data remains an error. */ }
    const delay = retryDelay(unpackResponse(result), data);
    if (delay) await octopusBudget.defer(delay);
    if (publicTariff) await tariffRestartCache.put(target.pathname, result);
    return result;
  }, { ttl, cacheWhen: cacheSuccessfulJson });
  return unpackResponse(packet);
}


function isLoopback(request) {
  if (remoteRequests.has(request)) return false;
  // Native worker/settings callers use a loopback Host as well as a loopback
  // socket. A public proxy Host or DNS-rebound website is not native access.
  let hostname;
  try { hostname = new URL(`http://${request.headers.host || ''}`).hostname; } catch { return false; }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return false;
  const address = request.socket.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function isExplicitClientRequest(request) {
  try {
    const referer = new URL(String(request.headers.referer || ''));
    return referer.searchParams.get('client') === '1';
  } catch {
    return false;
  }
}

function isExplicitWorkerRequest(request) {
  if (request.headers['x-octopus-worker'] === '1') return true;
  try {
    const referer = new URL(String(request.headers.referer || ''));
    return referer.searchParams.get('worker') === '1';
  } catch {
    return false;
  }
}

function getLanUrls() {
  return Object.values(networkInterfaces())
    .flatMap(addresses => addresses || [])
    .filter(address => address.family === 'IPv4' && !address.internal)
    .map(address => `http://${address.address}:${port}`)
    .sort();
}

async function getAccessKey() {
  return (await readFile(accessKeyFile, 'utf8')).trim();
}

async function saveAccessKey(accessKey) {
  const normalized = String(accessKey || '').trim();
  if (normalized.length < 8 || normalized.length > 64 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw Object.assign(new Error('Access code must contain 8 to 64 printable characters'), { statusCode: 400 });
  }
  const temporaryPath = `${accessKeyFile}.tmp`;
  await writeFile(temporaryPath, `${normalized}\n`, { mode: 0o600 });
  await rename(temporaryPath, accessKeyFile);
  await chmod(accessKeyFile, 0o600);
  return normalized;
}

async function isLanAccessRequired() {
  const state = await loadState();
  return state.lanAccessRequired !== false;
}

async function isAuthorized(request) {
  if (remoteRequests.has(request)) {
    const remote = (await loadState()).remoteAccess;
    return Boolean(remote?.enabled && (
      matchesRemoteKey(request.headers['x-octopus-remote-key'], remote.key)
      || remoteSessions.valid(request, remote.key)
    ));
  }
  if (isLoopback(request) && !isExplicitClientRequest(request)) return true;
  if (!(await isLanAccessRequired())) return true;
  const expected = Buffer.from(await getAccessKey());
  const supplied = Buffer.from(String(request.headers['x-octopus-access-key'] || ''));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function sendJson(response, statusCode, body) {
  const payload = Buffer.from(JSON.stringify(body));
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(payload);
}

function sendEmpty(response, statusCode = 204) {
  response.writeHead(statusCode, { 'Cache-Control': 'no-store' });
  response.end();
}

const integrationFile = path.join(stateRoot, 'integration-status.json');
let savedIntegrationState;
try { savedIntegrationState = JSON.parse(await readFile(integrationFile, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') console.error('Saved integration alerts could not be loaded.'); }
let integrationHealth;
try { integrationHealth = new IntegrationState(savedIntegrationState); }
catch { integrationHealth = new IntegrationState(); }
let integrationSaveQueue = Promise.resolve();
let integrationStorageError = false;
let integrationLastSave = 0;
function saveIntegrationHealth(force = false) {
  if (!force && Date.now() - integrationLastSave < 60_000) return Promise.resolve();
  integrationLastSave = Date.now();
  const data = JSON.stringify(integrationHealth.data);
  const task = integrationSaveQueue.then(async () => {
    await writeFile(`${integrationFile}.tmp`, data, { mode: 0o600 });
    await rename(`${integrationFile}.tmp`, integrationFile);
    await chmod(integrationFile, 0o600);
    integrationStorageError = false;
  });
  integrationSaveQueue = task.catch(() => { integrationStorageError = true; });
  return task;
}
let integrationRefreshRequestId = 0;
let integrationWorker = null;
function integrationSnapshot() {
  if (integrationHealth.expireAlerts()) void saveIntegrationHealth(true).catch(() => {});
  return { ...integrationHealth.snapshot(), serviceEnabled:serviceControl.enabled, storageError: integrationStorageError, refreshRequestId: integrationRefreshRequestId, worker: integrationWorker,
    tariff:tariffTransportStatus(),octopusRequests:{activity:octopusBudget.activity,queued:octopusBudget.queue.length,nextAllowedAt:octopusBudget.nextAt,recent:octopusRequestTrace.slice()} }; }
function publicProblem(error) {
  const text = String(error?.message || error || '');
  const http = text.match(/HTTP (\d{3})/);
  if (http) return `Request failed (HTTP ${http[1]}).`;
  const code = text.match(/\((\d+)\)\s*$/);
  if (code) return `The service rejected the request (code ${code[1]}).`;
  if (/too many requests|rate.?limit|KT-CT-1199/i.test(text)) return 'The API rate limit was reached. Requests will retry after the cooldown.';
  if (/timed? ?out|timeout|abort/i.test(text)) return 'The service request timed out.';
  if (/auth|credential|token|API key/i.test(text)) return 'Authentication failed. Check the configured credentials.';
  return 'The service request failed. Check the connection and configuration.';
}
function markIntegrationSuccess(name, channel = 'api', at = new Date().toISOString()) {
  integrationStatus[name] = { ...integrationStatus[name], lastSuccessAt: at, lastError: null };
  const service = name === 'foxRest' ? 'foxess' : 'octopus';
  const previous = integrationHealth.service(service).channels;
  const recovered = previous[channel]?.ok === false || previous.api?.ok === false;
  integrationHealth.success(service, channel, at);
  integrationHealth.success(service, 'api', at);
  if (recovered) void saveIntegrationHealth(true).catch(() => {});
}
function markIntegrationError(name, error, channel = 'api') {
  integrationStatus[name] = { ...integrationStatus[name], lastErrorAt: new Date().toISOString(), lastError: String(error?.message || error || 'Connection failed').slice(0, 240) };
  const revision = integrationHealth.data.revision;
  integrationHealth.failure(name === 'foxRest' ? 'foxess' : 'octopus', channel, publicProblem(error));
  void saveIntegrationHealth(integrationHealth.data.revision !== revision).catch(() => {});
}

function publicIntegrationStatus(name, configured) {
  const current = integrationStatus[name];
  const hasCurrentError = current.lastErrorAt
    && (!current.lastSuccessAt || new Date(current.lastErrorAt) > new Date(current.lastSuccessAt));
  return {
    configured,
    state: !serviceControl.enabled ? 'disabled' : !configured ? 'not-configured' : (hasCurrentError ? 'error' : (current.lastSuccessAt ? 'ok' : 'waiting')),
    lastSuccessAt: current.lastSuccessAt,
    lastErrorAt: current.lastErrorAt,
    lastError: hasCurrentError ? current.lastError : null
  };
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const desktopEncryptionKey = globalThis.desktopEncryptionKey;
delete globalThis.desktopEncryptionKey;
const encryptionKeyPath = path.join(stateRoot, 'config.key');
const encryptedConfigPath = path.join(stateRoot, 'config.enc');

async function getEncryptionKey() {
  if (process.env.OCTOPUS_DESKTOP === '1') {
    if (!Buffer.isBuffer(desktopEncryptionKey) || desktopEncryptionKey.length !== 32) throw new Error('Desktop encrypted storage is unavailable');
    return desktopEncryptionKey;
  }
  try {
    const key = await readFile(encryptionKeyPath);
    if (key.length !== 32) throw new Error('Invalid configuration key');
    return key;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const key = randomBytes(32);
    await writeFile(encryptionKeyPath, key, { mode: 0o600, flag: 'wx' });
    await chmod(encryptionKeyPath, 0o600);
    return key;
  }
}

async function loadState() {
  try {
    const payload = JSON.parse(await readFile(encryptedConfigPath, 'utf8'));
    const key = await getEncryptionKey();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64')),
      decipher.final()
    ]);
    return JSON.parse(plaintext.toString('utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function saveState(state) {
  const key = await getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(state), 'utf8'),
    cipher.final()
  ]);
  const payload = JSON.stringify({
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: ciphertext.toString('base64')
  });
  const temporaryPath = `${encryptedConfigPath}.tmp`;
  await writeFile(temporaryPath, payload, { mode: 0o600 });
  await rename(temporaryPath, encryptedConfigPath);
  await chmod(encryptedConfigPath, 0o600);
}

function isLiveWsEnabled(state = {}) {
  if (typeof state.liveWsEnabled === 'boolean') return state.liveWsEnabled;
  return state.credentials?.foxLiveMode !== 'rest';
}

function getStoredLiveWsPolicy(state = {}) {
  if (liveWsPolicies.has(state.liveWsPolicy)) return state.liveWsPolicy;
  return state.liveWsOnDemand === false ? 'rest' : 'on-demand';
}

function getLiveWsPolicy(state = {}) {
  return isLiveWsEnabled(state) ? getStoredLiveWsPolicy(state) : 'rest';
}

function requestedLiveWsPolicy(value, fallback) {
  if (value === undefined) return fallback;
  if (!liveWsPolicies.has(value)) {
    throw Object.assign(new Error('Live WS policy must be on-demand, always, or rest'), { statusCode: 400 });
  }
  return value;
}

function getClientState(state) {
  const credentials = state.credentials || {};
  const liveWsPolicy = getLiveWsPolicy(state);
  const { remoteAccess, ...clientState } = state;
  return {
    ...clientState,
    serviceEnabled: serviceControl.enabled,
    liveWsEnabled: isLiveWsEnabled(state),
    liveWsPolicy,
    liveWsOnDemand: liveWsPolicy === 'on-demand',
    credentials: {
      acc: credentials.acc || '',
      api: credentials.api ? 'pi-managed' : '',
      foxSN: credentials.foxSN ? 'pi-managed' : '',
      foxToken: credentials.foxToken ? 'pi-managed' : '',
      foxLiveMode: credentials.foxLiveMode === 'rest' ? 'rest' : 'live-ws',
      foxWebUsername: credentials.foxWebUsername ? 'pi-managed' : '',
      foxWebPassword: credentials.foxWebPassword ? 'pi-managed' : '',
      gasUrl: '/api/foxess'
    }
  };
}

function normalizeDispatches(dispatches) {
  if (!Array.isArray(dispatches) || dispatches.length > 96) {
    throw Object.assign(new Error('Smart Dispatch data must be an array of at most 96 windows'), { statusCode: 400 });
  }
  return dispatches.map(dispatch => {
    const start = new Date(dispatch?.startDt);
    const end = new Date(dispatch?.endDt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      throw Object.assign(new Error('Invalid Smart Dispatch window'), { statusCode: 400 });
    }
    return { startDt: start.toISOString(), endDt: end.toISOString() };
  }).sort((a, b) => a.startDt.localeCompare(b.startDt) || a.endDt.localeCompare(b.endDt));
}

function dispatchFingerprint(dispatches) {
  return createHash('sha256').update(JSON.stringify(dispatches)).digest('hex');
}

function getDispatchSnapshot(state = {}) {
  const snapshot = state.dispatchSnapshot || {};
  return {
    dispatches: Array.isArray(snapshot.dispatches) ? snapshot.dispatches : [],
    fingerprint: snapshot.fingerprint || dispatchFingerprint([]),
    status: dispatchSyncStatuses.has(snapshot.status) ? snapshot.status : 'waiting',
    fetchedAt: snapshot.fetchedAt || null,
    updatedAt: snapshot.updatedAt || null,
    confirmedAt: snapshot.confirmedAt || null,
    scheduleFingerprint: snapshot.scheduleFingerprint || null,
    error: snapshot.error || null,
    revision: Number(snapshot.revision || 0)
  };
}

function relayUpstreamResponse(upstream, response) {
  return upstream.text().then(body => {
    response.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Smart-Charging-Fetched-At': upstream.headers.get('X-Smart-Charging-Fetched-At') || String(Date.now()),
      'X-Content-Type-Options': 'nosniff',
      ...(upstream.headers.get('retry-after') ? { 'Retry-After': upstream.headers.get('retry-after') } : {})
    });
    response.end(body);
  });
}

async function proxyFoxRequest(request, response) {
  serviceControl.assertEnabled();
  const payload = await readJsonBody(request);
  const target = new URL(payload.url);
  if (
    target.protocol !== 'https:' ||
    target.hostname !== allowedFoxHost ||
    !allowedFoxPaths.has(target.pathname)
  ) {
    return sendJson(response, 400, { errno: 998, msg: 'Only FoxESS Cloud API requests are allowed' });
  }
  const state = await loadState();
  const upstream = await requestFoxOpenApi(state, target.pathname, payload.body || {}, { readback: payload.readback === true });
  const upstreamData = await upstream.clone().json().catch(() => null);
  if (upstream.ok && upstreamData?.errno === 0) {
    markIntegrationSuccess('foxRest', target.pathname, new Date(Number(upstream.headers.get('X-Smart-Charging-Fetched-At')) || Date.now()).toISOString());
  } else {
    markIntegrationError('foxRest', `FoxESS REST rejected ${target.pathname} (${upstreamData?.errno ?? upstream.status})`, target.pathname);
  }
  return relayUpstreamResponse(upstream, response);
}

async function requestFoxOpenApi(state, pathname, requestedBody = {}, { readback = false } = {}) {
  serviceControl.assertEnabled();
  const controlRevision=serviceControl.revision;
  const foxSN = state.credentials?.foxSN;
  const foxToken = state.credentials?.foxToken;
  if (!foxSN || !foxToken) {
    throw Object.assign(
      new Error('Configure FoxESS in the Raspberry Pi Settings app first'),
      { statusCode: 409 }
    );
  }
  const timestamp = Date.now().toString();
  const signString = `${pathname}\\r\\n${foxToken}\\r\\n${timestamp}`;
  const body = { ...requestedBody };
  if (Object.hasOwn(body, 'sn')) body.sn = foxSN;
  if (Object.hasOwn(body, 'deviceSN')) body.deviceSN = foxSN;
  if (Array.isArray(body.variables)) body.variables = [...new Set(body.variables)].sort();
  const send = () => {
    serviceControl.assertEnabled(controlRevision);
    return fetch(`https://${allowedFoxHost}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      token: foxToken,
      timestamp,
      signature: createHash('md5').update(signString).digest('hex'),
      lang: 'en'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000)
    });
  };
  if (pathname === '/op/v3/device/scheduler/enable') {
    const upstream = await automationPause.runWrite(send);
    const result = await upstream.clone().json().catch(() => null);
    if (upstream.ok && result?.errno === 0) {
      foxCacheRevision++;
      foxReadCache.cache.clear();
      foxReadbackUntil = Date.now() + 30_000;
    }
    return upstream;
  }
  // Only scheduler verification just after a successful write bypasses the read cache.
  const fresh = readback && pathname === '/op/v3/device/scheduler/get' && Date.now() < foxReadbackUntil;
  const credentialScope = createHash('sha256').update(`${foxSN}:${foxToken}`).digest('hex');
  const cacheKey = JSON.stringify([credentialScope, foxCacheRevision, pathname, body, fresh ? ++foxReadbackSerial : 0]);
  const interval = Math.max(600, Number(state.automations?.refreshIntervals?.foxess) || 600) * 1000;
  const packet = await foxReadCache.run(cacheKey, async () => responsePacket(await send()),
    { ttl: fresh ? 0 : interval, errorTtl: fresh ? 0 : interval });
  return unpackResponse(packet);
}

async function foxOpenApiJson(state, pathname, body) {
  try {
    const upstream = await requestFoxOpenApi(state, pathname, body);
    const data = await upstream.json();
    if (!upstream.ok) throw new Error(`FoxESS Open API returned HTTP ${upstream.status}`);
    if (data.errno !== 0) {
      throw new Error(`FoxESS Open API rejected ${pathname} (${data.errno ?? 'unknown'})`);
    }
    const fetchedAt = Number(upstream.headers.get('X-Smart-Charging-Fetched-At')) || Date.now();
    markIntegrationSuccess('foxRest', pathname, new Date(fetchedAt).toISOString());
    return { ...data, _fetchedAt: fetchedAt };
  } catch (error) {
    if (error.statusCode !== 423) markIntegrationError('foxRest', error, pathname);
    throw error;
  }
}

async function proxyOctopusRequest(request, response) {
  serviceControl.assertEnabled();
  const payload = await readJsonBody(request);
  const target = new URL(payload.url);
  if (
    target.protocol !== 'https:' ||
    target.hostname !== allowedOctopusHost ||
    !target.pathname.startsWith('/v1/')
  ) {
    return sendJson(response, 400, { error: 'Only Octopus Energy API requests are allowed' });
  }

  const state = await loadState();
  const accountNumber = state.credentials?.acc;
  const apiKey = state.credentials?.api;
  if (!accountNumber || !apiKey) {
    markIntegrationError('octopus', 'Octopus Energy is not configured');
    return sendJson(response, 409, { error: 'Configure Octopus Energy in the Raspberry Pi Settings app first' });
  }

  let upstream;
  if (payload.authMode === 'graphql' && target.pathname === '/v1/graphql/') {
    const apiKeyFingerprint = createHash('sha256').update(apiKey).digest('hex');
    let token = octopusTokenCache.apiKeyFingerprint === apiKeyFingerprint
      && octopusTokenCache.expiresAt > Date.now()
      ? octopusTokenCache.token
      : null;
    if (!token) {
      if (!octopusAuthPromise || octopusAuthFingerprint !== apiKeyFingerprint) {
        octopusAuthFingerprint = apiKeyFingerprint;
        octopusAuthPromise = (async () => {
          const authResponse = await octopusFetch(`auth:${apiKeyFingerprint}`, target, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `mutation { obtainKrakenToken(input: { APIKey: ${JSON.stringify(apiKey)} }) { token } }` })
          });
          const authData = await authResponse.json();
          const nextToken = authData.data?.obtainKrakenToken?.token;
          if (!authResponse.ok || !nextToken) {
            throw Object.assign(new Error(authData.errors?.[0]?.message || `Octopus authentication returned HTTP ${authResponse.status}`),
              { statusCode: authResponse.ok ? 401 : authResponse.status });
          }
          markIntegrationSuccess('octopus', 'auth');
          octopusTokenCache = { apiKeyFingerprint, token: nextToken, expiresAt: Date.now() + 10 * 60_000 };
          return nextToken;
        })().finally(() => { octopusAuthPromise = null; });
      }
      token = await octopusAuthPromise;
    }
    // One combined read serves worker dispatches and dashboard metadata.
    // Dashboard clients still display the worker's authoritative dispatch snapshot.
    if (!/\bgetGoData\b/.test(payload.body?.query || '') || /\bmutation\b/.test(payload.body.query)) {
      return sendJson(response, 400, { error: 'Only dashboard data queries are supported' });
    }
    const body = { query: `query getGoData($acc: String!) {
      registeredKrakenflexDevice(accountNumber: $acc) { provider vehicleMake vehicleModel chargePointMake chargePointModel status }
      vehicleChargingPreferences(accountNumber: $acc) { weekdayTargetTime weekdayTargetSoc }
      plannedDispatches(accountNumber: $acc) { startDt endDt }
    }`, variables: { acc: accountNumber } };
    upstream = await octopusFetch(`dashboard:${apiKeyFingerprint}:${accountNumber}`, target, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token }, body: JSON.stringify(body)
    }, 60_000);
  } else if (payload.authMode === 'basic') {
    const expectedPath = `/v1/accounts/${encodeURIComponent(accountNumber)}/`;
    if (target.pathname !== expectedPath) {
      return sendJson(response, 400, { error: 'Only the configured Octopus account may be queried' });
    }
    upstream = await octopusFetch(`account:${createHash('sha256').update(apiKey).digest('hex')}:${accountNumber}`, target, {
      headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` }
    }, 30 * 60_000);
  } else if (payload.authMode === 'none' && /^\/v1\/products\/[^/]+\/electricity-tariffs\/[^/]+\/(standard|day|night)-unit-rates\/$/.test(target.pathname) && !target.search) {
    upstream = await octopusFetch(`tariff:${target.pathname}`, target, {}, 30 * 60_000);
  } else {
    markIntegrationError('octopus', 'Unsupported Octopus API request');
    return sendJson(response, 400, { error: 'Unsupported Octopus API request' });
  }

  const upstreamData = await upstream.clone().json().catch(() => null);
  const dispatchQuery = payload.authMode === 'graphql' && /\bplannedDispatches\b/.test(payload.body?.query || '');
  const channel = dispatchQuery ? 'dispatch-data' : 'account-data';
  const validData = payload.authMode !== 'graphql' || (upstreamData?.data && (!dispatchQuery || Array.isArray(upstreamData.data.plannedDispatches)));
  if (upstream.ok && !upstreamData?.errors && validData) {
    if (payload.authMode === 'graphql' && Array.isArray(upstreamData?.data?.plannedDispatches)) {
      octopusDisplaySnapshot = { accountNumber, apiKeyFingerprint:createHash('sha256').update(apiKey).digest('hex'),
        data:upstreamData.data, fetchedAt:Number(upstream.headers.get('X-Smart-Charging-Fetched-At')) || Date.now() };
    }
    markIntegrationSuccess('octopus', channel, new Date(Number(upstream.headers.get('X-Smart-Charging-Fetched-At')) || Date.now()).toISOString());
    if (payload.authMode === 'graphql') markIntegrationSuccess('octopus', 'auth');
  } else {
    markIntegrationError('octopus', upstreamData?.errors?.[0]?.message || `Octopus data request failed (HTTP ${upstream.status})`, channel);
  }
  return relayUpstreamResponse(upstream, response);
}

const foxessLive = new FoxessLiveTelemetry({
  loadState,
  foxOpenApiJson,
  fetchImpl: (url,options) => { serviceControl.assertEnabled(); return fetch(url,options); }
});
const history = new CompactHistory({ directory: path.join(stateRoot, 'history') });
let historyErrorReported = false;
// Expire records even when telemetry is unavailable and no dashboard is open.
const automationPause = new AutomationPause({ file: path.join(stateRoot, 'automation-pause.json'), onEvent: event => history.recordEvent(event) });
const pauseExpiryTimer = setInterval(() => { void automationPause.getState().catch(() => console.error('Pause state unavailable; schedule writes stay blocked.')); }, 5000);
pauseExpiryTimer.unref();
const cleanupHistory = () => history.cleanup().catch(() => {
  console.error('History cleanup could not finish; it will retry automatically.');
});
const historyCleanupTimer = setInterval(cleanupHistory, 60 * 60_000);
historyCleanupTimer.unref();
const historySaveTimer=setInterval(()=>{void history.flushIfDue().catch(()=>console.error('History batch save failed; buffered readings will retry.'));},60_000);
historySaveTimer.unref();
void cleanupHistory();

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

async function serveStatic(request, response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.posix.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(webRoot, normalized);
  if (!filePath.startsWith(webRoot)) return sendJson(response, 403, { error: 'Forbidden' });
  try {
    const details = await stat(filePath);
    if (!details.isFile()) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': details.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(response, 404, { error: 'Not found' });
    throw error;
  }
}

async function handleRequest(request, response) {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;
    if (remoteRequests.has(request)) {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Referrer-Policy', 'no-referrer');
      response.setHeader('X-Frame-Options', 'DENY');
      const remote = (await loadState()).remoteAccess;
      if (!remote?.enabled) return sendJson(response, 503, { error: 'Remote access is disabled' });
      const permitted = new Set(['/api/runtime', '/api/auth', '/api/logout', '/api/config', '/api/tariff-snapshot', '/api/dashboard-snapshot', '/api/dispatch-snapshot', '/api/foxess', '/api/octopus', '/api/foxess/live', '/api/foxess/live/status', '/api/history', '/api/history/settings', '/api/history/clear', '/api/automation/pause', '/api/integration-status']);
      if (pathname.startsWith('/api/') && !permitted.has(pathname)) return sendJson(response, 403, { error: 'This endpoint is only available on the Raspberry Pi' });
      if (!['GET', 'HEAD'].includes(request.method)) {
        const origin = request.headers.origin;
        if (request.headers['sec-fetch-site'] === 'cross-site' || (origin && origin !== `https://${request.headers.host}`)) {
          return sendJson(response, 403, { error: 'Cross-site request rejected' });
        }
      }
      if (pathname.startsWith('/api/') && !['/api/runtime', '/api/auth'].includes(pathname) && !(await isAuthorized(request))) {
        return sendJson(response, 401, { error: 'Remote access key or session required' });
      }
      if (pathname === '/api/logout' && request.method === 'POST') {
        remoteSessions.revoke(request);
        response.setHeader('Set-Cookie', `${remoteCookie}=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
        return sendEmpty(response);
      }
      if (pathname === '/api/auth' && request.method === 'POST') {
        if (remoteSessions.valid(request, remote.key)) return sendEmpty(response);
        if (remoteSessions.limited()) return sendJson(response, 429, { error: 'Too many attempts. Wait one minute.' });
        if (!matchesRemoteKey(request.headers['x-octopus-remote-key'], remote.key)) {
          remoteSessions.fail();
          return sendJson(response, 401, { error: 'Invalid remote access key' });
        }
        const session = remoteSessions.issue(remote.key);
        response.setHeader('Set-Cookie', `${remoteCookie}=${session}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
        return sendEmpty(response);
      }
    }
    if (pathname === '/api/service-control') {
      if (!isLoopback(request)) return sendJson(response,403,{error:'Service control is available in local Pi Configuration only'});
      if (request.method === 'GET') return sendJson(response,200,serviceControl.snapshot());
      if (request.method !== 'PUT') return sendJson(response,405,{error:'Use GET or PUT'});
      if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) return sendJson(response,403,{error:'Cross-site request rejected'});
      const update=await readJsonBody(request);
      if (!update || Object.keys(update).length!==1 || typeof update.enabled!=='boolean') return sendJson(response,400,{error:'Specify enabled as true or false'});
      const previous=serviceControl.enabled;
      const control=await serviceControl.change(update.enabled);
      if (!control.enabled) foxessLive.stop();
      else if (!previous) { if (!desktopHost) await octopusBudget.defer(60_000); foxessLive.start(); }
      if(previous!==control.enabled){
        foxReadCache.cache.clear();foxCacheRevision++;
        await history.recordEvent({type:control.enabled?'service_enabled':'service_disabled',at:new Date().toISOString(),revision:control.revision});
      }
      return sendJson(response,200,control);
    }
    if (pathname === '/api/remote-access' || pathname === '/api/lan-remote-access') {
      const lanManagement = pathname === '/api/lan-remote-access';
      if (lanManagement) {
        // Never trust forwarded headers, loopback bypasses, or a remote session here.
        const hostname = requestUrl.hostname;
        const address=String(request.socket.remoteAddress || '').replace(/^::ffff:/,'');
        const privateAddress=/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address)
          || address==='::1' || /^(f[cd][0-9a-f]{2}:|fe80:)/i.test(address);
        const localHosts = new Set(['localhost','127.0.0.1','[::1]',...Object.values(networkInterfaces()).flat().filter(Boolean).map(item=>item.address)]);
        if (remoteRequests.has(request) || !privateAddress || !localHosts.has(hostname) || !(await isLanAccessRequired())) {
          return sendJson(response,403,{error:'Enable LAN access-code protection in host Configuration first. Cloudflare clients cannot manage remote access.'});
        }
        if (request.headers['sec-fetch-site'] === 'cross-site' || request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) return sendJson(response,403,{error:'Cross-site request rejected'});
        if (lanManagementAttempts.limited()) return sendJson(response,429,{error:'Too many attempts. Wait one minute.'});
        if (!matchesRemoteKey(request.headers['x-octopus-access-key'],await getAccessKey())) {
          lanManagementAttempts.fail();return sendJson(response,401,{error:'Enter the LAN access code to manage remote access.'});
        }
      } else if (!isLoopback(request)) return sendJson(response, 403, { error: 'Remote access is managed on the Raspberry Pi only' });
      let state = await loadState();
      if (request.method === 'PUT') {
        const update = await readJsonBody(request);
        if (!update || Array.isArray(update) || Object.keys(update).some(key => !['enabled', 'rotateKey', 'renewUrl'].includes(key))
            || typeof update.enabled !== 'boolean' || ['rotateKey','renewUrl'].some(key => key in update && typeof update[key] !== 'boolean')
            || update.renewUrl && (!update.enabled || update.rotateKey)) return sendJson(response,400,{error:'Invalid remote access update'});
        if (request.headers['sec-fetch-site'] === 'cross-site' || request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) return sendJson(response,403,{error:'Cross-site request rejected'});
        const remoteAccess = { enabled: update.enabled === true, key: state.remoteAccess?.key || createRemoteKey() };
        if (update.rotateKey === true) remoteAccess.key = createRemoteKey();
        state = { ...state, remoteAccess };
        await saveState(state);
        if (update.rotateKey || !remoteAccess.enabled) remoteSessions.clear();
        if (update.renewUrl) quickTunnel.restart();
        else if (remoteAccess.enabled) quickTunnel.start(); else quickTunnel.stop();
      }
      if (['GET', 'PUT'].includes(request.method)) return sendJson(response, 200, { enabled: state.remoteAccess?.enabled === true,
        ...(!lanManagement || request.method === 'GET' && requestUrl.searchParams.get('reveal') === '1' ? {key:state.remoteAccess?.key || ''} : {}), ...quickTunnel.status });
      return sendJson(response, 405, { error: 'Method not allowed' });
    }

    if (request.method === 'GET' && pathname === '/api/health') {
      return sendJson(response, 200, {
        status: 'ok',
        version,
        foxessTelemetry: foxessLive.getPublicStatus()
      });
    }
    if (request.method === 'GET' && pathname === '/api/service-status') {
      if (!isLoopback(request)) {
        return sendJson(response, 403, { error: 'Server status details are only available on the Raspberry Pi' });
      }
      const state = await loadState();
      const credentials = state.credentials || {};
      return sendJson(response, 200, {
        status: 'ok',
        serviceEnabled: serviceControl.enabled,
        version,
        lanUrls: getLanUrls(),
        accessRequired: state.lanAccessRequired !== false,
        octopus: publicIntegrationStatus('octopus', Boolean(credentials.acc && credentials.api)),
        foxRest: publicIntegrationStatus('foxRest', Boolean(credentials.foxSN && credentials.foxToken)),
        foxLive: foxessLive.getPublicStatus()
      });
    }
    if (request.method === 'GET' && pathname === '/api/runtime') {
      const remote = remoteRequests.has(request);
      const workerRequested = !remote && requestUrl.searchParams.get('worker') === '1';
      const clientRequested = requestUrl.searchParams.get('client') === '1';
      const localConfiguration = isLoopback(request) && !clientRequested && !workerRequested;
      const accessRequired = remote || await isLanAccessRequired();
      const role = workerRequested && isLoopback(request) ? 'worker' : 'dashboard';
      return sendJson(response, 200, {
        mode: 'linux',
        hostPlatform: process.env.OCTOPUS_DESKTOP === '1' ? 'desktop' : 'pi',
        version,
        role,
        localConfiguration,
        accessRequired,
        authRequired: remote ? !(await isAuthorized(request)) : accessRequired && role !== 'worker' && !localConfiguration
          && !(process.env.OCTOPUS_DESKTOP === '1' && isLoopback(request) && request.headers['x-octopus-access-key'] === await getAccessKey()),
        remoteAccess: remote,
        lanRemoteManagement: !remote && accessRequired,
        lanUrls: remote ? [] : getLanUrls()
      });
    }
    if (request.method === 'POST' && pathname === '/api/auth') {
      return (await isAuthorized(request))
        ? sendEmpty(response)
        : sendJson(response, 401, { error: 'Invalid LAN access code' });
    }
    if (pathname === '/api/access-key') {
      if (!isLoopback(request)) {
        return sendJson(response, 403, { error: 'The access code can only be managed from the Raspberry Pi' });
      }
      if (request.method === 'GET') {
        return sendJson(response, 200, {
          accessKey: await getAccessKey(),
          accessRequired: await isLanAccessRequired()
        });
      }
      if (request.method === 'PUT') {
        const body = await readJsonBody(request);
        return sendJson(response, 200, { saved: true, accessKey: await saveAccessKey(body.accessKey) });
      }
    }
    if (pathname === '/api/native-config') {
      if (!isLoopback(request)) {
        return sendJson(response, 403, { error: 'Server configuration is only available on the Raspberry Pi' });
      }
      if (request.method === 'GET') {
        const state = await loadState();
        const liveWsPolicy = getLiveWsPolicy(state);
        return sendJson(response, 200, {
          serviceEnabled: serviceControl.enabled,
          accessRequired: state.lanAccessRequired !== false,
          accessKey: await getAccessKey(),
          liveWsEnabled: isLiveWsEnabled(state),
          liveWsPolicy,
          credentials: {
            acc: state.credentials?.acc || '',
            api: state.credentials?.api || '',
            foxSN: state.credentials?.foxSN || '',
            foxToken: state.credentials?.foxToken || '',
            foxLiveMode: state.credentials?.foxLiveMode === 'rest' ? 'rest' : 'live-ws',
            foxWebUsername: state.credentials?.foxWebUsername || '',
            foxWebPassword: state.credentials?.foxWebPassword || '',
            gasUrl: '/api/foxess'
          }
        });
      }
      if (request.method === 'PUT') {
        const update = await readJsonBody(request);
        const accessRequired = update.accessRequired !== false;
        if (accessRequired) await saveAccessKey(update.accessKey);
        const current = await loadState();
        const supplied = update.credentials || {};
        const liveWsEnabled = typeof update.liveWsEnabled === 'boolean'
          ? update.liveWsEnabled
          : supplied.foxLiveMode !== 'rest';
        const liveWsPolicy = getStoredLiveWsPolicy(current);
        const credentials = {
          acc: String(supplied.acc || '').trim(),
          api: String(supplied.api || '').trim(),
          foxSN: String(supplied.foxSN || '').trim(),
          foxToken: String(supplied.foxToken || '').trim(),
          foxLiveMode: liveWsEnabled ? 'live-ws' : 'rest',
          foxWebUsername: String(supplied.foxWebUsername || '').trim(),
          foxWebPassword: String(supplied.foxWebPassword || ''),
          gasUrl: '/api/foxess'
        };
        const next = {
          ...current,
          lanAccessRequired: accessRequired,
          liveWsEnabled,
          liveWsPolicy,
          liveWsOnDemand: liveWsPolicy === 'on-demand',
          credentials,
          revision: Date.now()
        };
        await saveState(next);
        if(serviceControl.enabled) void foxessLive.reconcile({ force: true });
        return sendJson(response, 200, {
          saved: true,
          revision: next.revision,
          accessRequired
        });
      }
    }
    if (pathname === '/api/live-demand' && request.method === 'POST') {
      if (!isLoopback(request) || !isExplicitWorkerRequest(request)) {
        return sendJson(response, 403, { error: 'Live WS demand can only be updated by the Raspberry Pi worker' });
      }
      const update = await readJsonBody(request);
      const current = await loadState();
      const active = update.active === true;
      const startsAt = active && update.startsAt ? new Date(update.startsAt) : null;
      const endsAt = active && update.endsAt ? new Date(update.endsAt) : null;
      if (active && (
        !Number.isFinite(startsAt?.getTime())
        || !Number.isFinite(endsAt?.getTime())
        || endsAt <= startsAt
      )) {
        return sendJson(response, 400, { error: 'Invalid dynamic charge window' });
      }
      const next = {
        ...current,
        liveWsDemandActive: active,
        liveWsDemandStartsAt: startsAt?.toISOString() || null,
        liveWsDemandEndsAt: endsAt?.toISOString() || null,
        revision: Date.now()
      };
      await saveState(next);
      if(serviceControl.enabled) void foxessLive.reconcile({ force: true });
      return sendJson(response, 200, {
        saved: true,
        active,
        startsAt: next.liveWsDemandStartsAt,
        endsAt: next.liveWsDemandEndsAt
      });
    }

    const protectedApi = ['/api/config', '/api/tariff-snapshot', '/api/dashboard-snapshot', '/api/dispatch-snapshot', '/api/foxess', '/api/octopus', '/api/history'];
    const isProtected = pathname === '/api/integration-status' || pathname === '/api/automation/pause' || protectedApi.includes(pathname) || pathname === '/api/history/settings' || pathname === '/api/history/clear' || pathname.startsWith('/api/foxess/live');
    if (isProtected && !(await isAuthorized(request))) {
      return sendJson(response, 401, { error: 'Invalid LAN access code' });
    }

    if (pathname === '/api/config' && request.method === 'GET') {
      const state = await loadState();
      return sendJson(response, 200, { ...getClientState(state), automationPause: await automationPause.getState() });
    }
    if (pathname === '/api/config' && request.method === 'PUT') {
      const update = await readJsonBody(request);
      if (Object.hasOwn(update, 'credentials')) {
        return sendJson(response, 403, { error: 'Service credentials can only be changed from the Raspberry Pi Settings app' });
      }
      if (Object.hasOwn(update, 'liveWsEnabled')) {
        return sendJson(response, 403, { error: 'Live WS availability can only be changed from the Raspberry Pi Settings app' });
      }
      const allowedUpdates = new Set(['automations', 'liveWsPolicy', 'liveWsOnDemand']);
      if (Object.keys(update).some(key => !allowedUpdates.has(key))) {
        return sendJson(response, 403, { error: 'Only dashboard preferences may be changed here' });
      }
      const intervals = update.automations?.refreshIntervals;
      if (intervals && (Object.entries(intervals).some(([name, value]) => !['octopus', 'foxess'].includes(name) || !Number.isInteger(value) || value < (name === 'octopus' ? 60 : 600) || value > 86400))) {
        return sendJson(response, 400, { error: 'Minimum intervals: Octopus 60 seconds. FoxESS 600 seconds.' });
      }
      const current = await loadState();
      const requestedPolicy = update.liveWsPolicy ?? (
        Object.hasOwn(update, 'liveWsOnDemand')
          ? (update.liveWsOnDemand === false ? 'rest' : 'on-demand')
          : undefined
      );
      const liveWsPolicy = requestedLiveWsPolicy(requestedPolicy, getLiveWsPolicy(current));
      if (liveWsPolicy !== 'rest' && !isLiveWsEnabled(current)) {
        return sendJson(response, 409, { error: 'Enable Live WS in Raspberry Pi Server Configuration first' });
      }
      const next = {
        ...current,
        ...update,
        liveWsPolicy,
        liveWsOnDemand: liveWsPolicy === 'on-demand',
        revision: Date.now()
      };
      await saveState(next);
      if(serviceControl.enabled) void foxessLive.reconcile({ force: true });
      return sendJson(response, 200, { saved: true, revision: next.revision });
    }
    if (pathname === '/api/config' && request.method === 'DELETE') {
      if (!isLoopback(request)) {
        return sendJson(response, 403, { error: 'Service configuration can only be wiped from the Raspberry Pi Settings app' });
      }
      await saveState({ revision: Date.now() });
      if(serviceControl.enabled) void foxessLive.reconcile({ force: true });
      return sendEmpty(response);
    }
    if (pathname === '/api/tariff-snapshot' && request.method === 'GET') {
      const state = await loadState();
      const identity = createHash('sha256').update(JSON.stringify(state.credentials || {})).digest('hex');
      let payload = tariffDisplaySnapshot?.identity === identity ? tariffDisplaySnapshot.payload : null;
      if (tariffRecoverySnapshot && !tariffDisplayCache.clean(tariffRecoverySnapshot.identity,tariffRecoverySnapshot.payload)) tariffRecoverySnapshot=null;
      if ((!payload?.state || payload.pending || payload.problem) && tariffRecoverySnapshot?.identity === identity) {
        const previous = tariffRecoverySnapshot.payload.state;
        const current = payload?.state;
        payload = {...payload,pending:payload?.pending ?? true,cached:true,state:{...previous,...current,
          importRates:current?.importRates?.length ? current.importRates : !current || current.importTariffCode===previous.importTariffCode ? previous.importRates : [],
          exportRates:current?.exportRates?.length ? current.exportRates : !current || current.exportTariffCode===previous.exportTariffCode ? previous.exportRates : [],
          updatedAt:previous.updatedAt}};
      }
      return sendJson(response, 200, payload
        ? {...payload,transport:{...tariffTransportStatus(),servedAt:Date.now()}}
        : { pending:true, state:null,transport:{hostInstance,revision:0,servedAt:Date.now()} });
    }
    if (pathname === '/api/tariff-snapshot' && request.method === 'POST') {
      if (!isLoopback(request) || !isExplicitWorkerRequest(request)) return sendJson(response,403,{error:'Only the worker can publish tariffs'});
      const update = await readJsonBody(request);
      const source = update.state;
      const rates = values => Array.isArray(values) && values.length <= 500 && values.every(row =>
        Number.isFinite(row.value_inc_vat) && (!row.valid_from || Number.isFinite(Date.parse(row.valid_from)))
        && (!row.valid_to || Number.isFinite(Date.parse(row.valid_to))));
      if (!source && update.problem === true) {
        const state = await loadState();
        tariffDisplaySnapshot = {revision:++tariffSnapshotRevision,publishedAt:Date.now(),identity:createHash('sha256').update(JSON.stringify(state.credentials || {})).digest('hex'),
          payload:{pending:false,problem:true,state:null}};
        return sendJson(response,200,{saved:true});
      }
      if (!source || !rates(source.importRates) || !rates(source.exportRates)) return sendJson(response,400,{error:'Invalid tariff snapshot'});
      const cleanRates = values => values.map(row => ({value_inc_vat:row.value_inc_vat,valid_from:row.valid_from || null,valid_to:row.valid_to || null}));
      const code = value => typeof value === 'string' && /^[A-Za-z0-9 -]{1,100}$/.test(value) ? value : 'Not available';
      const state = await loadState();
      tariffDisplaySnapshot = {revision:++tariffSnapshotRevision,publishedAt:Date.now(),identity:createHash('sha256').update(JSON.stringify(state.credentials || {})).digest('hex'),payload:{
        pending:update.pending === true, problem:update.problem === true, progress:Math.min(2,Math.max(0,Number(update.progress)||0)),
        state:{importTariffCode:code(source.importTariffCode),exportTariffCode:code(source.exportTariffCode),
          importRates:cleanRates(source.importRates),exportRates:cleanRates(source.exportRates),
          minRate:Number.isFinite(source.minRate)?source.minRate:null,maxRate:Number.isFinite(source.maxRate)?source.maxRate:null,
          updatedAt:Number.isFinite(source.updatedAt)?source.updatedAt:null}}};
      if (!tariffDisplaySnapshot.payload.pending && !tariffDisplaySnapshot.payload.problem) {
        tariffRecoverySnapshot = tariffDisplayCache.clean(tariffDisplaySnapshot.identity,tariffDisplaySnapshot.payload);
        void tariffDisplayCache.put(tariffDisplaySnapshot.identity,tariffDisplaySnapshot.payload);
      }
      return sendJson(response,200,{saved:true});
    }
    if (pathname === '/api/dashboard-snapshot' && request.method === 'GET') {
      // Opening a dashboard never authenticates with Octopus or consumes a queue slot.
      const state = await loadState();
      const identity = createHash('sha256').update(state.credentials?.api || '').digest('hex');
      const snapshot = octopusDisplaySnapshot?.accountNumber === state.credentials?.acc
        && octopusDisplaySnapshot.apiKeyFingerprint === identity ? octopusDisplaySnapshot : null;
      return sendJson(response, 200, { data:snapshot?.data || {
        registeredKrakenflexDevice:null, vehicleChargingPreferences:null,
        plannedDispatches:getDispatchSnapshot(state).dispatches
      }, _serverSnapshot:{pending:!snapshot,fetchedAt:snapshot?.fetchedAt || null} });
    }
    if (pathname === '/api/dispatch-snapshot' && request.method === 'GET') {
      return sendJson(response, 200, getDispatchSnapshot(await loadState()));
    }
    if (pathname === '/api/dispatch-snapshot' && request.method === 'POST') {
      if (!isLoopback(request) || !isExplicitWorkerRequest(request)) {
        return sendJson(response, 403, { error: 'Smart Dispatch state can only be updated by the Raspberry Pi worker' });
      }
      const update = await readJsonBody(request);
      if (!dispatchSyncStatuses.has(update.status)) {
        return sendJson(response, 400, { error: 'Invalid Smart Dispatch synchronization state' });
      }
      const dispatches = normalizeDispatches(update.dispatches || []);
      const fingerprint = dispatchFingerprint(dispatches);
      const current = await loadState();
      const previous = getDispatchSnapshot(current);

      // A slower FoxESS confirmation must never overwrite a newer Octopus
      // schedule that arrived while the earlier scheduler write was in flight.
      if (['confirmed', 'failed'].includes(update.status) && previous.fingerprint !== fingerprint) {
        return sendJson(response, 409, {
          error: 'Stale Smart Dispatch synchronization result',
          currentFingerprint: previous.fingerprint
        });
      }

      const scheduleFingerprint = String(update.scheduleFingerprint || '').slice(0, 2048) || null;
      const error = update.status === 'failed'
        ? String(update.error || 'FoxESS did not confirm the Smart Dispatch schedule').slice(0, 240)
        : null;
      const unchanged = previous.fingerprint === fingerprint
        && previous.status === update.status
        && previous.scheduleFingerprint === scheduleFingerprint
        && previous.error === error;
      if (unchanged) return sendJson(response, 200, { saved: false, ...previous });

      const now = new Date().toISOString();
      const fetchedAt = previous.fingerprint === fingerprint && previous.fetchedAt
        ? previous.fetchedAt
        : (Number.isFinite(new Date(update.fetchedAt).getTime()) ? new Date(update.fetchedAt).toISOString() : now);
      const snapshot = {
        dispatches,
        fingerprint,
        status: update.status,
        fetchedAt,
        updatedAt: now,
        confirmedAt: update.status === 'confirmed' ? now : null,
        scheduleFingerprint,
        error,
        revision: Date.now()
      };
      await saveState({ ...current, dispatchSnapshot: snapshot });
      if (snapshot.status === 'failed') markIntegrationError('foxRest', 'The Pi worker schedule was not confirmed.', 'schedule-confirmation');
      if (['confirmed', 'disabled'].includes(snapshot.status)) markIntegrationSuccess('foxRest', 'schedule-confirmation');
      return sendJson(response, 200, { saved: true, ...snapshot });
    }
    if (pathname === '/api/octopus' && request.method === 'POST') {
      try {
        return await proxyOctopusRequest(request, response);
      } catch (error) {
        if(error.statusCode!==423) markIntegrationError('octopus', error);
        throw error;
      }
    }
    if (pathname === '/api/foxess' && request.method === 'POST') {
      try {
        return await proxyFoxRequest(request, response);
      } catch (error) {
        if (error.statusCode !== 423) markIntegrationError('foxRest', error);
        throw error;
      }
    }
    if (pathname === '/api/foxess/live/status' && request.method === 'GET') {
      if(serviceControl.enabled) await foxessLive.reconcile();
      return sendJson(response, 200, serviceControl.enabled ? foxessLive.getPublicStatus() : { ...foxessLive.getPublicStatus(), state:'disabled', source:'disabled' });
    }
    if (pathname === '/api/foxess/live' && request.method === 'GET') {
      serviceControl.assertEnabled();
      const telemetry = await foxessLive.getTelemetry({ forceRest: requestUrl.searchParams.get('refresh') === '1' });
      // Reuse the worker's existing readings. History must not add API calls or
      // prevent live telemetry/automation if the storage device is unavailable.
      void history.record(telemetry).then(() => { historyErrorReported = false; }).catch(() => {
        if (!historyErrorReported) console.error('History storage unavailable; live automation continues.');
        historyErrorReported = true;
      });
      return sendJson(response, 200, telemetry);
    }
    if (pathname === '/api/history') {
      if (request.method !== 'GET') return sendJson(response, 405, { error: 'History is read-only' });
      return sendJson(response, 200, await history.readMonth(requestUrl.searchParams.get('month') || undefined));
    }
    if (pathname === '/api/integration-status') {
      if (request.method === 'GET') return sendJson(response, 200, integrationSnapshot());
      if (request.method === 'POST') {
        if (!isLoopback(request) || !isExplicitWorkerRequest(request)) return sendJson(response, 403, {error:'Only the Pi worker can publish refresh timing'});
        const update = await readJsonBody(request);
        const fields = ['requestSeen','octopusNextAt','foxessNextAt','octopusBusy','foxessBusy'];
        if (!update || Object.keys(update).some(key=>!fields.includes(key)) || !Number.isSafeInteger(update.requestSeen)
            || update.requestSeen < 0 || typeof update.octopusBusy !== 'boolean' || typeof update.foxessBusy !== 'boolean'
            || !['octopusNextAt','foxessNextAt'].every(key=>update[key]===null || (Number.isFinite(update[key]) && update[key] > 0 && update[key] < Date.now() + 86400_000))) return sendJson(response,400,{error:'Invalid worker timing'});
        integrationWorker = { ...update, updatedAt: Date.now() };
        return sendJson(response,200,integrationSnapshot());
      }
      if (request.method !== 'PUT') return sendJson(response, 405, { error: 'Use GET or PUT for integration status' });
      const expectedOrigin = `${remoteRequests.has(request) ? 'https' : 'http'}://${request.headers.host}`;
      if (request.headers['sec-fetch-site'] === 'cross-site' || (request.headers.origin && request.headers.origin !== expectedOrigin)) return sendJson(response, 403, { error: 'Cross-site request rejected' });
      const update = await readJsonBody(request);
      if (update && Object.keys(update).length === 1 && update.action === 'refresh') {
        integrationRefreshRequestId = Math.max(Date.now(), integrationRefreshRequestId + 1);
        return sendJson(response,202,integrationSnapshot());
      }
      if (update && Object.keys(update).length === 2 && update.action === 'settings') {
        const previous = structuredClone(integrationHealth.data);
        integrationHealth.setAutoClearHours(update.autoClearHours);
        try { await saveIntegrationHealth(true); } catch (error) { integrationHealth.data = previous; throw error; }
        return sendJson(response,200,integrationSnapshot());
      }
      if (!update || Array.isArray(update) || Object.keys(update).length !== 2 || !Object.hasOwn(update, 'service') || !Number.isSafeInteger(update.alertId)) return sendJson(response, 400, { error: 'Specify service and alertId' });
      const previous = structuredClone(integrationHealth.data);
      integrationHealth.acknowledge(update.service, update.alertId);
      try { await saveIntegrationHealth(true); }
      catch (error) { if(integrationHealth.data.revision === previous.revision) integrationHealth.data = previous; throw error; }
      return sendJson(response, 200, integrationSnapshot());
    }
    if (pathname === '/api/automation/pause') {
      if (request.method === 'GET') return sendJson(response, 200, await automationPause.getState());
      if (request.method !== 'PUT') return sendJson(response, 405, { error: 'Use GET or PUT for pause control' });
      const expectedOrigin = `${remoteRequests.has(request) ? 'https' : 'http'}://${request.headers.host}`;
      if (request.headers['sec-fetch-site'] === 'cross-site' || (request.headers.origin && request.headers.origin !== expectedOrigin)) {
        return sendJson(response, 403, { error: 'Cross-site request rejected' });
      }
      return sendJson(response, 200, await automationPause.update(await readJsonBody(request)));
    }
    if (pathname === '/api/history/clear') {
      if(request.method!=='POST')return sendJson(response,405,{error:'Use POST to clear history'});
      const expectedOrigin=`${remoteRequests.has(request)?'https':'http'}://${request.headers.host}`;
      if(request.headers['sec-fetch-site']==='cross-site' || (request.headers.origin && request.headers.origin!==expectedOrigin))return sendJson(response,403,{error:'Cross-site request rejected'});
      const update=await readJsonBody(request);
      if(!update || Object.keys(update).length!==1 || update.action!=='clear')return sendJson(response,400,{error:'Specify the clear action'});
      return sendJson(response,200,{cleared:true,...await history.clearAll()});
    }
    if (pathname === '/api/history/settings') {
      if (request.method === 'GET') return sendJson(response, 200, await history.getSettings());
      if (request.method !== 'PUT') return sendJson(response, 405, { error: 'Use GET or PUT for history settings' });
      const expectedOrigin = `${remoteRequests.has(request) ? 'https' : 'http'}://${request.headers.host}`;
      if (request.headers['sec-fetch-site'] === 'cross-site' || (request.headers.origin && request.headers.origin !== expectedOrigin)) {
        return sendJson(response, 403, { error: 'Cross-site request rejected' });
      }
      const update = await readJsonBody(request);
      if (!update || Array.isArray(update) || Object.keys(update).length === 0 || Object.keys(update).some(key=>!['retentionMonths','saveIntervalMinutes'].includes(key))) {
        return sendJson(response, 400, { error: 'Specify retentionMonths or saveIntervalMinutes' });
      }
      const settings = await history.setSettings(update);
      return sendJson(response, settings.cleanupPending ? 202 : 200, { saved: true, ...settings });
    }
    if (pathname === '/api/foxess/live/test' && request.method === 'POST') {
      if (!isLoopback(request)) {
        return sendJson(response, 403, { error: 'FoxESS live self-test can only run from the Raspberry Pi Settings app' });
      }
      serviceControl.assertEnabled();
      return sendJson(response, 200, await foxessLive.selfTest());
    }
    if (pathname.startsWith('/api/')) {
      return sendJson(response, 404, { error: 'Unknown API endpoint' });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return sendJson(response, 405, { error: 'Method not allowed' });
    }
    return await serveStatic(request, response, pathname);
  } catch (error) {
    if(error.statusCode!==423) console.error(new Date().toISOString(), error);
    const status = error.statusCode || (error instanceof SyntaxError ? 400 : 500);
    return sendJson(response, status, {
      error: status >= 400 && status < 500
        ? (error.message || 'Invalid request')
        : 'Local server error'
    });
  }
}

tariffRecoverySnapshot = await tariffDisplayCache.load(createHash('sha256').update(JSON.stringify((await loadState()).credentials || {})).digest('hex'));
const server = http.createServer(handleRequest);
const remoteServer = http.createServer((request, response) => {
  remoteRequests.add(request);
  void handleRequest(request, response);
});
remoteServer.listen(remotePort, '127.0.0.1', async () => {
  if ((await loadState()).remoteAccess?.enabled) quickTunnel.start();
});
remoteServer.on('error', error => {
  quickTunnel.stop();
  console.error('Remote listener failed:', error.message);
  // A failed remote listener must never redirect the tunnel to the admin port.
});

server.listen(port, host, () => {
  console.log(`Octopus FoxESS Linux server v${version} listening on ${host}:${port}`);
  if(serviceControl.enabled) foxessLive.start();
});

let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(historyCleanupTimer);
    clearInterval(historySaveTimer);
    clearInterval(pauseExpiryTimer);
    foxessLive.stop();
    quickTunnel.stop();
    // Flush before closing clients. An Octopus queue can contain long waits.
    await history.close().catch(() => {});
    await integrationSaveQueue;
    server.closeAllConnections();
    remoteServer.closeAllConnections();
    server.close();
    remoteServer.close();
    process.exit(0);
  });
}
