const fs=require('fs');
const path='www/app.js';
let app=fs.readFileSync(path,'utf8');
const original="    const selectedRole = newRole.value; createAccountForm.reset(); newRole.value=selectedRole; updateAccountHints();";
if(!app.includes(original))throw Error('CREATE ACCOUNT success reset marker missing');
const updated="    const selectedRole = newRole.value; const createdUsername = String(data.account.username||''); createAccountForm.reset(); newRole.value=selectedRole; updateAccountHints(); if(selectedRole==='regular'||selectedRole==='flexible') document.getElementById('newUsername').value=createdUsername;";
app=app.replace(original,updated);
fs.writeFileSync(path,app);
console.log('CREATE ACCOUNT: successful Regular/Flexible username remains displayed until manually edited.');
