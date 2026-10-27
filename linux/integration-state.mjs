// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Shared, non-secret integration health and explicit incident acknowledgement.
export class IntegrationState {
  constructor(saved, now = Date.now) {
    this.now = now;
    this.data = { v:1, revision:0, autoClearHours:24, errors:[], services:{ octopus:{channels:{},alert:null}, foxess:{channels:{},alert:null} } };
    if (saved?.v === 1 && Number.isSafeInteger(saved.revision) && saved.services?.octopus && saved.services?.foxess) {
      for (const name of ['octopus','foxess']) {
        const source = saved.services[name];
        if (!source.channels || typeof source.channels !== 'object' || Array.isArray(source.channels)) throw new Error('Invalid integration state');
        for (const channel of Object.values(source.channels)) {
          if (typeof channel.ok !== 'boolean') throw new Error('Invalid integration channel');
        }
      }
      this.data = JSON.parse(JSON.stringify(saved));
      if (!Number.isInteger(this.data.autoClearHours) || this.data.autoClearHours < 0 || this.data.autoClearHours > 720) this.data.autoClearHours=24;
    }
    this.data.errors = this.diagnostics().errors;
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
    const category = /tariff|account/.test(channel) ? 'prices' : /dispatch|graphql/.test(channel) ? 'dispatch' : /schedul/.test(channel) ? 'schedule' : 'connection';
    const problem = IntegrationState.diagnosticMessage(message);
    const recent = this.data.errors.at(-1);
    if (previous?.ok === false && recent?.service === name && recent.category === category && recent.message === problem) {
      recent.lastAt = at; recent.count++;
    } else {
      this.data.errors.push({service:name,category,message:problem,firstAt:at,lastAt:at,count:1});
      this.data.errors = this.data.errors.slice(-100);
    }
    service.channels[channel] = {ok:false,at,message,lastSuccessAt:previous?.lastSuccessAt || (previous?.ok ? previous.at : null)};
    if (!service.alert || previous?.ok !== false || previous.message !== message) {
      service.alert = {id:++this.data.revision,firstAt:at,lastAt:at,message,count:1};
    } else {
      service.alert.lastAt=at; service.alert.count++;
    }
  }
  static diagnosticMessage(value) {
    const text = String(value || '');
    const http = text.match(/HTTP\s+(\d{3})/i);
    if (http) return `Request failed (HTTP ${http[1]}).`;
    if (/rate.?limit|too many requests|KT-CT-1199/i.test(text)) return 'API rate limit reached.';
    if (/timed? ?out|timeout|abort/i.test(text)) return 'Request timed out.';
    if (/auth|credential|token|API key/i.test(text)) return 'Authentication failed.';
    if (/schedule|confirm|readback/i.test(text)) return 'Schedule confirmation failed.';
    return 'Service update failed.';
  }
  diagnostics() {
    const errors = (Array.isArray(this.data.errors) ? this.data.errors : []).slice(-100)
      .filter(row => ['octopus','foxess'].includes(row?.service) && Number.isFinite(Date.parse(row.firstAt)) && Number.isFinite(Date.parse(row.lastAt)))
      .map(row => ({service:row.service,category:['prices','dispatch','schedule','connection'].includes(row.category)?row.category:'connection',
        message:IntegrationState.diagnosticMessage(row.message),firstAt:new Date(row.firstAt).toISOString(),lastAt:new Date(row.lastAt).toISOString(),
        count:Number.isSafeInteger(row.count)&&row.count>0?row.count:1}));
    return {limit:100,errors};
  }
  setAutoClearHours(hours) {
    if (!Number.isInteger(hours) || hours < 0 || hours > 720) throw Object.assign(new Error('Choose 0 to 720 hours. Zero disables automatic clearing.'),{statusCode:400});
    this.data.autoClearHours=hours;
  }
  expireAlerts() {
    if (!this.data.autoClearHours) return false;
    let changed=false;
    for (const service of Object.values(this.data.services)) {
      if (service.alert && !Object.values(service.channels).some(value=>!value.ok)
          && this.now()-Date.parse(service.alert.lastAt) >= this.data.autoClearHours*3600000) {
        service.alert=null; changed=true;
      }
    }
    return changed;
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
    return {version:1,autoClearHours:this.data.autoClearHours,services,diagnostics:this.diagnostics()};
  }
  acknowledge(name, id) {
    const service=this.service(name);
    if (service.alert?.id !== id) throw Object.assign(new Error('The incident changed. Review the latest problem before clearing it.'),{statusCode:409});
    if (Object.values(service.channels).some(value=>!value.ok)) throw Object.assign(new Error('The service still has a problem. Retry the update before clearing this incident.'),{statusCode:409});
    service.alert=null;
  }
}
