/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. Edition-specific setup view. */
(() => {
  const pi = document.documentElement.dataset.devEdition !== 'web';
  const guide = document.getElementById('setup-guide-panel');
  guide.classList.add('dev-setup-drawer');
  const guideClose = guide.querySelector('h3 span');
  const closeButton = document.createElement('button');
  closeButton.type = 'button'; closeButton.textContent = '×'; closeButton.setAttribute('aria-label','Close setup guide');
  closeButton.addEventListener('click', closeAllDrawers); guideClose.replaceWith(closeButton);
  const heading = guide.querySelector('h3');
  heading.childNodes[0].textContent = pi ? 'Pi dashboard access ' : 'Web setup guide ';
  guide.querySelector('p').textContent = 'Independent home energy automation software under GPL-3.0-or-later. Configure the edition you are using below.';
  if(pi) {
    const title=guide.querySelector('h3');guide.replaceChildren(title);
    const content=document.createElement('div');
    content.innerHTML='<h4>Local network</h4><ol><li>Open the dashboard address shown in Pi Server Configuration.</li><li>If LAN protection is enabled, enter the LAN access code.</li></ol><h4>Remote access</h4><ol><li>Open Remote Access from the Pi taskbar.</li><li>Copy the public URL.</li><li>Select Copy Key.</li><li>If you use Pi Connect, select Copy from remote.</li><li>Open the URL on your device.</li><li>Enter the Remote Access Key.</li></ol><p>The remote key is different from the LAN access code.</p><h4>Access times</h4><ul><li>The browser login lasts up to 12 hours.</li><li>The same key remains valid until replaced.</li><li>The URL changes when the tunnel restarts.</li></ul><h4>Account setup</h4><p>Manage Octopus and FoxESS credentials in the native Pi Server Configuration window. This dashboard does not need those credentials.</p>';
    guide.append(content);
  } else {
    const title=guide.querySelector('h3');guide.replaceChildren(title);
    const content=document.createElement('div');
    content.innerHTML='<h4>1. Octopus Energy</h4><ol><li>Open your <a href="https://octopus.energy/dashboard/new/accounts/personal-details/api-access" target="_blank" rel="noopener noreferrer">Octopus API Access page</a>.</li><li>Copy the account number and API key.</li><li>Enter both values in the setup form.</li></ol><h4>2. FoxESS</h4><ol><li>Sign in to <a href="https://www.foxesscloud.com/login" target="_blank" rel="noopener noreferrer">FoxESSCloud V1</a>.</li><li>Open User Profile → API Management.</li><li>Generate a private API token.</li><li>Enter that token in the setup form.</li><li>Find the inverter serial number in Device → Inverter.</li><li>Enter that serial number in the setup form.</li></ol><h4>3. Google relay</h4><p>The web edition needs your Google Apps Script relay. The Pi edition does not need that relay.</p><h4>Browser operation</h4><p>Keep the browser open and the device awake. Use one active automation browser.</p>';
    const instructions=document.createElement('button');instructions.type='button';instructions.textContent='View relay instructions';
    instructions.addEventListener('click',()=>{closeAllDrawers();document.getElementById('proxy-modal').style.display='flex';});
    content.insertBefore(instructions,content.querySelector('h4:last-of-type'));guide.append(content);
  }
  const purpose = document.querySelector('#why-use-panel > div');
  purpose.textContent = 'Intelligent Octopus Go supplies EV charging windows. In Self-Use mode, a FoxESS home battery can supply that EV load. This app schedules Force Charge during the charging windows. The dashboard shows the requested schedule and the measured power data.';
  const proxy = document.querySelector('#proxy-modal > div');
  const relayCode = proxy.querySelector('pre');
  const done = proxy.querySelector('button:last-child');
  const closeProxy = proxy.querySelector('button');
  proxy.replaceChildren();
  proxy.append(closeProxy);
  const relayHeading = document.createElement('h3'); relayHeading.textContent = 'Google Apps Script relay setup';
  const relayIntro = document.createElement('p'); relayIntro.textContent = 'The web edition needs a relay for FoxESS requests. The relay runs in your Google account.';
  const beforeCode = document.createElement('ol');
  beforeCode.innerHTML = '<li>Open <a href="https://script.google.com/" target="_blank" rel="noopener noreferrer">Google Apps Script</a>.</li><li>Sign in to your Google account.</li><li>Create a project.</li><li>Replace the example code with this code.</li>';
  const afterCode = document.createElement('ol'); afterCode.start = 5;
  afterCode.innerHTML = '<li>Select <strong>Deploy → New deployment</strong>.</li><li>Select <strong>Web app</strong> as the deployment type.</li><li>Set <strong>Execute as</strong> to <strong>Me</strong>.</li><li>Set <strong>Who has access</strong> to <strong>Anyone</strong>.</li><li>Deploy the project.</li><li>Complete the Google permission steps.</li><li>Copy the Web App URL that ends in <code>/exec</code>.</li><li>Paste that URL into <strong>Google Apps Script Relay URL</strong>.</li>';
  proxy.append(relayHeading,relayIntro,beforeCode,relayCode,afterCode,done);
  for (const id of ['acc','api','fox-sn','fox-token','gas-url','local-access-key']) {
    const input = document.getElementById(id);
    input.closest('.input-group')?.querySelector('label')?.setAttribute('for',id);
  }
  const menu = document.getElementById('app-menu-panel');
  const guideButton = document.createElement('button'); guideButton.type = 'button'; guideButton.textContent = pi ? 'Pi access & setup help' : 'Web setup guide';
  guideButton.addEventListener('click', () => { closeAllDrawers(); toggleDrawer('setup-guide-panel'); });
  menu.querySelector('div').append(guideButton);
})();
