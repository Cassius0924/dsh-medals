// Follows the DSH host palette (body[data-ds-dark-theme]) when embedded; falls back to the OS setting.
// Loaded synchronously in <head> so the first paint already uses the right palette.
(()=>{
  const root=document.documentElement,media=matchMedia('(prefers-color-scheme: dark)');
  let hostBody=null;
  try{if(window.parent!==window)hostBody=window.parent.document.body;}catch{}
  const apply=()=>{
    const dark=hostBody?hostBody.hasAttribute('data-ds-dark-theme'):media.matches;
    const theme=dark?'dark':'light';
    if(root.dataset.theme===theme)return;
    root.dataset.theme=theme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=dark?'#151517':'#ffffff';
  };
  apply();
  if(hostBody)new MutationObserver(apply).observe(hostBody,{attributes:true,attributeFilter:['data-ds-dark-theme']});
  else media.addEventListener('change',apply);
  document.addEventListener('DOMContentLoaded',apply,{once:true});
})();
