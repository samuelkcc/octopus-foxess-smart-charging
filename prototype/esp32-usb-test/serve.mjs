// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files=new Map();
for(const file of ['index.html','client.js','styles.css','flasher.js','flash-policy.js','brand.svg','brand-light.svg','vendor/esptool-0.7.1.js','vendor/esptool-LICENSE.txt','vendor/DEPENDENCY_NOTICES.txt']) files.set('/'+file,new URL('./'+file,import.meta.url));
files.set('/',files.get('/index.html'));
files.set('/about.js',new URL('../../dev/about.js',import.meta.url));
for(const file of ['manifest.json','bootloader.bin','partition-table.bin','application.bin','ota-data.bin','SDK_NOTICES.txt']) files.set('/firmware/'+file,new URL('../../dist/esp32-deploy/firmware/'+file,import.meta.url));
const server = createServer(async (request, response) => {
  const allowedHost = request.headers.host === '127.0.0.1:8789' || request.headers.host === 'localhost:8789';
  if (!allowedHost || !['GET', 'HEAD'].includes(request.method) || !files.has(request.url)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('Not found');
    return;
  }
  let html;
  try {
    html = await readFile(files.get(request.url));
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('Cannot load the test page.');
    return;
  }
  response.writeHead(200, {
    'Content-Type': ({js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',json:'application/json',txt:'text/plain; charset=utf-8',bin:'application/octet-stream'}[request.url.split('.').pop()] || 'text/html; charset=utf-8'),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'serial=(self)',
    'Referrer-Policy': 'no-referrer'
  });
  response.end(request.method === 'HEAD' ? undefined : html);
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'Port 8789 is already in use.' : `Cannot start local test server (${error.code}).`);
  process.exitCode = 1;
});
server.listen(8789, '127.0.0.1', () => {
  console.log('ESP32 USB 測試：http://127.0.0.1:8789');
  console.log('用電腦版 Chrome／Edge 開啟。按 Ctrl+C 停止。');
});
