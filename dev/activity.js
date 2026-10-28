/* Copyright (C) 2026 SCKC. GPL-3.0-or-later. Standalone browser activity and backups. */
(() => {
  window.installActivityView=(panel,{isVisible})=>{
    const make=(tag,className='',text='')=>{const node=document.createElement(tag);node.className=className;node.textContent=text;return node;};
    panel.classList.add('browser-activity');
    const controls=make('div','dev-history-controls');
    const filter=make('label','','Filter by month (optional)'),month=make('input');month.type='month';month.max=new Date().toISOString().slice(0,7);filter.append(month);
    const button=(title,handler)=>{const node=make('button','next-button secondary',title);node.type='button';node.addEventListener('click',handler);return node;};
    const status=make('p','next-muted');status.setAttribute('role','status');
    const feedback=make('p','next-muted');feedback.setAttribute('role','status');
    const list=make('ol','browser-activity-list');list.setAttribute('aria-label','Activity records');
    const pager=make('nav','browser-activity-pages');pager.setAttribute('aria-label','Activity pages');
    let page=0,loaded=false;const pageSize=10;
    const previous=button('Previous',()=>{page--;render();}),next=button('Next',()=>{page++;render();}),pageLabel=make('span');
    pager.append(previous,pageLabel,next);
    const file=make('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
    const exportButton=button('Export activity',()=>{
      try{
        const backup=window.browserActivity.export();
        const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
        const link=make('a');link.href=url;link.download=`smart-charging-activity-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        feedback.textContent=`Exported ${backup.events.length} activity records. Account settings and access keys are excluded.`;
      }catch{feedback.textContent='Activity export failed. Check browser storage and download permissions.';}
    });
    const importButton=button('Import activity',()=>file.click());
    file.addEventListener('change',async()=>{
      const selected=file.files?.[0];if(!selected)return;
      importButton.disabled=true;
      try{
        if(selected.size>window.browserActivity.maxFileBytes)throw new Error('Choose an activity JSON file smaller than 1 MB.');
        const result=window.browserActivity.import(await selected.text());page=0;render();
        feedback.textContent=`Imported ${result.added} new records. ${result.total} records retained. Automation settings and pause state are unchanged.`;
      }catch(error){feedback.textContent=error.message || 'Activity import failed.';}
      finally{file.value='';importButton.disabled=false;}
    });
    controls.append(filter,button('Refresh activity',()=>render()),exportButton,importButton);
    panel.replaceChildren(controls,status,make('p','next-muted','Activity stays in this browser for 12 months, up to 2,000 records. Export saves all retained records. Import merges records and removes duplicates.'),feedback,pager,list,file,
      make('p','next-muted','Backups contain activity only. Import does not restore accounts, change pause state, or send inverter commands.'));
    function render(){
      const all=window.browserActivity.events(),stats=window.browserActivity.stats();
      const events=month.value?all.filter(event=>event.at.slice(0,7)===month.value):all;
      page=Math.max(0,Math.min(page,Math.ceil(events.length/pageSize)-1));
      const start=page*pageSize;previous.disabled=page===0;next.disabled=start+pageSize>=events.length;pager.hidden=events.length<=pageSize;
      pageLabel.textContent=`${start+1}–${Math.min(start+pageSize,events.length)} of ${events.length}`;
      status.textContent=`${stats.count} stored records · Estimated browser storage: ${(stats.estimatedBytes/1024).toFixed(1)} KB · 12-month / 2,000-record limit`;
      list.replaceChildren();
      for(const event of events.slice(start,start+pageSize)){
        const row=make('li','next-activity-row');
        row.append(make('strong','',({automation_paused:'Automation paused',automation_resumed:'Automation resumed',pause_expired:'Timed pause ended'})[event.type]),
          make('p','next-muted',new Date(event.at).toLocaleString()));
        if(event.type==='automation_paused')row.append(make('small','next-muted',event.until?`Until ${new Date(event.until).toLocaleString()}`:'Until manually resumed'));
        list.append(row);
      }
      if(!events.length)list.append(make('li','next-muted','No activity recorded for this selection.'));
      loaded=true;
    }
    month.addEventListener('change',()=>{page=0;render();});
    window.addEventListener('browser-activity-change',()=>{if(isVisible())render();});
    render();
    return {load:async()=>{if(isVisible())render();},needsLoad:()=>!loaded};
  };
})();
