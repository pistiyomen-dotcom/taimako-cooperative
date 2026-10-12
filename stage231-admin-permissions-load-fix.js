const fs=require('fs');
let app=fs.readFileSync('www/app.js','utf8');
const from=app.indexOf('async function openAdminPermissionsDialog(){');
const to=app.indexOf('\nfunction loadSelectedAdminPermissions(){',from);
if(from<0||to<0||!app.slice(from,to).includes("admin-permissions"))throw Error('Admin Permissions loader not found; refusing change');
const replacement=`async function openAdminPermissionsDialog(){
  const dialog=document.getElementById('adminPermissionsDialog');
  const error=document.getElementById('adminPermissionsError');
  const success=document.getElementById('adminPermissionsSuccess');
  const select=document.getElementById('adminPermissionSelect');
  if(!dialog||!error||!success||!select)return;
  error.textContent='';success.textContent='';
  select.replaceChildren(new Option('Loading administrators…',''));
  select.disabled=true;
  if(!dialog.open)openDialog(dialog);
  try{
    const data=await api('/api/admin/admin-permissions',{cache:'no-store'});
    if(!Array.isArray(data.admins))throw new Error('Administrator list was not returned.');
    adminPermissionData=data.admins.filter(a=>a && a.id!=null && a.permissions);
    select.replaceChildren();
    if(!adminPermissionData.length){
      select.add(new Option('No administrator accounts found',''));
      error.textContent='No administrator accounts were returned.';
      return;
    }
    for(const a of adminPermissionData){
      const opt=new Option(String(a.username||'')+' • '+String(a.name||''),String(a.id));
      select.add(opt);
    }
    select.disabled=false;
    select.selectedIndex=0;
    loadSelectedAdminPermissions();
  }catch(err){
    select.replaceChildren(new Option('Unable to load administrators',''));
    error.textContent=err?.message||'Unable to load administrator accounts. Please try again.';
  }
}`;
app=app.slice(0,from)+replacement+app.slice(to);
fs.writeFileSync('www/app.js',app);
console.log('Admin Permissions dropdown loader repaired without changing permission enforcement.');
