const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes('tmcsSetupConfirmDelegatedV177')){
  const marker='function renderDashboard() {';
  const code=`
/* tmcsSetupConfirmDelegatedV177 */
document.addEventListener('click', async (event)=>{
  const button=event.target.closest?.('#setupConfirmV173');
  if(!button) return;
  event.preventDefault();
  event.stopPropagation();

  const error=document.getElementById('setupErrorV173');
  const success=document.getElementById('setupSuccessV173');
  const box=document.getElementById('setupMemberConfirmV173');
  const input=document.getElementById('setupUsernameV173');

  if(error) error.textContent='';
  if(success) success.textContent='';
  if(box){ box.textContent=''; box.className='member-confirm'; }
  confirmedSetupMemberV173=null;

  try{
    const username=String(input?.value||'').trim().toUpperCase();
    if(!username) throw new Error('Enter username.');
    if(!/^\\d{1,5}$/.test(username)) throw new Error('Enter a valid Regular member username.');

    button.disabled=true;
    button.textContent='VERIFYING...';

    const data=await api('/api/admin/members/search?username='+encodeURIComponent(username),{cache:'no-store'});
    const member=data.account;
    if(!member) throw new Error('Member account not found.');
    if(String(member.role||'').toLowerCase()!=='regular') throw new Error('SETUP is for Regular member accounts.');

    confirmedSetupMemberV173={username:member.username,name:member.name,role:member.role};
    if(box){
      box.textContent=member.name+' – '+member.username;
      box.className='member-confirm show';
    }
  }catch(e){
    if(error) error.textContent=e.message||'Unable to verify username.';
  }finally{
    button.disabled=false;
    button.textContent='CONFIRM';
  }
},true);

`;
  if(!app.includes(marker)){console.error('Stage 177 render marker missing');process.exit(1);}
  app=app.replace(marker,code+marker);
}

/* neutralize the older direct handler to prevent duplicate requests */
app=app.replace(
  "document.getElementById('setupConfirmV173')?.addEventListener('click',async()=>{",
  "document.getElementById('setupConfirmV173')?.addEventListener('tmcs-disabled-click',async()=>{"
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=177'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=177');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=177');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=177');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v177';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 177 SETUP username confirmation fixed with member search.');
