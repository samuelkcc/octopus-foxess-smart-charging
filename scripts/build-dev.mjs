// Build a separate real-data Pi dashboard. Never replaces the original index.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const [base, css, js, packageText] = await Promise.all([
  readFile(path.join(root, 'dist/Octopus_IGO_Smart_Charging_Detector.html'), 'utf8'),
  readFile(path.join(root, 'dev/ui.css'), 'utf8'),
  readFile(path.join(root, 'dev/ui.js'), 'utf8'),
  readFile(path.join(root, 'package.json'), 'utf8')
]);
const clientGuard = `<script>/* DEV is always a dashboard, never a second worker. */
const devUrl = new URL(location.href);
if (devUrl.searchParams.get('client') !== '1' || devUrl.searchParams.has('worker')) {
  devUrl.searchParams.delete('worker'); devUrl.searchParams.set('client', '1'); history.replaceState(null, '', devUrl);
}
</script>`;
const output = base.replace('<head>', `<head>\n<base href="/">\n${clientGuard}`)
  .replace('<title>Smart Charging Detector</title>', '<title>Smart Charging · Pi DEV</title>')
  .replace('content="Octopus FoxESS"', 'content="Smart Charging DEV"')
  .replace(/href="\.\/site\.webmanifest[^\"]*"/, 'href="/dev/site.webmanifest"')
  .replace('</head>', `<style>${css}</style></head>`)
  .replace('</body>', `<script>${js}</script></body>`);
await mkdir(path.join(root, 'dist/linux-package/octopus-foxess/web/dev'), { recursive:true });
await writeFile(path.join(root, 'dist/linux-package/octopus-foxess/web/dev/index.html'), output);
await writeFile(path.join(root, 'dist/pi-dev.html'), output);
await writeFile(path.join(root, 'dist/linux-package/octopus-foxess/web/dev/site.webmanifest'), await readFile(path.join(root, 'dev/site.webmanifest')));
console.log(`Built Pi DEV dashboard ${JSON.parse(packageText).version}; original dashboard retained.`);
