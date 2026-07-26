import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const webRoot = process.env.OCTOPUS_WEB_ROOT || path.join(appRoot, 'web');
const stateRoot = process.env.OCTOPUS_STATE_DIR || '/var/lib/octopus-foxess';
const accessKeyFile = process.env.OCTOPUS_ACCESS_KEY_FILE || path.join(stateRoot, 'access.key');
const host = process.env.OCTOPUS_HOST || '0.0.0.0';
const port = Number(process.env.OCTOPUS_PORT || 8787);
const maxBodyBytes = 128 * 1024;
const allowedFoxHost = 'www.foxesscloud.com';
const allowedOctopusHost = 'api.octopus.energy';
const allowedFoxPaths = new Set([
  '/op/v0/device/real/query',
  '/op/v0/device/setting/get',
  '/op/v3/device/scheduler/enable',
  '/op/v3/device/scheduler/get'
]);
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

function isLoopback(request) {
  const address = request.socket.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
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
    throw Object.assign(new Error('Access key must contain 8 to 64 printable characters'), { statusCode: 400 });
  }
  const temporaryPath = `${accessKeyFile}.tmp`;
  await writeFile(temporaryPath, `${normalized}\n`, { mode: 0o600 });
  await rename(temporaryPath, accessKeyFile);
  await chmod(accessKeyFile, 0o600);
  return normalized;
}

async function isAuthorized(request) {
  if (isLoopback(request)) return true;
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

const encryptionKeyPath = path.join(stateRoot, 'config.key');
const encryptedConfigPath = path.join(stateRoot, 'config.enc');

async function getEncryptionKey() {
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

function getClientState(state) {
  const credentials = state.credentials || {};
  return {
    ...state,
    credentials: {
      acc: credentials.acc || '',
      api: credentials.api ? 'pi-managed' : '',
      foxSN: credentials.foxSN ? 'pi-managed' : '',
      foxToken: credentials.foxToken ? 'pi-managed' : '',
      gasUrl: '/api/foxess'
    }
  };
}

function relayUpstreamResponse(upstream, response) {
  return upstream.text().then(body => {
    response.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(body);
  });
}

async function proxyFoxRequest(request, response) {
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
  const foxSN = state.credentials?.foxSN;
  const foxToken = state.credentials?.foxToken;
  if (!foxSN || !foxToken) {
    return sendJson(response, 409, { errno: 997, msg: 'Configure FoxESS in the Raspberry Pi Settings app first' });
  }
  const timestamp = Date.now().toString();
  const signString = `${target.pathname}\\r\\n${foxToken}\\r\\n${timestamp}`;
  const body = { ...(payload.body || {}) };
  if (Object.hasOwn(body, 'sn')) body.sn = foxSN;
  if (Object.hasOwn(body, 'deviceSN')) body.deviceSN = foxSN;
  const upstream = await fetch(target, {
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
  return relayUpstreamResponse(upstream, response);
}

async function proxyOctopusRequest(request, response) {
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
    return sendJson(response, 409, { error: 'Configure Octopus Energy in the Raspberry Pi Settings app first' });
  }

  let upstream;
  if (payload.authMode === 'graphql' && target.pathname === '/v1/graphql/') {
    const authResponse = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation { obtainKrakenToken(input: { APIKey: ${JSON.stringify(apiKey)} }) { token } }`
      }),
      signal: AbortSignal.timeout(20_000)
    });
    const authData = await authResponse.json();
    const token = authData.data?.obtainKrakenToken?.token;
    if (!authResponse.ok || !token) {
      return sendJson(response, authResponse.ok ? 401 : authResponse.status, authData);
    }
    const body = {
      ...(payload.body || {}),
      variables: {
        ...(payload.body?.variables || {}),
        acc: accountNumber
      }
    };
    upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000)
    });
  } else if (payload.authMode === 'basic') {
    const expectedPath = `/v1/accounts/${encodeURIComponent(accountNumber)}/`;
    if (target.pathname !== expectedPath) {
      return sendJson(response, 400, { error: 'Only the configured Octopus account may be queried' });
    }
    upstream = await fetch(target, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`
      },
      signal: AbortSignal.timeout(20_000)
    });
  } else {
    return sendJson(response, 400, { error: 'Unsupported Octopus API request' });
  }

  return relayUpstreamResponse(upstream, response);
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
      'Cache-Control': path.extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error.code === 'ENOENT') return sendJson(response, 404, { error: 'Not found' });
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;

    if (request.method === 'GET' && pathname === '/api/health') {
      return sendJson(response, 200, { status: 'ok', version });
    }
    if (request.method === 'GET' && pathname === '/api/runtime') {
      const workerRequested = requestUrl.searchParams.get('worker') === '1';
      return sendJson(response, 200, {
        mode: 'linux',
        version,
        role: workerRequested && isLoopback(request) ? 'worker' : 'dashboard',
        authRequired: !isLoopback(request),
        lanUrls: getLanUrls()
      });
    }
    if (request.method === 'POST' && pathname === '/api/auth') {
      return (await isAuthorized(request))
        ? sendEmpty(response)
        : sendJson(response, 401, { error: 'Invalid Raspberry Pi access key' });
    }
    if (pathname === '/api/access-key') {
      if (!isLoopback(request)) {
        return sendJson(response, 403, { error: 'The access key can only be managed from the Raspberry Pi' });
      }
      if (request.method === 'GET') {
        return sendJson(response, 200, { accessKey: await getAccessKey() });
      }
      if (request.method === 'PUT') {
        const body = await readJsonBody(request);
        return sendJson(response, 200, { saved: true, accessKey: await saveAccessKey(body.accessKey) });
      }
    }

    const protectedApi = ['/api/config', '/api/foxess', '/api/octopus'];
    if (protectedApi.includes(pathname) && !(await isAuthorized(request))) {
      return sendJson(response, 401, { error: 'Invalid Raspberry Pi access key' });
    }

    if (pathname === '/api/config' && request.method === 'GET') {
      const state = await loadState();
      return sendJson(response, 200, isLoopback(request) ? state : getClientState(state));
    }
    if (pathname === '/api/config' && request.method === 'PUT') {
      const update = await readJsonBody(request);
      if (!isLoopback(request) && Object.hasOwn(update, 'credentials')) {
        return sendJson(response, 403, { error: 'Service credentials can only be changed from the Raspberry Pi Settings app' });
      }
      const current = await loadState();
      const next = {
        ...current,
        ...update,
        revision: Date.now()
      };
      await saveState(next);
      return sendJson(response, 200, { saved: true, revision: next.revision });
    }
    if (pathname === '/api/config' && request.method === 'DELETE') {
      if (!isLoopback(request)) {
        return sendJson(response, 403, { error: 'Service configuration can only be wiped from the Raspberry Pi Settings app' });
      }
      await saveState({ revision: Date.now() });
      return sendEmpty(response);
    }
    if (pathname === '/api/octopus' && request.method === 'POST') {
      return await proxyOctopusRequest(request, response);
    }
    if (pathname === '/api/foxess' && request.method === 'POST') {
      return await proxyFoxRequest(request, response);
    }
    if (pathname.startsWith('/api/')) {
      return sendJson(response, 404, { error: 'Unknown API endpoint' });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return sendJson(response, 405, { error: 'Method not allowed' });
    }
    return await serveStatic(request, response, pathname);
  } catch (error) {
    console.error(new Date().toISOString(), error);
    const status = error.statusCode || (error instanceof SyntaxError ? 400 : 500);
    return sendJson(response, status, {
      error: status === 400 ? (error.message || 'Invalid JSON request') : 'Local server error'
    });
  }
});

server.listen(port, host, () => {
  console.log(`Octopus FoxESS Linux server v${version} listening on ${host}:${port}`);
});
