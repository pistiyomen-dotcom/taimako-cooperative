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

// Filter Admin dashboard cards before rendering.
if(!app.includes('adminActionsFiltered')){
  const old="  actions.forEach(([title, subtitle]) => {";
  const neu="  const adminActionsFiltered = currentUser?.role==='admin' ? actions.filter(([title])=>adminActionAllowed(title)) : actions;\n  adminActionsFiltered.forEach(([title, subtitle]) => {";
  if(!app.includes(old)){ console.error('Stage 32 dashboard action loop target not found'); process.exit(1); }
  app=app.replace(old,neu);
}

// Load permissions after successful Admin login before dashboard render.
if(!app.includes("currentAdminPermissions=(await api('/api/admin/my-permissions')).permissions")){
  const marker="currentUser = data.user;";
  const replacement="currentUser = data.user;\n    if (currentUser?.role === 'admin') { try { currentAdminPermissions=(await api('/api/admin/my-permissions')).permissions; } catch (_) { currentAdminPermissions=null; } } else { currentAdminPermissions=null; }";
  if(!app.includes(marker)){ console.error('Stage 32 login currentUser target not found'); process.exit(1); }
  app=app.replace(marker,replacement);
}

// Reset permissions on logout.
if(!app.includes('currentAdminPermissions = null; // Stage 32')){
  const logoutMarker="currentUser = null;";
  const first=app.indexOf(logoutMarker);
  const second=app.indexOf(logoutMarker, first+1);
  if(second>=0) app=app.slice(0,second)+"currentUser = null;\n  currentAdminPermissions = null; // Stage 32"+app.slice(second+logoutMarker.length);
}

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
