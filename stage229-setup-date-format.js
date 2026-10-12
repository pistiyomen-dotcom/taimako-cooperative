const fs=require('fs');
const p='www/index.html';
let html=fs.readFileSync(p,'utf8');
if(!html.includes('id="setupStartV173" type="date"')||!html.includes('id="setupEndV173" type="date"'))throw Error('Setup native date inputs not found; no changes made');
if(html.includes('tmcsSetupDateFormatV229'))throw Error('Setup date formatting already present');
const style=String.raw`<style id="tmcsSetupDateFormatStyleV229">
.tmcs-setup-date-shell-v229{position:relative;display:block;width:100%;min-height:46px;border:1px solid #cdd5d8;border-radius:11px;background:#fff;box-sizing:border-box;overflow:hidden}
.tmcs-setup-date-shell-v229 input[type="date"]{position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;margin:0!important;opacity:0.015!important;cursor:pointer!important;z-index:2!important}
.tmcs-setup-date-readout-v229{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:46px;padding:10px 13px;box-sizing:border-box;font-size:16px;line-height:1.4;color:#18251e;pointer-events:none}
.tmcs-setup-date-readout-v229[data-empty="true"]{color:#647079}
.tmcs-setup-date-readout-v229 svg{flex-shrink:0;color:#1d4230}
</style>`;
const js=String.raw`<script id="tmcsSetupDateFormatV229">
(function(){
 function init(){
  for(const id of ['setupStartV173','setupEndV173']){
   const input=document.getElementById(id);
   if(!input||input.type!=='date'||input.parentElement?.classList.contains('tmcs-setup-date-shell-v229'))continue;
   const shell=document.createElement('span');shell.className='tmcs-setup-date-shell-v229';
   const readout=document.createElement('span');readout.className='tmcs-setup-date-readout-v229';readout.setAttribute('aria-hidden','true');
   readout.innerHTML='<span class="tmcs-date-value-v229">dd/mm/yyyy</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>';
   input.parentNode.insertBefore(shell,input);shell.append(readout,input);
   input.setAttribute('aria-label',id==='setupStartV173'?'Start Date, day month year':'End Date, day month year');
   const update=()=>{
    const v=input.value;
    const ok=/^\d{4}-\d{2}-\d{2}$/.test(v);
    readout.dataset.empty=String(!ok);
    readout.querySelector('.tmcs-date-value-v229').textContent=ok?v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4):'dd/mm/yyyy';
   };
   input.addEventListener('input',update);
   input.addEventListener('change',update);
   const watcher=new MutationObserver(update);watcher.observe(input,{attributes:true,attributeFilter:['value']});
   update();
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 document.addEventListener('click',e=>{if(e.target?.closest?.('[data-action="setup"]'))queueMicrotask(init);},true);
})();
</script>`;
html=html.replace('</head>',style+'</head>').replace('</body>',js+'</body>');
fs.writeFileSync(p,html);
console.log('SETUP Start and End native dates preserved, visible dd/mm/yyyy readouts added.');
