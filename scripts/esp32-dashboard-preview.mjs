// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
// Local fixture: no upstream networking and no real inverter commands.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const now=()=>Math.floor(Date.now()/1000);
let revision=1,writes=0,authenticated=false,lanEnabled=false,lanCode='';
const rules={enabled:true,paused:false,pause_until:0,follow_dispatch:true,charge_price_enabled:false,charge_price_p:7,discharge_price_enabled:false,discharge_price_p:30,weekly_charge:true,charge_start:1410,charge_end:330,charge_days:127,weekly_discharge:false,discharge_start:960,discharge_end:1140,discharge_days:127,target_soc:100,charge_soc_enabled:true,dispatch_soc_enabled:false,dispatch_soc:100,min_soc:11,power_w:5000,auto_resume:true,octopus_seconds:60,foxess_seconds:600,history_days:14,history_flash_enabled:false,pause_discharge_dispatch:true,discharge_overrides_charge:true};
const period={enable:1,startHour:23,startMinute:30,endHour:23,endMinute:59,workMode:'ForceCharge'};
const state=()=>({schema:1,fixture:true,lan_access_enabled:lanEnabled,csrf:'fixture-csrf',revision,confirmed_revision:rules.enabled&&!rules.paused?revision:0,now:now(),rules,telemetry:{solar:1.65,home:.56,grid:-.83,battery:.26,soc:78},dispatches:[{startDt:new Date((now()+3600)*1000).toISOString(),endDt:new Date((now()+5400)*1000).toISOString()}],groups:[period,{...period,startHour:0,startMinute:0,endHour:5,endMinute:30}],confirmed:rules.enabled&&!rules.paused,control_status:rules.paused?'Paused; monitoring continues':rules.enabled?'Schedule confirmed by official FoxESS REST (fixture)':'Automation is not enabled',dispatch_valid:true,dispatch_at:now()-20,telemetry_at:now()-30,schedule_at:now()-25,confirmed_at:rules.enabled?now()-10:0,octopus_next:now()+40,foxess_next:now()+570,octopus_http:200,foxess_http:200,octopus_status:'Charging windows updated',foxess_status:'Official REST telemetry updated',free_psram_bytes:7600000,history_records:96,history_flash_available:true,history_flash_error:false,history_saved_records:0,history_saved_through:0,import_rates:Array.from({length:48},(_,i)=>({start:now()+i*1800,end:now()+(i+1)*1800,value:i>32?7:24.5})),export_rates:[{start:now()-3600,end:now()+86400,value:15}]});
const server=createServer(async(req,res)=>{
 const host=req.headers.host;if(!['127.0.0.1:8790','localhost:8790'].includes(host)){res.writeHead(403);res.end();return;}
 const url=new URL(req.url,'http://127.0.0.1:8790');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 const reply=(value,status=200)=>{res.writeHead(status);res.end(JSON.stringify(value));};
 if(req.url==='/'&&req.method==='GET'){res.setHeader('Content-Type','text/html');res.end(await readFile(new URL('../.build/esp32-ui/dashboard.html',import.meta.url)));return;}
 if(url.pathname==='/sdk-notices'){res.setHeader('Content-Type','text/plain');res.end(await readFile(new URL('../esp32/SDK_NOTICES.txt',import.meta.url)));return;}
 if(url.pathname==='/licence'){res.setHeader('Content-Type','text/plain');res.end(await readFile(new URL('../LICENSE',import.meta.url)));return;}
 if(url.pathname==='/test/state'){reply({writes,revision});return;}
 let body={};if(req.method==='POST'){let text='';for await(const chunk of req){text+=chunk;if(text.length>8192){reply({error:'Too large'},413);return;}}try{body=JSON.parse(text);}catch{reply({error:'Invalid JSON'},400);return;}}
 if(url.pathname==='/api/login'){if(!lanEnabled||body.access_code!==lanCode){reply({error:'Invalid LAN access code'},401);return;}authenticated=true;res.setHeader('Set-Cookie','fixture=1; Path=/; HttpOnly; SameSite=Strict');reply({authenticated:true});return;}
 if(lanEnabled&&!authenticated){reply({error:'Enter the configured LAN access code'},401);return;}
 if(url.pathname==='/api/lan-access'&&req.method==='POST'){lanEnabled=body.enabled===true;lanCode=body.access_code||'';authenticated=lanEnabled;reply({saved:true});return;}
 if(url.pathname==='/api/logout'){authenticated=false;reply({});return;}
 if(url.pathname==='/api/account'){reply({account_number:'A-DEMO',import_tariff:'E-1R-IOG-FIX-26-10-01-A',export_tariff:'E-1R-OUTGOING-26-10-01-A',device_reported:true,provider:'OHME',vehicleMake:'Peugeot',vehicleModel:'e-5008',chargePointMake:'Ohme',chargePointModel:'home pro',status:'LIVE',target_time:'08:46',charge_limit:80,updated_at:now(),update_error:false});return;}
 if(url.pathname==='/api/state'){reply(state());return;}
 if(url.pathname==='/api/rules'&&req.method==='POST'){if(body.revision!==revision){reply({error:'Settings changed'},409);return;}Object.assign(rules,body.rules);revision++;if(rules.enabled&&!rules.paused)writes++;reply({saved:true,revision});return;}
 if(url.pathname==='/api/manual'&&req.method==='POST'){writes++;reply({});return;}
 if(url.pathname==='/api/history'){reply(Array.from({length:96},(_,i)=>({at:now()-(95-i)*900,solar:Math.max(0,Math.sin(i/12)),home:.6,grid:.3,battery:i%20<10?.2:-.2,soc:70+i/8})));return;}
 reply({error:'Not found'},404);
});
server.listen(8790,'127.0.0.1',()=>console.log('ESP32 dashboard fixture: http://127.0.0.1:8790 · LAN access open by default · No real commands'));
