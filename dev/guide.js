// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
(() => {
 'use strict';
 const source="__SC_USER_GUIDE__";
 const install=()=>{
  const rail=document.querySelector('.dev-rail-bottom')||document.querySelector('.rail-footer');
  if(!rail||document.getElementById('open-user-guide'))return;
  const trigger=document.createElement('button');trigger.id='open-user-guide';trigger.type='button';trigger.textContent='User guide';trigger.setAttribute('aria-haspopup','dialog');rail.prepend(trigger);
  const dialog=document.createElement('dialog');dialog.className='sc-guide-drawer';dialog.setAttribute('aria-labelledby','sc-guide-title');
  const header=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');title.id='sc-guide-title';title.textContent='User guide';title.tabIndex=-1;close.type='button';close.textContent='×';close.setAttribute('aria-label','Close User guide');header.append(title,close);
  const body=document.createElement('div');body.className='sc-guide-body';const toc=document.createElement('nav');toc.setAttribute('aria-label','Guide chapters');const content=document.createElement('article');content.className='sc-guide-content';const chooser=document.createElement('label');chooser.className='sc-guide-chooser';chooser.textContent='Chapter';const select=document.createElement('select');select.setAttribute('aria-label','Guide chapter');chooser.append(select);body.append(toc,chooser,content);
  const inline=(node,text)=>{for(const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https:\/\/[^\s)]+\))/g)){
   const link=part.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);
   const element=document.createElement(link?'a':part.startsWith('**')?'strong':part.startsWith('`')?'code':'span');
   element.textContent=link?link[1]:part.startsWith('**')?part.slice(2,-2):part.startsWith('`')?part.slice(1,-1):part;
   if(link){element.href=link[2];element.target='_blank';element.rel='noopener noreferrer';}
   node.append(element);
  }};
  let list=null,table=null,chapter=0,panel=content;const chapters=[];
  const showChapter=index=>{chapters.forEach((item,i)=>{item.panel.hidden=i!==index;item.button.setAttribute('aria-current',i===index?'page':'false');});select.value=String(index);content.scrollTop=0;};
  select.addEventListener('change',()=>showChapter(Number(select.value)));
  for(const line of source.split('\n')){
   if(!line.trim()){list=null;table=null;continue;}
   if(line.startsWith('|')){if(/^\|[\s:|-]+\|$/.test(line))continue;if(!table){table=document.createElement('table');const wrapper=document.createElement('div');wrapper.className='sc-guide-table';wrapper.append(table);panel.append(wrapper);}const row=document.createElement('tr');for(const value of line.split('|').slice(1,-1)){const cell=document.createElement(table.childNodes.length?'td':'th');inline(cell,value.trim());row.append(cell);}table.append(row);continue;}
   const heading=line.match(/^(#{1,3}) (.+)/);if(heading){
    if(heading[1].length===1)continue;
    const element=document.createElement('h'+Math.min(4,heading[1].length+1));element.textContent=heading[2];
    if(heading[1].length===2){
     element.id='sc-guide-chapter-'+(++chapter);panel=document.createElement('section');panel.setAttribute('aria-labelledby',element.id);content.append(panel);
     const button=document.createElement('button');button.type='button';button.textContent=heading[2];button.setAttribute('aria-controls',element.id+'-panel');panel.id=element.id+'-panel';const index=chapters.length;button.addEventListener('click',()=>showChapter(index));toc.append(button);chapters.push({panel,button});
     const option=document.createElement('option');option.value=String(index);option.textContent=heading[2];select.append(option);
    }
    panel.append(element);list=null;table=null;continue;
   }
   if(/^\d+\. /.test(line)){if(!list){list=document.createElement('ol');panel.append(list);}const item=document.createElement('li');inline(item,line.replace(/^\d+\. /,''));list.append(item);continue;}
   const paragraph=document.createElement('p');inline(paragraph,line);panel.append(paragraph);
  }
  showChapter(0);
  dialog.append(header,body);document.body.append(dialog);trigger.addEventListener('click',()=>{dialog.showModal();title.focus();});close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>trigger.focus());dialog.addEventListener('click',event=>{if(event.target===dialog&&event.clientX<dialog.getBoundingClientRect().left)dialog.close();});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
