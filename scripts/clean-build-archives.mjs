// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
// Explicit housekeeping only. Preserve current downloads, SDKs and unknown working files.
import {readFile,readdir,lstat,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const run=promisify(execFile);

export async function archivePlan(root){
 const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Cleanup requires a MAJOR.MINOR.PATCH package version.');
 const work=path.join(root,'.build');
 try{if(!(await lstat(work)).isDirectory())throw Error('Refusing a linked or non-directory .build path.');}
 catch(error){if(error.code==='ENOENT')return [];throw error;}
 const tracked=(await run('git',['ls-files','-z'],{cwd:root})).stdout.split('\0').filter(Boolean);
 const entries=await readdir(work,{withFileTypes:true});
 const generated=/^(?:artifacts-[A-Za-z0-9]{6}|dist-[A-Za-z0-9-]+-(?:packaging|output)|pre-final-dist-\d{8}|(?:published|release|esp32-setup)-v\d+\.\d+\.\d+)$/;
 const keep=new Set(['release-v'+version,'esp32-setup-v'+version,'published-v'+version]);
 const current=version.split('.').map(Number);
 const plan=[];
 for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
  if(!entry.isDirectory()||!generated.test(entry.name)||keep.has(entry.name))continue;
  const versioned=entry.name.match(/-v(\d+)\.(\d+)\.(\d+)$/);
  if(versioned){
   const candidate=versioned.slice(1).map(Number);
   const difference=candidate.map((part,index)=>part-current[index]).find(value=>value!==0)||0;
   if(difference>=0)continue;
  }
  const relative='.build/'+entry.name;
  if(tracked.some(file=>file===relative||file.startsWith(relative+'/')))throw Error('Refusing tracked archive: '+relative);
  plan.push(relative);
 }
 return plan;
}

export async function cleanBuildArchives(root,{apply=false}={}){
 const plan=await archivePlan(root);
 for(const relative of plan){
  // Recheck the full plan before each deletion. Never follow a replaced top-level symlink.
  if(apply){
   const fresh=await archivePlan(root);
   if(!fresh.includes(relative))throw Error('Archive changed during cleanup: '+relative);
   await rm(path.join(root,relative),{recursive:true});
  }
 }
 return plan;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 if(args.some(arg=>arg!=='--apply'))throw Error('Usage: npm run clean:archives -- [--apply]');
 const root=path.resolve(import.meta.dirname,'..'),apply=args.includes('--apply');
 const plan=await archivePlan(root);
 console.log(plan.join('\n')||'No obsolete packaging archives.');
 if(plan.length){
  const {stdout}=await run('du',['-sk',...plan],{cwd:root});
  const kib=stdout.trim().split('\n').reduce((sum,line)=>sum+Number(line.match(/^\d+/)[0]),0);
  console.log(`${plan.length} archives, ${(kib/1024/1024).toFixed(2)} GiB allocated.`);
 }
 if(apply){await cleanBuildArchives(root,{apply:true});console.log('Obsolete packaging archives removed.');}
 else console.log('Preview only. Use npm run clean:archives -- --apply to remove these archives.');
}
