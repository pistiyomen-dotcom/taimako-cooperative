const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="adminResetDialog"')){
  const dialog=`
  <dialog id="adminResetDialog" class="wide-dialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>RESET</h3><button type="button" class="icon-btn" data-close="adminResetDialog" aria-label="Close">×</button></div>

      <section>
        <h4>RESET PASSWORD/PIN</h4>
        <label>Username<input id="resetCredentialUsername" autocomplete="off" /></label>
        <button type="button" class="secondary" onclick="return window.confirmResetCredentialAccountV111()">CONFIRM</button>
        <div id="resetCredentialMember" class="member-confirm"></div>
        <label>Temporary Password/PIN<input id="resetTemporaryCredential" type="password" autocomplete="new-password" disabled /></label>
        <button type="button" class="primary" id="resetCredentialButton" onclick="return window.resetCredentialV111()" disabled>RESET</button>
        <p class="helper">The temporary password/PIN is for first login only. The account holder must change it immediately after login.</p>
        <p class="form-error" id="resetCredentialError"></p>
        <p class="form-success" id="resetCredentialSuccess"></p>
      </section>

      <hr />

      <section>
        <h4>DELETE ACCOUNT</h4>
        <label>Username<input id="deleteAccountUsername" autocomplete="off" /></label>
        <button type="button" class="secondary" onclick="return window.confirmDeleteAccountV111()">CONFIRM</button>
        <div id="deleteAccountMember" class="member-confirm"></div>
        <button type="button" class="danger" id="deleteAccountButton" onclick="return window.deleteAccountV111()" disabled>DELETE</button>
        <p class="helper">The account is removed from active use while its financial and audit history is preserved.</p>
        <p class="form-error" id="deleteAccountError"></p>
        <p class="form-success" id="deleteAccountSuccess"></p>
      </section>
    </div>
  </dialog>

`;
  const marker='<dialog id="adminSettingsDialog"';
  if(!html.includes(marker)){console.error('Stage 111 dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}

html=html.replace(/app\.js\?v=\d+/g,'app.js?v=111');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=111');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=111');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

const cardMarker="['SETTINGS', 'Set minimum share and registration fee'],";
if(!app.includes("['RESET', 'Reset password/PIN or delete account']")){
  if(!app.includes(cardMarker)){console.error('Stage 111 dashboard marker missing');process.exit(1);}
  app=app.replace(cardMarker,cardMarker+"\n    ['RESET', 'Reset password/PIN or delete account'],");
}

if(!app.includes("if (title === 'RESET')")){
  app=app.replace(
    "if (title === 'SETTINGS') { openAdminSettingsV101(); }",
    "if (title === 'SETTINGS') { openAdminSettingsV101(); }\n  if (title === 'RESET') { openAdminResetV111(); }"
  );
}

const logic=`
let resetCredentialAccountV111=null;
let deleteAccountTargetV111=null;

function openAdminResetV111(){
  resetCredentialAccountV111=null;
  deleteAccountTargetV111=null;
  ['resetCredentialUsername','resetTemporaryCredential','deleteAccountUsername'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['resetCredentialMember','deleteAccountMember'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='';el.classList.remove('show');}});
  ['resetCredentialError','resetCredentialSuccess','deleteAccountError','deleteAccountSuccess'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='';});
  const temp=document.getElementById('resetTemporaryCredential');
  const resetBtn=document.getElementById('resetCredentialButton');
  const deleteBtn=document.getElementById('deleteAccountButton');
  if(temp)temp.disabled=true;
  if(resetBtn)resetBtn.disabled=true;
  if(deleteBtn)deleteBtn.disabled=true;
  openDialog(document.getElementById('adminResetDialog'));
}

async function resetLookupV111(username){
  return api('/api/admin/reset-account/confirm?username='+encodeURIComponent(username)+'&ts='+Date.now(),{cache:'no-store'});
}

window.confirmResetCredentialAccountV111=async function(){
  const username=String(document.getElementById('resetCredentialUsername')?.value||'').trim().toUpperCase();
  const box=document.getElementById('resetCredentialMember');
  const error=document.getElementById('resetCredentialError');
  const success=document.getElementById('resetCredentialSuccess');
  const temp=document.getElementById('resetTemporaryCredential');
  const btn=document.getElementById('resetCredentialButton');
  error.textContent='';success.textContent='';box.textContent='';box.classList.remove('show');
  resetCredentialAccountV111=null;
  if(temp){temp.value='';temp.disabled=true;}
  if(btn)btn.disabled=true;
  try{
    if(!username)throw new Error('Enter username.');
    const data=await resetLookupV111(username);
    if(!data.account.isActive)throw new Error('This account is deleted/inactive.');
    resetCredentialAccountV111=data.account;
    box.textContent=data.account.name+' - '+data.account.username+' ('+String(data.account.role).toUpperCase()+')';
    box.classList.add('show');
    if(temp){
      temp.disabled=false;
      temp.placeholder=(data.account.role==='regular'||data.account.role==='flexible')?'Enter temporary 4-digit PIN':'Enter temporary password';
      temp.inputMode=(data.account.role==='regular'||data.account.role==='flexible')?'numeric':'text';
      temp.focus();
    }
    if(btn)btn.disabled=false;
  }catch(err){error.textContent=err.message;}
  return false;
};

window.resetCredentialV111=async function(){
  const error=document.getElementById('resetCredentialError');
  const success=document.getElementById('resetCredentialSuccess');
  const temp=document.getElementById('resetTemporaryCredential');
  const btn=document.getElementById('resetCredentialButton');
  error.textContent='';success.textContent='';
  try{
    if(!resetCredentialAccountV111)throw new Error('Confirm the account first.');
    const credential=String(temp?.value||'');
    const role=String(resetCredentialAccountV111.role||'').toLowerCase();
    if((role==='regular'||role==='flexible')&&!/^\\d{4}$/.test(credential))throw new Error('Temporary PIN must be exactly 4 digits.');
    if(role==='admin'&&credential.length<4)throw new Error('Temporary password must be at least 4 characters.');
    btn.disabled=true;
    await api('/api/admin/reset-account/credential',{
      method:'POST',
      cache:'no-store',
      body:JSON.stringify({username:resetCredentialAccountV111.username,temporaryCredential:credential})
    });
    success.textContent='RESET SUCCESSFUL. Temporary credential is valid for first login only.';
    temp.value='';
  }catch(err){error.textContent='RESET FAILED: '+err.message;}
  finally{btn.disabled=false;}
  return false;
};

window.confirmDeleteAccountV111=async function(){
  const username=String(document.getElementById('deleteAccountUsername')?.value||'').trim().toUpperCase();
  const box=document.getElementById('deleteAccountMember');
  const error=document.getElementById('deleteAccountError');
  const success=document.getElementById('deleteAccountSuccess');
  const btn=document.getElementById('deleteAccountButton');
  error.textContent='';success.textContent='';box.textContent='';box.classList.remove('show');
  deleteAccountTargetV111=null;
  if(btn)btn.disabled=true;
  try{
    if(!username)throw new Error('Enter username.');
    const data=await resetLookupV111(username);
    if(!data.account.isActive)throw new Error('This account is already deleted/inactive.');
    deleteAccountTargetV111=data.account;
    box.textContent=data.account.name+' - '+data.account.username+' ('+String(data.account.role).toUpperCase()+')';
    box.classList.add('show');
    if(btn)btn.disabled=false;
  }catch(err){error.textContent=err.message;}
  return false;
};

window.deleteAccountV111=async function(){
  const error=document.getElementById('deleteAccountError');
  const success=document.getElementById('deleteAccountSuccess');
  const btn=document.getElementById('deleteAccountButton');
  error.textContent='';success.textContent='';
  try{
    if(!deleteAccountTargetV111)throw new Error('Confirm the account first.');
    const a=deleteAccountTargetV111;
    if(!window.confirm('Delete '+a.name+' - '+a.username+'? This account will no longer be able to log in.'))return false;
    btn.disabled=true;
    await api('/api/admin/reset-account/'+encodeURIComponent(a.username),{method:'DELETE',cache:'no-store'});
    success.textContent='ACCOUNT DELETED SUCCESSFULLY.';
    const box=document.getElementById('deleteAccountMember');
    if(box){box.textContent='';box.classList.remove('show');}
    const input=document.getElementById('deleteAccountUsername');
    if(input)input.value='';
    deleteAccountTargetV111=null;
  }catch(err){error.textContent='DELETE FAILED: '+err.message;}
  finally{btn.disabled=deleteAccountTargetV111===null;}
  return false;
};

`;

if(!app.includes('function openAdminResetV111()')){
  const marker='async function openAdminSettingsV101(){';
  if(!app.includes(marker)){console.error('Stage 111 logic marker missing');process.exit(1);}
  app=app.replace(marker,logic+marker);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=111'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v111';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 111 Admin RESET dashboard UI applied.');