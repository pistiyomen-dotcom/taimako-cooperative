const fs=require('fs');

// 1) Constant maturity preparation records.
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS constant_maturity_preparations')){
  const table=`

CREATE TABLE IF NOT EXISTS constant_maturity_preparations (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  maturity_date DATE NOT NULL,
  constant_balance NUMERIC(14,2) NOT NULL CHECK (constant_balance >= 0),
  minimum_required NUMERIC(14,2) NOT NULL CHECK (minimum_required >= 0),
  shortfall_amount NUMERIC(14,2) NOT NULL CHECK (shortfall_amount >= 0),
  shortfall_charge_rate NUMERIC(6,2) NOT NULL DEFAULT 5.00 CHECK (shortfall_charge_rate >= 0),
  shortfall_charge_amount NUMERIC(14,2) NOT NULL CHECK (shortfall_charge_amount >= 0),
  eligible_amount NUMERIC(14,2) NOT NULL CHECK (eligible_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared','processed','cancelled')),
  prepared_by_account_id BIGINT REFERENCES accounts(id),
  prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_constant_maturity_status ON constant_maturity_preparations(status,prepared_at DESC);
`;
  schema=schema.replace('\nCOMMIT;',table+'\nCOMMIT;');
}
fs.writeFileSync(schemaPath,schema);

// 2) Admin readiness and preparation routes.
const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes("router.get('/constant-maturity-readiness'")){
  const routes=`

router.get('/constant-maturity-readiness', async (req,res) => {
  const username=String(req.query.username||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter a member username.'});
  const result=await pool.query("SELECT a.id,a.username,a.full_name,a.role,a.is_active,COALESCE(b.constant,0) AS constant_balance,p.start_date,p.duration_months,p.minimum_balance,p.status AS plan_status,m.id AS maturity_id,m.maturity_date,m.constant_balance AS maturity_balance,m.minimum_required,m.shortfall_amount,m.shortfall_charge_amount,m.eligible_amount,m.status AS maturity_status,m.prepared_at FROM accounts a LEFT JOIN member_balances b ON b.account_id=a.id LEFT JOIN savings_plans p ON p.account_id=a.id AND p.plan_type='CONSTANT' LEFT JOIN constant_maturity_preparations m ON m.account_id=a.id WHERE a.username=$1",[username]);
  const row=result.rows[0];
  if(!row || !row.is_active) return res.status(404).json({error:'Active member account not found.'});
  if(row.role!=='regular') return res.status(400).json({error:'Constant maturity applies to Regular member accounts.'});
  if(!row.start_date) return res.status(400).json({error:'No Constant savings plan is configured for this member.'});
  const start=new Date(row.start_date);
  const maturity=new Date(start); maturity.setUTCMonth(maturity.getUTCMonth()+60);
  const minimumRequired=Number(row.minimum_balance||300000);
  const balance=Number(row.constant_balance||0);
  const shortfall=Math.max(0,Number((minimumRequired-balance).toFixed(2)));
  const charge=Number((shortfall*0.05).toFixed(2));
  const eligible=Math.max(0,Number((balance-charge).toFixed(2)));
  res.json({member:{username:row.username,name:row.full_name},constantBalance:balance,minimumRequired,shortfallAmount:shortfall,shortfallChargeAmount:charge,eligibleAmount:eligible,maturityDate:maturity.toISOString().slice(0,10),matured:new Date()>=maturity,preparation:row.maturity_id?{id:row.maturity_id,maturityDate:row.maturity_date,balance:Number(row.maturity_balance||0),minimumRequired:Number(row.minimum_required||0),shortfallAmount:Number(row.shortfall_amount||0),shortfallChargeAmount:Number(row.shortfall_charge_amount||0),eligibleAmount:Number(row.eligible_amount||0),status:row.maturity_status,preparedAt:row.prepared_at}:null});
});

router.post('/constant-maturity-prepare', async (req,res) => {
  const username=String(req.body?.username||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter a member username.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const memberResult=await client.query("SELECT a.id,a.username,a.full_name,a.role,a.is_active,COALESCE(b.constant,0) AS constant_balance FROM accounts a JOIN member_balances b ON b.account_id=a.id WHERE a.username=$1 FOR UPDATE",[username]);
    const member=memberResult.rows[0];
    if(!member || !member.is_active){ await client.query('ROLLBACK'); return res.status(404).json({error:'Active member account not found.'}); }
    if(member.role!=='regular'){ await client.query('ROLLBACK'); return res.status(400).json({error:'Constant maturity applies to Regular member accounts.'}); }
    const planResult=await client.query("SELECT start_date,duration_months,minimum_balance,status FROM savings_plans WHERE account_id=$1 AND plan_type='CONSTANT'",[member.id]);
    const plan=planResult.rows[0];
    if(!plan){ await client.query('ROLLBACK'); return res.status(400).json({error:'No Constant savings plan is configured for this member.'}); }
    const start=new Date(plan.start_date);
    const maturity=new Date(start); maturity.setUTCMonth(maturity.getUTCMonth()+60);
    if(new Date()<maturity){ await client.query('ROLLBACK'); return res.status(400).json({error:'Constant Savings has not reached the minimum 5-year maturity period.'}); }
    const existing=await client.query('SELECT id,status FROM constant_maturity_preparations WHERE account_id=$1 FOR UPDATE',[member.id]);
    if(existing.rows.length){ await client.query('ROLLBACK'); return res.status(409).json({error:'Constant maturity has already been prepared for this member.'}); }
    const balance=Number(member.constant_balance||0);
    const minimumRequired=Number(plan.minimum_balance||300000);
    const shortfall=Math.max(0,Number((minimumRequired-balance).toFixed(2)));
    const charge=Number((shortfall*0.05).toFixed(2));
    const eligible=Math.max(0,Number((balance-charge).toFixed(2)));
    const created=await client.query("INSERT INTO constant_maturity_preparations(account_id,maturity_date,constant_balance,minimum_required,shortfall_amount,shortfall_charge_rate,shortfall_charge_amount,eligible_amount,status,prepared_by_account_id,note) VALUES($1,$2,$3,$4,$5,5,$6,$7,'prepared',$8,$9) RETURNING id,maturity_date,constant_balance,minimum_required,shortfall_amount,shortfall_charge_amount,eligible_amount,status,prepared_at",[member.id,maturity.toISOString().slice(0,10),balance,minimumRequired,shortfall,charge,eligible,req.auth.sub,'Prepared after minimum five-year Constant maturity; no automatic deduction or disbursement applied.']);
    await client.query('COMMIT');
    res.status(201).json({member:{username:member.username,name:member.full_name},preparation:created.rows[0]});
  }catch(error){ await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});
`;
  admin=admin.replace('\nmodule.exports = router;',routes+'\nmodule.exports = router;');
}
fs.writeFileSync(adminPath,admin);

// 3) Member view of Constant maturity preparation.
const accountPath='server/routes/account.js';
let account=fs.readFileSync(accountPath,'utf8');
if(!account.includes("router.get('/constant-maturity'")){
  const route=`

router.get('/constant-maturity', requireAuth, async (req,res) => {
  const result=await pool.query("SELECT maturity_date,constant_balance,minimum_required,shortfall_amount,shortfall_charge_rate,shortfall_charge_amount,eligible_amount,status,prepared_at,processed_at FROM constant_maturity_preparations WHERE account_id=$1",[req.auth.sub]);
  if(!result.rows.length) return res.json({preparation:null});
  const r=result.rows[0];
  res.json({preparation:{maturityDate:r.maturity_date,balance:Number(r.constant_balance||0),minimumRequired:Number(r.minimum_required||0),shortfallAmount:Number(r.shortfall_amount||0),shortfallChargeRate:Number(r.shortfall_charge_rate||0),shortfallChargeAmount:Number(r.shortfall_charge_amount||0),eligibleAmount:Number(r.eligible_amount||0),status:r.status,preparedAt:r.prepared_at,processedAt:r.processed_at}});
});
`;
  account=account.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(accountPath,account);

// 4) Admin UI.
const indexPath='www/index.html';
let index=fs.readFileSync(indexPath,'utf8');
if(!index.includes('id="constantMaturityDialog"')){
  const dialog=`
  <dialog id="constantMaturityDialog" class="wide-dialog">
    <form class="dialog-card" id="constantMaturityForm">
      <div class="dialog-head"><h3>Constant Savings Maturity</h3><button type="button" class="icon-btn" data-close="constantMaturityDialog" aria-label="Close">×</button></div>
      <p class="helper">Prepare a Constant Savings account after the minimum five-year period. If the minimum balance has not been achieved, the system calculates a 5% charge on the shortfall. No funds are deducted or disbursed at preparation.</p>
      <label>Member Username<input id="constantMaturityUsername" autocomplete="off" required /></label>
      <p class="form-error" id="constantMaturityError" role="alert"></p>
      <p class="form-success" id="constantMaturitySuccess" role="status"></p>
      <div class="dialog-actions"><button type="button" id="constantMaturityCheck">CHECK READINESS</button><button class="primary" type="submit">PREPARE MATURITY</button></div>
      <div id="constantMaturityResult"></div>
    </form>
  </dialog>
`;
  index=index.replace('</body>',dialog+'\n</body>');
}
fs.writeFileSync(indexPath,index);

const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
if(!app.includes("['CONSTANT MATURITY'")){
  app=app.replace(
"    ['WELFARE PAYOUT', 'Prepare completed Welfare savings for payout'],",
"    ['WELFARE PAYOUT', 'Prepare completed Welfare savings for payout'],\n    ['CONSTANT MATURITY', 'Prepare Constant Savings after five years'],"
  );
  app=app.replace(
"  if (title === 'WELFARE PAYOUT') { openWelfarePayoutDialog(); }",
"  if (title === 'WELFARE PAYOUT') { openWelfarePayoutDialog(); }\n  if (title === 'CONSTANT MATURITY') { openConstantMaturityDialog(); }"
  );
}
if(!app.includes('function openConstantMaturityDialog()')){
  app += `
function openConstantMaturityDialog(){
  const form=document.getElementById('constantMaturityForm'); form.reset();
  document.getElementById('constantMaturityError').textContent=''; document.getElementById('constantMaturitySuccess').textContent=''; document.getElementById('constantMaturityResult').innerHTML='';
  document.getElementById('constantMaturityDialog').showModal();
}
async function checkConstantMaturityReadiness(){
  const username=document.getElementById('constantMaturityUsername').value.trim();
  const error=document.getElementById('constantMaturityError'),box=document.getElementById('constantMaturityResult'); error.textContent=''; box.innerHTML='';
  if(!username){ error.textContent='Enter a member username.'; return; }
  try{
    const data=await api('/api/admin/constant-maturity-readiness?username='+encodeURIComponent(username));
    box.innerHTML='<div class="mini-grid"><div><span>'+escapeHTML(data.member.username)+' • '+escapeHTML(data.member.name)+'</span><b>'+naira(data.constantBalance)+'</b><small>Maturity date: '+escapeHTML(data.maturityDate)+' • '+(data.matured?'MATURED':'NOT YET MATURED')+'</small><small>Minimum '+naira(data.minimumRequired)+' • shortfall '+naira(data.shortfallAmount)+' • 5% shortfall charge '+naira(data.shortfallChargeAmount)+'</small><small>Eligible maturity amount '+naira(data.eligibleAmount)+'</small></div></div>'+ (data.preparation?'<p class="helper"><strong>Existing preparation:</strong> '+escapeHTML(data.preparation.status)+' • eligible '+naira(data.preparation.eligibleAmount)+'</p>':'');
  }catch(err){ error.textContent=err.message; }
}
document.getElementById('constantMaturityCheck').addEventListener('click',checkConstantMaturityReadiness);
document.getElementById('constantMaturityForm').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const error=document.getElementById('constantMaturityError'),success=document.getElementById('constantMaturitySuccess'); error.textContent=''; success.textContent='';
  try{
    const data=await api('/api/admin/constant-maturity-prepare',{method:'POST',body:JSON.stringify({username:document.getElementById('constantMaturityUsername').value.trim()})});
    success.textContent='Constant maturity prepared for '+data.member.username+' • eligible amount '+naira(data.preparation.eligible_amount)+' • shortfall charge '+naira(data.preparation.shortfall_charge_amount)+'.';
    await checkConstantMaturityReadiness();
  }catch(err){ error.textContent=err.message; }
});
`;
}

// Add member maturity summary to Savings Plans.
if(!app.includes("const constantMaturity=await api('/api/account/constant-maturity')")){
  app=app.replace(
"    const welfarePayout=await api('/api/account/welfare-payout');",
"    const welfarePayout=await api('/api/account/welfare-payout');\n    const constantMaturity=await api('/api/account/constant-maturity');"
  );
  app=app.replace(
"    const welfareText=welfarePayout.payout?' • <strong>Welfare payout:</strong> '+naira(welfarePayout.payout.principal)+' over '+escapeHTML(welfarePayout.payout.disbursementMonths)+' months • '+escapeHTML(welfarePayout.payout.status):'';",
"    const welfareText=welfarePayout.payout?' • <strong>Welfare payout:</strong> '+naira(welfarePayout.payout.principal)+' over '+escapeHTML(welfarePayout.payout.disbursementMonths)+' months • '+escapeHTML(welfarePayout.payout.status):'';\n    const constantText=constantMaturity.preparation?' • <strong>Constant maturity:</strong> eligible '+naira(constantMaturity.preparation.eligibleAmount)+' • '+escapeHTML(constantMaturity.preparation.status):'';"
  );
  app=app.replace(
"+welfareText+'</p>';",
"+welfareText+constantText+'</p>';"
  );
}
fs.writeFileSync(appPath,app);

// 5) Cache bump.
index=fs.readFileSync(indexPath,'utf8').replace(/app\\.js\\?v=29/g,'app.js?v=30').replace(/styles\\.css\\?v=29/g,'styles.css?v=30');
fs.writeFileSync(indexPath,index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v29/g,'taimako-v30');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=29/g,'sw.js?v=30');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 30 Constant maturity preparation applied.');
