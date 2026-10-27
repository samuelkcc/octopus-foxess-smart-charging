/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. Browser health and retained incidents. */
(() => {
    const key='smartChargingIntegrationStatusV1';
    let saved;try {saved=JSON.parse(localStorage.getItem(key)||'null');} catch {}
    let state;try {state=new window.IntegrationState(saved);} catch {state=new window.IntegrationState();}
    let leaving=false;
    window.addEventListener('pagehide',()=>{leaving=true;});
    window.addEventListener('pageshow',()=>{leaving=false;});
    let remote=null;let pollBusy=false;let workerRequestSeen=0;let lastPersist=0;const busy={octopus:0,foxess:0};
    const notify=()=>window.dispatchEvent(new CustomEvent('integration-status-change'));
    const persist=(force=true)=>{if(force || Date.now()-lastPersist>=60000){try {localStorage.setItem(key,JSON.stringify(state.data));lastPersist=Date.now();} catch {}} notify();};
    const clean = error => {
        let message=String(error?.message||error||'The service could not be updated.').replace(/https?:\/\/\S+/g,'[service]').slice(0,240);
        for(const id of ['api','fox-token','local-access-key']) {
            const value=document.getElementById(id)?.value;
            if(value && value.length>3) message=message.split(value).join('[private]');
        }
        return message;
    };
    window.integrationMonitor={
        start(name) {busy[name]++;notify();return()=>{busy[name]=Math.max(0,busy[name]-1);notify();};},
        success(name,channel='api') {const recovered=state.service(name).channels[channel]?.ok===false;state.success(name,channel);if(recovered)persist();else notify();},
        failure(name,channel,error) {if(leaving || window.linuxRuntime && window.linuxServiceEnabled===false)return;const revision=state.data.revision;state.failure(name,channel,clean(error));persist(state.data.revision!==revision);},
        snapshot() {return {local:state.snapshot(),remote,busy:{...busy}};},
        async acknowledge(name) {
            const local=state.snapshot().services[name];const server=remote?.services[name];
            if (local.alert && local.state==='error' || server?.alert && server.state==='error') throw new Error('The service still has a problem. Update now to retry before clearing it.');
            if(server?.alert) {
                const result=await fetchJson('/api/integration-status',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({service:name,alertId:server.alert.id})});
                remote=result;
            }
            if(local.alert) state.acknowledge(name,local.alert.id);
            persist();
        },
        async pollPi() {
            if(!window.linuxRuntime || (window.linuxRole!=='worker' && !document.getElementById('dashboard')?.classList.contains('visible')) || pollBusy)return;
            pollBusy=true;
            try {
                const headers={'X-Octopus-Access-Key':getLinuxAccessKey()};
                const options={cache:'no-store',headers};
                if(window.linuxRole==='worker') {
                    const timing=getOverviewRefreshStatus();
                    options.method='POST';headers['Content-Type']='application/json';headers['X-Octopus-Worker']='1';
                    options.body=JSON.stringify({requestSeen:workerRequestSeen,octopusNextAt:timing.octopusNextAt,foxessNextAt:timing.foxessScheduleNextAt,octopusBusy:Boolean(busy.octopus),foxessBusy:Boolean(busy.foxess)});
                }
                remote=await fetchJson('/api/integration-status',options);
                window.linuxServiceEnabled=remote.serviceEnabled!==false;
                if(window.linuxRole==='worker' && remote.refreshRequestId>workerRequestSeen) {
                    workerRequestSeen=remote.refreshRequestId;requestWorkerDataRefresh();
                }
                const recovered=['octopus','foxess'].some(name=>state.service(name).channels['pi-status']?.ok===false);
                for(const name of ['octopus','foxess']) state.success(name,'pi-status');
                if(recovered)persist();else notify();
            } catch(error) {
                if(leaving)return;
                const revision=state.data.revision;
                for(const name of ['octopus','foxess']) state.failure(name,'pi-status',clean(error));
                persist(state.data.revision!==revision);
            }
            finally {pollBusy=false;}
        }
    };
    window.addEventListener('storage',event=>{if(event.key===key){try {state=new window.IntegrationState(JSON.parse(event.newValue));notify();}catch{}}});
    setInterval(()=>void window.integrationMonitor.pollPi(),5000);
})();
