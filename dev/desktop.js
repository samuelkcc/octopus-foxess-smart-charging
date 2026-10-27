/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * Desktop-only administration. LAN and tunnel clients never receive this bridge.
 */
(() => {
  const host=window.desktopHost;
  if(!host)return;
  document.body.classList.add('desktop-host');
  const make=(tag,className='',text='')=>{const node=document.createElement(tag);node.className=className;node.textContent=text;return node;};
  const button=(text,handler,secondary=true)=>{
    const node=make('button',secondary?'next-button secondary':'next-button',text);node.type='button';
    node.addEventListener('click',async()=>{node.disabled=true;try{await handler();}catch(error){showToast(error.message);}finally{node.disabled=false;}});return node;
  };
  const panel=(title,description)=>{const node=make('section','next-panel');node.append(make('h2','next-panel-title',title),make('p','next-muted',description));return node;};
  const field=(label,type='text')=>{const row=make('label','next-field');const input=make('input');input.type=type;input.autocomplete='off';row.append(make('span','',label),input);return {row,input};};
  const toggle=label=>{const row=make('label','next-toggle');const input=make('input');input.type='checkbox';row.append(make('span','',label),input);return {row,input};};
  const configuration=()=>{
    const form=make('form','desktop-configuration');
    const credentials=make('div','next-field-grid');
    const fields={};
    for(const [name,label,type] of [['acc','Octopus account number','text'],['api','Octopus API key','password'],['foxSN','FoxESS serial number','text'],['foxToken','FoxESS API token','password']]){
      fields[name]=field(label,type);credentials.append(fields[name].row);
    }
    const access=toggle('Require a LAN access code');const code=field('LAN access code','password');
    code.input.minLength=8;code.input.maxLength=64;
    const secret=make('div','desktop-secret-control');
    const reveal=button('',async()=>{
      const showing=code.input.type==='password';code.input.type=showing?'text':'password';
      reveal.setAttribute('aria-label',showing?'Hide LAN access code':'Show LAN access code');
      reveal.setAttribute('aria-pressed',String(showing));
    });
    reveal.classList.add('desktop-secret-toggle');reveal.setAttribute('aria-label','Show LAN access code');reveal.setAttribute('aria-pressed','false');
    reveal.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    secret.append(code.input,reveal);code.row.append(secret);
    const lan=make('div','desktop-code-actions');lan.append(code.row,button('Copy LAN code',()=>host.copyLanCode()));
    const live=toggle('Enable FoxESS Live WS telemetry');
    fields.foxWebUsername=field('FoxCloud web-login account');fields.foxWebPassword=field('FoxCloud web-login password','password');
    const advanced=make('details','desktop-advanced');
    const liveCredentials=make('div','next-field-grid');liveCredentials.append(fields.foxWebUsername.row,fields.foxWebPassword.row);
    advanced.append(make('summary','','Optional live telemetry'),live.row,liveCredentials);
    const status=make('p','next-muted');status.setAttribute('role','status');
    const save=make('button','next-button','Save configuration');save.type='submit';
    form.append(credentials,access.row,lan,advanced,status,save);
    const load=async()=>{
      const state=await host.configuration();
      for(const [name,control] of Object.entries(fields))control.input.value=state.credentials?.[name]||'';
      access.input.checked=state.accessRequired;code.input.value=state.accessKey||'';live.input.checked=state.liveWsEnabled;
      status.textContent='These credentials stay on this PC. Remote clients cannot change them.';
    };
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!form.reportValidity())return;
      save.disabled=true;status.textContent='Saving configuration…';
      try{
        const values=Object.fromEntries(Object.entries(fields).map(([name,control])=>[name,control.input.value.trim()]));
        if(!values.acc || !values.api)throw new Error('Enter the Octopus account number and API key.');
        values.foxLiveMode=live.input.checked?'live-ws':'rest';
        await host.saveConfiguration({credentials:values,accessRequired:access.input.checked,accessKey:code.input.value,liveWsEnabled:live.input.checked});
        status.textContent='Saved. The worker will load the new setup. Opening Welcome…';
        location.reload();
      }catch(error){status.textContent=error.message;}finally{save.disabled=false;}
    });
    void load().catch(error=>{status.textContent=error.message;});
    return form;
  };
  const settings=document.querySelector('.dev-page[data-page="settings"] .dev-page-grid');
  const account=panel('Service configuration','Manage this PC’s energy accounts and local dashboard protection.');
  account.dataset.setting='desktop-service';const accountDetails=make('details');accountDetails.append(make('summary','','Accounts, LAN access and live telemetry'),configuration());account.append(accountDetails);settings.prepend(account);
  const login=document.getElementById('login-layout');
  const setup=login.querySelector('.launch-setup');
  const parking=document.getElementById('dev-engine-elements');
  [...setup.children].forEach(node=>parking.append(node));
  setup.append(make('span','launch-eyebrow','SET UP THIS PC'),make('h2','','Connect your energy accounts'),make('p','next-auth-copy','No Google relay is required. Use one automation host for each inverter.'),configuration());
  const actions=make('div','next-settings-actions');actions.append(button('Account setup guide',()=>toggleDrawer('setup-guide-panel')),button('Back to Welcome',()=>{login.dataset.mode='welcome';}));setup.append(actions);
  login.querySelector('.launch-operation').textContent='Keep Smart Charging open. Minimizing continues automation. Closing the app stops the service.';
  const configure=button('Configure this PC',()=>{login.dataset.mode='setup';});
  login.querySelector('.launch-art .launch-links').prepend(configure);
  document.querySelector('[data-setting="updates"]')?.remove();
  document.querySelector('[data-setting="access-on-this-device"]')?.remove();
  const updates=panel('Application updates','Smart Charging runs while this desktop app stays open.');
  updates.append(make('p','next-muted','To update, close Smart Charging and replace the portable EXE. Settings and history remain in your Windows user profile.'));
  settings.append(updates);
  const remote=window.dashboardNavigation.register('remote','Remote Access','Connect another device over your local network or a protected Cloudflare URL.');
  const localPanel=panel('Local network','Your PC and the app must stay on. Allow access only on your trusted private network.');
  const addresses=make('div','desktop-lan-addresses');localPanel.append(addresses,button('Copy LAN code',()=>host.copyLanCode()));remote.append(localPanel);
  const tunnel=panel('Cloudflare Quick Tunnel','Create a random HTTPS URL. Remote access uses its own 256-bit key.');
  const stateText=make('p','next-muted');stateText.setAttribute('role','status');
  const publicUrl=field('Public URL');publicUrl.input.readOnly=true;
  const key=field('Remote Access Key','password');key.input.readOnly=true;
  const show=toggle('Show remote key');show.input.addEventListener('change',()=>{key.input.type=show.input.checked?'text':'password';});
  const operations=make('div','next-settings-actions desktop-remote-actions');
  operations.append(button('Start Quick Tunnel',async()=>{await host.setRemoteAccess({enabled:true});await updateRemote();},false),button('Stop tunnel',async()=>{await host.setRemoteAccess({enabled:false});await updateRemote();}),button('Copy URL',()=>host.copyPublicUrl()),button('Copy Key',()=>host.copyRemoteKey()));
  const rotate=button('New key / Sign out all',async()=>{
    const confirmed=await window.confirm('Replace the remote key and sign out every remote browser?');
    if(confirmed){await host.setRemoteAccess({enabled:true,rotateKey:true});await updateRemote();}
  });
  const security=make('div','desktop-remote-security');
  security.append(make('p','next-muted','Replacing the key signs out every remote browser.'),rotate);
  tunnel.append(stateText,publicUrl.row,key.row,show.row,operations,security,make('p','next-muted','The URL stays while this tunnel runs. Restarting the app creates a new URL. Browser sessions last up to 12 hours.'));
  remote.append(tunnel);
  async function updateRemote(){
    const state=await host.remoteAccess();
    stateText.textContent=state.error || `Tunnel: ${state.state}.`;
    publicUrl.input.value=state.url||'';key.input.value=state.key||'';
  }
  async function refreshStatus(){
    const state=await host.status();addresses.replaceChildren();
    for(const address of state.lanUrls||[]){const link=make('p','',address);addresses.append(link);}
    await updateRemote();
  }
  void refreshStatus().catch(error=>{stateText.textContent=error.message;});
  setInterval(()=>{if(!remote.closest('.dev-page').hidden)void updateRemote().catch(error=>{stateText.textContent=error.message;});},5000);
})();
