import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

const [html, css, app, pause, integrationState, monitor, refreshPreferences] = await Promise.all([
  readFile(path.join(src, 'index.html'), 'utf8'),
  readFile(path.join(src, 'styles.css'), 'utf8'),
  readFile(path.join(src, 'app.js'), 'utf8'),
  readFile(path.join(src, 'automation-control.js'), 'utf8'),
  readFile(path.join(root, 'linux/integration-state.mjs'), 'utf8'),
  readFile(path.join(src, 'integration-monitor.js'), 'utf8'),
  readFile(path.join(src, 'refresh-preferences.js'), 'utf8'),
]);

const js = `(()=>{${integrationState.replace('export class IntegrationState', 'class IntegrationState')}\nwindow.IntegrationState=IntegrationState;})();\n${pause}\n${monitor}\n${app}\n${refreshPreferences}`;
const escapeText = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const [license, notices] = await Promise.all(['LICENSE', 'THIRD_PARTY_NOTICES.md'].map(name => readFile(path.join(root, name), 'utf8')));
const output = html
  .replace('__FULL_LICENSE__', () => escapeText(license))
  .replace('__THIRD_PARTY_NOTICES__', () => escapeText(notices))
  .replace(/\s*<link rel="stylesheet" href="\.\/styles\.css(?:\?[^"]*)?">/, `\n    <style>\n${css}\n    </style>`)
  .replace(/<script src="\.\/app\.js(?:\?[^"]*)?"><\/script>/, `<script>\n${js}\n</script>`);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(path.join(dist, 'Octopus_IGO_Smart_Charging_Detector.html'), output);

console.log('Built dist/Octopus_IGO_Smart_Charging_Detector.html');
