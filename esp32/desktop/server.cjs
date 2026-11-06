// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const files=['index.html','client.js','styles.css','flasher.js','flash-policy.js','about.js','guide.js','guide.css','brand.svg','brand-light.svg','vendor/esptool-0.7.1.js','vendor/esptool-LICENSE.txt','vendor/DEPENDENCY_NOTICES.txt','firmware/manifest.json','firmware/bootloader.bin','firmware/partition-table.bin','firmware/application.bin','firmware/ota-data.bin','firmware/SDK_NOTICES.txt'];
async function startServer(directory){
  const assets=new Map(await Promise.all(files.map(async file=>['/'+file,await fs.readFile(path.join(directory,file))])));
  assets.set('/',assets.get('/index.html'));
  let origin;
  const server=http.createServer((request,response)=>{
    const resource=assets.get(request.url);
    if(request.headers.host!==new URL(origin).host||!['GET','HEAD'].includes(request.method)||!resource){response.writeHead(404);response.end('Not found');return;}
    const extension=request.url.split('.').pop();
    response.writeHead(200,{'Content-Type':({js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',json:'application/json',txt:'text/plain; charset=utf-8',bin:'application/octet-stream'}[extension]||'text/html; charset=utf-8'),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'serial=(self)'});
    response.end(request.method==='HEAD'?undefined:resource);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  origin='http://127.0.0.1:'+server.address().port;
  return {server,origin};
}
module.exports={startServer,files};
