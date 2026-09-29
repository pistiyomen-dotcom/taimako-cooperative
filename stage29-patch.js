const fs=require('fs');

// 1) Welfare payout preparation table.
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS welfare_payout_plans')){
  const table=`

CREATE TABLE IF NOT EXISTS welfare_payout_plans (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  savings_plan_start_date DATE NOT NULL,
  savings_plan_end_date DATE NOT NULL,
  payout_principal NUMERIC(14,2) NOT NULL CHECK (payout_principal >= 0),
  disbursement_months INTEGER NOT NULL CHECK (disbursement_months >= 12),
  payout_mode VARCHAR(20) CHECK (payout_mode IN ('DESCENDING','ASCENDING')),
  status VARCHAR(20) NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','active','completed','cancelled')),
  prepared_by_account_id BIGINT REFERENCES accounts(id),
  prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_welfare_payout_status ON welfare_payout_plans(status,prepared_at DESC);
`;
  schema=schema.replace('\nCOMMIT;',table+'\nCOMMIT;');
}
fs.writeFileSync(schemaPath,schema);

// 2) Admin prepare/read Welfare payout plans.
const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes("router.post('/welfare-payout-prepare'")){
  const routes=`

router.get('/welfare-payout-readiness', async (req,res) => {
  const username=String(req.query.username||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter a member username.'});
  const result=await pool.query("SELECT a.id,a.username,a.full_name,a.role,a.is_active,COALESCE(b.welfare,0) AS welfare_balance,p.start_date,p.duration_months,p.disbursement_months,p.status AS savings_plan_status,w.id AS payout_id,w.savings_plan_end_date,w.payout_principal,w.disbursement_months AS payout_disbursement_months,w.payout_mode,w.status AS payout_status,w.prepared_at FROM accounts a LEFT JOIN member_balances b ON b.account_id=a.id LEFT JOIN savings_plans p ON p.account_id=a.id AND p.plan_type='WELFARE' LEFT JOIN welfare_payout_plans w ON w.account_id=a.id WHERE a.username=$1",[username]);
  const row=result.rows[0];
  if(!row || !row.is_active) return res.status(404).json({error:'Active member account not found.'});
  if(row.role!=='regular') return res.status(400).json({error:'Welfare payout applies to Regular member accounts.'});
  if(!row.start_date) return res.status(400).json({error:'No Welfare savings plan is configured for this member.'});
  const start=new Date(row.start_date);
  const end=new Date(start); end.setUTCMonth(end.getUTCMonth()+Number(row.duration_months||0));
  const now=new Date();
  res.json({member:{username:row.username,name:row.full_name},welfareBalance:Number(row.welfare_balance||0),savingStart:String(row.start_date).slice(0,10),savingEnd:end.toISOString().slice(0,10),savingDurationMonths:Number(row.duration_months||0),configuredDisbursementMonths:Number(row.disbursement_months||0),savingPhaseComplete:now>=end,payout:row.payout_id?{id:row.payout_id,principal:Number(row.payout_principal||0),disbursementMonths:Number(row.payout_disbursement_months||0),mode:row.payout_mode,status:row.payout_status,preparedAt:row.prepared_at}:null});
});

router.post('/welfare-payout-prepare', async (req,res) => {
  const username=String(req.body?.username||'').trim().toUpperCase();
  const disbursementMonths=Number(req.body?.disbursementMonths);
  const mode=String(req.body?.mode||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter a member username.'});
  if(!Number.isInteger(disbursementMonths) || disbursementMonths<12) return res.status(400).json({error:'Welfare disbursement duration must be at least 12 months.'});
  if(mode && !['DESCENDING','ASCENDING'].includes(mode)) return res.status(400).json({error:'Payout mode must be Descending or Ascending.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const memberResult=await client.query("SELECT a.id,a.username,a.full_name,a.role,a.is_active,COALESCE(b.welfare,0) AS welfare_balance FROM accounts a JOIN member_balances b ON b.account_id=a.id WHERE a.username=$1 FOR UPDATE",[username]);
    const member=memberResult.rows[0];
    if(!member || !member.is_active){ await client.query('ROLLBACK'); return res.status(404).json({error:'Active member account not found.'}); }
    if(member.role!=='regular'){ await client.query('ROLLBACK'); return res.status(400).json({error:'Welfare payout applies to Regular member accounts.'}); }
    const planResult=await client.query("SELECT start_date,duration_months,disbursement_months,status FROM savings_plans WHERE account_id=$1 AND plan_type='WELFARE'",[member.id]);
    const plan=planResult.rows[0];
    if(!plan){ await client.query('ROLLBACK'); return res.status(400).json({error:'No Welfare savings plan is configured for this member.'}); }
    const start=new Date(plan.start_date);
    const end=new Date(start); end.setUTCMonth(end.getUTCMonth()+Number(plan.duration_months||0));
    if(new Date()<end){ await client.query('ROLLBACK'); return res.status(400).json({error:'Welfare saving phase is not yet complete.'}); }
    const existing=await client.query('SELECT id,status FROM welfare_payout_plans WHERE account_id=$1 FOR UPDATE',[member.id]);
    if(existing.rows.length){ await client.query('ROLLBACK'); return res.status(409).json({error:'A Welfare payout plan has already been prepared for this member.'}); }
    const principal=Number(member.welfare_balance||0);
    const created=await client.query("INSERT INTO welfare_payout_plans(account_id,savings_plan_start_date,savings_plan_end_date,payout_principal,disbursement_months,payout_mode,status,prepared_by_account_id,note) VALUES($1,$2,$3,$4,$5,$6,'prepared',$7,$8) RETURNING id,payout_principal,disbursement_months,payout_mode,status,prepared_at",[member.id,String(plan.start_date).slice(0,10),end.toISOString().slice(0,10),principal,disbursementMonths,mode||null,req.auth.sub,'Prepared after Welfare saving phase completion; payout formula activation remains separate.']);
    await client.query('COMMIT');
    res.status(201).json({member:{username:member.username,name:member.full_name},payout:created.rows[0]});
  }catch(error){ await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});
`;
  admin=admin.replace('\nmodule.exports = router;',routes+'\nmodule.exports = router;');
}
fs.writeFileSync(adminPath,admin);

// 3) Member Welfare payout status.
const accountPath='server/routes/account.js';
let account=fs.readFileSync(accountPath,'utf8');
if(!account.includes("router.get('/welfare-payout'")){
  const route=`

router.get('/welfare-payout', requireAuth, async (req,res) => {
  const result=await pool.query("SELECT w.savings_plan_start_date,w.savings_plan_end_date,w.payout_principal,w.disbursement_months,w.payout_mode,w.status,w.prepared_at,w.activated_at,w.completed_at FROM welfare_payout_plans w WHERE w.account_id=$1",[req.auth.sub]);
  if(!result.rows.length) return res.json({payout:null});
  const r=result.rows[0];
  res.json({payout:{savingStart:r.savings_plan_start_date,savingEnd:r.savings_plan_end_date,principal:Number(r.payout_principal||0),disbursementMonths:Number(r.disbursement_months||0),mode:r.payout_mode,status:r.status,preparedAt:r.prepared_at,activatedAt:r.activated_at,completedAt:r.completed_at}});
});
`;
  account=account.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(accountPath,account);

// 4) Admin UI for Welfare payout preparation.
const indexPath='www/index.html';
let index=fs.readFileSync(indexPath,'utf8');
if(!index.includes('id="welfarePayoutDialog"')){
  const dialog=`
  <dialog id="welfarePayoutDialog" class="wide-dialog">
    <form class="dialog-card" id="welfarePayoutForm">
      <div class="dialog-head"><h3>Welfare Payout Preparation</h3><button type="button" class="icon-btn" data-close="welfarePayoutDialog" aria-label="Close">×</button></div>
      <p class="helper">Prepare payout only after the Welfare saving phase is complete. This locks the payout principal and duration. The actual ascending/descending payout calculation remains separate.</p>
      <label>Member Username<input id="welfarePayoutUsername" autocomplete="off" required /></label>
      <label>Disbursement Months<input id="welfarePayoutMonths" type="number" min="12" step="1" value="12" required /></label>
      <label>Payout Mode<select id="welfarePayoutMode"><option value="">Not selected yet</option><option value="DESCENDING">Descending</option><option value="ASCENDING">Ascending</option></select></label>
      <p class="form-error" id="welfarePayoutError" role="alert"></p>
      <p class="form-success" id="welfarePayoutSuccess" role="status"></p>
      <div class="dialog-actions"><button type="button" id="welfarePayoutCheck">CHECK READINESS</button><button class="primary" type="submit">PREPARE PAYOUT</button></div>
      <div id="welfarePayoutResult"></div>
    </form>
  </dialog>
`;
  index=index.replace('</body>',dialog+'\n</body>');
}
fs.writeFileSync(indexPath,index);

const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
if(!app.includes("['WELFARE PAYOUT'")){
  app=app.replace(
"    ['COMPLIANCE SETTLEMENT', 'Receive Target and Constant shortfall charge payments'],",
"    ['COMPLIANCE SETTLEMENT', 'Receive Target and Constant shortfall charge payments'],\n    ['WELFARE PAYOUT', 'Prepare completed Welfare savings for payout'],"
  );
  app=app.replace(
"  if (title === 'COMPLIANCE SETTLEMENT') { openComplianceSettlementDialog(); }",
"  if (title === 'COMPLIANCE SETTLEMENT') { openComplianceSettlementDialog(); }\n  if (title === 'WELFARE PAYOUT') { openWelfarePayoutDialog(); }"
  );
}
if(!app.includes('function openWelfarePayoutDialog()')){
  app += `
function openWelfarePayoutDialog(){
  const form=document.getElementById('welfarePayoutForm'); form.reset();
  document.getElementById('welfarePayoutMonths').value='12';
  document.getElementById('welfarePayoutError').textContent=''; document.getElementById('welfarePayoutSuccess').textContent=''; document.getElementById('welfarePayoutResult').innerHTML='';
  document.getElementById('welfarePayoutDialog').showModal();
}
async function checkWelfarePayoutReadiness(){
  const username=document.getElementById('welfarePayoutUsername').value.trim();
  const error=document.getElementById('welfarePayoutError'),box=document.getElementById('welfarePayoutResult');
  error.textContent=''; box.innerHTML='';
  if(!username){ error.textContent='Enter a member username.'; return; }
  try{
    const data=await api('/api/admin/welfare-payout-readiness?username='+encodeURIComponent(username));
    box.innerHTML='<div class="mini-grid"><div><span>'+escapeHTML(data.member.username)+' • '+escapeHTML(data.member.name)+'</span><b>'+naira(data.welfareBalance)+'</b><small>Saving phase: '+escapeHTML(data.savingStart)+' to '+escapeHTML(data.savingEnd)+'</small><small>'+(data.savingPhaseComplete?'READY FOR PAYOUT PREPARATION':'SAVING PHASE ACTIVE')+'</small></div></div>'+ (data.payout?'<p class="helper"><strong>Existing payout:</strong> '+naira(data.payout.principal)+' • '+escapeHTML(data.payout.disbursementMonths)+' months • '+escapeHTML(data.payout.mode||'mode not selected')+' • '+escapeHTML(data.payout.status)+'</p>':'');
  }catch(err){ error.textContent=err.message; }
}
document.getElementById('welfarePayoutCheck').addEventListener('click',checkWelfarePayoutReadiness);
document.getElementById('welfarePayoutForm').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const error=document.getElementById('welfarePayoutError'),success=document.getElementById('welfarePayoutSuccess'); error.textContent=''; success.textContent='';
  try{
    const data=await api('/api/admin/welfare-payout-prepare',{method:'POST',body:JSON.stringify({username:document.getElementById('welfarePayoutUsername').value.trim(),disbursementMonths:Number(document.getElementById('welfarePayoutMonths').value),mode:document.getElementById('welfarePayoutMode').value})});
    success.textContent='Welfare payout prepared for '+data.member.username+' • principal '+naira(data.payout.payout_principal)+' • '+data.payout.disbursement_months+' months.';
    await checkWelfarePayoutReadiness();
  }catch(err){ error.textContent=err.message; }
});
`;
}

// Add Welfare payout preparation status to member Savings Plans.
if(!app.includes("const welfarePayout=await api('/api/account/welfare-payout')")){
  app=app.replace(
"    const targetRewards=await api('/api/account/target-rewards');",
"    const targetRewards=await api('/api/account/target-rewards');\n    const welfarePayout=await api('/api/account/welfare-payout');"
  );
  app=app.replace(
"    const postedSummary='<p class=\"helper\"><strong>Outstanding month-end compliance charges:</strong> '+naira(postedCharges.outstandingTotal||0)+' • <strong>Total Target rewards credited:</strong> '+naira(targetRewards.totalReward||0)+'</p>';",
"    const welfareText=welfarePayout.payout?' • <strong>Welfare payout:</strong> '+naira(welfarePayout.payout.principal)+' over '+escapeHTML(welfarePayout.payout.disbursementMonths)+' months • '+escapeHTML(welfarePayout.payout.status):'';\n    const postedSummary='<p class=\"helper\"><strong>Outstanding month-end compliance charges:</strong> '+naira(postedCharges.outstandingTotal||0)+' • <strong>Total Target rewards credited:</strong> '+naira(targetRewards.totalReward||0)+welfareText+'</p>';"
  );
}
fs.writeFileSync(appPath,app);

// 5) Cache bump.
index=fs.readFileSync(indexPath,'utf8').replace(/app\\.js\\?v=28/g,'app.js?v=29').replace(/styles\\.css\\?v=28/g,'styles.css?v=29');
fs.writeFileSync(indexPath,index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v28/g,'taimako-v29');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=28/g,'sw.js?v=29');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 29 Welfare payout preparation applied.');
