// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Local, read-only diagnostics. Only explicit public fields reach the report.
import {fileURLToPath} from 'node:url';
import {realpathSync} from 'node:fs';
export async function readRuntimeReport(fetcher=fetch) {
  const routes=['health','service-status','integration-status','history','automation/pause','dispatch-snapshot','foxess/live','remote-access'];
  const values=await Promise.all(routes.map(async route=>{
    try{const response=await fetcher(`http://127.0.0.1:8787/api/${route}`,{signal:AbortSignal.timeout(12000)});return response.ok?await response.json():{unavailable:true,httpStatus:response.status};}
    catch{return {unavailable:true};}
  }));
  const [health,service,integrations,history,pause,dispatch,telemetry,remote]=values;
  const connection=value=>({state:value?.state || 'unavailable',lastSuccessAt:value?.lastSuccessAt || null});
  const readingFields=['pvPower','loadsPower','gridConsumptionPower','feedinPower','batChargePower','batDischargePower','SoC'];
  return {
    version:health.version || null,
    octopus:connection(integrations.services?.octopus || service.octopus),
    foxess:connection(integrations.services?.foxess || service.foxRest),
    worker:integrations.worker?{updatedAt:integrations.worker.updatedAt,requestSeen:integrations.worker.requestSeen}:null,
    pause:pause.unavailable?'unavailable':pause.paused,
    dispatch:{status:dispatch.status || null,fetchedAt:dispatch.fetchedAt || null,confirmedAt:dispatch.confirmedAt || null,windows:(dispatch.dispatches || []).map(item=>({start:item.startDt,end:item.endDt}))},
    telemetry:{source:telemetry.source || null,updatedAt:telemetry.updatedAt || null,values:Object.fromEntries(readingFields.map(field=>[field,telemetry.values?.[field] ?? null]))},
    history:{intervals:history.points?.length ?? null,storageBytes:history.storageBytes ?? null,allocatedBytes:history.allocatedBytes ?? null,freeBytes:history.freeBytes ?? null,lowStorage:history.lowStorage ?? null,retentionMonths:history.retentionMonths ?? null,saveIntervalMinutes:history.saveIntervalMinutes ?? null,bufferedIntervals:history.bufferedIntervals ?? null,lastSavedAt:history.lastSavedAt ?? null},
    remote:{enabled:remote.enabled === true,state:remote.state || null,url:remote.url || null}
  };
}
if(process.argv[1] && realpathSync(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await readRuntimeReport(),null,2));
