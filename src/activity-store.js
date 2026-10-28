/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * Browser activity data only. Never restores control state or credentials.
 */
(() => {
  const key='smartChargingActivityV1',limit=2000,maxFileBytes=1024*1024;
  const types=new Set(['automation_paused','automation_resumed','pause_expired']);
  const invalid=()=>new Error('Invalid activity backup. Use a Smart Charging activity JSON file.');
  const timestamp=value=>{
    if(typeof value!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value)))throw invalid();
    const canonical=new Date(value).toISOString();
    if(canonical!==value.replace(/Z$/,value.includes('.')?'Z':'.000Z'))throw invalid();
    return canonical;
  };
  const normalize=value=>{
    if(!value || typeof value!=='object' || Array.isArray(value)
        || Object.keys(value).some(field=>!['at','type','until','revision'].includes(field))
        || !types.has(value.type) || !Number.isSafeInteger(value.revision) || value.revision<0)throw invalid();
    const at=timestamp(value.at),until=value.until===null?null:timestamp(value.until);
    if(Date.parse(at)>Date.now()+300000)throw invalid();
    return {at,type:value.type,until,revision:value.revision};
  };
  const trim=events=>{
    const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-12);
    return [...new Map(events.filter(event=>Date.parse(event.at)>=cutoff.getTime()).map(event=>[JSON.stringify(event),event])).values()]
      .sort((a,b)=>b.at.localeCompare(a.at)||b.revision-a.revision).slice(0,limit);
  };
  function events(){
    let saved;try{saved=JSON.parse(localStorage.getItem(key)||'[]');}catch{return [];}
    if(!Array.isArray(saved))return [];
    const clean=[];for(const item of saved.slice(0,10000)){try{clean.push(normalize(item));}catch{}}
    return trim(clean);
  }
  const store=next=>{localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new CustomEvent('browser-activity-change'));};
  const webOnly=()=>{if(window.linuxRuntime)throw new Error('Activity backups are available in the standalone web edition only.');};
  window.browserActivity={
    events,maxFileBytes,
    append(event){store(trim([normalize(event),...events()]));},
    stats(){const rows=events();return {count:rows.length,estimatedBytes:JSON.stringify(rows).length*2,limit,retentionMonths:12};},
    export(){webOnly();return {format:'smart-charging-activity',version:1,exportedAt:new Date().toISOString(),events:events()};},
    import(text){
      webOnly();if(typeof text!=='string' || text.length>maxFileBytes)throw invalid();
      let backup;try{backup=JSON.parse(text);}catch{throw invalid();}
      if(!backup || backup.format!=='smart-charging-activity' || backup.version!==1
          || Object.keys(backup).some(field=>!['format','version','exportedAt','events'].includes(field))
          || !Array.isArray(backup.events) || backup.events.length>limit)throw invalid();
      timestamp(backup.exportedAt);
      // Validate the complete file before the first write. Never assign arbitrary fields.
      const incoming=backup.events.map(normalize),previous=events();
      const next=trim([...previous,...incoming]);
      const previousKeys=new Set(previous.map(event=>JSON.stringify(event)));
      const added=next.filter(event=>!previousKeys.has(JSON.stringify(event))).length;
      store(next);return {added,total:next.length};
    }
  };
  window.addEventListener('storage',event=>{if(event.key===key)window.dispatchEvent(new CustomEvent('browser-activity-change'));});
})();
