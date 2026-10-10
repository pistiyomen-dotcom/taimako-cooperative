const fs=require('fs');
const path='www/app.js', apiPath='server/routes/admin.js';
let app=fs.readFileSync(path,'utf8'), admin=fs.readFileSync(apiPath,'utf8');
const anchor="router.get('/setup-member'";
if(!admin.includes(anchor)) throw Error('Dedicated admin member route missing');
if(!admin.includes("router.get('/last-created-usernames'")){
const route=`router.get('/last-created-usernames', requireAdminPermission('manage_accounts'), async (req,res)=>{
  const result=await pool.query("SELECT DISTINCT ON (role) role,username FROM accounts WHERE role IN ('regular','flexible') ORDER BY role,created_at DESC,id DESC");
  res.set('Cache-Control','no-store');
  res.json({usernames:Object.fromEntries(result.rows.map(row=>[row.role,row.username]))});
});

`;
admin=admin.replace(anchor,route+anchor);
}
const handler="function tmcsRestoreCreatedUsernameV213(role){";
if(!app.includes(handler))throw Error('Role reminder helper missing');
const inject=`/* Latest account usernames come from the admin database, not only this browser. */
let tmcsLastCreatedFromServerV216=null;
let tmcsLastCreatedRequestV216=null;
async function tmcsLoadCreatedUsernamesV216(){
 if(tmcsLastCreatedRequestV216)return tmcsLastCreatedRequestV216;
 tmcsLastCreatedRequestV216=api('/api/admin/last-created-usernames',{cache:'no-store'})
 .then(data=>{tmcsLastCreatedFromServerV216=data.usernames||{};return tmcsLastCreatedFromServerV216;})
 .catch(()=>null).finally(()=>{tmcsLastCreatedRequestV216=null;});
 return tmcsLastCreatedRequestV216;
}
async function tmcsShowLastCreatedV216(role){
 const input=document.getElementById('newUsername');
 if(!input||!['regular','flexible'].includes(role))return;
 const previous=input.value;
 const accounts=await tmcsLoadCreatedUsernamesV216();
 if(!accounts||newRole.value!==role||!createAccountDialog.open)return;
 if(input.value!==previous)return; // never overwrite what the admin typed
 const value=String(accounts[role]||'');
 if((role==='regular'&&/^\\d{5}$/.test(value))||(role==='flexible'&&/^F\\d{3}$/.test(value))){
   input.value=value;
   try{localStorage.setItem('tmcs-last-created-'+role+'-v213',value);}catch(_){}
 }
}
`;
app=app.replace(handler,inject+handler);
const open="tmcsRestoreCreatedUsernameV213('regular'); openDialog(createAccountDialog);";
if(!app.includes(open))throw Error('Create Account dialog open marker missing');
app=app.replace(open,"tmcsRestoreCreatedUsernameV213('regular'); openDialog(createAccountDialog); tmcsShowLastCreatedV216('regular');");
const switcher="newRole.addEventListener('change',()=>{ updateAccountHints(); tmcsRestoreCreatedUsernameV213(newRole.value); });";
if(!app.includes(switcher))throw Error('Account-role switch handler missing');
app=app.replace(switcher,"newRole.addEventListener('change',()=>{ updateAccountHints(); tmcsRestoreCreatedUsernameV213(newRole.value); tmcsShowLastCreatedV216(newRole.value); });");
const created="localStorage.setItem('tmcs-last-created-'+selectedRole+'-v213',createdUsername);";
if(!app.includes(created))throw Error('Successful account creation marker missing');
app=app.replace(created,created+" tmcsLastCreatedFromServerV216=null;");
fs.writeFileSync(path,app);
fs.writeFileSync(apiPath,admin);
console.log('CREATE ACCOUNT reminders now load actual latest Regular and Flexible usernames from account database, with browser fallback.');
