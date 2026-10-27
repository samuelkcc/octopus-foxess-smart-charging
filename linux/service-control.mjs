// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
import { readFile,writeFile,rename } from 'node:fs/promises';
export class ServiceControl {
  constructor(file) {this.file=file;this.enabled=true;this.revision=0;this.queue=Promise.resolve();}
  async load() {
    try {
      const state=JSON.parse(await readFile(this.file,'utf8'));
      if(typeof state.enabled!=='boolean' || !Number.isSafeInteger(state.revision))throw new Error('Invalid service-control state');
      this.enabled=state.enabled;this.revision=state.revision;
    } catch(error){if(error.code!=='ENOENT')throw error;}
  }
  snapshot(){return {enabled:this.enabled,revision:this.revision};}
  assertEnabled(revision=this.revision){
    if(!this.enabled || revision!==this.revision)throw Object.assign(new Error('Pi service is disabled. Enable it in local Configuration.'),{statusCode:423,serviceDisabled:true});
  }
  change(enabled){
    const task=this.queue.then(async()=>{
      if(this.enabled===enabled && !this.dirty)return this.snapshot();
      // Disable immediately and fail closed if saving fails. Enable only after saving.
      this.dirty=true;
      if(!enabled)this.enabled=false;
      const next={enabled,revision:this.revision+1};
      await writeFile(this.file+'.tmp',JSON.stringify(next),{mode:0o600});
      await rename(this.file+'.tmp',this.file);
      Object.assign(this,next);this.dirty=false;return this.snapshot();
    });
    this.queue=task.catch(()=>{});return task;
  }
}
