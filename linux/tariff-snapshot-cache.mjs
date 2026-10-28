// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import {readFile,writeFile,rename} from 'node:fs/promises';

// Presentation recovery only. This cache is never an upstream API response.
export class TariffSnapshotCache {
  constructor(file,now=Date.now){this.file=file;this.now=now;this.saving=Promise.resolve();}
  clean(identity,payload){
    const state=payload?.state;
    if(!/^[a-f0-9]{64}$/.test(identity)||!state||payload.pending!==false||payload.problem!==false)return null;
    if(!Number.isFinite(state.updatedAt)||state.updatedAt>this.now()||this.now()-state.updatedAt>=86400000)return null;
    const code=value=>typeof value==='string'&&/^[A-Za-z0-9 -]{1,100}$/.test(value);
    const rates=value=>Array.isArray(value)&&value.length<=500&&value.every(row=>row&&Number.isFinite(row.value_inc_vat)&&
      [row.valid_from,row.valid_to].every(date=>date===null||(typeof date==='string'&&date.length<=40&&Number.isFinite(Date.parse(date)))));
    if(!code(state.importTariffCode)||!code(state.exportTariffCode)||!rates(state.importRates)||!rates(state.exportRates))return null;
    if(!state.importRates.length&&!state.exportRates.length)return null;
    const cleanRates=values=>values.map(({value_inc_vat,valid_from,valid_to})=>({value_inc_vat,valid_from,valid_to}));
    return {identity,payload:{pending:false,problem:false,progress:2,state:{importTariffCode:state.importTariffCode,exportTariffCode:state.exportTariffCode,
      importRates:cleanRates(state.importRates),exportRates:cleanRates(state.exportRates),updatedAt:state.updatedAt,
      minRate:Number.isFinite(state.minRate)?state.minRate:null,maxRate:Number.isFinite(state.maxRate)?state.maxRate:null}}};
  }
  async load(identity){
    try{const text=await readFile(this.file,'utf8');if(text.length>250000)return null;
      const value=JSON.parse(text);return value.version===1&&value.identity===identity?this.clean(identity,value.payload):null;
    }catch{return null;}
  }
  async put(identity,payload){
    const value=this.clean(identity,payload);if(!value)return;
    this.saving=this.saving.catch(()=>{}).then(async()=>{
      await writeFile(this.file+'.tmp',JSON.stringify({version:1,...value}),{mode:0o600});await rename(this.file+'.tmp',this.file);
    });
    try{await this.saving;}catch{/* Disk failure cannot fail successful tariff publication. */}
  }
}
