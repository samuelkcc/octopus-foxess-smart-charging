// Copyright (C) 2026 SCKC. GPL-3.0-or-later.
const tabs=[...document.querySelectorAll('[data-preview]')];
for(const tab of tabs)tab.addEventListener('click',()=>{for(const other of tabs)other.setAttribute('aria-selected',String(other===tab));document.getElementById('preview-image').src='screenshots/'+tab.dataset.preview;document.getElementById('preview-image').alt=tab.dataset.caption+' · demonstration data';document.getElementById('preview-caption').textContent=tab.dataset.caption;});
