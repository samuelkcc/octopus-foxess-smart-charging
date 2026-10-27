// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Local browser fixtures. No request is forwarded to an energy service.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createGasRelay } from './fixtures/gas-relay.mjs';
import { IntegrationState } from '../linux/integration-state.mjs';
const web = process.argv.includes('--web');
const desktop = process.env.OCTOPUS_FIXTURE_DESKTOP === '1';
const screenshotMode=process.env.OCTOPUS_FIXTURE_SCREENSHOT==='1';
const port = Number(process.env.OCTOPUS_FIXTURE_PORT) || (web ? 65524 : 65523);
const origin = `http://127.0.0.1:${port}`;
const root = process.cwd();
let writes = 0;
let refreshRequestId = 0;
const workerStartedAt = Date.now();
const health = new IntegrationState();
const faults = {octopus:false,foxess:false};
const gasRelay = web ? await createGasRelay({mockOctopusOrigin:origin}) : null;
if (gasRelay) http.createServer((request,response) => { void gasRelay.handle(request,response); }).listen(port+1,'127.0.0.1');
const readings = { pvPower:0.4, loadsPower:0.6, gridConsumptionPower:0.2, feedinPower:0, batChargePower:0, batDischargePower:0, SoC:64 };
let pauseState = { paused:false, until:null, revision:0 };
let retentionMonths = 12;
let saveIntervalMinutes = 60;
let lowStorage=false,historyCleared=false;
const historyStats=()=>({retentionMonths,saveIntervalMinutes,storageBytes:historyCleared?0:150,allocatedBytes:historyCleared?0:4096,bufferedIntervals:historyCleared?0:1,lastSavedAt:null,freeBytes:lowStorage?3e9:16e9,reserveBytes:4e9,lowStorage,automaticCleanup:true});
const activity = process.env.OCTOPUS_FIXTURE_ACTIVITY==='1' ? Array.from({length:8},(_,index)=>({type:index%2?'automation_resumed':'automation_paused',at:new Date(Date.now()-index*3600000).toISOString(),until:null})) : [];
const config = { credentials:{ acc:'A-MOCK', api:'pi-managed', foxSN:'pi-managed', foxToken:'pi-managed' }, automations:{dispatchCheck:false}, liveWsEnabled:false, liveWsPolicy:'rest', revision:1 };
const seeded=process.env.OCTOPUS_FIXTURE_SCHEDULES==='1';
const dispatches=seeded?Array.from({length:screenshotMode?2:5},(_,index)=>({startDt:new Date(Date.now()+(index*2-.5)*3600000).toISOString(),endDt:new Date(Date.now()+(index*2+.5)*3600000).toISOString()})):[];
const seededGroups=seeded?[{enable:1,startHour:0,startMinute:0,endHour:23,endMinute:59,workMode:'ForceCharge',extraParam:{schSources:['weekly']}},{enable:1,startHour:0,startMinute:0,endHour:5,endMinute:30,workMode:'ForceCharge',extraParam:{schSources:['dispatch']}}]:[];
const historyPoints=Array.from({length:96},(_,index)=>{const hour=index/4;const solar=Math.max(0,Math.sin((hour-6)*Math.PI/12))*3.6;const home=.45+Math.max(0,Math.sin(hour*1.7))*.5+(hour>17&&hour<20?1.4:0);const charge=hour<5?1.8:0;const discharge=hour>16&&hour<22?.8:0;return {at:new Date(new Date().setHours(0,0,0,0)+index*900000).toISOString(),values:{pvPower:solar,loadsPower:home,gridConsumptionPower:Math.max(0,home-solar+charge-discharge),feedinPower:Math.max(0,solar-home),batChargePower:charge,batDischargePower:discharge,SoC:Math.min(95,Math.max(15,25+hour*4-(hour>15?(hour-15)*13:0)))},samples:{}}});
const device = {status:'LIVE',vehicleMake:'Example',vehicleModel:'Mock EV'};
http.createServer(async (request,response) => {
  const json = (value,status=200) => { response.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify(value)); };
  try {
    const url = new URL(request.url,origin);
    let body = ''; for await (const chunk of request) body += chunk;
    const payload = body ? JSON.parse(body) : {};
    const timestamp = new Date().toISOString();
    if (url.pathname === '/api/dashboard-snapshot') return json({data:{registeredKrakenflexDevice:device,vehicleChargingPreferences:{weekdayTargetTime:'07:00',weekdayTargetSoc:80},plannedDispatches:dispatches},_serverSnapshot:{pending:false,fetchedAt:Date.now()}});
    if (url.pathname === '/test/capture') {
      const mobile=url.searchParams.get('mobile')==='1';
      const welcome=url.searchParams.get('welcome')==='1';
      const view=url.searchParams.get('view')||'overview';
      const route=desktop?'/app/index.html?client=1':web?'/web/index.html':'/dev/index.html?client=1';
      const frames=mobile?[{url:'/dev/index.html?client=1&locked=1',width:390},{url:'/dev/index.html?client=1',width:390},{url:'/dev/index.html?client=1&view=history',width:390}]:[{url:route+(route.includes('?')?'&':'?')+'view='+view+(welcome?'&locked=1':''),width:1920}];
      response.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
      return response.end(`<style>body{margin:0;background:#100326;display:flex;gap:24px;width:1280px;height:720px;overflow:hidden}iframe{border:0;display:block;flex-shrink:0;height:720px}body:has(iframe:only-child) iframe{height:1080px;transform:scale(.6666666667);transform-origin:top left}</style>${frames.map((frame,index)=>`<iframe title="Example interface ${index+1}" src="${frame.url}" style="width:${frame.width}px"></iframe>`).join('')}`);
    }
    if (url.pathname === '/test/viewport') {
      const requested=Number(url.searchParams.get('width'));
      const width=[320,390,768,1024,1280,1440,1920,2560].includes(requested)?requested:390;
      const height=[650,720,900,1080,1320,1440].includes(Number(url.searchParams.get('height')))?Number(url.searchParams.get('height')):650;
      const scale=Math.max(.25,Math.min(1,Number(url.searchParams.get('scale')) || 1));
      const view=['overview','schedules','rules','history','connections','settings'].includes(url.searchParams.get('view'))?url.searchParams.get('view'):'overview';
      const route=web?'/web/index.html?setup=1':`/dev/index.html?client=1&view=${view}${url.searchParams.get('connected')==='1'?'':'&locked=1'}`;
      response.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
      return response.end(`<main><p>Local responsive fixture: ${width} × ${height}px</p><output id="viewport-metrics" style="display:block;font:10px monospace"></output><iframe title="Responsive app test" src="${route}" style="display:block;width:${width}px;height:${height}px;border:0;transform:scale(${scale});transform-origin:top left"></iframe></main><script>
      setInterval(()=>{const frame=document.querySelector('iframe'),d=frame.contentDocument;if(!d?.querySelector('#dev-content'))return;
      const page=d.querySelector('.dev-page:not([hidden])'),content=d.querySelector('#dev-content'),rail=d.querySelector('.dev-rail'),r=page?.getBoundingClientRect(),c=content.getBoundingClientRect();
      document.querySelector('#viewport-metrics').textContent=JSON.stringify({page:page?.dataset.page,scale:content.dataset.fitScale,viewport:[frame.contentWindow.innerWidth,frame.contentWindow.innerHeight],document:[d.documentElement.scrollWidth,d.documentElement.scrollHeight],content:{left:c.left,right:c.right,bottom:c.bottom},pageBounds:r?{left:r.left,right:r.right,bottom:r.bottom}:null,railBottom:rail.getBoundingClientRect().bottom,fonts:{navigation:frame.contentWindow.getComputedStyle(rail.querySelector('nav button')).fontSize,body:page?frame.contentWindow.getComputedStyle(page.querySelector('header p')).fontSize:null},panels:page?[...page.querySelectorAll('.next-panel,.dev-history')].filter(e=>e.offsetHeight).map(e=>({title:e.querySelector('h2')?.textContent,height:e.clientHeight,scroll:e.scrollHeight})):[]});},1000);
      </script>`);
    }
    if(url.pathname==='/test/storage' && request.method==='PUT'){lowStorage=payload.low===true;return json(historyStats());}
    if(url.pathname==='/api/history/clear' && request.method==='POST'){historyCleared=true;activity.length=0;return json({cleared:true,...historyStats()});}
    if (url.pathname === '/test/integration-fault' && request.method === 'PUT') {
      faults.octopus=payload.octopus===true;faults.foxess=payload.foxess===true;gasRelay?.reject(faults.foxess?'Mock FoxESS unavailable':null);
      return json({mock:true,faults});
    }
    if (url.pathname === '/api/integration-status') {
      if(request.method==='PUT') {
        if(payload.action==='refresh') refreshRequestId=Date.now();
        else if(payload.action==='settings') health.setAutoClearHours(payload.autoClearHours);
        else health.acknowledge(payload.service,payload.alertId);
      }
      health.expireAlerts();
      const now=Date.now(),epoch=refreshRequestId||workerStartedAt;
      const nextDeadline=seconds=>epoch+(Math.floor((now-epoch)/(seconds*1000))+1)*seconds*1000;
      return json({...health.snapshot(),refreshRequestId,worker:{updatedAt:now,octopusNextAt:nextDeadline(config.automations.refreshIntervals?.octopus || 60),foxessNextAt:nextDeadline(config.automations.refreshIntervals?.foxess || 600),octopusBusy:false,foxessBusy:process.env.OCTOPUS_FIXTURE_BUSY_CYCLE==='1' && now%4000<2000}});
    }
    if (url.pathname === '/test/state') return json({mock:true,schedulerWrites:gasRelay?.stats.writes ?? writes,relay:gasRelay?.stats});
    if (url.pathname === '/api/runtime') {
      if (web) return json({error:'No Pi runtime in the web fixture'},404);
      const locked=String(request.headers.referer || '').includes('locked=1');
      return json({mode:'linux',role:'dashboard',authRequired:locked,accessRequired:locked,remoteAccess:locked,version:'2.0.0',lanUrls:[]});
    }
    if (url.pathname === '/api/auth') { response.writeHead(204);return response.end(); }
    if (url.pathname === '/api/config') {
      if(request.method==='PUT') {config.automations=payload.automations || config.automations;config.revision+=1;return json({saved:true,revision:config.revision});}
      if (request.method !== 'GET') return json({error:'Fixture configuration is read-only'},405);
      return json({...config, automationPause:pauseState});
    }
    if (url.pathname === '/api/dispatch-snapshot') return json({dispatches,status:'confirmed',revision:1,fetchedAt:timestamp,confirmedAt:timestamp});
    if (url.pathname === '/api/foxess/live/status') return json({source:'rest',state:'standby',policy:'rest'});
    if (url.pathname === '/api/foxess/live' && faults.foxess) {health.failure('foxess','api','Mock FoxESS unavailable');return json({error:'Mock FoxESS unavailable'},503);}
    if (url.pathname === '/api/foxess/live') {health.success('foxess');return json({source:'rest',updatedAt:timestamp,values:readings,cached:true});}
    if (url.pathname === '/api/automation/pause') {
      if (request.method === 'PUT') {
        pauseState = { paused:payload.action === 'pause', until:payload.action === 'pause' && payload.hours !== null ? new Date(Date.now()+payload.hours*3600000).toISOString() : null, revision:pauseState.revision+1 };
        activity.unshift({at:timestamp,type:pauseState.paused?'automation_paused':'automation_resumed',until:pauseState.until});
      }
      return json(pauseState);
    }
    if (url.pathname === '/api/history/settings') { if (request.method === 'PUT') {retentionMonths = payload.retentionMonths ?? retentionMonths;saveIntervalMinutes=payload.saveIntervalMinutes ?? saveIntervalMinutes;} return json(historyStats()); }
    if (url.pathname === '/api/history') return json({month:url.searchParams.get('month'),intervalMinutes:15,...historyStats(),events:activity,fields:Object.keys(readings),points:historyCleared?[]:historyPoints});
    if (url.pathname.startsWith('/mock-octopus/') || url.pathname === '/api/octopus') {
      if(faults.octopus){health.failure('octopus','api','Mock Octopus unavailable');return json({error:'Mock Octopus unavailable'},503);}
      health.success('octopus');
      const target = url.pathname === '/api/octopus' ? payload.url : url.pathname;
      const data = url.pathname === '/api/octopus' ? payload.body || {} : payload;
      if (target.includes('graphql')) return json(data.query?.includes('obtainKrakenToken')
        ? {data:{obtainKrakenToken:{token:'mock-token'}}}
        : {data:{registeredKrakenflexDevice:device,vehicleChargingPreferences:{weekdayTargetTime:'07:00',weekdayTargetSoc:80},plannedDispatches:dispatches}});
      if (target.includes('accounts')) {
        const delay=Math.max(0,Math.min(10000,Number(process.env.OCTOPUS_FIXTURE_TARIFF_DELAY_MS)||0));
        if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
        return json({properties:[{electricity_meter_points:[{is_export:false,agreements:[{tariff_code:'E-1R-DEMO-26-A',valid_from:'2020-01-01T00:00:00Z',valid_to:null}]},{is_export:true,agreements:[{tariff_code:'E-1R-OUTGOING-26-A',valid_from:'2020-01-01T00:00:00Z',valid_to:null}]}]}]});
      }
      const day=new Date().setHours(0,0,0,0);
      return json({results:Array.from({length:48},(_,i)=>({value_inc_vat:target.includes('OUTGOING')?12:i<11||i>46?8:29.8,valid_from:new Date(day+i*1800000).toISOString(),valid_to:new Date(day+(i+1)*1800000).toISOString()}))});
    }
    if (url.pathname === '/mock-foxess' || url.pathname === '/api/foxess') {
      if(faults.foxess){health.failure('foxess','api','Mock FoxESS unavailable');return json({error:'Mock FoxESS unavailable'},503);}
      health.success('foxess');
      const target = payload.url || '';
      if (target.includes('scheduler/enable')) { if (pauseState.paused && !web) return json({error:'Paused'},423); writes += 1; }
      const result = target.includes('scheduler/get') ? {groups:seededGroups}
        : target.includes('/real/query') ? [{datas:Object.entries(readings).map(([variable,value])=>({variable,value}))}]
        : {value:'SelfUse'};
      return json({errno:0,result});
    }
    if (url.pathname === '/dev/index.html' || url.pathname === '/app/index.html' || url.pathname === '/web/index.html' || url.pathname === '/octopus-foxess-smart-charging/index.html') {
      let html = await readFile(path.join(root,'dist',desktop?'Smart_Charging_Desktop.html':web?'Smart_Charging_UI_DEV.html':'pi-dev.html'),'utf8');
      const guideCode = html.match(/<code style="font-family: monospace;">[\s\S]*?<\/code>/)?.[0] || '';
      if (guideCode) html = html.replace(guideCode, '__FIXTURE_RELAY_GUIDE__');
      html = html.replaceAll('https://api.octopus.energy',`${origin}/mock-octopus`).replace("target.includes('api.octopus.energy')", "(target.includes('api.octopus.energy') || target.includes('/mock-octopus/'))");
      if (guideCode) html = html.replace('__FIXTURE_RELAY_GUIDE__', () => guideCode);
      const noticeFixture = url.searchParams.get('firstUse') === '1'
        ? 'localStorage.removeItem("licenseAccepted");'
        : 'localStorage.setItem("licenseAccepted","true");';
      if(desktop)html=html.replace('<head>',`<head><script>
      let fixtureRemote={enabled:false,state:'disabled',url:null,key:'mock-key-for-layout-only'};
      const fixtureConfig={accessRequired:true,accessKey:'mock-LAN-code',liveWsEnabled:false,credentials:{acc:'A-MOCK',api:'mock-octopus-key',foxSN:'mock-device',foxToken:'mock-fox-token'}};
      window.desktopHost={platform:'windows',configuration:async()=>fixtureConfig,saveConfiguration:async()=>({saved:true}),status:async()=>({lanUrls:['http://192.0.2.1:8787']}),remoteAccess:async()=>fixtureRemote,setRemoteAccess:async value=>(fixtureRemote={...fixtureRemote,...value,state:value.enabled?'running':'disabled',url:value.enabled?'https://mock-url.example.test':null}),copyRemoteKey:async()=>true,copyPublicUrl:async()=>true,copyLanCode:async()=>true};
      </script>`);
      html = html.replace('<head>',`<head><script>${noticeFixture}</script>`)
        .replace('<body>',screenshotMode?'<body>':'<body><p style="position:fixed;bottom:0;left:0;z-index:10020;padding:4px;margin:0;color:#b91c1c;background:white;font-size:10px;pointer-events:none">LOCAL TEST · MOCK DATA · No real credentials or inverter commands</p>');
      response.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});return response.end(html);
    }
    if (url.pathname === '/octopus-foxess.svg') {
      response.writeHead(200,{'Content-Type':'image/svg+xml'});return response.end(await readFile(path.join(root,'linux/octopus-foxess.svg')));
    }
    if (url.pathname.endsWith('site.webmanifest')) return json({});
    return json({error:'Mock route not found'},404);
  } catch { json({error:'Invalid fixture request'},400); }
}).listen(port,'127.0.0.1',()=>console.log(`Local ${web?'web':'Pi'} fixture: ${origin}/${web?'web':'dev'}/index.html${web?'?setup=1':'?client=1'}${web?' · Cross-origin GAS mock: http://127.0.0.1:65525/exec':''}`));
