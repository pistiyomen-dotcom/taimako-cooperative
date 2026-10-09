'use strict';
// Developer-branch integration of assisted Member Search.
// This stage is intentionally NOT included in the release build chain.
const fs=require('node:fs');
const path=require('node:path');
function ensureFile(p){if(!fs.existsSync(p))throw new Error('Missing '+p);}
ensureFile('www/app.js');ensureFile('www/index.html');
for(const name of ['session-service.js','router.js','context-middleware.js']){
  const dest=path.join('server','assisted-access',name);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(path.join('assisted-access',name),dest);
}
fs.copyFileSync('assisted-access/member-view.js','www/member-assistance-view.js');

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('member-assistance-view.js')){
  html=html.replace('</body>','<script src="member-assistance-view.js?v=210"></script>\n</body>');
}
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes('tmcsAssistedMemberViewV210')){
  app+=`
/* tmcsAssistedMemberViewV210: development integration only */
let tmcsAssistedMemberViewV210=null;
async function tmcsOpenAssistedMemberV210(username){
  if(!state?.token || state?.user?.role!=='admin') throw Error('Administrator login required');
  const root=document.getElementById('memberLookupFreshResult');
  if(!root || typeof window.createAssistedMemberView!=='function') throw Error('Assisted view is unavailable');
  tmcsAssistedMemberViewV210=window.createAssistedMemberView({
    root,
    apiBase:typeof API_BASE!=='undefined'?API_BASE:'',
    getAdminToken:()=>state.token,
    onClose:()=>openMemberLookupFresh()
  });
  await tmcsAssistedMemberViewV210.open(username);
}
document.addEventListener('click',async event=>{
  const btn=event.target.closest?.('#tmcsOpenMemberV210');
  if(!btn)return;
  event.preventDefault();
  btn.disabled=true;
  try{
    const username=String(document.getElementById('memberLookupFreshUsername')?.value||'').trim().toUpperCase();
    await tmcsOpenAssistedMemberV210(username);
  }catch(err){
    const error=document.getElementById('memberLookupFreshError');
    if(error)error.textContent=err.message||'Unable to open member account';
  }finally{btn.disabled=false;}
});
`;
}
const original="if(r) r.innerHTML='<div class=\"member-confirm show\"";
const start=app.indexOf(original);
if(start<0)throw Error('Fresh Member Search rendering marker absent');
const next=app.indexOf(';\n  }catch(err)',start);
if(next<0)throw Error('Member Search rendering ending marker absent');
const originalStatement=app.slice(start,next);
if(!originalStatement.includes('memberLookupFreshGrid(bal)'))throw Error('Unexpected search result format');
const updated="if(r) r.innerHTML='<div class=\"member-confirm show\" style=\"display:block;margin:8px 0 14px\"><b>'+escapeHTML(name)+' - '+escapeHTML(a.username)+'</b><br><small>'+escapeHTML(role)+' • '+escapeHTML(status)+'</small></div>'+(a.is_active===false?'':'<button type=\"button\" id=\"tmcsOpenMemberV210\" class=\"primary\">OPEN MEMBER ACCOUNT</button>')";
app=app.slice(0,start)+updated+app.slice(next);
fs.writeFileSync('www/app.js',app);
console.log('Development-only assisted Member Search interface installed. Mount API router separately after DB migration; not ready for release.');
