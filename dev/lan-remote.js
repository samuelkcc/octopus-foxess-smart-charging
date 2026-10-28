/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * LAN-only administration. Explicit code verification, no stored management secret.
 */
(() => {
  if(document.documentElement.dataset.devEdition==='web' || window.desktopHost)return;
  const make=(tag,className='',text='')=>{const node=document.createElement(tag);node.className=className;node.textContent=text;return node;};
  const grid=window.dashboardNavigation.register('remote','Remote Access','Manage the tunnel from a protected local network connection.');
  const nav=document.querySelector('nav button[data-page="remote"]');
  const panel=make('section','next-panel wide');panel.append(make('h2','next-panel-title','Cloudflare Quick Tunnel'));
  const notice=make('p','next-muted','Enter your LAN access code. This code grants tunnel and key management. LAN HTTP is not encrypted. Use a trusted private network.');
  const label=(text,type='text')=>{const row=make('label','next-field');const input=make('input');input.type=type;input.autocomplete='off';row.append(make('span','',text),input);return {row,input};};
  const code=label('LAN access code','password');code.input.maxLength=64;
  const status=make('p','next-muted');status.setAttribute('role','status');
  const controls=make('div');controls.hidden=true;
  const url=label('Public URL');url.input.readOnly=true;
  const key=label('Remote Access Key','password');key.input.readOnly=true;
  const actions=make('div','next-settings-actions desktop-remote-actions');
  let accessCode='',expiresAt=0,visible=false,busy=false,lockTimer,generation=0;
  const lock=()=>{generation++;clearTimeout(lockTimer);accessCode='';expiresAt=0;visible=false;code.input.value='';key.input.value='';key.input.type='password';url.input.value='';controls.hidden=true;show.textContent='Show key';};
  const call=async(body,reveal=false)=>{
    if(!accessCode || Date.now()>=expiresAt){lock();throw Error('Enter the LAN access code again.');}
    const startedGeneration=generation;
    const response=await fetch(`/api/lan-remote-access${reveal?'?reveal=1':''}`,{method:body?'PUT':'GET',cache:'no-store',
      headers:{'Content-Type':'application/json','X-Octopus-Access-Key':accessCode},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(startedGeneration!==generation || !accessCode || Date.now()>=expiresAt)throw Error('Management locked. Enter the LAN access code again.');
    if(!response.ok){lock();throw Error(data.error || 'Remote access management failed.');}return data;
  };
  const refresh=async()=>{const data=await call();status.textContent=data.error || `Tunnel: ${data.state}.`;url.input.value=data.url || '';};
  const button=(text,handler)=>{const node=make('button','next-button secondary',text);node.type='button';node.addEventListener('click',async()=>{
    if(busy)return;busy=true;node.disabled=true;
    try{await handler();}catch(error){status.textContent=error.message;}finally{busy=false;node.disabled=false;}
  });return node;};
  const unlock=button('Unlock LAN management',async()=>{
    accessCode=code.input.value.trim();expiresAt=Date.now()+5*60000;
    await refresh();code.input.value='';controls.hidden=false;clearTimeout(lockTimer);lockTimer=setTimeout(lock,5*60000);
  });
  const copy=async value=>{
    if(!value)throw Error('No value is available yet.');
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
    else {
      const temporary=make('textarea');temporary.value=value;temporary.style.cssText='position:fixed;opacity:0;';document.body.append(temporary);
      try{temporary.select();if(!document.execCommand('copy'))throw Error('Copy is unavailable. Select Show key and copy it manually.');}
      finally{temporary.value='';temporary.remove();}
    }
    status.textContent='Copied.';
  };
  const show=button('Show key',async()=>{
    if(visible){visible=false;key.input.value='';key.input.type='password';show.textContent='Show key';return;}
    const data=await call(null,true);key.input.value=data.key||'';key.input.type='text';visible=true;show.textContent='Hide key';
  });
  actions.append(button('Update URL',async()=>{
    if(!window.confirm('Replace the public URL? Existing bookmarks will need the new address.'))return;
    await call({enabled:true,renewUrl:true});await refresh();
  }),button('Copy URL',async()=>{await refresh();await copy(url.input.value);}),show,button('Copy Key',async()=>{const data=await call(null,true);await copy(data.key);}),button('New key / Sign out all',async()=>{
    if(!window.confirm('Replace the remote key and sign out every remote browser?'))return;
    await call({enabled:true,rotateKey:true});visible=false;key.input.value='';key.input.type='password';show.textContent='Show key';await refresh();
  }),button('Lock management',async()=>{lock();status.textContent='Management locked.';}));
  controls.append(url.row,key.row,actions,make('p','next-muted','Update URL keeps the key. New key signs out remote browsers. Management locks after five minutes or when you leave this page.'));
  panel.append(notice,code.row,unlock,status,controls);grid.append(panel);
  const entry=make('section','next-panel');entry.append(make('h2','next-panel-title','Remote Access'),make('p','next-muted','Use your LAN access code to view the public URL or manage its key.'),button('Open Remote Access',async()=>window.dashboardNavigation.navigate('remote')));
  document.querySelector('[data-page="settings"] .dev-page-grid').append(entry);
  const capability=()=>{
    nav.hidden=!(window.linuxRuntime && !window.linuxRemoteAccess && window.linuxAccessRequired);
    entry.hidden=nav.hidden;
    if(nav.hidden){lock();if(!grid.closest('.dev-page').hidden)window.dashboardNavigation.navigate('settings');}
  };
  window.addEventListener('host-runtime-ready',capability);capability();
  new MutationObserver(()=>{if(grid.closest('.dev-page').hidden)lock();}).observe(grid.closest('.dev-page'),{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('pagehide',lock);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')lock();});
  setInterval(()=>{
    if(!accessCode)return;
    if(grid.closest('.dev-page').hidden || Date.now()>=expiresAt){lock();return;}
    if(!busy){busy=true;void refresh().catch(error=>{status.textContent=error.message;}).finally(()=>{busy=false;});}
  },5000);
})();
