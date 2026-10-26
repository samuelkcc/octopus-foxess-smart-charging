// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Shared, non-secret integration health and explicit incident acknowledgement.
export class IntegrationState {
  constructor(saved, now = Date.now) {
    this.now = now;
    this.data = { v:1, revision:0, services:{ octopus:{channels:{},alert:null}, foxess:{channels:{},alert:null} } };
    if (saved?.v === 1 && Number.isSafeInteger(saved.revision) && saved.services?.octopus && saved.services?.foxess) {
      for (const name of ['octopus','foxess']) {
        const source = saved.services[name];
        if (!source.channels || typeof source.channels !== 'object' || Array.isArray(source.channels)) throw new Error('Invalid integration state');
        for (const channel of Object.values(source.channels)) {
          if (typeof channel.ok !== 'boolean') throw new Error('Invalid integration channel');
        }
      }
      this.data = JSON.parse(JSON.stringify(saved));
    }
  }
  service(name) {
    if (!['octopus','foxess'].includes(name)) throw Object.assign(new Error('Unknown integration'), {statusCode:400});
    return this.data.services[name];
  }
  success(name, channel='api', at = new Date(this.now()).toISOString()) {
    const service = this.service(name);
    service.channels[channel] = {ok:true,at,lastSuccessAt:at};
  }
  failure(name, channel='api', message='The service could not be updated.') {
    const service = this.service(name);
    const at = new Date(this.now()).toISOString();
    const previous = service.channels[channel];
    service.channels[channel] = {ok:false,at,message,lastSuccessAt:previous?.lastSuccessAt || (previous?.ok ? previous.at : null)};
    if (!service.alert || previous?.ok !== false || previous.message !== message) {
      service.alert = {id:++this.data.revision,firstAt:at,lastAt:at,message,count:1};
    } else {
      service.alert.lastAt=at; service.alert.count++;
    }
  }
  snapshot() {
    const services = {};
    for (const name of ['octopus','foxess']) {
      const source=this.service(name);const values=Object.values(source.channels);
      const failures=Object.entries(source.channels).filter(([,value])=>!value.ok).map(([channel,value])=>({channel,...value}));
      services[name] = { state:failures.length?'error':values.length?'ok':'waiting',failures,
        lastSuccessAt:values.map(value=>value.lastSuccessAt || (value.ok ? value.at : null)).filter(Boolean).sort().at(-1)||null,
        alert:source.alert?{...source.alert}:null };
    }
    return {version:1,services};
  }
  acknowledge(name, id) {
    const service=this.service(name);
    if (service.alert?.id !== id) throw Object.assign(new Error('The incident changed. Review the latest problem before clearing it.'),{statusCode:409});
    if (Object.values(service.channels).some(value=>!value.ok)) throw Object.assign(new Error('The service still has a problem. Retry the update before clearing this incident.'),{statusCode:409});
    service.alert=null;
  }
}
