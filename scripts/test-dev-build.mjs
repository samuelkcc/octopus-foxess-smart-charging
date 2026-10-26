import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const [pi, web, app, legacy, manifestText, root] = await Promise.all([
  'dist/pi-dev.html', 'dist/Smart_Charging.html',
  'dist/linux-package/octopus-foxess/web/app/index.html',
  'dist/linux-package/octopus-foxess/web/dev/index.html',
  'dist/linux-package/octopus-foxess/web/app/site.webmanifest',
  'dist/linux-package/octopus-foxess/web/index.html'
].map(read));

for (const html of [pi, web]) {
  assert(html.includes('<title>Smart Charging</title>'));
  assert(!html.includes('src="/octopus-foxess.svg"'), 'The brand icon must not depend on an old installed asset.');
  assert(html.includes('href="data:image/svg+xml;base64,'), 'The favicon must use the same embedded SVG.');
  assert(html.includes('href="data:image/png;base64,'), 'The phone icon must be included.');
  assert(html.includes('Pause automation'));
  assert(html.includes('history-retention'));
  assert(html.includes('automationControl'));
  assert(html.includes('next-visible-state'));
  assert(html.includes('window.installLaunchScreen'));
  assert(html.includes('meta name="smart-charging-version"'));
  assert(html.includes('Your EV, charging.'));
  assert(html.includes('Set up Smart Charging'));
  assert(html.includes('One Settings view.'), 'Both editions need the Settings adapter.');
}
const pkg=JSON.parse(await read('package.json'));
assert.equal(await read(`dist/Smart_Charging_v${pkg.version}.html`),web);
assert.equal(app, pi);
assert(pi.includes('DEV is always a dashboard'));
assert(!web.includes('DEV is always a dashboard'), 'Standalone automation must not receive the Pi client guard.');
assert(legacy.includes('/app/index.html'));
assert(!legacy.includes('function evaluateLocalAutomations'), 'The old client route must only redirect.');
assert.equal((root.match(/id="dev-default-route"/g) || []).length, 1);
const manifest = JSON.parse(manifestText);
assert.equal(manifest.name, 'Smart Charging');
assert.equal(manifest.scope, '/app/');
assert(!manifest.start_url.includes('/dev/'));
for (const icon of manifest.icons) {
  const bytes = await readFile(new URL(`../dist/linux-package/octopus-foxess/web${icon.src}`, import.meta.url));
  assert(bytes.length > 0);
}
console.log('Pi and standalone build assets, branding, Settings and client routing passed.');
