const fs=require('fs');
const p='www/app.js';let app=fs.readFileSync(p,'utf8');
const original="newRole.addEventListener('change',()=>tmcsRestoreCreatedUsernameV213(newRole.value));";
if(!app.includes(original))throw Error('Previous role-change reminder handler missing');
const replacement=`/* Restore after every other role-change handler finishes, including field-clearing handlers. */
newRole.addEventListener('change',()=>{
  const selected=newRole.value;
  queueMicrotask(()=>tmcsRestoreCreatedUsernameV213(selected));
});
`;
app=app.replace(original,replacement);
const success="localStorage.setItem('tmcs-last-created-'+selectedRole+'-v213',createdUsername);";
if(!app.includes(success))throw Error('Per-role successful creation storage missing');
const nameFix="if((role==='regular'&&/^\\d{1,5}$/.test(value))||(role==='flexible'&&/^F\\d{3}$/.test(value)))";
if(!app.includes(nameFix))throw Error('Per-role username validation missing');
fs.writeFileSync(p,app);
console.log('Role-switch reminders run after form role-change reset handlers.');
