// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Local read-only connection diagnosis. Never print credentials or response bodies.
const origin='http://127.0.0.1:8787';
const clean=value=>String(value || '').replace(/https?:\/\/\S+/g,'[service]').replace(/"[^"\n]*"|'[^'\n]*'/g,'[detail]').replace(/\b[A-Za-z0-9_-]{24,}\b/g,'[private]').replace(/\bA-[A-Z0-9]+\b/g,'[account]').slice(0,300);
const service=await fetch(origin+'/api/service-status').then(response=>response.json());
const health=await fetch(origin+'/api/integration-status').then(response=>response.json());
console.log(JSON.stringify({
  octopus:{state:service.octopus?.state,lastSuccessAt:service.octopus?.lastSuccessAt,lastError:clean(service.octopus?.lastError)},
  channels:health.services?.octopus?.failures?.map(item=>({channel:item.channel,message:clean(item.message),at:item.at})),
  worker:health.worker?{updatedAt:health.worker.updatedAt,octopusNextAt:health.worker.octopusNextAt}:null
},null,2));
