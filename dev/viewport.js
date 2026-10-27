/* Copyright (C) 2026 SCKC. GPL-3.0-or-later.
 * Use native-size text and flexible desktop regions. Never scale page contents.
 */
(() => {
  const root=document.documentElement;
  const content=document.getElementById('dev-content');
  const desktop=matchMedia('(min-width: 761px) and (hover: hover)');
  const narrow=matchMedia('(max-width: 760px)');
  const mobileBrowser=navigator.userAgentData?.mobile === true || /iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent);
  const layout=()=>{
    root.classList.toggle('desktop-viewport',desktop.matches);
    root.classList.toggle('mobile-launch',narrow.matches || mobileBrowser);
    content.dataset.fitScale='1.000';
  };
  desktop.addEventListener('change',layout);
  narrow.addEventListener('change',layout);
  layout();
})();
