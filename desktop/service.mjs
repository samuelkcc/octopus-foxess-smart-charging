// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// The encryption key travels through the private parent port, never an HTTP API.
import { pathToFileURL } from 'node:url';
import path from 'node:path';
if (!process.parentPort) throw new Error('The desktop host must start this service.');
let started = false;
process.parentPort.on('message', async event => {
  const message = event.data;
  if (message?.kind === 'shutdown') { process.emit('SIGTERM'); return; }
  if (started || message?.kind !== 'start') return;
  started = true;
  const key = Buffer.from(message.key, 'base64');
  if (key.length !== 32) throw new Error('Invalid desktop encryption key.');
  globalThis.desktopEncryptionKey = key;
  try { await import(pathToFileURL(path.join(process.env.OCTOPUS_SERVICE_ROOT, 'server.mjs')).href); }
  catch { process.parentPort.postMessage({kind:'failed'}); process.exit(1); }
});
