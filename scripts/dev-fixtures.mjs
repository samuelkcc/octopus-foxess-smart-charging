// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Local browser fixtures. No request is forwarded to an energy service.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createGasRelay } from './fixtures/gas-relay.mjs';
const web = process.argv.includes('--web');
const port = web ? 65524 : 65523;
const origin = `http://127.0.0.1:${port}`;
const root = process.cwd();
let writes = 0;
const gasRelay = web ? await createGasRelay() : null;
if (gasRelay) http.createServer((request,response) => { void gasRelay.handle(request,response); }).listen(65525,'127.0.0.1');
const readings = { pvPower:0.4, loadsPower:0.6, gridConsumptionPower:0.2, feedinPower:0, batChargePower:0, batDischargePower:0, SoC:64 };
let pauseState = { paused:false, until:null, revision:0 };
let retentionMonths = 12;
const activity = [];
const config = { credentials:{ acc:'A-MOCK', api:'pi-managed', foxSN:'pi-managed', foxToken:'pi-managed' }, automations:{dispatchCheck:false}, liveWsEnabled:false, liveWsPolicy:'rest', revision:1 };
const device = {status:'LIVE',vehicleMake:'Example',vehicleModel:'Mock EV'};
http.createServer(async (request,response) => {
  const json = (value,status=200) => { response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value)); };
  try {
    const url = new URL(request.url,origin);
    let body = ''; for await (const chunk of request) body += chunk;
    const payload = body ? JSON.parse(body) : {};
    const timestamp = new Date().toISOString();
    if (url.pathname === '/test/viewport') {
      const requested=Number(url.searchParams.get('width'));
      const width=[320,390,768,1024].includes(requested)?requested:390;
      const view=['overview','schedules','rules','history','connections','settings'].includes(url.searchParams.get('view'))?url.searchParams.get('view'):'overview';
      const route=web?'/web/index.html?setup=1':`/dev/index.html?client=1&view=${view}${url.searchParams.get('connected')==='1'?'':'&locked=1'}`;
      response.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
      return response.end(`<main><p>Local responsive fixture: ${width}px</p><iframe title="Responsive app test" src="${route}" style="display:block;width:${width}px;height:650px;border:0"></iframe></main>`);
    }
    if (url.pathname === '/test/state') return json({mock:true,schedulerWrites:gasRelay?.stats.writes ?? writes,relay:gasRelay?.stats});
    if (url.pathname === '/api/runtime') {
      if (web) return json({error:'No Pi runtime in the web fixture'},404);
      const locked=String(request.headers.referer || '').includes('locked=1');
      return json({mode:'linux',role:'dashboard',authRequired:locked,accessRequired:locked,remoteAccess:locked,version:'2026.10.26.6',lanUrls:[]});
    }
    if (url.pathname === '/api/auth') { response.writeHead(204);return response.end(); }
    if (url.pathname === '/api/config') {
      if (request.method !== 'GET') return json({error:'Fixture configuration is read-only'},405);
      return json({...config, automationPause:pauseState});
    }
    if (url.pathname === '/api/dispatch-snapshot') return json({dispatches:[],status:'confirmed',revision:1,fetchedAt:timestamp,confirmedAt:timestamp});
    if (url.pathname === '/api/foxess/live/status') return json({source:'rest',state:'standby',policy:'rest'});
    if (url.pathname === '/api/foxess/live') return json({source:'rest',updatedAt:timestamp,values:readings,cached:true});
    if (url.pathname === '/api/automation/pause') {
      if (request.method === 'PUT') {
        pauseState = { paused:payload.action === 'pause', until:payload.action === 'pause' && payload.hours !== null ? new Date(Date.now()+payload.hours*3600000).toISOString() : null, revision:pauseState.revision+1 };
        activity.unshift({at:timestamp,type:pauseState.paused?'automation_paused':'automation_resumed',until:pauseState.until});
      }
      return json(pauseState);
    }
    if (url.pathname === '/api/history/settings') { if (request.method === 'PUT') retentionMonths = payload.retentionMonths; return json({retentionMonths,automaticCleanup:true}); }
    if (url.pathname === '/api/history') return json({month:url.searchParams.get('month'),intervalMinutes:15,retentionMonths,events:activity,storageBytes:150,fields:Object.keys(readings),points:[{at:timestamp,values:readings,samples:{}}]});
    if (url.pathname.startsWith('/mock-octopus/') || url.pathname === '/api/octopus') {
      const target = url.pathname === '/api/octopus' ? payload.url : url.pathname;
      const data = url.pathname === '/api/octopus' ? payload.body || {} : payload;
      if (target.includes('graphql')) return json(data.query?.includes('obtainKrakenToken')
        ? {data:{obtainKrakenToken:{token:'mock-token'}}}
        : {data:{registeredKrakenflexDevice:device,vehicleChargingPreferences:{weekdayTargetTime:'07:00',weekdayTargetSoc:80},plannedDispatches:[]}});
      if (target.includes('accounts')) return json({properties:[{electricity_meter_points:[{is_export:false,agreements:[{tariff_code:'E-1R-DEMO-26-A',valid_from:'2020-01-01T00:00:00Z',valid_to:null}]}]}]});
      return json({results:[{value_inc_vat:8,valid_from:new Date(Date.now()-86400000).toISOString(),valid_to:new Date(Date.now()+86400000).toISOString()}]});
    }
    if (url.pathname === '/mock-foxess' || url.pathname === '/api/foxess') {
      const target = payload.url || '';
      if (target.includes('scheduler/enable')) { if (pauseState.paused && !web) return json({error:'Paused'},423); writes += 1; }
      const result = target.includes('scheduler/get') ? {groups:[]}
        : target.includes('/real/query') ? [{datas:Object.entries(readings).map(([variable,value])=>({variable,value}))}]
        : {value:'SelfUse'};
      return json({errno:0,result});
    }
    if (url.pathname === '/dev/index.html' || url.pathname === '/app/index.html' || url.pathname === '/web/index.html' || url.pathname === '/octopus-foxess-smart-charging/index.html') {
      let html = await readFile(path.join(root,'dist',web?'Smart_Charging_UI_DEV.html':'pi-dev.html'),'utf8');
      if (web) html = html.replaceAll('https://api.octopus.energy',`${origin}/mock-octopus`);
      const noticeFixture = url.searchParams.get('firstUse') === '1'
        ? 'localStorage.removeItem("licenseAccepted");'
        : 'localStorage.setItem("licenseAccepted","true");';
      html = html.replace('<head>',`<head><script>${noticeFixture}</script>`)
        .replace('<body>','<body><p style="padding:8px;margin:0;color:#b91c1c">LOCAL TEST · MOCK DATA · No real credentials or inverter commands</p>');
      response.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});return response.end(html);
    }
    if (url.pathname === '/octopus-foxess.svg') {
      response.writeHead(200,{'Content-Type':'image/svg+xml'});return response.end(await readFile(path.join(root,'linux/octopus-foxess.svg')));
    }
    if (url.pathname.endsWith('site.webmanifest')) return json({});
    return json({error:'Mock route not found'},404);
  } catch { json({error:'Invalid fixture request'},400); }
}).listen(port,'127.0.0.1',()=>console.log(`Local ${web?'web':'Pi'} fixture: ${origin}/${web?'web':'dev'}/index.html${web?'?setup=1':'?client=1'}${web?' · Cross-origin GAS mock: http://127.0.0.1:65525/exec':''}`));
