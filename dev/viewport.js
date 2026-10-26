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
    const grid=shell.classList.contains('dev-auth-mode')?null:shell.querySelector('.dev-page:not([hidden]) .dev-page-grid');
    const railBounds=rail.getBoundingClientRect();
    const minimumBottom=railBounds.bottom;
    // Zoom adjusts layout and hit testing while percentage width keeps both edges aligned.
    const size=scale=>{
      wrapper.style.width='100%';
      wrapper.style.zoom=String(scale);
      if(grid){
        grid.style.minHeight='0px';
        // Short pages must still leave room for every navigation control.
        grid.style.minHeight=`${Math.max(0,(minimumBottom-grid.getBoundingClientRect().top)/scale)}px`;
      }
      return wrapper.getBoundingClientRect().height;
    };
    let scale=1;
    if(size(1)>height){
      let low=.05,high=1;
      for(let step=0;step<10;step++){
        const candidate=(low+high)/2;
        if(size(candidate)<=height-1)low=candidate;else high=candidate;
      }
      scale=low;
      size(scale);
    }
    content.dataset.fitScale=scale.toFixed(3);
    if(grid)rail.style.height=`${grid.getBoundingClientRect().bottom-railBounds.top}px`;
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
