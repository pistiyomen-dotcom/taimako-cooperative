const fs=require('fs');
const file='www/app.js'; let app=fs.readFileSync(file,'utf8');
const prior=`/* Restore after every other role-change handler finishes, including field-clearing handlers. */
newRole.addEventListener('change',()=>{
  const selected=newRole.value;
  queueMicrotask(()=>tmcsRestoreCreatedUsernameV213(selected));
});
`;
if(!app.includes(prior)) throw Error('Previous restore-on-change handler missing');
app=app.replace(prior,'');
const target="newRole.addEventListener('change', updateAccountHints);";
if(!app.includes(target)) throw Error('Original role change handler missing');
app=app.replace(target,"newRole.addEventListener('change',()=>{ updateAccountHints(); tmcsRestoreCreatedUsernameV213(newRole.value); });");
if(app.includes(target))throw Error('Old clearing listener remains');
fs.writeFileSync(file,app);
console.log('CREATE ACCOUNT role change now runs setup first, then restores the role-specific stored username.');
