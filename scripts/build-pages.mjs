// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),out=path.join(root,'_site'),version=JSON.parse(await readFile('package.json','utf8')).version;
const download=`https://github.com/samuelkcc/octopus-foxess-smart-charging/releases/download/esp32-${version}/`;
await mkdir(out,{recursive:true});
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const inline=s=>escape(s).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,'<a href="$2">$1</a>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
const chapters=[];let current,list=false,table=false;
for(const line of (await readFile('docs/USER-GUIDE.md','utf8')).split('\n')){
 const heading=line.match(/^## (\d+)\. (.+)/);if(heading){if(current){if(list)current.html+='</ol>';if(table)current.html+='</table></div>';}list=table=false;current={number:Number(heading[1]),title:heading[1]+'. '+heading[2],html:'<h2>'+inline(heading[2])+'</h2>'};chapters.push(current);continue;}if(!current)continue;
 if(!line.trim()){if(list)current.html+='</ol>';if(table)current.html+='</table></div>';list=table=false;continue;}
 if(line.startsWith('### ')){current.html+='<h3>'+inline(line.slice(4))+'</h3>';continue;}
 if(line.startsWith('|')){if(/^\|[\s:|-]+\|$/.test(line))continue;const cell=table?'td':'th';if(!table)current.html+='<div class="guide-table"><table>';table=true;current.html+='<tr>'+line.split('|').slice(1,-1).map(c=>'<'+cell+'>'+inline(c.trim())+'</'+cell+'>').join('')+'</tr>';continue;}
 if(/^\d+\. /.test(line)){if(!list)current.html+='<ol>';list=true;current.html+='<li>'+inline(line.replace(/^\d+\. /,''))+'</li>';continue;}current.html+='<p>'+inline(line)+'</p>';
}
if(list)current.html+='</ol>';if(table)current.html+='</table></div>';
const setup=chapters.find(c=>c.number===4);
const setupSections=Object.fromEntries([...setup.html.matchAll(/<h3>([^<]+)<\/h3>([\s\S]*?)(?=<h3>|$)/g)].map(match=>[match[1],'<h2>'+match[1]+' setup</h2>'+match[2]]));
setup.byEdition={web:setupSections['Web edition'],pi:setupSections['Raspberry Pi'],portable:setupSections['Portable app']};
const editions={esp32:{name:'ESP32',intro:'For an independent local controller. Use desktop Chrome for USB deployment, or use the Mac or Windows setup app. Cloudflare is not supported.',chapters:[1,2,3,5,6,7,8,9,10,11,12]},pi:{name:'Raspberry Pi',intro:'For unattended operation on an always-on Pi. Install the service, then enter credentials in native Configuration. Protected Cloudflare access is optional.',chapters:[1,2,4,6,7,8,9,10,11,12]},portable:{name:'Portable app',intro:'For a computer that stays on. Configure accounts inside the app. Keep the host app open while automation runs.',chapters:[1,2,4,6,7,8,9,10,11,12]},web:{name:'HTML web app',intro:'For browser-based operation. Use the guided setup and your Google Apps Script relay. Keep this browser open and awake.',chapters:[1,2,4,6,7,8,9,10,11,12]}};
for(const file of ['index.html','guide.html','gallery.html','site.css','site.js','guide.js']){const text=(await readFile('website/'+file,'utf8')).replaceAll('/*VERSION*/',version).replaceAll('/*DOWNLOAD*/',download).replace('/*GUIDE_DATA*/',JSON.stringify({chapters,editions}).replaceAll('<','\\u003c'));await writeFile(path.join(out,file),text);}
await cp('linux/octopus-foxess.svg',path.join(out,'octopus-foxess.svg'));
await cp('docs/screenshots',path.join(out,'screenshots'),{recursive:true});
await mkdir(path.join(out,'app'),{recursive:true});await cp('dist/Smart_Charging.html',path.join(out,'app/index.html'));
for(const dir of [out,path.join(out,'app')]){await cp('src/site.webmanifest',path.join(dir,'site.webmanifest'));await cp('src/icons',path.join(dir,'icons'),{recursive:true});}
await cp('dist/esp32-deploy',path.join(out,'esp32'),{recursive:true});await writeFile(path.join(out,'.nojekyll'),'');
console.log('Built GitHub Pages: two home entries, edition guides, app/ and esp32/.');
