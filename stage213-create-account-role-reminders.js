const fs=require('fs');
const file='www/app.js';
let app=fs.readFileSync(file,'utf8');
const legacy="localStorage.setItem('tmcs-last-created-account-v211',JSON.stringify({role:selectedRole,username:createdUsername}));";
if(!app.includes(legacy))throw Error('CREATE ACCOUNT successful creation storage marker missing');
app=app.replace(legacy,`localStorage.setItem('tmcs-last-created-'+selectedRole+'-v213',createdUsername); localStorage.setItem('tmcs-last-created-account-v211',JSON.stringify({role:selectedRole,username:createdUsername}));`);
const start="if (title === 'CREATE ACCOUNT') {";
const end=" openDialog(createAccountDialog); }";
const i=app.indexOf(start);
if(i<0)throw Error('CREATE ACCOUNT opening marker missing');
const j=app.indexOf(end,i);
if(j<0)throw Error('CREATE ACCOUNT opening end missing');
const replacement="if (title === 'CREATE ACCOUNT') { createAccountForm.reset(); createAccountError.textContent=''; createAccountSuccess.textContent=''; newRole.value='regular'; updateAccountHints(); tmcsRestoreCreatedUsernameV213('regular'); openDialog(createAccountDialog); }";
app=app.slice(0,i)+replacement+app.slice(j+end.length);
const anchor="document.getElementById('newUsername').addEventListener('input',(e)=>{";
if(!app.includes(anchor))throw Error('Username input handler missing');
const helpers=`/* v213: independent per-role reminders; never replace these on account-type switching. */
function tmcsRestoreCreatedUsernameV213(role){
  const input=document.getElementById('newUsername');
  if(!input)return;
  input.value='';
  if(role!=='regular'&&role!=='flexible')return;
  try{
    let value=localStorage.getItem('tmcs-last-created-'+role+'-v213')||'';
    if(!value){
      const prior=JSON.parse(localStorage.getItem('tmcs-last-created-account-v211')||'null');
      if(prior&&prior.role===role)value=String(prior.username||'');
    }
    if((role==='regular'&&/^\\d{1,5}$/.test(value))||(role==='flexible'&&/^F\\d{3}$/.test(value))){
      input.value=value;
    }
  }catch(_){}
}
newRole.addEventListener('change',()=>tmcsRestoreCreatedUsernameV213(newRole.value));
`;
app=app.replace(anchor,helpers+anchor);
fs.writeFileSync(file,app);
console.log('CREATE ACCOUNT remembers separate Regular and Flexible usernames across role changes and reloads.');
