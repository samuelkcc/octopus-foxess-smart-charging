// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,stat,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {archivePlan,cleanBuildArchives} from './clean-build-archives.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'sc-archive-cleanup-'));
const put=async file=>{await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),'retain');};
try{
 execFileSync('git',['init','--quiet'],{cwd:root});
 await writeFile(path.join(root,'package.json'),JSON.stringify({version:'2.5.6'}));
 assert.deepEqual(await archivePlan(root),[]);
 const removed=['artifacts-AbC123','dist-243-before-244-packaging','dist-250-check-output','pre-final-dist-20261105','release-v2.5.5','esp32-setup-v2.5.5','published-v2.2.0'];
 const retained=['esp32-sdk','esp32-firmware','tutorial-252','artifacts-not-generated','release-notes','release-v2.5.6','esp32-setup-v2.5.6','published-v2.5.6','release-v2.6.0','esp32-setup-v3.0.0','my-source'];
 for(const name of [...removed,...retained])await put('.build/'+name+'/keep.txt');
 await put('src/app.js');await put('docs/README.md');await put('dist/current.zip');
 await symlink(path.join(root,'src'),path.join(root,'.build/artifacts-Link12'));
 await symlink(path.join(root,'src'),path.join(root,'.build/artifacts-AbC123/source-link'));
 assert.deepEqual((await cleanBuildArchives(root)).sort(),removed.map(name=>'.build/'+name).sort());
 for(const name of removed)assert((await stat(path.join(root,'.build',name))).isDirectory(),'Preview must retain archives');
 execFileSync('git',['add','-f','.build/artifacts-AbC123/keep.txt'],{cwd:root});
 await assert.rejects(cleanBuildArchives(root,{apply:true}),/Refusing tracked archive/);
 assert.equal(await readFile(path.join(root,'.build/artifacts-AbC123/keep.txt'),'utf8'),'retain');
 execFileSync('git',['rm','--cached','-f','.build/artifacts-AbC123/keep.txt'],{cwd:root});
 await cleanBuildArchives(root,{apply:true});
 assert.deepEqual(await archivePlan(root),[]);
 for(const name of retained)assert.equal(await readFile(path.join(root,'.build',name,'keep.txt'),'utf8'),'retain');
 for(const file of ['src/app.js','docs/README.md','dist/current.zip'])assert.equal(await readFile(path.join(root,file),'utf8'),'retain');
 await rm(path.join(root,'.build'),{recursive:true});
 await symlink(path.join(root,'src'),path.join(root,'.build'));
 await assert.rejects(archivePlan(root),/Refusing a linked/);
 console.log('Archive cleanup: preview, current-version retention, source protection, tracked-file refusal and symlink protection passed.');
}finally{await rm(root,{recursive:true,force:true});}
