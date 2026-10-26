/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * One Settings view. Engine-owned controls keep their IDs and event handlers.
 */
(() => {
  const pi = document.documentElement.dataset.devEdition !== 'web';
  const shell = document.getElementById('dev-shell');
  const grid = shell.querySelector('[data-page="settings"] .dev-page-grid');
  const make = (tag, className = '', text = '') => {
    const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  const action = (label, handler, danger = false) => {
    const node = make('button', `next-button secondary${danger ? ' is-danger' : ''}`, label);
    node.type = 'button'; node.addEventListener('click', handler); return node;
  };
  const card = (title, description) => {
    const node = make('section', 'next-panel');
    node.append(make('h2', 'next-panel-title', title), make('p', 'next-muted', description));
    grid.append(node); return node;
  };
  const previous = [...grid.children];
  grid.replaceChildren();

  const appearance = card('Appearance', 'Choose the appearance for this browser.');
  const choices = make('div', 'next-segmented'); choices.setAttribute('aria-label', 'Appearance');
  for (const [value, label] of [['light', 'Light'], ['dark', 'Dark']]) {
    const button = action(label, () => {
      if ((document.documentElement.dataset.theme || 'dark') !== value) toggleDarkMode();
    });
    button.dataset.themeChoice = value; choices.append(button);
  }
  appearance.append(choices);
  const syncAppearance = () => choices.querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === (document.documentElement.dataset.theme || 'dark')));
  });
  new MutationObserver(syncAppearance).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  syncAppearance();
  const displayActions = make('div', 'next-settings-actions');
  displayActions.append(action('Full screen', toggleFullScreen), action('Screen saver', toggleScreenSaver));
  appearance.append(displayActions);

  const refreshSettings=card('API refresh intervals', pi
    ? 'These intervals apply to the Pi worker. Smart Dispatch checks run at least once every 60 seconds.'
    : 'Set how often this browser reads each API. Keep this browser open and awake.');
  for(const [name,id,buttonId,title] of [['octopus','octo-interval-input','btn-apply-octo','Octopus Energy'],['foxess','fox-interval-input','btn-apply-fox','FoxESS']]) {
    const row=make('div','next-refresh-setting');
    const label=make('label','next-field',`${title} interval (seconds)`);label.htmlFor=id;
    const input=document.getElementById(id);input.min='10';input.max=name==='octopus' && pi?'60':'86400';input.step='1';
    label.append(input);const save=document.getElementById(buttonId);save.textContent='Save';
    row.append(label,save);refreshSettings.append(row);
  }
  refreshSettings.append(make('p','next-muted','Short intervals can reach API rate limits. FoxESS defaults to 600 seconds.'));

  const visibleStates = [];
  const visibility = card('Visible panels', 'Choose which panels to show on this device. This does not disable automation.');
  for (const [key, label] of [
    ['intelligentOctopus', 'Electricity prices'], ['foxessMode', 'Inverter schedule'],
    ['deviceSettings', 'Account and device'], ['smartCharging', 'Charging rules'], ['smartDischarging', 'Discharging rules']
  ]) {
    const input = document.getElementById(`show-section-${key}`);
    const row = make('label', 'next-toggle'); row.htmlFor = input.id;
    const state = make('span', 'next-visible-state'); state.setAttribute('aria-hidden', 'true');
    const control = make('span', 'next-visible-control'); control.append(state, input);
    const sync = () => { state.textContent = input.checked ? 'On' : 'Off'; state.dataset.on = String(input.checked); };
    visibleStates.push(sync); input.addEventListener('change', sync);
    row.append(make('span', '', label), control); visibility.append(row);
  }

  const syncVisibleStates = () => visibleStates.forEach(sync => sync());
  syncVisibleStates();
  new MutationObserver(syncVisibleStates).observe(document.getElementById('dashboard'), { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('dashboard-visibility-change', syncVisibleStates);

  if (pi) {
    const telemetry = card('FoxESS telemetry', 'Select the power-data source. Inverter commands always use the official REST API.');
    const selector = document.getElementById('live-ws-policy');
    const label = make('label', 'next-field', 'Power-data source'); label.htmlFor = selector.id;
    label.append(selector); telemetry.append(label, document.getElementById('live-ws-policy-state'));
    const access = card('Access on this device', 'Sign out of this dashboard. Your Pi continues to run the automation.');
    const signOut = action('Sign out', removeSavedAccessCode, true);
    signOut.classList.add('remove-access-button'); access.append(signOut);
  } else {
    const storage = card('Configuration backup', 'Save an encrypted copy of your setup, or load an existing configuration file.');
    const actions = make('div', 'next-settings-actions');
    actions.append(
      action('Save configuration', () => { document.getElementById('disclaimer-modal').style.display = 'flex'; }),
      action('Load configuration', () => document.getElementById('import-file').click())
    );
    storage.append(actions);
    const access = card('Saved browser data', 'Remove saved account data through the confirmation dialog. Export a backup before you continue.');
    access.append(action('Wipe saved data', () => { document.getElementById('wipe-modal').style.display = 'flex'; }, true));
  }
  const help = card('Help and application information', 'Read the setup guide, application licence and component notices.');
  const helpActions = make('div', 'next-settings-actions');
  helpActions.append(
    action(pi ? 'Access guide' : 'Web setup guide', () => toggleDrawer('setup-guide-panel')),
    action('About and licences', () => openLicenseModal(false))
  );
  help.append(helpActions);
  previous.forEach(node => { node.className = 'next-panel'; node.querySelector('h2')?.classList.add('next-panel-title'); grid.append(node); });

  // The old menu stays out of the layout. Remaining engine references remain valid.
  document.getElementById('dev-engine-elements').append(document.getElementById('app-menu-panel'));
})();
