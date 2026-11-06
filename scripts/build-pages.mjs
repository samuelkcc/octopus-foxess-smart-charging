// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'_site'),version=JSON.parse(await readFile('package.json','utf8')).version;
const download=`https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-${version}/`;
await mkdir(out,{recursive:true});
for(const file of ['index.html','guide.html','gallery.html','site.css','site.js','guide.js']){const text=(await readFile('website/'+file,'utf8')).replaceAll('/*VERSION*/',version).replaceAll('/*DOWNLOAD*/',download);await writeFile(path.join(out,file),text);}
await cp('linux/octopus-foxess.svg',path.join(out,'octopus-foxess.svg'));
await cp('docs/screenshots',path.join(out,'screenshots'),{recursive:true});
await cp('docs/tutorial',path.join(out,'tutorial'),{recursive:true});
await cp('website/tutorial.html',path.join(out,'tutorial/index.html'));
await mkdir(path.join(out,'app'),{recursive:true});await cp('dist/Smart_Charging.html',path.join(out,'app/index.html'));
for(const dir of [out,path.join(out,'app')]){await cp('src/site.webmanifest',path.join(dir,'site.webmanifest'));await cp('src/icons',path.join(dir,'icons'),{recursive:true});}
await cp('dist/esp32-deploy',path.join(out,'esp32'),{recursive:true});await writeFile(path.join(out,'.nojekyll'),'');
console.log('Built GitHub Pages: two home entries, edition guides, app/ and esp32/.');
