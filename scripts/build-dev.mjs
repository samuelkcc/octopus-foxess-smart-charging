// Build new Pi and standalone web views. Keep the original Pi view as a fallback.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const [baseText, css, js, about, setup, views, packageText, icon, defaultRoute] = await Promise.all([
  readFile(path.join(root, 'dist/Octopus_IGO_Smart_Charging_Detector.html'), 'utf8'),
  readFile(path.join(root, 'dev/ui.css'), 'utf8'),
  readFile(path.join(root, 'dev/ui.js'), 'utf8'),
  readFile(path.join(root, 'dev/about.js'), 'utf8'),
  readFile(path.join(root, 'dev/setup.js'), 'utf8'),
  readFile(path.join(root, 'dev/views.js'), 'utf8'),
  readFile(path.join(root, 'package.json'), 'utf8'),
  readFile(path.join(root, 'linux/octopus-foxess.svg'), 'utf8'),
  readFile(path.join(root, 'dev/default-route.js'), 'utf8')
]);
// A UI-only update reads the installed root file. Never copy its Pi router into web builds.
const base = baseText.replace(/<script id="dev-default-route">[\s\S]*?<\/script>\s*/g, '');
const revision = /^[0-9a-f]{40}$/.test(process.env.OCTOPUS_UI_COMMIT || '') ? process.env.OCTOPUS_UI_COMMIT : 'local-development';
const clientGuard = `<script>/* DEV is always a dashboard, never a second worker. */
const devUrl = new URL(location.href);
if (devUrl.searchParams.get('client') !== '1' || devUrl.searchParams.has('worker')) {
  devUrl.searchParams.delete('worker'); devUrl.searchParams.set('client', '1'); history.replaceState(null, '', devUrl);
}
</script>`;
function render(edition) {
const pi = edition === 'pi';
let output = base.replace('<head>', `<head>\n${pi ? '<base href="/">' : ''}\n<meta name="smart-charging-ui-revision" content="${revision}">\n<script>document.documentElement.dataset.devEdition='${edition}';</script>\n${pi ? clientGuard : ''}`)
  .replace('<title>Smart Charging Detector</title>', '<title>Smart Charging · Pi DEV</title>')
  .replace('content="Octopus FoxESS"', 'content="Smart Charging DEV"')
  .replace(/href="\.\/site\.webmanifest[^\"]*"/, 'href="/dev/site.webmanifest"')
  .replace('</head>', `<style>${css}</style></head>`)
  .replace('</body>', `<script>${js}\n${about}\n${setup}\n${views}</script></body>`);
if (!pi) output = output.replace('Smart Charging · Pi DEV</title>', 'Smart Charging · Web DEV</title>')
  .replace('href="/dev/site.webmanifest"', 'href="./site.webmanifest"')
  .replace('src="/octopus-foxess.svg"', `src="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}"`);
return output;
}
const output = render('pi');
await mkdir(path.join(root, 'dist/linux-package/octopus-foxess/web/dev'), { recursive:true });
await writeFile(path.join(root, 'dist/linux-package/octopus-foxess/web/dev/index.html'), output);
await writeFile(path.join(root, 'dist/linux-package/octopus-foxess/web/index.html'),
  base.replace('<head>', `<head>\n<script id="dev-default-route">${defaultRoute}</script>`));
await writeFile(path.join(root, 'dist/pi-dev.html'), output);
await writeFile(path.join(root, 'dist/Smart_Charging_UI_DEV.html'), render('web'));
await writeFile(path.join(root, 'dist/linux-package/octopus-foxess/web/dev/site.webmanifest'), await readFile(path.join(root, 'dev/site.webmanifest')));
console.log(`Built separate Pi and web DEV interfaces ${JSON.parse(packageText).version}; original dashboards retained.`);
