const fs=require('fs');

// Stage 32: expose current Admin permissions and hide unauthorized dashboard actions.
const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes("router.get('/my-permissions'")){
  const route=`

router.get('/my-permissions', async (req,res) => {
  const result=await pool.query('SELECT * FROM admin_permissions WHERE account_id=$1',[req.auth.sub]);
  const r=result.rows[0];
  const permissions={};
  for(const key of ADMIN_PERMISSION_KEYS) permissions[key]=r ? r[key]===true : true;
  res.json({permissions});
});
`;
  admin=admin.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(adminPath,admin);

const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');

if(!app.includes('let currentAdminPermissions=null;')){
  app = app.replace(
"let currentUser = null;",
"let currentUser = null;\nlet currentAdminPermissions=null;"
  );
}

if(!app.includes('function adminPermissionForAction')){
  const helper=`

function adminPermissionForAction(title){
  const map={
    'CREATE ACCOUNT':'manage_accounts',
    'ADMIN PERMISSIONS':'manage_admins',
    'CASH CREDIT':'cash_credit',
    'PAYMENT REQUESTS':'approve_payments',
    'WITHDRAWAL REQUESTS':'approve_withdrawals',
    'LOANS':'manage_loans',
    'LOAN APPLICATIONS':'manage_loans',
    'SAVINGS PLAN SETUP':'manage_savings',
    'MONTH-END COMPLIANCE':'manage_savings',
    'COMPLIANCE SETTLEMENT':'manage_savings',
    'WELFARE PAYOUT':'manage_savings',
    'CONSTANT MATURITY':'manage_savings',
    'TRANSACTIONS':'view_reports',
    'CONTACT REQUESTS':'view_reports',
    'LINK FLEXIBLE':'manage_accounts'
  };
  return map[title]||null;
}
function adminActionAllowed(title){
  if(!currentAdminPermissions) return true;
  const key=adminPermissionForAction(title);
  return !key || currentAdminPermissions[key]!==false;
}
`;
  app += helper;
}

// Hide unauthorized Admin actions after the dashboard is rendered.
if(!app.includes('function applyAdminPermissionVisibility()')){
  app += `
function applyAdminPermissionVisibility(){
  if(currentUser?.role!=='admin' || !currentAdminPermissions) return;
  const titles=['CREATE ACCOUNT','ADMIN PERMISSIONS','CASH CREDIT','PAYMENT REQUESTS','WITHDRAWAL REQUESTS','LOANS','LOAN APPLICATIONS','SAVINGS PLAN SETUP','MONTH-END COMPLIANCE','COMPLIANCE SETTLEMENT','WELFARE PAYOUT','CONSTANT MATURITY','TRANSACTIONS','CONTACT REQUESTS','LINK FLEXIBLE'];
  document.querySelectorAll('button').forEach(btn=>{
    const text=(btn.textContent||'').trim().toUpperCase();
    const title=titles.find(t=>text===t||text.startsWith(t+' '));
    if(title && !adminActionAllowed(title)) btn.style.display='none';
  });
}
`;
}

// Load permissions lazily whenever an Admin dashboard is present.
if(!app.includes('let adminPermissionsLoading=false;')){
  app += `
let adminPermissionsLoading=false;
let adminPermissionsUsername=null;
async function ensureAdminPermissionsLoaded(){
  if(currentUser?.role!=='admin') { currentAdminPermissions=null; adminPermissionsUsername=null; return; }
  if(currentAdminPermissions && adminPermissionsUsername===currentUser.username) return;
  if(adminPermissionsLoading) return;
  adminPermissionsLoading=true;
  try{
    const data=await api('/api/admin/my-permissions');
    currentAdminPermissions=data.permissions;
    adminPermissionsUsername=currentUser.username;
    applyAdminPermissionVisibility();
  }catch(_){
    currentAdminPermissions=null;
  }finally{
    adminPermissionsLoading=false;
  }
}
`;
}

// Permission cache resets automatically when the signed-in username changes.
fs.writeFileSync(appPath,app);

// Cache bump.
const indexPath='www/index.html';
let index=fs.readFileSync(indexPath,'utf8').replace(/app\\.js\\?v=31/g,'app.js?v=32').replace(/styles\\.css\\?v=31/g,'styles.css?v=32');
fs.writeFileSync(indexPath,index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v31/g,'taimako-v32');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=31/g,'sw.js?v=32');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 32 permission-aware Admin dashboard applied.');
