import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const webRoot = process.env.OCTOPUS_WEB_ROOT || path.join(appRoot, 'web');
const stateRoot = process.env.OCTOPUS_STATE_DIR || '/var/lib/octopus-foxess';
const accessKeyFile = process.env.OCTOPUS_ACCESS_KEY_FILE || '/etc/octopus-foxess/access.key';
const host = process.env.OCTOPUS_HOST || '0.0.0.0';
const port = Number(process.env.OCTOPUS_PORT || 8787);
const maxBodyBytes = 128 * 1024;
const allowedFoxHost = 'www.foxesscloud.com';
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

async function getAccessKey() {
  return (await readFile(accessKeyFile, 'utf8')).trim();
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

async function proxyFoxRequest(request, response) {
  const payload = await readJsonBody(request);
  const target = new URL(payload.url);
  if (
    target.protocol !== 'https:' ||
    target.hostname !== allowedFoxHost ||
    !target.pathname.startsWith('/op/')
  ) {
    return sendJson(response, 400, { errno: 998, msg: 'Only FoxESS Cloud API requests are allowed' });
  }
  const upstream = await fetch(target, {
    method: 'POST',
    headers: payload.headers || {},
    body: JSON.stringify(payload.body || {}),
    signal: AbortSignal.timeout(20_000)
  });
  const body = await upstream.text();
  response.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
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
        authRequired: !isLoopback(request)
      });
    }
    if (request.method === 'POST' && pathname === '/api/auth') {
      return (await isAuthorized(request))
        ? sendEmpty(response)
        : sendJson(response, 401, { error: 'Invalid Raspberry Pi access key' });
    }

    const protectedApi = ['/api/config', '/api/foxess'];
    if (protectedApi.includes(pathname) && !(await isAuthorized(request))) {
      return sendJson(response, 401, { error: 'Invalid Raspberry Pi access key' });
    }

    if (pathname === '/api/config' && request.method === 'GET') {
      return sendJson(response, 200, await loadState());
    }
    if (pathname === '/api/config' && request.method === 'PUT') {
      const update = await readJsonBody(request);
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
      await saveState({ revision: Date.now() });
      return sendEmpty(response);
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
    const status = error instanceof SyntaxError ? 400 : 500;
    return sendJson(response, status, { error: status === 400 ? 'Invalid JSON request' : 'Local server error' });
  }
});

server.listen(port, host, () => {
  console.log(`Octopus FoxESS Linux server v${version} listening on ${host}:${port}`);
});
