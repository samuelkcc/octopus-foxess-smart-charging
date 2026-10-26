// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Runs the documented GAS doPost with in-memory FoxESS responses. Never forwards traffic.
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export async function createGasRelay() {
  const markup = await readFile(new URL('../../src/index.html', import.meta.url), 'utf8');
  const code = markup.match(/<code[^>]*>(function doPost\(e\) \{[\s\S]*?)<\/code>/)?.[1];
  if (!code) throw new Error('Missing documented GAS relay');
  const stats = { requests: [], writes: 0, redirects: 0, preflights: 0 };
  let groups = [];
  let rejection = null;
  let readbackMismatch = false;
  const content = new Map();
  const readings = { pvPower:0.4, loadsPower:0.6, gridConsumptionPower:0.2, feedinPower:0, batChargePower:0, batDischargePower:0, SoC:64 };
  const context = vm.createContext({
    JSON,
    ContentService: { MimeType:{JSON:'application/json'}, createTextOutput: text => ({text,setMimeType(type){this.type=type;return this;}}) },
    UrlFetchApp:{fetch(url, options) {
      const target = new URL(url);
      if (target.origin !== 'https://www.foxesscloud.com' || !['/op/v0/device/real/query','/op/v0/device/setting/get','/op/v3/device/scheduler/get','/op/v3/device/scheduler/enable'].includes(target.pathname)) throw new Error('Only mock FoxESS targets are accepted');
      const headers = options.headers || {};
      const expected = createHash('md5').update([target.pathname,headers.token,headers.timestamp].join('\\r\\n')).digest('hex');
      stats.requests.push({path:target.pathname,method:options.method,contentType:options.contentType,signatureValid:headers.signature===expected});
      const body = JSON.parse(options.payload);
      let result;
      if (rejection) return {getContentText:()=>JSON.stringify({errno:40256,msg:rejection})};
      if (target.pathname.endsWith('/scheduler/enable')) { stats.writes++; groups = body.groups || []; result = {}; }
      else if (target.pathname.endsWith('/scheduler/get')) result = {groups:readbackMismatch?[]:groups};
      else if (target.pathname.endsWith('/setting/get')) result = {value:'SelfUse'};
      else result = [{datas:Object.entries(readings).map(([variable,value])=>({variable,value}))}];
      return {getContentText:()=>JSON.stringify({errno:0,result})};
    }}
  });
  vm.runInContext(code,context);
  return {
    stats, code,
    reject(message) { rejection=message; },
    mismatch(value) { readbackMismatch=value; },
    async handle(request,response) {
      const url = new URL(request.url,'http://mock.invalid');
      response.setHeader('Access-Control-Allow-Origin','*');
      response.setHeader('Cache-Control','no-store');
      if (request.method==='OPTIONS') { stats.preflights++; response.writeHead(405);response.end('This fixture requires a simple POST');return; }
      if (url.pathname==='/exec' && request.method==='POST') {
        let body='';for await(const chunk of request)body+=chunk;
        const result=context.doPost({postData:{contents:body}});
        const id=randomUUID();content.set(id,result);
        stats.redirects++;
        response.writeHead(302,{Location:`/content/${id}`});response.end();return;
      }
      if (url.pathname.startsWith('/content/') && request.method==='GET') {
        const id=url.pathname.slice('/content/'.length);const result=content.get(id);content.delete(id);
        if (!result) {response.writeHead(404);response.end();return;}
        response.writeHead(200,{'Content-Type':result.type});response.end(result.text);return;
      }
      response.writeHead(404);response.end();
    }
  };
}
