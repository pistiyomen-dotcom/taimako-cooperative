const fs=require('fs');

// Stage 240: make assisted-account exit visible and prevent logout from trapping the admin in member view.
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
app=app.replace(
  "exit.className='secondary';exit.textContent='EXIT ASSISTED ACCOUNT';",
  "exit.className='secondary';exit.textContent='EXIT ASSISTED ACCOUNT';exit.style.cssText='display:inline-flex!important;align-items:center!important;justify-content:center!important;background:#145c36!important;color:#ffffff!important;border:2px solid #0b4427!important;border-radius:8px!important;padding:12px 18px!important;min-height:44px!important;font-weight:800!important;opacity:1!important;visibility:visible!important;cursor:pointer!important;white-space:nowrap!important;position:relative!important;z-index:5!important;'"
);
const fix=[
"",
"/* Stage 240: assisted account exit safety and high-contrast control */",
"document.addEventListener('click',function tmcsAssistedLogoutGuardV240(event){",
"  const active=state&&state.assistedAdminSnapshot&&state.assistedAccountId;",
"  if(!active)return;",
"  const button=event.target&&event.target.closest?event.target.closest('button,a,[role=button]'):null;",
"  if(!button)return;",
"  const label=String(button.textContent||button.getAttribute('aria-label')||'').trim().toUpperCase();",
"  if(label!=='LOGOUT'&&label!=='LOG OUT'&&label!=='SIGN OUT')return;",
"  event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();",
"  if(typeof exitAssistedAccountV239==='function')exitAssistedAccountV239();",
"},true);",
""
].join('\n');
if(!app.includes('tmcsAssistedLogoutGuardV240')) app += '\n'+fix;
if(!app.includes('tmcsAssistedExitStyleV240')) app += [
"",
"/* Keep the exit button visible after dashboard redraws. */",
"document.addEventListener('click',function tmcsAssistedExitStyleV240(){",
"  const exit=document.querySelector('.assisted-member-banner-v239 button');",
"  if(exit)exit.style.cssText='display:inline-flex!important;align-items:center!important;justify-content:center!important;background:#145c36!important;color:#ffffff!important;border:2px solid #0b4427!important;border-radius:8px!important;padding:12px 18px!important;min-height:44px!important;font-weight:800!important;opacity:1!important;visibility:visible!important;cursor:pointer!important;white-space:nowrap!important;position:relative!important;z-index:5!important;';",
"},true);",
""
].join('\n');
fs.writeFileSync(appPath,app);
let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\\.js\\?v=\\d+/g,'app.js?v=240').replace(/styles\\.css\\?v=\\d+/g,'styles.css?v=240');
fs.writeFileSync('www/index.html',html);
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\\d+';/,"const CACHE = 'taimako-v240';");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 240: visible assisted-account exit and safe logout return applied.');