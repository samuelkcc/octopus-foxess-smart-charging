/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. Shared review UI, no credential handling. */
(() => {
// Shared, searchable inventory. Full legal texts remain bundled and unchanged.
const installAboutDetails=({host,components,edition,version,notices})=>{
 const firmware=edition==='esp32-dashboard',deploy=edition==='esp32-deploy',desktop=edition==='desktop',web=edition==='web';
 const nativeSetup=deploy && /Electron\//.test(navigator.userAgent);
 const title=firmware?'ESP32 dashboard':deploy?(nativeSetup?'Desktop USB setup':'Web USB setup'):desktop?'Desktop host':web?'Standalone web':'Raspberry Pi';
 const section=(tag,cls='',text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
 host.classList.add('sc-about-summary');host.replaceChildren();
 host.append(section('h3','','Smart Charging'),section('p','','Follow Octopus charging windows and apply your battery rules to FoxESS.'));
 const facts=section('dl','sc-about-facts');
 for(const [label,value] of [['Version',version],['Edition',title],['Developer','SCKC'],['Application licence','GPL-3.0-or-later']]){const row=section('div');row.append(section('dt','',label),section('dd','',value));facts.append(row);}host.append(facts);
 host.append(section('h3','','How this edition works'),section('p','',firmware?'The ESP32 runs the worker. Your phone or computer displays its state. Settings and rules survive a restart.':deploy?'Connect a supported ESP32-S3 N16R8 by USB. This tool installs firmware and configures Wi-Fi, IP addresses and service accounts.':desktop?'The desktop app runs the worker and local dashboard. Keep the computer awake and the app open.':web?'This browser runs the automation and uses your Google Apps Script relay. Keep the browser open and awake.':'The Pi runs the background worker. Phones and computers display the shared state. The dashboard can be closed.'));
 host.append(section('h3','','Services and data'),section('p','',deploy?'Setup data travels to your ESP32 over USB. The ESP32 tests its Wi-Fi and official Octopus and FoxESS API connections.':'Octopus Energy supplies charging windows and electricity prices. FoxESS supplies inverter readings and accepts schedule commands.'));
 if(!deploy)host.append(section('p','','Official REST readback confirms the programmed schedule. It does not establish measured battery behaviour.'));
 host.append(section('h3','','Software and rights'),section('p','','Copyright (C) 2026 SCKC. Application source is released under GPL-3.0-or-later, without warranty. Third-party components retain their own licences.'),section('p','','Independent software. Not endorsed or supported by Octopus Energy or FoxESS.'));
 const source=section('a','','Source code and releases');source.href='https://github.com/samuelkcc/octopus-foxess-smart-charging';source.target='_blank';source.rel='noopener noreferrer';host.append(source);
 const catalogue=[];
 const add=(name,version,licence,purpose,scope,match,url,sdk)=>catalogue.push({name,version,licence,purpose,scope,match,url,sdk});
 if(!deploy)add('Chart.js','4.4.9','MIT','Draws tariff and power-history charts.',firmware?'Bundled dashboard library':'Dashboard library',firmware?'ESP32 dashboard charts':'Chart.js','https://github.com/chartjs/Chart.js/tree/v4.4.9');
 if(firmware||deploy){
  add('Espressif ESP-IDF','5.5.2','Apache-2.0 + component licences','Provides the ESP32 firmware platform, Wi-Fi, HTTP server and flash interfaces.',deploy?'Installed firmware':'Firmware','ESP32 connection-test firmware','https://github.com/espressif/esp-idf/tree/v5.5.2','LICENSE');
  add('FreeRTOS','10.5.1 · ESP-IDF port','MIT','Runs background tasks and coordinates firmware work.','Firmware component',null,'https://github.com/espressif/esp-idf/tree/v5.5.2/components/freertos','components/freertos/FreeRTOS-Kernel/LICENSE.md');
  add('Mbed TLS','3.6.5 · ESP-IDF','Apache-2.0 OR GPL-2.0-or-later','Secures HTTPS requests and provides cryptographic functions.','Firmware component',null,'https://github.com/espressif/esp-idf/tree/v5.5.2/components/mbedtls','components/mbedtls/mbedtls/LICENSE');
  add('lwIP','ESP-IDF 5.5.2 component','BSD-3-Clause','Provides the firmware TCP/IP network stack.','Firmware component',null,'https://github.com/espressif/esp-idf/tree/v5.5.2/components/lwip','components/lwip/lwip/COPYING');
  add('cJSON','1.7.19','MIT','Reads and writes structured API and configuration data.','Firmware component',null,'https://github.com/DaveGamble/cJSON','components/json/cJSON/LICENSE');
 }
 if(firmware||deploy)add('nicois/foxess-control','Adapted integration','MIT','Supplies the original FoxESS portal protocol used for optional live telemetry.','Optional WebSocket telemetry','FoxESS web-portal signature integration','https://github.com/nicois/foxess-control');
 if(deploy){
  add('esptool-js','0.7.1','Apache-2.0','Installs firmware through the USB serial connection.','USB installer',null,'https://github.com/espressif/esptool-js/tree/v0.7.1');
  add('pako','2.1.0','MIT','Compresses firmware data for the browser installer.','esptool-js dependency',null,'https://github.com/nodeca/pako');
  add('atob-lite','2.0.0','MIT','Decodes Base64 data used by the installer.','esptool-js dependency',null,'https://github.com/hughsk/atob-lite');
 }
 if(!firmware&&!deploy){
  add('CryptoJS','4.1.1','MIT','Signs FoxESS API requests in the shared browser engine.','Dashboard library','CryptoJS','https://github.com/brix/crypto-js');
  if(!web){add('ws','8.21.1','MIT','Provides host WebSocket transport.','Host service','ws','https://github.com/websockets/ws');add('nicois/foxess-control','Adapted integration','MIT','Supplies the original FoxESS web-signature integration.','Optional experimental Live WS','FoxESS web-portal signature integration','https://github.com/nicois/foxess-control');add('cloudflared',desktop?'2026.10.4':'System-installed version','Apache-2.0','Provides optional Cloudflare Quick Tunnel remote access.',desktop?'Bundled host executable':'Optional separate installation','Cloudflare cloudflared','https://github.com/cloudflare/cloudflared');}
 }
 if(desktop||nativeSetup)add('Electron','45.0.0','MIT + Chromium notices','Provides the native application window and browser runtime.',nativeSetup?'USB setup host only':'Desktop host runtime','Electron','https://github.com/electron/electron/tree/v45.0.0');
 components.classList.add('sc-about-components');
 const heading=section('h3','','Built with'),copy=section('p','','Key runtime components are listed below. Search by name, purpose or licence. Complete notices include further bundled dependencies.');
 const search=section('input','sc-about-search');search.type='search';search.placeholder='Search components or licences…';search.setAttribute('aria-label','Search components or licences');
 const count=section('p','sc-about-count');count.setAttribute('role','status');const list=section('div','sc-about-list');components.prepend(heading,copy,search,count,list);
 let sdkText;
 const loadSdk=()=>sdkText ||= fetch(firmware?'/sdk-notices':'./firmware/SDK_NOTICES.txt',{cache:'force-cache'}).then(async r=>{if(!r.ok)throw Error('Bundled SDK notices unavailable.');return r.text();}).catch(e=>{sdkText=null;throw e;});
 const markdownSection=label=>{const heading='## '+label;const from=notices.indexOf(heading);if(from<0)return '';const until=notices.indexOf('\n## ',from+heading.length);return notices.slice(from,until<0?undefined:until).trim();};
 for(const item of catalogue){
  const detail=section('details','sc-about-component'),summary=section('summary');
  summary.append(section('strong','',item.name),section('span','',item.version+' · '+item.licence));detail.append(summary,section('p','',item.purpose),section('small','',item.scope));
  const link=section('a','','Source and upstream licence');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';detail.append(link);
  const text=section('pre');const bundled=item.match?markdownSection(item.match):'';
  if(bundled)text.textContent=bundled;
  else if(item.sdk)text.textContent='Open this entry to load the bundled firmware licence.';
  else if(deploy)text.textContent='Open this entry to read its bundled licence.';
  if(item.sdk||deploy){detail.addEventListener('toggle',async()=>{if(!detail.open||detail.dataset.loaded)return;try{
    if(item.sdk){
      const all=await loadSdk(),markers=[...all.matchAll(/^([^\n]+)\n={10,}\n/gm)],index=markers.findIndex(m=>m[1]===item.sdk);
      if(index<0)throw Error('Read the complete SDK notices below for this component.');
      text.textContent=all.slice(markers[index].index+markers[index][0].length,index+1<markers.length?markers[index+1].index:all.length).trim();
    }else if(!bundled){
      const r=await fetch(item.name==='esptool-js'?'./vendor/esptool-LICENSE.txt':'./vendor/DEPENDENCY_NOTICES.txt');if(!r.ok)throw Error('Bundled licence unavailable.');text.textContent=await r.text();
    }
    detail.dataset.loaded='true';
  }catch(error){text.textContent=error.message;}});}
  if(text.textContent)detail.append(text);list.append(detail);
  detail.dataset.search=[item.name,item.version,item.licence,item.purpose,item.scope].join(' ').toLowerCase();
 }
 const filter=()=>{const query=search.value.trim().toLowerCase();let visible=0;for(const detail of list.children){detail.hidden=!detail.dataset.search.includes(query);if(!detail.hidden)visible++;}count.textContent=visible+' of '+catalogue.length+' components';};search.addEventListener('input',filter);filter();
 if(firmware||deploy){
  const sdk=section('details'),summary=section('summary','','Complete firmware SDK licences'),text=section('pre','','Open to read all bundled firmware notices.');sdk.append(summary,text);components.append(sdk);
  sdk.addEventListener('toggle',async()=>{if(!sdk.open||sdk.dataset.loaded)return;try{text.textContent=await loadSdk();sdk.dataset.loaded='true';}catch(error){text.textContent=error.message;}});
 }
};
const aboutStyle=document.createElement('style');aboutStyle.textContent=`
.sc-about-summary h3,.sc-about-components h3{margin:22px 0 12px!important;font-size:16px}.sc-about-summary>h3:first-child{margin-top:0!important}
.sc-about-summary p,.sc-about-components p{font-size:13px;line-height:1.7;color:var(--text-muted);margin:0 0 14px}.sc-about-summary a,.sc-about-components a{display:inline-block;font-size:12px;margin:8px 14px 8px 0;color:var(--accent);overflow-wrap:anywhere}
.sc-about-facts{margin:18px 0}.sc-about-facts>div{display:flex;justify-content:space-between;gap:20px;padding:10px 0;border-bottom:1px solid var(--border);font-size:12px}.sc-about-facts dt{color:var(--text-muted)}.sc-about-facts dd{margin:0;text-align:right}
.sc-about-search{box-sizing:border-box;width:100%;min-height:44px;padding:10px 12px;font:inherit;font-size:13px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text-main)}
.sc-about-count{margin:10px 0!important;font-size:12px!important}.sc-about-list{display:grid;gap:10px;margin:16px 0}.sc-about-component{padding:14px!important;border:1px solid var(--border)!important;border-radius:10px;background:var(--bg)}
.sc-about-component summary{cursor:pointer;font-size:13px;line-height:1.6}.sc-about-component summary strong{font-weight:600}.sc-about-component summary span{display:block;font-size:11px;color:var(--text-muted);padding-left:16px}.sc-about-component p{margin:14px 0 6px!important}.sc-about-component small{display:block;font-size:11px;color:var(--text-muted)}
.sc-about-component pre{max-height:300px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.6 ui-monospace,monospace;background:var(--card-bg);padding:14px;border-radius:8px}.sc-about-component[hidden]{display:none!important}
.sc-about-components>details:not(.sc-about-component){margin:20px 0;padding:14px 0;border-top:1px solid var(--border)}
@media(max-width:600px){.sc-about-search{font-size:16px}}
`;document.head.append(aboutStyle);

  const installTabs=drawer=>{
    const tabs=[...drawer.querySelectorAll('[data-about-tab]')];
    const activate=tab=>tabs.forEach(button=>{const selected=button===tab;button.setAttribute('aria-selected',String(selected));drawer.querySelector('#'+button.getAttribute('aria-controls')).hidden=!selected;});
    tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const next=tabs[(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];activate(next);next.focus();});});
  };
  // USB deployment uses the same About owner, without the worker's licence acknowledgement store.
  if(['esp32-deploy','esp32-dashboard'].includes(document.documentElement.dataset.devEdition)){
    const drawer=document.getElementById('license-modal');
    const trigger=document.getElementById('open-about');
    const close=document.getElementById('close-about');
    const body=drawer.querySelector('.about-body');
    const existingDetails=[...body.querySelectorAll(':scope>details')].slice(0,2);
    const notices=existingDetails[1]?.querySelector('pre')?.textContent||'';
    const version=body.textContent.match(/(?:Version|Smart Charging)\s+([0-9.]+)/)?.[1]||'Development';
    const summary=document.createElement('section'),components=document.createElement('section');
    body.replaceChildren(summary,components,...existingDetails);
    installAboutDetails({host:summary,components,edition:document.documentElement.dataset.devEdition,version,notices});
    if(document.documentElement.dataset.devEdition==='esp32-dashboard'){
      const intro=document.createElement('div');intro.className='dev-about-intro';intro.innerHTML='<h3>Independent software. Clear attribution.</h3><p>Smart Charging is free software under GNU GPL version 3 or later. Complete terms and third-party notices are bundled below.</p>';
      const tabs=document.createElement('div');tabs.className='dev-notice-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','About and license sections');
      const licence=document.createElement('section');licence.append(existingDetails[0].querySelector('pre'));
      for(const [key,label,panel] of [['about','About',summary],['license','Application licence',licence],['components','Components',components]]){
        const tab=document.createElement('button');tab.type='button';tab.id='dev-tab-'+key;tab.dataset.aboutTab=key;tab.textContent=label;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','dev-notice-'+key);tab.setAttribute('aria-selected',String(key==='about'));tabs.append(tab);
        panel.id='dev-notice-'+key;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.hidden=key!=='about';
      }
      if(existingDetails[1]){existingDetails[1].querySelector('summary').textContent='Complete third-party notices';components.append(existingDetails[1]);}
      body.replaceChildren(intro,tabs,summary,licence,components);installTabs(drawer);
    }
    let focusBefore=null;


    trigger.addEventListener('click',()=>{
      if(!drawer.open){
        focusBefore=document.activeElement;drawer.showModal();
        document.getElementById('about-title').focus({preventScroll:true});
      }
    });
    close.addEventListener('click',()=>drawer.close());
    drawer.addEventListener('click',event=>{
      if(event.target!==drawer)return;
      const rect=drawer.getBoundingClientRect();
      if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)drawer.close();
    });
    drawer.addEventListener('close',()=>{if(focusBefore?.isConnected)focusBefore.focus();else trigger.focus();});
    return;
  }
  const pi = document.documentElement.dataset.devEdition !== 'web';
  const old = document.getElementById('license-modal');
  const version = old.querySelector('[data-app-version]').textContent;
  const fullLicense = old.querySelectorAll('details pre')[0].textContent;
  const componentNotices = old.querySelectorAll('details pre')[1].textContent;
  const footer = document.getElementById('license-modal-buttons');
  const drawer = document.createElement('dialog');
  drawer.id = 'license-modal';
  drawer.className = 'dev-about-drawer';
  drawer.style.display = 'none';
  drawer.setAttribute('aria-labelledby', 'dev-about-title');
  drawer.innerHTML = `<header class="dev-drawer-header"><div><span>SMART CHARGING · SCKC</span><h2 id="dev-about-title">About &amp; License</h2></div><button type="button" id="dev-about-close" aria-label="Close About and License">×</button></header><div class="dev-drawer-body"><div class="dev-about-intro"><h3>Independent software. Clear attribution.</h3><p>Smart Charging is free software under GNU GPL version 3 or later. Third-party components retain their own licences. The complete terms and notices are bundled below.</p></div><div class="dev-notice-tabs" role="tablist" aria-label="About and license sections"><button type="button" role="tab" id="dev-tab-about" aria-controls="dev-notice-about" aria-selected="true" data-about-tab="about">About</button><button type="button" role="tab" id="dev-tab-license" aria-controls="dev-notice-license" aria-selected="false" data-about-tab="license">Application licence</button><button type="button" role="tab" id="dev-tab-components" aria-controls="dev-notice-components" aria-selected="false" data-about-tab="components">Components</button></div><section id="dev-notice-about" role="tabpanel" aria-labelledby="dev-tab-about"><h3>Smart Charging</h3><p>For Intelligent Octopus Go and FoxESS. This independent community project is not affiliated with, endorsed by, or supported by Octopus Energy Ltd or FoxESS Co., Ltd. Product and company names belong to their respective owners.</p><section class="dev-about-purpose"><h3>Why this app exists</h3><p>During EV charging, a FoxESS inverter in Self-Use mode can supply the car from your home battery. This can leave less stored energy for your home.</p><p>Smart Charging connects Intelligent Octopus Go charging windows to your FoxESS battery schedule. It can set Force Charge during those windows to prevent the home battery from supplying the EV.</p><h3>How it works</h3><ol><li>Read the charging windows from Octopus Energy.</li><li>Apply your rules and battery limits to the FoxESS schedule.</li><li>Check the schedule through an official FoxESS REST readback.</li></ol><p>Price rules and weekly schedules provide additional charging and discharging options. Smart Dispatch protection takes priority under the default rules.</p><p>${document.documentElement.dataset.devEdition === 'desktop' ? 'The desktop worker runs while Smart Charging stays open. Closing the app stops automation and remote access.' : pi ? 'The Pi worker runs the automation continuously. You can close the desktop or mobile dashboard.' : 'The web edition runs automation in this browser and uses your Google Apps Script relay. Keep the browser open and awake.'}</p></section><h3>Application details</h3><dl class="dev-about-facts"><div><dt>Version</dt><dd id="dev-about-version"></dd></div><div><dt>Edition</dt><dd>${document.documentElement.dataset.devEdition === 'desktop' ? 'Desktop · local service and dashboard' : pi ? 'Raspberry Pi · service and dashboard' : 'Web · standalone browser'}</dd></div><div><dt>Developer</dt><dd>SCKC</dd></div><div><dt>Licence</dt><dd>GPL-3.0-or-later</dd></div></dl><p>Copyright (C) 2026 SCKC. You may redistribute and modify this software under GNU GPL version 3 or, at your option, any later version. It is supplied without warranty, including implied merchantability or fitness for a particular purpose.</p><p>The software controls physical hardware and depends on third-party APIs. Check the actual inverter behaviour after deliberately changing schedules.</p><p><a href="https://github.com/samuelkcc/octopus-foxess-smart-charging" target="_blank" rel="noopener noreferrer">Source code &amp; releases ↗</a></p></section><section id="dev-notice-license" role="tabpanel" aria-labelledby="dev-tab-license" hidden><p>Copyright (C) 2026 SCKC · SPDX: GPL-3.0-or-later</p><pre id="dev-license-text"></pre></section><section id="dev-notice-components" role="tabpanel" aria-labelledby="dev-tab-components" hidden><p>Bundled application libraries and optional Pi components retain their own terms. These notices are separate from the application's GPL licence.</p><pre id="dev-components-text"></pre></section></div><footer class="dev-drawer-footer"></footer>`;
  drawer.querySelector('.dev-drawer-footer').append(footer);
  old.replaceWith(drawer);
  drawer.querySelector('#dev-about-version').textContent = version;
  const revisionRow = document.createElement('div');
  const revisionLabel = document.createElement('dt'); revisionLabel.textContent = 'UI revision';
  const revisionValue = document.createElement('dd');
  revisionValue.textContent = document.querySelector('meta[name="smart-charging-ui-revision"]')?.content || 'local-development';
  revisionRow.append(revisionLabel,revisionValue);
  drawer.querySelector('.dev-about-facts').append(revisionRow);
  drawer.querySelector('#dev-license-text').textContent = fullLicense;
  drawer.querySelector('#dev-components-text').textContent = componentNotices;
  const componentsHost=drawer.querySelector('#dev-notice-components');
  const fullNotices=document.createElement('details'),fullSummary=document.createElement('summary');fullSummary.textContent='Complete third-party notices';fullNotices.append(fullSummary,drawer.querySelector('#dev-components-text'));componentsHost.replaceChildren(fullNotices);
  installAboutDetails({host:drawer.querySelector('#dev-notice-about'),components:componentsHost,edition:document.documentElement.dataset.devEdition,version,notices:componentNotices});
  // Use the existing acknowledgement store and handler in both editions.
  const engineOpenLicenseModal = openLicenseModal;
  const engineAcceptLicense = acceptLicense;
  let acknowledgementRequired = false;
  acceptLicense = () => {
    engineAcceptLicense();
    acknowledgementRequired = false;
  };
  openLicenseModal = () => {
    const firstUse = !localStorage.getItem('licenseAccepted');
    acknowledgementRequired = firstUse;
    engineOpenLicenseModal(firstUse);
    const action = footer.querySelector('button');
    action.type = 'button';
    action.textContent = firstUse ? 'Accept and Continue' : 'Close';
    action.classList.toggle('dev-license-accept', firstUse);
    action.style.removeProperty('background');
  };
  let focusBefore = null;
  const close = () => { drawer.style.display = 'none'; };
  drawer.querySelector('#dev-about-close').addEventListener('click', close);
  drawer.addEventListener('cancel', event => {
    if (acknowledgementRequired) event.preventDefault();
  });
  drawer.addEventListener('close', () => {
    // Some embedded browsers close native dialogs without a cancel event.
    if (acknowledgementRequired) {
      drawer.style.display = 'flex';
      if (!drawer.open) drawer.showModal();
      return;
    }
    drawer.style.display = 'none';
    if (focusBefore?.isConnected) focusBefore.focus();
  });
  new MutationObserver(() => {
    if (drawer.style.display === 'flex' && !drawer.open) {
      focusBefore = document.activeElement;
      drawer.querySelector('#dev-about-close').hidden = acknowledgementRequired;
      drawer.showModal();
    } else if (drawer.style.display === 'none' && drawer.open) drawer.close();
  }).observe(drawer, {attributes:true,attributeFilter:['style']});
  installTabs(drawer);
})();
