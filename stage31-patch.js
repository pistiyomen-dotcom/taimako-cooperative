const fs=require('fs');

// 1) Fine-grained Admin permissions. Missing row = full legacy access for safe migration.
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS admin_permissions')){
  const table=`

CREATE TABLE IF NOT EXISTS admin_permissions (
  account_id BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  manage_admins BOOLEAN NOT NULL DEFAULT TRUE,
  manage_accounts BOOLEAN NOT NULL DEFAULT TRUE,
  cash_credit BOOLEAN NOT NULL DEFAULT TRUE,
  approve_payments BOOLEAN NOT NULL DEFAULT TRUE,
  approve_withdrawals BOOLEAN NOT NULL DEFAULT TRUE,
  manage_loans BOOLEAN NOT NULL DEFAULT TRUE,
  manage_savings BOOLEAN NOT NULL DEFAULT TRUE,
  view_reports BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by_account_id BIGINT REFERENCES accounts(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
  schema=schema.replace('\nCOMMIT;',table+'\nCOMMIT;');
}
fs.writeFileSync(schemaPath,schema);

// 2) Server-side permission enforcement.
const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes('async function adminPermissionAllowed')){
  const helper=`

const ADMIN_PERMISSION_KEYS=['manage_admins','manage_accounts','cash_credit','approve_payments','approve_withdrawals','manage_loans','manage_savings','view_reports'];
async function adminPermissionAllowed(accountId,key){
  if(!ADMIN_PERMISSION_KEYS.includes(key)) return false;
  const result=await pool.query('SELECT * FROM admin_permissions WHERE account_id=$1',[accountId]);
  if(!result.rows.length) return true;
  return result.rows[0][key]===true;
}
function requireAdminPermission(key){
  return async (req,res,next)=>{
    try{
      if(await adminPermissionAllowed(req.auth.sub,key)) return next();
      return res.status(403).json({error:'Your administrator account does not have permission for this action.'});
    }catch(error){ next(error); }
  };
}
`;
  admin=admin.replace('router.use(requireAuth, requireAdmin);','router.use(requireAuth, requireAdmin);'+helper);
}

const replacements=[
  ["router.post('/accounts', async (req, res) => {","router.post('/accounts', requireAdminPermission('manage_accounts'), async (req, res) => {"],
  ["router.get('/members/search', async (req, res) => {","router.get('/members/search', requireAdminPermission('manage_accounts'), async (req, res) => {"],
  ["router.post('/cash-credit', async (req, res) => {","router.post('/cash-credit', requireAdminPermission('cash_credit'), async (req, res) => {"],
  ["router.get('/payment-requests', async (req, res) => {","router.get('/payment-requests', requireAdminPermission('approve_payments'), async (req, res) => {"],
  ["router.get('/payment-requests/:id/receipt', async (req, res) => {","router.get('/payment-requests/:id/receipt', requireAdminPermission('approve_payments'), async (req, res) => {"],
  ["router.post('/payment-requests/:id/approve', async (req, res) => {","router.post('/payment-requests/:id/approve', requireAdminPermission('approve_payments'), async (req, res) => {"],
  ["router.post('/payment-requests/:id/reject', async (req, res) => {","router.post('/payment-requests/:id/reject', requireAdminPermission('approve_payments'), async (req, res) => {"],
  ["router.get('/withdrawal-requests', async (req, res) => {","router.get('/withdrawal-requests', requireAdminPermission('approve_withdrawals'), async (req, res) => {"],
  ["router.post('/withdrawal-requests/:id/approve', async (req, res) => {","router.post('/withdrawal-requests/:id/approve', requireAdminPermission('approve_withdrawals'), async (req, res) => {"],
  ["router.post('/withdrawal-requests/:id/reject', async (req, res) => {","router.post('/withdrawal-requests/:id/reject', requireAdminPermission('approve_withdrawals'), async (req, res) => {"],
  ["router.post('/account-links', async (req, res) => {","router.post('/account-links', requireAdminPermission('manage_accounts'), async (req, res) => {"],
  ["router.get('/transactions', async (req, res) => {","router.get('/transactions', requireAdminPermission('view_reports'), async (req, res) => {"],
  ["router.get('/loans', async (req, res) => {","router.get('/loans', requireAdminPermission('manage_loans'), async (req, res) => {"],
  ["router.get('/loan-applications', async (req, res) => {","router.get('/loan-applications', requireAdminPermission('manage_loans'), async (req, res) => {"],
  ["router.post('/loan-applications/:id/approve', async (req, res) => {","router.post('/loan-applications/:id/approve', requireAdminPermission('manage_loans'), async (req, res) => {"],
  ["router.post('/loan-applications/:id/reject', async (req, res) => {","router.post('/loan-applications/:id/reject', requireAdminPermission('manage_loans'), async (req, res) => {"],
  ["router.get('/contact-requests', async (_req,res)=>{","router.get('/contact-requests', requireAdminPermission('view_reports'), async (_req,res)=>{"],
  ["router.get('/savings-plans', async (req, res) => {","router.get('/savings-plans', requireAdminPermission('manage_savings'), async (req, res) => {"],
  ["router.post('/savings-plans', async (req, res) => {","router.post('/savings-plans', requireAdminPermission('manage_savings'), async (req, res) => {"],
  ["router.get('/savings-plan-progress', async (req, res) => {","router.get('/savings-plan-progress', requireAdminPermission('manage_savings'), async (req, res) => {"],
  ["router.get('/savings-compliance', async (req,res) => {","router.get('/savings-compliance', requireAdminPermission('manage_savings'), async (req,res) => {"],
  ["router.post('/savings-compliance-close-month', async (req,res) => {","router.post('/savings-compliance-close-month', requireAdminPermission('manage_savings'), async (req,res) => {"],
  ["router.get('/savings-compliance-charges', async (req,res) => {","router.get('/savings-compliance-charges', requireAdminPermission('manage_savings'), async (req,res) => {"],
  ["router.get('/savings-compliance-balance', async (req,res) => {","router.get('/savings-compliance-balance', requireAdminPermission('manage_savings'), async (req,res) => {"],
  ["router.post('/savings-compliance-payments', async (req,res) => {","router.post('/savings-compliance-payments', requireAdminPermission('manage_savings'), async (req,res) => {"],
  ["router.get('/target-rewards', async (req,res) => {","router.get('/target-rewards', requireAdminPermission('manage_savings'), async (req,res) => {"],
  ["router.get('/welfare-payout-readiness', async (req,res) => {","router.get('/welfare-payout-readiness', requireAdminPermission('manage_savings'), async (req,res) => {"],
  ["router.post('/welfare-payout-prepare', async (req,res) => {","router.post('/welfare-payout-prepare', requireAdminPermission('manage_savings'), async (req,res) => {"],
  ["router.get('/constant-maturity-readiness', async (req,res) => {","router.get('/constant-maturity-readiness', requireAdminPermission('manage_savings'), async (req,res) => {"],
  ["router.post('/constant-maturity-prepare', async (req,res) => {","router.post('/constant-maturity-prepare', requireAdminPermission('manage_savings'), async (req,res) => {"]
];
for(const [from,to] of replacements){ if(admin.includes(from)) admin=admin.replace(from,to); }

// Creating another Admin additionally requires manage_admins.
if(!admin.includes("role === 'admin' && !(await adminPermissionAllowed")){
  const target="  if (!['admin', 'regular', 'flexible'].includes(role)) return res.status(400).json({ error: 'Select Admin, Regular or Flexible.' });";
  const add=target+"\n  if (role === 'admin' && !(await adminPermissionAllowed(req.auth.sub,'manage_admins'))) return res.status(403).json({ error: 'Your administrator account cannot create other administrators.' });";
  if(!admin.includes(target)){ console.error('Stage 31 account role validation target missing'); process.exit(1); }
  admin=admin.replace(target,add);
}

// Permission administration endpoints.
if(!admin.includes("router.get('/admin-permissions'")){
  const routes=`

router.get('/admin-permissions', requireAdminPermission('manage_admins'), async (req,res) => {
  const result=await pool.query("SELECT a.id,a.username,a.full_name,a.is_active,p.manage_admins,p.manage_accounts,p.cash_credit,p.approve_payments,p.approve_withdrawals,p.manage_loans,p.manage_savings,p.view_reports,p.updated_at FROM accounts a LEFT JOIN admin_permissions p ON p.account_id=a.id WHERE a.role='admin' ORDER BY a.id");
  const admins=result.rows.map(r=>({id:r.id,username:r.username,name:r.full_name,active:r.is_active,permissions:{manage_admins:r.manage_admins===null?true:r.manage_admins,manage_accounts:r.manage_accounts===null?true:r.manage_accounts,cash_credit:r.cash_credit===null?true:r.cash_credit,approve_payments:r.approve_payments===null?true:r.approve_payments,approve_withdrawals:r.approve_withdrawals===null?true:r.approve_withdrawals,manage_loans:r.manage_loans===null?true:r.manage_loans,manage_savings:r.manage_savings===null?true:r.manage_savings,view_reports:r.view_reports===null?true:r.view_reports},updatedAt:r.updated_at}));
  res.json({admins});
});

router.post('/admin-permissions/:accountId', requireAdminPermission('manage_admins'), async (req,res) => {
  const accountId=Number(req.params.accountId);
  if(!Number.isInteger(accountId)||accountId<=0) return res.status(400).json({error:'Invalid administrator account.'});
  if(String(accountId)===String(req.auth.sub)) return res.status(400).json({error:'For safety, you cannot change your own administrator permissions.'});
  const adminAccount=await pool.query("SELECT id,username,full_name,is_active FROM accounts WHERE id=$1 AND role='admin'",[accountId]);
  if(!adminAccount.rows.length) return res.status(404).json({error:'Administrator account not found.'});
  const values={};
  for(const key of ADMIN_PERMISSION_KEYS) values[key]=req.body?.[key]!==false;
  const saved=await pool.query("INSERT INTO admin_permissions(account_id,manage_admins,manage_accounts,cash_credit,approve_payments,approve_withdrawals,manage_loans,manage_savings,view_reports,updated_by_account_id,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT(account_id) DO UPDATE SET manage_admins=EXCLUDED.manage_admins,manage_accounts=EXCLUDED.manage_accounts,cash_credit=EXCLUDED.cash_credit,approve_payments=EXCLUDED.approve_payments,approve_withdrawals=EXCLUDED.approve_withdrawals,manage_loans=EXCLUDED.manage_loans,manage_savings=EXCLUDED.manage_savings,view_reports=EXCLUDED.view_reports,updated_by_account_id=EXCLUDED.updated_by_account_id,updated_at=NOW() RETURNING *",[accountId,values.manage_admins,values.manage_accounts,values.cash_credit,values.approve_payments,values.approve_withdrawals,values.manage_loans,values.manage_savings,values.view_reports,req.auth.sub]);
  res.json({admin:{id:adminAccount.rows[0].id,username:adminAccount.rows[0].username,name:adminAccount.rows[0].full_name},permissions:saved.rows[0]});
});
`;
  admin=admin.replace('\nmodule.exports = router;',routes+'\nmodule.exports = router;');
}
fs.writeFileSync(adminPath,admin);

// 3) Admin permissions dialog.
const indexPath='www/index.html';
let index=fs.readFileSync(indexPath,'utf8');
if(!index.includes('id="adminPermissionsDialog"')){
  const dialog=`
  <dialog id="adminPermissionsDialog" class="wide-dialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>Admin Permissions</h3><button type="button" class="icon-btn" data-close="adminPermissionsDialog" aria-label="Close">×</button></div>
      <p class="helper">Select an administrator and choose the functions they are allowed to perform. Existing Admins retain full access until permissions are explicitly changed.</p>
      <label>Administrator<select id="adminPermissionSelect"></select></label>
      <div class="mini-grid" id="adminPermissionChecks">
        <label><input type="checkbox" data-admin-permission="manage_admins" /> Manage Admins</label>
        <label><input type="checkbox" data-admin-permission="manage_accounts" /> Member Accounts</label>
        <label><input type="checkbox" data-admin-permission="cash_credit" /> Cash Credits</label>
        <label><input type="checkbox" data-admin-permission="approve_payments" /> Deposit Approvals</label>
        <label><input type="checkbox" data-admin-permission="approve_withdrawals" /> Withdrawal Approvals</label>
        <label><input type="checkbox" data-admin-permission="manage_loans" /> Loans</label>
        <label><input type="checkbox" data-admin-permission="manage_savings" /> Savings Operations</label>
        <label><input type="checkbox" data-admin-permission="view_reports" /> Reports</label>
      </div>
      <p class="form-error" id="adminPermissionsError" role="alert"></p>
      <p class="form-success" id="adminPermissionsSuccess" role="status"></p>
      <div class="dialog-actions"><button class="primary" type="button" id="saveAdminPermissions">SAVE PERMISSIONS</button></div>
    </div>
  </dialog>
`;
  index=index.replace('</body>',dialog+'\n</body>');
}
fs.writeFileSync(indexPath,index);

const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
if(!app.includes("['ADMIN PERMISSIONS'")){
  app=app.replace(
"    ['CREATE ACCOUNT', 'Create Regular, Flexible or Admin account'],",
"    ['CREATE ACCOUNT', 'Create Regular, Flexible or Admin account'],\n    ['ADMIN PERMISSIONS', 'Control what each Admin account can do'],"
  );
  app=app.replace(
"  if (title === 'CREATE ACCOUNT') { createAccountForm.reset(); createAccountError.textContent=''; createAccountSuccess.textContent=''; updateAccountHints(); openDialog(createAccountDialog); }",
"  if (title === 'CREATE ACCOUNT') { createAccountForm.reset(); createAccountError.textContent=''; createAccountSuccess.textContent=''; updateAccountHints(); openDialog(createAccountDialog); }\n  if (title === 'ADMIN PERMISSIONS') { openAdminPermissionsDialog(); }"
  );
}
if(!app.includes('let adminPermissionData=[];')){
  app += `
let adminPermissionData=[];
async function openAdminPermissionsDialog(){
  const error=document.getElementById('adminPermissionsError'),success=document.getElementById('adminPermissionsSuccess'),select=document.getElementById('adminPermissionSelect');
  error.textContent=''; success.textContent=''; select.innerHTML='<option>Loading…</option>';
  document.getElementById('adminPermissionsDialog').showModal();
  try{
    const data=await api('/api/admin/admin-permissions'); adminPermissionData=data.admins||[];
    select.innerHTML=adminPermissionData.map(a=>'<option value="'+escapeHTML(a.id)+'">'+escapeHTML(a.username)+' • '+escapeHTML(a.name)+'</option>').join('');
    loadSelectedAdminPermissions();
  }catch(err){ select.innerHTML=''; error.textContent=err.message; }
}
function loadSelectedAdminPermissions(){
  const id=Number(document.getElementById('adminPermissionSelect').value);
  const a=adminPermissionData.find(x=>Number(x.id)===id); if(!a) return;
  document.querySelectorAll('[data-admin-permission]').forEach(cb=>{ cb.checked=a.permissions[cb.dataset.adminPermission]!==false; });
}
document.getElementById('adminPermissionSelect').addEventListener('change',loadSelectedAdminPermissions);
document.getElementById('saveAdminPermissions').addEventListener('click',async()=>{
  const error=document.getElementById('adminPermissionsError'),success=document.getElementById('adminPermissionsSuccess'); error.textContent=''; success.textContent='';
  const id=Number(document.getElementById('adminPermissionSelect').value); if(!id){ error.textContent='Select an administrator.'; return; }
  const body={}; document.querySelectorAll('[data-admin-permission]').forEach(cb=>{ body[cb.dataset.adminPermission]=cb.checked; });
  try{
    const data=await api('/api/admin/admin-permissions/'+id,{method:'POST',body:JSON.stringify(body)});
    success.textContent='Permissions updated for '+data.admin.username+'.';
    const current=adminPermissionData.find(x=>Number(x.id)===id); if(current) current.permissions=body;
  }catch(err){ error.textContent=err.message; }
});
`;
}
fs.writeFileSync(appPath,app);

// 4) Cache bump.
index=fs.readFileSync(indexPath,'utf8').replace(/app\\.js\\?v=30/g,'app.js?v=31').replace(/styles\\.css\\?v=30/g,'styles.css?v=31');
fs.writeFileSync(indexPath,index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v30/g,'taimako-v31');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=30/g,'sw.js?v=31');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 31 Admin permissions applied.');
