/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. Shared review UI, no credential handling. */
(() => {
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
  const tabs = [...drawer.querySelectorAll('[data-about-tab]')];
  const activate = tab => {
    tabs.forEach(button => {
      const selected = button === tab;
      button.setAttribute('aria-selected', String(selected));
      drawer.querySelector(`#dev-notice-${button.dataset.aboutTab}`).hidden = !selected;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault(); const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      activate(next); next.focus();
    });
  });
})();
