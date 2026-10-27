import { readFile, writeFile } from 'node:fs/promises';
const version = process.argv[2];
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version || '')) {
  throw new Error('Use MAJOR.MINOR.PATCH, e.g. 2.0.0');
}
const tag = `v${version}`;
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
pkg.version = version;
await writeFile('package.json', JSON.stringify(pkg, null, 2) + '\n');
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
lock.version = version;
lock.packages[''].version = version;
await writeFile('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
// Desktop metadata follows the same version when that optional package exists.
for (const file of ['desktop/package.json', 'desktop/package-lock.json']) {
  try {
    const desktop = JSON.parse(await readFile(file, 'utf8'));
    desktop.version = version;
    if (desktop.packages?.['']) desktop.packages[''].version = version;
    await writeFile(file, JSON.stringify(desktop, null, 2) + '\n');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
// Match both legacy calendar labels and the new three-part version.
const markup = await readFile('src/index.html', 'utf8');
await writeFile('src/index.html', markup.replace(/\?v=\d+(?:\.\d+){2,3}/g, `?v=${version}`)
  .replace(/Build v\d+(?:\.\d+){2,3}/g, `Build ${tag}`)
  .replace(/(data-app-version>)\d+(?:\.\d+){2,3}/, `$1${version}`));
const workflow = await readFile('.github/workflows/release.yml', 'utf8');
await writeFile('.github/workflows/release.yml', workflow.replace(/default: v\d+(?:\.\d+){2,3}/, `default: ${tag}`));
console.log(`Version ${version}; release tag ${tag}. Update CHANGELOG.md and RELEASE_NOTES.md, then run npm run check.`);
