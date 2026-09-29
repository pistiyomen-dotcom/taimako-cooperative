const fs=require('fs');

// 1) Persistent month-end Target/Constant shortfall charges.
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS savings_compliance_charges')){
  const table=`

CREATE TABLE IF NOT EXISTS savings_compliance_charges (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('TARGET','CONSTANT')),
  period_month DATE NOT NULL,
  required_amount NUMERIC(14,2) NOT NULL CHECK (required_amount >= 0),
  contributed_amount NUMERIC(14,2) NOT NULL CHECK (contributed_amount >= 0),
  shortfall_amount NUMERIC(14,2) NOT NULL CHECK (shortfall_amount >= 0),
  charge_rate NUMERIC(6,2) NOT NULL DEFAULT 10.00 CHECK (charge_rate >= 0),
  charge_amount NUMERIC(14,2) NOT NULL CHECK (charge_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid','waived')),
  assessed_by_account_id BIGINT REFERENCES accounts(id),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  note TEXT,
  UNIQUE(account_id, plan_type, period_month)
);
CREATE INDEX IF NOT EXISTS idx_savings_compliance_charges_account_status ON savings_compliance_charges(account_id,status,period_month DESC);
`;
  schema=schema.replace('\nCOMMIT;',table+'\nCOMMIT;');
}
fs.writeFileSync(schemaPath,schema);

// 2) Admin month-close assessment and charge reporting.
const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes("router.post('/savings-compliance-close-month'")){
  const routes=`

function complianceMonthBounds(monthText){
  const m=String(monthText||'').trim();
  if(!/^\\d{4}-\\d{2}$/.test(m)) throw new Error('Select a valid month.');
  const start=new Date(m+'-01T00:00:00.000Z');
  if(Number.isNaN(start.getTime())) throw new Error('Select a valid month.');
  const next=new Date(start); next.setUTCMonth(next.getUTCMonth()+1);
  const current=new Date();
  const currentStart=new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth(),1));
  if(start>=currentStart) throw new Error('Only a completed month can be closed.');
  return {start:start.toISOString().slice(0,10),next:next.toISOString().slice(0,10),month:m};
}

router.post('/savings-compliance-close-month', async (req,res) => {
  let bounds;
  try { bounds=complianceMonthBounds(req.body?.month); } catch(err){ return res.status(400).json({error:err.message}); }
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const plans=await client.query("SELECT p.account_id,p.plan_type,p.start_date,p.monthly_amount,a.username,a.full_name FROM savings_plans p JOIN accounts a ON a.id=p.account_id WHERE p.status='active' AND p.plan_type IN ('TARGET','CONSTANT') AND a.role='regular' AND a.is_active=TRUE AND p.start_date < $2 ORDER BY a.username,p.plan_type",[bounds.start,bounds.next]);
    const results=[];
    let createdCount=0;
    let totalNewCharge=0;
    for(const p of plans.rows){
      const required=Number(p.monthly_amount||0);
      if(required<=0) continue;
      const credits=await client.query("SELECT COALESCE(SUM(amount),0) AS contributed FROM transactions WHERE account_id=$1 AND destination=$2 AND status IN ('approved','completed') AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND COALESCE(approved_at,created_at) >= $3::date AND COALESCE(approved_at,created_at) < $4::date",[p.account_id,p.plan_type,bounds.start,bounds.next]);
      const contributed=Number(credits.rows[0]?.contributed||0);
      const shortfall=Math.max(0,Number((required-contributed).toFixed(2)));
      const charge=Number((shortfall*0.10).toFixed(2));
      let created=false;
      if(charge>0){
        const ins=await client.query("INSERT INTO savings_compliance_charges(account_id,plan_type,period_month,required_amount,contributed_amount,shortfall_amount,charge_rate,charge_amount,status,assessed_by_account_id,note) VALUES($1,$2,$3,$4,$5,$6,10,$7,'due',$8,$9) ON CONFLICT(account_id,plan_type,period_month) DO NOTHING RETURNING id",[p.account_id,p.plan_type,bounds.start,required,contributed,shortfall,charge,req.auth.sub,'10% charge on monthly savings shortfall']);
        created=ins.rows.length>0;
        if(created){ createdCount++; totalNewCharge+=charge; }
      }
      results.push({username:p.username,name:p.full_name,planType:p.plan_type,requiredAmount:required,contributedAmount:contributed,shortfallAmount:shortfall,chargeAmount:charge,compliant:shortfall===0,chargeCreated:created});
    }
    await client.query('COMMIT');
    res.json({month:bounds.month,assessed:results.length,newCharges:createdCount,totalNewCharge:Number(totalNewCharge.toFixed(2)),results});
  }catch(error){ await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});

router.get('/savings-compliance-charges', async (req,res) => {
  const username=String(req.query.username||'').trim().toUpperCase();
  const params=[];
  let where="WHERE c.status IN ('due','paid','waived')";
  if(username){ params.push(username); where+=' AND a.username=$'+params.length; }
  const result=await pool.query("SELECT c.id,a.username,a.full_name,c.plan_type,c.period_month,c.required_amount,c.contributed_amount,c.shortfall_amount,c.charge_rate,c.charge_amount,c.status,c.assessed_at,c.settled_at,c.note FROM savings_compliance_charges c JOIN accounts a ON a.id=c.account_id "+where+" ORDER BY c.period_month DESC,a.username,c.plan_type LIMIT 500",params);
  res.json({charges:result.rows});
});
`;
  admin=admin.replace('\nmodule.exports = router;',routes+'\nmodule.exports = router;');
}
fs.writeFileSync(adminPath,admin);

// 3) Member can see own posted compliance charges.
const accountPath='server/routes/account.js';
let account=fs.readFileSync(accountPath,'utf8');
if(!account.includes("router.get('/savings-compliance-charges'")){
  const route=`

router.get('/savings-compliance-charges', requireAuth, async (req,res) => {
  const result=await pool.query("SELECT plan_type,period_month,required_amount,contributed_amount,shortfall_amount,charge_rate,charge_amount,status,assessed_at,settled_at,note FROM savings_compliance_charges WHERE account_id=$1 ORDER BY period_month DESC,plan_type LIMIT 120",[req.auth.sub]);
  const outstanding=result.rows.filter(r=>r.status==='due').reduce((sum,r)=>sum+Number(r.charge_amount||0),0);
  res.json({outstandingTotal:Number(outstanding.toFixed(2)),charges:result.rows});
});
`;
  account=account.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(accountPath,account);

// 4) Admin month-close dialog and dashboard action.
const indexPath='www/index.html';
let index=fs.readFileSync(indexPath,'utf8');
if(!index.includes('id="complianceCloseDialog"')){
  const dialog=`
  <dialog id="complianceCloseDialog" class="wide-dialog">
    <form class="dialog-card" id="complianceCloseForm">
      <div class="dialog-head"><h3>Month-End Savings Compliance</h3><button type="button" class="icon-btn" data-close="complianceCloseDialog" aria-label="Close">×</button></div>
      <p class="helper">Close a completed month for active Target and Constant plans. The system posts a 10% charge on any monthly shortfall. Running the same month again will not duplicate charges.</p>
      <label>Completed Month<input id="complianceMonth" type="month" required /></label>
      <p class="form-error" id="complianceCloseError" role="alert"></p>
      <p class="form-success" id="complianceCloseSuccess" role="status"></p>
      <div class="dialog-actions"><button class="primary" type="submit">CLOSE MONTH</button></div>
      <div id="complianceCloseResults"></div>
    </form>
  </dialog>
`;
  index=index.replace('</body>',dialog+'\n</body>');
}
fs.writeFileSync(indexPath,index);

const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
if(!app.includes("['MONTH-END COMPLIANCE'")){
  app=app.replace(
"    ['SAVINGS PLAN SETUP', 'Set Target, Constant and Welfare plan terms'],",
"    ['SAVINGS PLAN SETUP', 'Set Target, Constant and Welfare plan terms'],\n    ['MONTH-END COMPLIANCE', 'Post Target and Constant monthly shortfall charges'],"
  );
  app=app.replace(
"  if (title === 'SAVINGS PLAN SETUP') { openSavingsPlanDialog(); }",
"  if (title === 'SAVINGS PLAN SETUP') { openSavingsPlanDialog(); }\n  if (title === 'MONTH-END COMPLIANCE') { openComplianceCloseDialog(); }"
  );
}
if(!app.includes('function openComplianceCloseDialog()')){
  app += `
function previousMonthValue(){
  const d=new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()-1);
  return d.toISOString().slice(0,7);
}
function openComplianceCloseDialog(){
  const form=document.getElementById('complianceCloseForm');
  form.reset();
  document.getElementById('complianceMonth').value=previousMonthValue();
  document.getElementById('complianceCloseError').textContent='';
  document.getElementById('complianceCloseSuccess').textContent='';
  document.getElementById('complianceCloseResults').innerHTML='';
  document.getElementById('complianceCloseDialog').showModal();
}
document.getElementById('complianceCloseForm').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const error=document.getElementById('complianceCloseError'),success=document.getElementById('complianceCloseSuccess'),box=document.getElementById('complianceCloseResults');
  error.textContent=''; success.textContent=''; box.innerHTML='';
  try{
    const data=await api('/api/admin/savings-compliance-close-month',{method:'POST',body:JSON.stringify({month:document.getElementById('complianceMonth').value})});
    success.textContent=data.month+': '+data.newCharges+' new shortfall charge(s) posted • '+naira(data.totalNewCharge)+' total new charges.';
    box.innerHTML='<div class="mini-grid">'+data.results.map(r=>'<div><span>'+escapeHTML(r.username)+' • '+escapeHTML(r.planType)+'</span><b>'+ (r.compliant?'COMPLIANT':naira(r.chargeAmount)+' CHARGE') +'</b><small>Required '+naira(r.requiredAmount)+' • credited '+naira(r.contributedAmount)+' • shortfall '+naira(r.shortfallAmount)+'</small><small>'+(r.chargeCreated?'Charge posted':'No new charge posted')+'</small></div>').join('')+'</div>';
  }catch(err){ error.textContent=err.message; }
});
`;
}

// Add posted-charge summary to member Savings Plans dialog.
if(!app.includes("const postedCharges=await api('/api/account/savings-compliance-charges')")){
  app=app.replace(
"    const compliance=await api('/api/account/savings-compliance');",
"    const compliance=await api('/api/account/savings-compliance');\n    const postedCharges=await api('/api/account/savings-compliance-charges');"
  );
  app=app.replace(
"    const complianceMap=Object.fromEntries((compliance.items||[]).map(i=>[i.planType,i]));",
"    const complianceMap=Object.fromEntries((compliance.items||[]).map(i=>[i.planType,i]));\n    const postedSummary='<p class=\"helper\"><strong>Outstanding month-end compliance charges:</strong> '+naira(postedCharges.outstandingTotal||0)+'</p>';"
  );
  app=app.replace(
"    list.innerHTML='<div class=\"mini-grid\">'+data.plans.map(p=>{",
"    list.innerHTML=postedSummary+'<div class=\"mini-grid\">'+data.plans.map(p=>{"
  );
}
fs.writeFileSync(appPath,app);

// 5) Cache bump.
index=fs.readFileSync(indexPath,'utf8').replace(/app\\.js\\?v=25/g,'app.js?v=26').replace(/styles\\.css\\?v=25/g,'styles.css?v=26');
fs.writeFileSync(indexPath,index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v25/g,'taimako-v26');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=25/g,'sw.js?v=26');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 26 month-end savings shortfall charges applied.');
