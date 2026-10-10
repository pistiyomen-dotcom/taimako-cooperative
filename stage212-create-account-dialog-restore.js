const fs=require('fs');
const file='www/app.js';
let app=fs.readFileSync(file,'utf8');
const prior="if (title === 'CREATE ACCOUNT') { createAccountForm.reset(); createAccountError.textContent=''; createAccountSuccess.textContent=''; newRole.value='regular'; updateAccountHints(); openDialog(createAccountDialog); }";
if(!app.includes(prior))throw Error('CREATE ACCOUNT opening handler not found');
const next="if (title === 'CREATE ACCOUNT') { createAccountForm.reset(); createAccountError.textContent=''; createAccountSuccess.textContent=''; newRole.value='regular'; updateAccountHints(); try { const last=JSON.parse(localStorage.getItem('tmcs-last-created-account-v211')||'null'); if(last&&((last.role==='regular'&&/^\\d{1,5}$/.test(last.username))||(last.role==='flexible'&&/^F\\d{3}$/.test(last.username)))) { newRole.value=last.role; updateAccountHints(); document.getElementById('newUsername').value=last.username; } } catch(_) {} openDialog(createAccountDialog); }";
app=app.replace(prior,next);
fs.writeFileSync(file,app);
console.log('CREATE ACCOUNT restores last successful username whenever dialog is opened, including after page reload.');
