/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * Desktop viewport sizing only. Does not change settings, transport, or automation.
 */
(() => {
  const root=document.documentElement;
  const shell=document.getElementById('dev-shell');
  const content=document.getElementById('dev-content');
  const wrapper=content.querySelector('.app-wrapper');
  const rail=shell.querySelector('.dev-rail');
  const desktop=matchMedia('(min-width: 761px) and (hover: hover)');
  let frame=0;
  const fit=()=>{
    frame=0;
    root.classList.toggle('desktop-viewport',desktop.matches);
    wrapper.style.removeProperty('zoom');
    wrapper.style.removeProperty('width');
    rail.style.removeProperty('height');
    shell.querySelectorAll('.dev-page-grid').forEach(grid=>grid.style.removeProperty('min-height'));
    delete content.dataset.fitScale;
    if(!desktop.matches)return;
    const height=content.clientHeight;
    if(!height)return;
    // One scale for every page. Navigation must not change control or text sizes.
    const scale=Math.min(1,height/1200,content.clientWidth/1440);
    wrapper.style.width='100%';
    wrapper.style.zoom=String(scale);
    content.dataset.fitScale=scale.toFixed(3);
    content.scrollTop=0;content.scrollLeft=0;
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(fit);};
  const observer=new ResizeObserver(schedule);
  observer.observe(content);observer.observe(wrapper);
  new MutationObserver(schedule).observe(shell,{subtree:true,attributes:true,attributeFilter:['hidden','open','class']});
  desktop.addEventListener('change',schedule);
  window.addEventListener('resize',schedule);
  window.addEventListener('orientationchange',schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();
