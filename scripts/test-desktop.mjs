import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp,readFile,writeFile,rm,access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once, EventEmitter } from 'node:events';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const {isAdminSender}=require('../desktop/policy.cjs');
const origin='http://127.0.0.1:8787';
const frame={url:origin+'/app/index.html?client=1'},contents={mainFrame:frame};
assert.equal(isAdminSender({sender:contents,senderFrame:frame},contents,origin),true);
assert.equal(isAdminSender({sender:contents,senderFrame:{url:frame.url}},contents,origin),false,'Subframes cannot administer the service');
assert.equal(isAdminSender({sender:{mainFrame:frame},senderFrame:frame},contents,origin),false,'The worker has no administration bridge');
frame.url='https://example.trycloudflare.com/app/index.html';assert.equal(isAdminSender({sender:contents,senderFrame:frame},contents,origin),false);
frame.url='http://127.0.0.1:9999/app/index.html';assert.equal(isAdminSender({sender:contents,senderFrame:frame},contents,origin),false);
assert.equal(isAdminSender({},contents,origin),false);
let argumentsSeen;
const source=await readFile('linux/remote-access.mjs','utf8');
const fakeChild=new EventEmitter();fakeChild.stdout=new EventEmitter();fakeChild.stderr=new EventEmitter();fakeChild.kill=()=>{};
const context=vm.createContext({process:{platform:'win32',env:{}},setTimeout,clearTimeout});
vm.runInContext(source.slice(source.indexOf('export class QuickTunnel')).replace('export class','class')+';this.QuickTunnel=QuickTunnel;',context);
const tunnel=new context.QuickTunnel({url:'http://127.0.0.1:8788',spawnProcess:(binary,args,options)=>{argumentsSeen={binary,args,options};return fakeChild;}});
tunnel.start();assert.equal(argumentsSeen.args[argumentsSeen.args.indexOf('--config')+1],'NUL');assert.equal(argumentsSeen.options.windowsHide,true);tunnel.stop();
const directory=await mkdtemp(path.join(tmpdir(),'charging-desktop-'));
const hook=path.join(directory,'desktop-key.mjs');
await writeFile(hook,"globalThis.desktopEncryptionKey=Buffer.alloc(32,7);globalThis.fetch=async()=>{throw new Error('No real upstream in desktop tests');};");
const port=42000+Math.floor(Math.random()*5000);let child;
async function start(){
  child=spawn(process.execPath,['--import',hook,'linux/server.mjs'],{env:{...process.env,OCTOPUS_DESKTOP:'1',OCTOPUS_HOST:'127.0.0.1',OCTOPUS_PORT:String(port),OCTOPUS_REMOTE_PORT:String(port+1),OCTOPUS_STATE_DIR:directory},stdio:['ignore','ignore','pipe']});
  let output='';child.stderr.on('data',data=>{output+=data;});
  for(let attempt=0;attempt<100;attempt++){try{if((await fetch(`http://127.0.0.1:${port}/api/health`)).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,30));}
  throw new Error('Desktop test service failed: '+output);
}
async function stop(){if(child?.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}}
const local=`http://127.0.0.1:${port}`;
try{
  await start();
  const response=await fetch(local+'/api/native-config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessRequired:true,accessKey:'test-local-access',credentials:{acc:'A-DESKTOP',api:'desktop-secret',foxSN:'dummy',foxToken:'dummy'}})});
  assert.equal(response.status,200);
  await assert.rejects(access(path.join(directory,'config.key')),'Desktop must not write an unprotected configuration key');
  assert.equal((await readFile(path.join(directory,'config.enc'),'utf8')).includes('desktop-secret'),false);
  assert.equal((await fetch(local+'/api/runtime?client=1')).status,200);
  const runtime=await fetch(local+'/api/runtime?client=1',{headers:{'X-Octopus-Access-Key':'test-local-access'}}).then(r=>r.json());
  assert.equal(runtime.authRequired,false,'Desktop window uses its own authenticated local connection');
  assert.equal((await fetch(local+'/api/runtime?client=1').then(r=>r.json())).authRequired,true,'An ordinary browser still needs LAN authentication');
  await stop();await start();
  const saved=await fetch(local+'/api/native-config').then(r=>r.json());assert.equal(saved.credentials.acc,'A-DESKTOP');
  const remote=await fetch(`http://127.0.0.1:${port+1}/api/native-config`);assert.ok([403,503].includes(remote.status));assert.equal((await remote.json()).credentials,undefined);
  console.log('Desktop IPC owner-frame/origin isolation, Windows tunnel arguments, private key injection, encrypted restart persistence and ordinary-browser authentication passed (mock host key).');
}finally{await stop();await rm(directory,{recursive:true,force:true});}
