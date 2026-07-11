import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const prototypePath = path.join(root, 'prototype', 'Octoups_IGO_Smart_Charing_Detector.html');
const html = await readFile(prototypePath, 'utf8');

const primaryStyle = html.match(/<style>\s*([\s\S]*?)\s*<\/style>/);
const appScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1);

if (!primaryStyle || !appScript) {
  throw new Error('Could not find the prototype CSS or application script.');
}

let sourceHtml = html
  .replace(primaryStyle[0], '    <link rel="stylesheet" href="./styles.css">')
  .replace(appScript[0], '<script src="./app.js"></script>');

await mkdir(path.join(root, 'src'), { recursive: true });
await writeFile(path.join(root, 'src', 'index.html'), sourceHtml);
await writeFile(path.join(root, 'src', 'styles.css'), `${primaryStyle[1].trim()}\n`);
await writeFile(path.join(root, 'src', 'app.js'), `${appScript[1].trim()}\n`);

console.log('Created src/index.html, src/styles.css, and src/app.js from the prototype.');
