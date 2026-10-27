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
    content.innerHTML='<h4>Local network</h4><ol><li>Open the dashboard address shown in Pi Configuration.</li><li>If LAN protection is enabled, enter the LAN access code.</li></ol><h4>Remote access</h4><ol><li>Open Remote Access from the Pi taskbar.</li><li>Copy the public URL.</li><li>Select Copy Key.</li><li>If you use Pi Connect, select Copy from remote.</li><li>Open the URL on your device.</li><li>Enter the Remote Access Key.</li></ol><p>The remote key is different from the LAN access code.</p><h4>Access times</h4><ul><li>The browser login lasts up to 12 hours.</li><li>The same key remains valid until replaced.</li><li>The URL changes when the tunnel restarts.</li></ul><h4>Account setup</h4><p>Manage Octopus and FoxESS credentials in the native Pi Configuration window. This dashboard does not need those credentials.</p>';
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

// Launch presentation. Keep the engine-owned inputs and connect handler intact.
window.installLaunchScreen = ({ pi, login, parking, byId, make, button, onEnter }) => {
  [...login.children].forEach(node => parking.append(node));
  login.className = 'next-login launch-screen';
  login.dataset.mode = 'welcome';
  const hostName = document.documentElement.dataset.devEdition === 'desktop' ? 'PC' : 'Pi';
  const welcome = make('section', 'launch-welcome');
  const brand = document.querySelector('.dev-brand img').cloneNode(true);
  brand.width = 58; brand.height = 58; brand.alt = '';
  welcome.append(brand, make('span', 'launch-eyebrow', 'SMART CHARGING · VERSION ' + document.querySelector('meta[name="smart-charging-version"]').content));
  const heading = make('h1', '', 'Your EV, charging.');
  heading.append(make('br'), make('span', '', 'Your home, protected.'));
  welcome.append(heading, make('p', 'launch-intro', 'Connect Octopus charging windows to your FoxESS battery. Keep your energy controls in one place.'));
  const welcomeActions = make('div', 'launch-actions');
  const start = button(pi ? 'Open dashboard' : 'Set up Smart Charging', () => {
    if(login.dataset.ready==='true') onEnter(); else openSetup();
  });
  start.className = 'next-button'; welcomeActions.append(start);
  if (!pi) welcomeActions.append(button('Restore a saved setup', () => byId('import-file').click(), true));
  welcome.append(welcomeActions);
  const flow = make('div', 'launch-flow'); flow.setAttribute('aria-label', 'How Smart Charging works');
  for (const [index, title, text] of [[1, 'Octopus Energy', 'Find your EV charging windows'], [2, 'Smart Charging', 'Check your rules and safeguards'], [3, 'FoxESS', 'Set and confirm the battery schedule']]) {
    const node = make('div', 'launch-flow-item');
    node.append(make('span', 'launch-flow-number', String(index)));
    const copy = make('div'); copy.append(make('strong', '', title), make('small', '', text)); node.append(copy); flow.append(node);
  }
  welcome.append(flow);
  const operation = make('p', 'launch-operation', pi ? `Your ${hostName} runs the automation. You can close this dashboard.` : 'Automation runs in this browser. Keep it open and awake.');
  welcome.append(operation);
  const welcomeTools = make('div', 'launch-links');
  welcomeTools.append(button(pi ? 'Access guide' : 'Setup guide', () => toggleDrawer('setup-guide-panel'), true), button('About & licences', () => openLicenseModal(false), true));
  welcome.append(welcomeTools);

  const introArt = make('section', 'launch-art'); introArt.setAttribute('aria-label', 'EV and home battery protection');
  introArt.innerHTML = '<span class="launch-eyebrow">YOUR HOME ENERGY, CONNECTED</span><div class="launch-art-orbit"><svg viewBox="0 0 320 230" fill="none" aria-hidden="true"><path class="launch-wire" d="M65 80h190v95H65z"/><rect x="20" y="48" width="90" height="65" rx="14"/><path d="m38 87 14-22h27l14 22M39 87h53M45 100h7m28 0h7"/><circle cx="47" cy="86" r="2"/><circle cx="84" cy="86" r="2"/><path d="m215 160 40-35 40 35v42h-80zM245 202v-30h20v30"/><rect x="137" y="102" width="46" height="62" rx="12"/><path class="launch-bolt" d="m164 115-12 20h16l-12 20"/></svg><span class="launch-art-pill">Charging windows → Battery protection</span></div><div class="launch-art-note"><strong>One clear view of your energy.</strong><p>Review schedules, follow Smart Dispatch, and pause app control when you need a temporary setting.</p></div>';

  // The welcome and sign-in pages share one full-height, two-panel frame.
  const illustration = introArt.querySelector('.launch-art-orbit');
  welcome.insertBefore(illustration, flow);
  introArt.replaceChildren(make('span', 'launch-eyebrow', 'YOUR HOME ENERGY WORKSPACE'), make('h2', '', 'Open your home energy workspace'), make('p', '', 'Connect your accounts, review charging windows, and keep your home battery protected.'), welcomeActions, welcomeTools);
  const auth = make('section', 'next-auth-card launch-setup');
  auth.append(make('span', 'launch-eyebrow', pi ? 'PI DASHBOARD ACCESS' : 'CONNECT YOUR ACCOUNTS'), make('h2', '', pi ? 'Open your dashboard' : 'A few details. Then you’re connected.'));
  auth.append(make('p', 'next-auth-copy', pi ? 'Use your LAN access code or the separate Remote Access Key.' : 'Your Octopus account, FoxESS device, and Google relay work together here.'));
  const error = byId('error'); error.setAttribute('role', 'alert'); auth.append(error);
  const sections = [];
  const steps = make('nav', 'launch-steps'); steps.setAttribute('aria-label', 'Account setup steps');
  let currentStep = 0;
  const stepButtons = [];
  if (pi) auth.append(document.querySelector('.linux-access-group'));
  else {
    const fields = [
      ['Octopus Energy', 'Read EV charging windows and electricity prices.', [['acc', 'Account number'], ['api', 'API key']]],
      ['FoxESS', 'Connect the inverter and home battery.', [['fox-sn', 'Inverter serial number'], ['fox-token', 'API token']]],
      ['Google relay', 'Use your own deployed Google Apps Script Web App.', [['gas-url', 'Google Apps Script Web App URL']]]
    ];
    const stepStack = make('div', 'launch-step-stack');
    auth.append(steps, stepStack);
    fields.forEach(([title, description, inputs], index) => {
      const section = make('section', 'launch-step');
      const titleNode = make('h3', '', title); titleNode.tabIndex = -1;
      section.append(titleNode, make('p', 'next-auth-copy', description));
      for (const [id, label] of inputs) {
        const row = make('div', 'next-field'); const caption = make('label', '', label); caption.htmlFor = id;
        const control = make('div', 'launch-input'); control.append(byId(id));
        if (id === 'acc') control.append(byId('octopus-account-toggle'));
        row.append(caption, control); section.append(row);
      }
      if (index === 2) section.append(button('How to create the relay', () => { closeAllDrawers(); byId('proxy-modal').style.display = 'flex'; }, true));
      stepStack.append(section); sections.push(section);
      const step = button(`${index + 1}. ${title}`, () => showStep(index)); step.className = 'launch-step-tab'; steps.append(step); stepButtons.push(step);
    });
  }
  const session = make('p', 'next-session-note'); session.id = 'next-session-copy'; auth.append(session);
  const actions = make('div', 'launch-setup-actions');
  const back = button('Back', () => currentStep ? showStep(currentStep - 1) : closeSetup(), true);
  const next = button('Continue', () => {
    const required = currentStep === 0 ? ['acc', 'api'] : [];
    for (const id of required) {
      const input = byId(id);
      if (!input.value.trim()) { input.setCustomValidity('Complete this field to continue.'); input.reportValidity(); input.setCustomValidity(''); return; }
    }
    showStep(currentStep + 1);
  });
  const connect = byId('btn');
  connect.style.removeProperty('margin-top');
  // A deliberate Connect also requests entry after the async connection finishes.
  connect.addEventListener('click', onEnter);
  actions.append(back, next, connect); auth.append(actions);
  const tools = make('div', 'launch-links');
  tools.append(button(pi ? 'Access help' : 'Setup guide', () => toggleDrawer('setup-guide-panel'), true), button('About & licences', () => openLicenseModal(false), true));
  if (!pi) tools.append(button('Load saved setup', () => byId('import-file').click(), true), button('Manage saved data', () => { byId('wipe-modal').style.display = 'flex'; }, true));
  auth.append(tools); login.append(welcome, introArt, auth);

  function showStep(index, focus = true) {
    currentStep = Math.max(0, Math.min(2, index));
    sections.forEach((section, step) => {
      const active = currentStep === step;
      section.dataset.active = String(active);
      section.inert = !active;
      section.setAttribute('aria-hidden', String(!active));
    });
    stepButtons.forEach((step, index) => step.setAttribute('aria-current', index === currentStep ? 'step' : 'false'));
    next.hidden = pi || currentStep === 2; connect.hidden = !pi && currentStep !== 2; back.hidden = pi;
    if (focus) sections[currentStep]?.querySelector('h3').focus({ preventScroll: true });
  }
  function openSetup() {
    login.dataset.mode = 'setup';
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }));
    if (!pi) showStep(currentStep);
    else byId('local-access-key').focus({ preventScroll: true });
  }
  function closeSetup() { login.dataset.mode = 'welcome'; start.focus({ preventScroll: true }); }
  if (!pi) showStep(0, false);
  else { next.hidden = true; back.hidden = false; }
  new MutationObserver(() => { if (error.style.display === 'block' && !pi) openSetup(); }).observe(error, { attributes: true, attributeFilter: ['style'] });
  return { session, updateConnection(connected) {
    login.dataset.ready=String(connected);
    start.textContent=connected?'Open dashboard':pi?'Continue to sign in':'Set up Smart Charging';
    introArt.querySelector('p').textContent=connected
      ? pi?`Your ${hostName} is connected. Open the dashboard to review your home energy.`:'Your accounts are connected. Open the dashboard to review your home energy.'
      : 'Connect your accounts, review charging windows, and keep your home battery protected.';
  } };
};
