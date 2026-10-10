const fs=require('fs');
const path='www/app.js';
let app=fs.readFileSync(path,'utf8');
const original="if(selectedRole==='regular'||selectedRole==='flexible') document.getElementById('newUsername').value=createdUsername;";
if(!app.includes(original))throw Error('CREATE ACCOUNT retention marker missing');
app=app.replace(original,original+" if((selectedRole==='regular'||selectedRole==='flexible')&&createdUsername){try{localStorage.setItem('tmcs-last-created-account-v211',JSON.stringify({role:selectedRole,username:createdUsername}));}catch(_){}}");
const marker="document.getElementById('newUsername').addEventListener('input',(e)=>{";
if(!app.includes(marker))throw Error('CREATE ACCOUNT username input marker missing');
const restore=`/* Last successfully created username is retained on this device, including after reload. */
try{
  const lastCreated=JSON.parse(localStorage.getItem('tmcs-last-created-account-v211')||'null');
  if(lastCreated && ['regular','flexible'].includes(lastCreated.role) &&
     ((lastCreated.role==='regular' && /^\\d{1,5}$/.test(lastCreated.username)) ||
      (lastCreated.role==='flexible' && /^F\\d{3}$/.test(lastCreated.username)))){
    newRole.value=lastCreated.role;
    updateAccountHints();
    document.getElementById('newUsername').value=lastCreated.username;
  }
}catch(_){}

`;
app=app.replace(marker,restore+marker);
fs.writeFileSync(path,app);
console.log('CREATE ACCOUNT retains latest successful Regular/Flexible username across page reloads on the same device.');
