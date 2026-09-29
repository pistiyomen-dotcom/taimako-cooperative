const fs=require('fs');

// Stage 33: Admin audit trail.
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS admin_audit_log')){
  const table=`

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_account_id BIGINT REFERENCES accounts(id),
  action_code VARCHAR(80) NOT NULL,
  target_type VARCHAR(40),
  target_id VARCHAR(80),
  target_username VARCHAR(40),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_account_id,created_at DESC);
`;
  schema=schema.replace('\nCOMMIT;',table+'\nCOMMIT;');
}
fs.writeFileSync(schemaPath,schema);

const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes('async function writeAdminAudit')){
  const helper=`

async function writeAdminAudit(clientOrPool, req, actionCode, targetType, targetId, targetUsername, details={}){
  try{
    await clientOrPool.query(
      'INSERT INTO admin_audit_log(admin_account_id,action_code,target_type,target_id,target_username,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)',
      [req.auth?.sub||null,actionCode,targetType||null,targetId==null?null:String(targetId),targetUsername||null,JSON.stringify(details||{})]
    );
  }catch(error){ console.error('Admin audit write failed:',error.message); }
}
`;
  admin=admin.replace("function money(v) { return Number(v || 0); }","function money(v) { return Number(v || 0); }"+helper);
}

// Insert audits after successful financial/admin actions.
const rules=[
  ["res.status(201).json({ account: accountView(created.rows[0]) });","await writeAdminAudit(pool,req,'ACCOUNT_CREATED','account',created.rows[0].id,created.rows[0].username,{role:created.rows[0].role});\n    res.status(201).json({ account: accountView(created.rows[0]) });"],
  ["res.json({ transaction: tx.rows[0], balances: balanceView(updated.rows[0]) });","await writeAdminAudit(pool,req,'CASH_CREDIT_POSTED','account',member.id,member.username,{destination,amount});\n    res.json({ transaction: tx.rows[0], balances: balanceView(updated.rows[0]) });"],
  ["res.json({ request: updated.rows[0] });","await writeAdminAudit(pool,req,'PAYMENT_REQUEST_APPROVED','payment_request',request.id,request.username,{destination:request.destination,amount:Number(request.amount)});\n    res.json({ request: updated.rows[0] });"],
  ["res.json({ ok: true });","await writeAdminAudit(pool,req,'ADMIN_ACTION_COMPLETED','generic',null,null,{path:req.path,method:req.method});\n    res.json({ ok: true });"],
  ["res.json({ admin:{id:adminAccount.rows[0].id,username:adminAccount.rows[0].username,name:adminAccount.rows[0].full_name},permissions:saved.rows[0]});","await writeAdminAudit(pool,req,'ADMIN_PERMISSIONS_CHANGED','admin',adminAccount.rows[0].id,adminAccount.rows[0].username,values);\n  res.json({ admin:{id:adminAccount.rows[0].id,username:adminAccount.rows[0].username,name:adminAccount.rows[0].full_name},permissions:saved.rows[0]});"]
];
for(const [from,to] of rules){ if(admin.includes(from)) admin=admin.replace(from,to); }

if(!admin.includes("router.get('/audit-log'")){
  const route=`

router.get('/audit-log', requireAdminPermission('view_reports'), async (req,res) => {
  const limit=Math.min(500,Math.max(1,Number(req.query.limit||200)));
  const result=await pool.query("SELECT l.id,l.action_code,l.target_type,l.target_id,l.target_username,l.details,l.created_at,a.username AS admin_username,a.full_name AS admin_name FROM admin_audit_log l LEFT JOIN accounts a ON a.id=l.admin_account_id ORDER BY l.created_at DESC LIMIT $1",[limit]);
  res.json({entries:result.rows});
});
`;
  admin=admin.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(adminPath,admin);

const indexPath='www/index.html';
let index=fs.readFileSync(indexPath,'utf8');
if(!index.includes('id="auditLogDialog"')){
  const dialog=`
  <dialog id="auditLogDialog" class="wide-dialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>Admin Audit Log</h3><button type="button" class="icon-btn" data-close="auditLogDialog" aria-label="Close">×</button></div>
      <p class="helper">Recent administrator actions and the accounts or records affected.</p>
      <p class="form-error" id="auditLogError" role="alert"></p>
      <div id="auditLogList"></div>
    </div>
  </dialog>
`;
  index=index.replace('</body>',dialog+'\n</body>');
}
fs.writeFileSync(indexPath,index);

const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
if(!app.includes("['AUDIT LOG'")){
  app=app.replace(
"    ['ADMIN PERMISSIONS', 'Control what each Admin account can do'],",
"    ['ADMIN PERMISSIONS', 'Control what each Admin account can do'],\n    ['AUDIT LOG', 'Review administrator activity history'],"
  );
  app=app.replace(
"  if (title === 'ADMIN PERMISSIONS') { openAdminPermissionsDialog(); }",
"  if (title === 'ADMIN PERMISSIONS') { openAdminPermissionsDialog(); }\n  if (title === 'AUDIT LOG') { openAuditLogDialog(); }"
  );
}

if(!app.includes("'AUDIT LOG':'view_reports'")){
  app=app.replace("'CONTACT REQUESTS':'view_reports',","'CONTACT REQUESTS':'view_reports',\n    'AUDIT LOG':'view_reports',");
  app=app.replace("'CONTACT REQUESTS','LINK FLEXIBLE'","'CONTACT REQUESTS','AUDIT LOG','LINK FLEXIBLE'");
}

if(!app.includes('async function openAuditLogDialog()')){
  app += `
async function openAuditLogDialog(){
  const dialog=document.getElementById('auditLogDialog'),box=document.getElementById('auditLogList'),error=document.getElementById('auditLogError');
  error.textContent=''; box.innerHTML='<p class="helper">Loading audit history…</p>'; dialog.showModal();
  try{
    const data=await api('/api/admin/audit-log?limit=200');
    if(!data.entries.length){ box.innerHTML='<p class="empty-state">No administrator activity has been recorded yet.</p>'; return; }
    box.innerHTML='<div class="mini-grid">'+data.entries.map(e=>'<div><span>'+escapeHTML(e.action_code)+'</span><b>'+escapeHTML(e.admin_username||'SYSTEM')+'</b><small>'+escapeHTML(e.target_username||e.target_id||e.target_type||'—')+'</small><small>'+escapeHTML(new Date(e.created_at).toLocaleString())+'</small></div>').join('')+'</div>';
  }catch(err){ box.innerHTML=''; error.textContent=err.message; }
}
`;
}
fs.writeFileSync(appPath,app);

index=fs.readFileSync(indexPath,'utf8').replace(/app\\.js\\?v=32/g,'app.js?v=33').replace(/styles\\.css\\?v=32/g,'styles.css?v=33');
fs.writeFileSync(indexPath,index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v32/g,'taimako-v33');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=32/g,'sw.js?v=33');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 33 Admin audit trail applied.');
