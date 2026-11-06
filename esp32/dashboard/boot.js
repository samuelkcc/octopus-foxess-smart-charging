// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Separate from the application bundle so a script error cannot leave a blank page.
(function () {
 function recover() {
  if (document.documentElement.dataset.espUiReady === 'true') return;
  var panel = document.getElementById('esp-startup');
  if (!panel) return;
  panel.hidden = false;
  panel.querySelector('h1').textContent = 'Dashboard could not start';
  panel.querySelector('p').textContent = 'Reload this page. If the problem continues, report your browser and iOS version.';
  ['esp-welcome', 'dashboard'].forEach(function (id) { var node = document.getElementById(id); if (node) node.hidden = true; });
 }
 window.addEventListener('error', recover);
 setTimeout(recover, 15000);
}());
