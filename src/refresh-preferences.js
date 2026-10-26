/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * Refresh preferences share the existing encrypted Pi automation configuration.
 * Saving intervals does not send an inverter command.
 */
(() => {
  const normalize = (value, fallback, maximum=86400) => Number.isInteger(Number(value)) && Number(value)>=10 && Number(value)<=maximum ? Number(value) : fallback;
  const defaults = () => ({octopus:window.linuxRuntime?60:300,foxess:600});
  const values = () => ({octopus:getEffectiveOctopusRefreshInterval(),foxess:foxRefreshInterval});
  const load = saved => {
    const fallback=defaults();
    const next={octopus:normalize(saved?.octopus,fallback.octopus,window.linuxRuntime?60:86400),foxess:normalize(saved?.foxess,fallback.foxess)};
    for(const [name,id] of [['octopus','octo-interval-input'],['foxess','fox-interval-input']]) {
      const input=document.getElementById(id);
      if(input && document.activeElement!==input)input.value=next[name];
    }
    if(octoRefreshInterval!==next.octopus && window.nextOctoTime)window.nextOctoTime=Date.now()+next.octopus*1000;
    if(foxRefreshInterval!==next.foxess && window.nextFoxTime)window.nextFoxTime=Date.now()+next.foxess*1000;
    octoRefreshInterval=next.octopus;foxRefreshInterval=next.foxess;
    window.dispatchEvent(new Event('refresh-preferences-change'));
    return next;
  };
  const save = async (name,value) => {
    if(window.linuxRuntime && window.linuxRole==='worker')throw new Error('Change refresh intervals from Settings.');
    const state=window.linuxRuntime?await loadLinuxState():null;
    const automations=state?.automations || readStoredJson('foxAutomations',{});
    const next={...automations,refreshIntervals:{...values(),[name]:value}};
    if(window.linuxRuntime)await updateLinuxState({automations:next});
    localStorage.setItem('foxAutomations',JSON.stringify(next));
    load(next.refreshIntervals);
    showToast(window.linuxRuntime?'Refresh interval saved on the Pi. The worker loads it within 15 seconds.':'Refresh interval saved in this browser.');
  };
  const apply = name => {
    const octopus=name==='octopus';const input=document.getElementById(octopus?'octo-interval-input':'fox-interval-input');
    const value=Number(input.value);const maximum=octopus && window.linuxRuntime?60:86400;
    if(!Number.isInteger(value) || value<10 || value>maximum) {showToast(`Enter a whole number from 10 to ${maximum} seconds.`);return;}
    const commit=()=>save(name,value).catch(error=>showToast(`Could not save refresh interval: ${error.message}`));
    if(value<(octopus?60:600)) {
      const prefix=octopus?'octo':'fox';const modal=document.getElementById(`${prefix}-warning-modal`);
      modal.style.display='flex';
      document.getElementById(`cancel-${prefix}-btn`).onclick=()=>{modal.style.display='none';input.value=values()[name];};
      document.getElementById(`confirm-${prefix}-btn`).onclick=()=>{modal.style.display='none';void commit();};
      return;
    }
    return commit();
  };
  window.refreshPreferences={values,load,apply};
})();
