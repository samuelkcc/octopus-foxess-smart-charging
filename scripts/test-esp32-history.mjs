// Copyright (C) 2026 SCKC. SPDX-License-Identifier: GPL-3.0-or-later
import {mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';import path from 'node:path';
const directory=await mkdtemp(path.join(os.tmpdir(),'sc-history-'));
try{
 const executable=path.join(directory,'history-test');
 const build=spawnSync('cc',['-std=c11','-O2','-Wall','-Wextra','-Werror','-Iesp32/main','esp32/tests/history_test.c','esp32/main/history_store.c','-lm','-o',executable],{encoding:'utf8'});
 if(build.status!==0)throw Error(build.stderr||build.stdout);
 const run=spawnSync(executable,[],{encoding:'utf8'});process.stdout.write(run.stdout);if(run.status!==0)throw Error(run.stderr||'History journal test failed');
}finally{await rm(directory,{recursive:true,force:true});}
