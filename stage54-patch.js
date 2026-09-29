const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace('<div class="dialog-head"><h3>Create Account</h3><button type="button" class="icon-btn" data-close="createAccountDialog" aria-label="Close">×</button></div><div class="dialog-actions create-account-tabs"><button type="button" id="createRegularTab" class="primary">REGULAR</button><button type="button" id="createFlexibleTab" class="secondary">FLEXIBLE</button></div>','<div class="dialog-head"><h3>Create Account</h3><button type="button" class="icon-btn" data-close="createAccountDialog" aria-label="Close">×</button></div>');
html=html.replace('<label>Username<input id="newUsername" required /></label>','<label>Username<input id="newUsername" required autocomplete="off" /></label>');
html=html.replace('<label>Temporary Password / PIN<input id="newTempPassword" type="password" required /></label>','<label id="newCredentialLabel">Temporary Password<input id="newTempPassword" type="password" required /></label><label id="linkedRegularField" hidden>Link to Regular Username (optional)<input id="linkedRegularUsername" autocomplete="off" /></label>');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace("document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.close)?.close()));",`document.addEventListener('click',(event)=>{
  const button=event.target.closest?.('[data-close]');
  if(!button) return;
  event.preventDefault();
  event.stopPropagation();
  const dialog=document.getElementById(button.dataset.close);
  if(dialog?.open) dialog.close();
});`);

app=app.replace(/function setCreateAccountType\(role\)\{[\s\S]*?newRole\.addEventListener\('change',\(\)=>\{[\s\S]*?\}\);/m,`function setCreateAccountType(role){
  newRole.value=role;
  updateAccountHints();
}
newRole.addEventListener('change',updateAccountHints);`);

const oldHints=`function updateAccountHints() {
  const role = newRole.value;
  usernameHint.textContent = role === 'regular' ? 'Regular username: exactly 5 digits.' : role === 'flexible' ? 'Flexible username: F followed by exactly 3 digits.' : 'Admin username: 4–20 letters/numbers.';
  passwordHint.textContent = role === 'regular' ? 'Regular members must change this temporary password at first login.' : role === 'flexible' ? 'Flexible saver PIN must be exactly 4 digits.' : 'Admin password must be at least 4 characters.';
}`;
const newHints=`function updateAccountHints() {
  const role=newRole.value;
  const username=document.getElementById('newUsername');
  const credentialLabel=document.getElementById('newCredentialLabel');
  const linkedField=document.getElementById('linkedRegularField');
  const linkedInput=document.getElementById('linkedRegularUsername');
  username.value='';
  username.removeAttribute('maxlength');
  username.removeAttribute('pattern');
  username.removeAttribute('inputmode');
  if(role==='regular'){
    usernameHint.textContent='Regular username: exactly 5 digits.';
    username.maxLength=5; username.inputMode='numeric'; username.pattern='[0-9]{5}';
    credentialLabel.childNodes[0].nodeValue='Temporary Password';
    passwordHint.textContent='Regular members must change this temporary password at first login.';
    linkedField.hidden=true; linkedInput.value='';
  }else if(role==='flexible'){
    usernameHint.textContent='Flexible username: F followed by exactly 3 digits.';
    username.maxLength=4; username.inputMode='text'; username.pattern='F[0-9]{3}'; username.value='F';
    credentialLabel.childNodes[0].nodeValue='PIN';
    passwordHint.textContent='Flexible saver PIN must be exactly 4 digits.';
    linkedField.hidden=false;
  }else{
    usernameHint.textContent='Admin username: 4–20 letters/numbers.';
    username.maxLength=20;
    credentialLabel.childNodes[0].nodeValue='Temporary Password';
    passwordHint.textContent='Admin password must be at least 4 characters.';
    linkedField.hidden=true; linkedInput.value='';
  }
}
document.getElementById('newUsername').addEventListener('input',(e)=>{
  const role=newRole.value;
  if(role==='regular') e.target.value=e.target.value.replace(/\\D/g,'').slice(0,5);
  else if(role==='flexible'){ const digits=e.target.value.toUpperCase().replace(/^F/,'').replace(/\\D/g,'').slice(0,3); e.target.value='F'+digits; }
});
document.getElementById('linkedRegularUsername').addEventListener('input',(e)=>{ e.target.value=e.target.value.replace(/\\D/g,'').slice(0,5); });`;
app=app.replace(oldHints,newHints);
app=app.replace("username:document.getElementById('newUsername').value, temporaryPassword:document.getElementById('newTempPassword').value","username:document.getElementById('newUsername').value, temporaryPassword:document.getElementById('newTempPassword').value, linkedRegularUsername:document.getElementById('linkedRegularUsername')?.value||''");
app=app.replace("if (title === 'CREATE ACCOUNT') { createAccountForm.reset(); createAccountError.textContent=''; createAccountSuccess.textContent=''; setCreateAccountType('regular'); openDialog(createAccountDialog); }","if (title === 'CREATE ACCOUNT') { createAccountForm.reset(); createAccountError.textContent=''; createAccountSuccess.textContent=''; newRole.value='regular'; updateAccountHints(); openDialog(createAccountDialog); }");
fs.writeFileSync('www/app.js',app);

let admin=fs.readFileSync('server/routes/admin.js','utf8');
admin=admin.replace("const temporaryPassword = String(req.body?.temporaryPassword || '');","const temporaryPassword = String(req.body?.temporaryPassword || '');\n  const linkedRegularUsername = String(req.body?.linkedRegularUsername || '').trim().toUpperCase();");
admin=admin.replace("if (role === 'flexible' && !/^\\d{4}$/.test(temporaryPassword)) return res.status(400).json({ error: 'Flexible PIN must be exactly 4 digits.' });","if (role === 'flexible' && !/^\\d{4}$/.test(temporaryPassword)) return res.status(400).json({ error: 'Flexible PIN must be exactly 4 digits.' });\n  if (role === 'flexible' && linkedRegularUsername && !/^\\d{5}$/.test(linkedRegularUsername)) return res.status(400).json({ error: 'Linked Regular username must be exactly 5 digits.' });");
admin=admin.replace("const hash = await bcrypt.hash(temporaryPassword, 12);",`let linkedRegularId=null;
    if(role==='flexible' && linkedRegularUsername){
      const linked=await client.query("SELECT id FROM accounts WHERE username=$1 AND role='regular' AND is_active=TRUE FOR UPDATE",[linkedRegularUsername]);
      if(!linked.rowCount){ await client.query('ROLLBACK'); return res.status(404).json({ error:'Active Regular account not found for linking.' }); }
      linkedRegularId=linked.rows[0].id;
    }
    const hash = await bcrypt.hash(temporaryPassword, 12);`);
admin=admin.replace("    await client.query(\n      `INSERT INTO member_balances (account_id, flexible_start_date)","    if(role==='flexible' && linkedRegularId) await client.query('UPDATE accounts SET linked_regular_account_id=$1 WHERE id=$2',[linkedRegularId,created.rows[0].id]);\n    await client.query(\n      `INSERT INTO member_balances (account_id, flexible_start_date)");
fs.writeFileSync('server/routes/admin.js',admin);

console.log('TAIMAKO Stage 54 Create Account and dialog corrections applied.');