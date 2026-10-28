// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),dir=await mkdtemp(tmpdir()+'/charger-launch-');
const socket=createServer();
try{
  await mkdir(dir+'/home');await mkdir(dir+'/runtime');
  await new Promise(resolve=>socket.listen(dir+'/runtime/wayland-0',resolve));
  await writeFile(dir+'/chromium','#!/bin/sh\npwd\nprintf "%s\\n" "$@"\n',{mode:0o700});
  const script=(await readFile('linux/open-dashboard.sh','utf8')).replace('/usr/bin/chromium',dir+'/chromium').replace('/etc/default/octopus-foxess',dir+'/absent');
  await writeFile(dir+'/launch.sh',script);
  const env={...process.env,HOME:dir+'/home',XDG_CONFIG_HOME:dir+'/home/config',XDG_RUNTIME_DIR:dir+'/runtime',WAYLAND_DISPLAY:'wayland-0',DISPLAY:''};
  const wayland=(await exec('sh',[dir+'/launch.sh'],{env,cwd:'/'})).stdout;
  assert(wayland.startsWith(dir+'/home\n'));assert.match(wayland,/--ozone-platform=wayland/);assert.match(wayland,/--app=http:\/\/127.0.0.1:8787/);
  const x11=(await exec('sh',[dir+'/launch.sh'],{env:{...env,WAYLAND_DISPLAY:'missing',DISPLAY:':0'}})).stdout;
  assert.match(x11,/--ozone-platform=x11/);
  await assert.rejects(exec('sh',[dir+'/launch.sh'],{env:{...env,WAYLAND_DISPLAY:'missing'}}),error=>/No desktop display/.test(error.stderr));
  console.log('Pi launcher Wayland, X11, missing display, private profile and working-directory recovery passed.');
}finally{await new Promise(resolve=>socket.close(resolve));await rm(dir,{recursive:true,force:true});}
