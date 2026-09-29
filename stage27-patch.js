const fs=require('fs');

// 1) Add auditable partial-payment support for month-end compliance charges.
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('ALTER TABLE savings_compliance_charges ADD COLUMN IF NOT EXISTS paid_amount')){
  const migration=`

ALTER TABLE savings_compliance_charges ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0);

CREATE TABLE IF NOT EXISTS savings_compliance_payments (
  id BIGSERIAL PRIMARY KEY,
  reference VARCHAR(40) UNIQUE NOT NULL,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_by_account_id BIGINT REFERENCES accounts(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS savings_compliance_payment_allocations (
  payment_id BIGINT NOT NULL REFERENCES savings_compliance_payments(id) ON DELETE CASCADE,
  charge_id BIGINT NOT NULL REFERENCES savings_compliance_charges(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  PRIMARY KEY(payment_id,charge_id)
);
`;
  schema=schema.replace('\nCOMMIT;',migration+'\nCOMMIT;');
}
fs.writeFileSync(schemaPath,schema);

// 2) Admin outstanding-balance lookup and FIFO settlement.
const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes("router.get('/savings-compliance-balance'")){
  const routes=`

router.get('/savings-compliance-balance', async (req,res) => {
  const username=String(req.query.username||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter a member username.'});
  const memberResult=await pool.query('SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1',[username]);
  const member=memberResult.rows[0];
  if(!member || !member.is_active) return res.status(404).json({error:'Active member account not found.'});
  if(member.role!=='regular') return res.status(400).json({error:'Compliance charges apply to Regular member accounts.'});
  const charges=await pool.query("SELECT id,plan_type,period_month,charge_amount,paid_amount,status FROM savings_compliance_charges WHERE account_id=$1 AND status='due' ORDER BY period_month,id",[member.id]);
  const rows=charges.rows.map(r=>({id:r.id,planType:r.plan_type,periodMonth:r.period_month,chargeAmount:Number(r.charge_amount||0),paidAmount:Number(r.paid_amount||0),outstanding:Number((Number(r.charge_amount||0)-Number(r.paid_amount||0)).toFixed(2))}));
  const outstandingTotal=rows.reduce((sum,r)=>sum+r.outstanding,0);
  res.json({member:{username:member.username,name:member.full_name},outstandingTotal:Number(outstandingTotal.toFixed(2)),charges:rows});
});

router.post('/savings-compliance-payments', async (req,res) => {
  const username=String(req.body?.username||'').trim().toUpperCase();
  const amount=Number(req.body?.amount);
  const note=String(req.body?.note||'').trim();
  if(!username) return res.status(400).json({error:'Member username is required.'});
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({error:'Enter a payment amount greater than zero.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const memberResult=await client.query('SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1 FOR UPDATE',[username]);
    const member=memberResult.rows[0];
    if(!member || !member.is_active){ await client.query('ROLLBACK'); return res.status(404).json({error:'Active member account not found.'}); }
    if(member.role!=='regular'){ await client.query('ROLLBACK'); return res.status(400).json({error:'Compliance charges apply to Regular member accounts.'}); }
    const charges=await client.query("SELECT id,plan_type,period_month,charge_amount,paid_amount FROM savings_compliance_charges WHERE account_id=$1 AND status='due' ORDER BY period_month,id FOR UPDATE",[member.id]);
    const outstandingTotal=charges.rows.reduce((sum,r)=>sum+Math.max(0,Number(r.charge_amount||0)-Number(r.paid_amount||0)),0);
    if(outstandingTotal<=0){ await client.query('ROLLBACK'); return res.status(400).json({error:'This member has no outstanding compliance charges.'}); }
    if(amount>outstandingTotal+0.0001){ await client.query('ROLLBACK'); return res.status(400).json({error:'Payment exceeds the outstanding compliance balance of ₦'+outstandingTotal.toLocaleString('en-NG',{minimumFractionDigits:2})+'.'}); }
    const reference='SCP-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
    const payment=await client.query("INSERT INTO savings_compliance_payments(reference,account_id,amount,created_by_account_id,note) VALUES($1,$2,$3,$4,$5) RETURNING id,reference,amount,created_at",[reference,member.id,amount,req.auth.sub,note||null]);
    let remaining=Number(amount.toFixed(2));
    const allocations=[];
    for(const charge of charges.rows){
      if(remaining<=0) break;
      const chargeAmount=Number(charge.charge_amount||0);
      const alreadyPaid=Number(charge.paid_amount||0);
      const outstanding=Math.max(0,Number((chargeAmount-alreadyPaid).toFixed(2)));
      if(outstanding<=0) continue;
      const applied=Math.min(remaining,outstanding);
      const newPaid=Number((alreadyPaid+applied).toFixed(2));
      const fullyPaid=newPaid>=chargeAmount-0.0001;
      await client.query("UPDATE savings_compliance_charges SET paid_amount=$1,status=$2,settled_at=CASE WHEN $2='paid' THEN NOW() ELSE settled_at END WHERE id=$3",[newPaid,fullyPaid?'paid':'due',charge.id]);
      await client.query('INSERT INTO savings_compliance_payment_allocations(payment_id,charge_id,amount) VALUES($1,$2,$3)',[payment.rows[0].id,charge.id,applied]);
      allocations.push({chargeId:charge.id,planType:charge.plan_type,periodMonth:charge.period_month,amount:Number(applied.toFixed(2)),fullyPaid});
      remaining=Number((remaining-applied).toFixed(2));
    }
    await client.query("INSERT INTO transactions(reference,account_id,created_by_account_id,transaction_type,destination,amount,status,note,approved_at) VALUES($1,$2,$3,'compliance_charge_payment','COMPLIANCE',$4,'completed',$5,NOW())",[reference,member.id,req.auth.sub,amount,note||'Payment of month-end savings compliance charges']);
    await client.query('COMMIT');
    res.status(201).json({member:{username:member.username,name:member.full_name},payment:{reference,amount:Number(amount.toFixed(2)),allocations},outstandingAfter:Number((outstandingTotal-amount).toFixed(2))});
  }catch(error){ await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});
`;
  admin=admin.replace('\nmodule.exports = router;',routes+'\nmodule.exports = router;');
}
fs.writeFileSync(adminPath,admin);

// 3) Make the member outstanding total partial-payment aware.
const accountPath='server/routes/account.js';
let account=fs.readFileSync(accountPath,'utf8');
account=account.replace(
"  const result=await pool.query(\"SELECT plan_type,period_month,required_amount,contributed_amount,shortfall_amount,charge_rate,charge_amount,status,assessed_at,settled_at,note FROM savings_compliance_charges WHERE account_id=$1 ORDER BY period_month DESC,plan_type LIMIT 120\",[req.auth.sub]);",
"  const result=await pool.query(\"SELECT plan_type,period_month,required_amount,contributed_amount,shortfall_amount,charge_rate,charge_amount,paid_amount,status,assessed_at,settled_at,note FROM savings_compliance_charges WHERE account_id=$1 ORDER BY period_month DESC,plan_type LIMIT 120\",[req.auth.sub]);"
);
account=account.replace(
"  const outstanding=result.rows.filter(r=>r.status==='due').reduce((sum,r)=>sum+Number(r.charge_amount||0),0);",
"  const outstanding=result.rows.filter(r=>r.status==='due').reduce((sum,r)=>sum+Math.max(0,Number(r.charge_amount||0)-Number(r.paid_amount||0)),0);"
);
fs.writeFileSync(accountPath,account);

// 4) Admin settlement dialog and dashboard card.
const indexPath='www/index.html';
let index=fs.readFileSync(indexPath,'utf8');
if(!index.includes('id="compliancePaymentDialog"')){
  const dialog=`
  <dialog id="compliancePaymentDialog">
    <form class="dialog-card" id="compliancePaymentForm">
      <div class="dialog-head"><h3>Compliance Charge Payment</h3><button type="button" class="icon-btn" data-close="compliancePaymentDialog" aria-label="Close">×</button></div>
      <p class="helper">Record payment of posted Target/Constant month-end charges. Payment is applied to the oldest outstanding charge first and does not reduce savings.</p>
      <label>Member Username<input id="compliancePaymentUsername" required /></label>
      <div class="dialog-actions"><button type="button" class="secondary" id="loadComplianceBalance">VIEW BALANCE</button></div>
      <div id="complianceBalanceBox"></div>
      <label>Amount (₦)<input id="compliancePaymentAmount" type="number" min="0.01" step="0.01" required /></label>
      <label>Note<textarea id="compliancePaymentNote" rows="2"></textarea></label>
      <p class="form-error" id="compliancePaymentError" role="alert"></p>
      <p class="form-success" id="compliancePaymentSuccess" role="status"></p>
      <div class="dialog-actions"><button class="primary" type="submit">RECORD PAYMENT</button></div>
    </form>
  </dialog>
`;
  index=index.replace('</body>',dialog+'\n</body>');
}
fs.writeFileSync(indexPath,index);

const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
if(!app.includes("['COMPLIANCE PAYMENT'")){
  app=app.replace(
"    ['MONTH-END COMPLIANCE', 'Post Target and Constant monthly shortfall charges'],",
"    ['MONTH-END COMPLIANCE', 'Post Target and Constant monthly shortfall charges'],\n    ['COMPLIANCE PAYMENT', 'Record payment of posted shortfall charges'],"
  );
  app=app.replace(
"  if (title === 'MONTH-END COMPLIANCE') { openComplianceCloseDialog(); }",
"  if (title === 'MONTH-END COMPLIANCE') { openComplianceCloseDialog(); }\n  if (title === 'COMPLIANCE PAYMENT') { openCompliancePaymentDialog(); }"
  );
}
if(!app.includes('function openCompliancePaymentDialog()')){
  app += `
function openCompliancePaymentDialog(){
  const form=document.getElementById('compliancePaymentForm');
  form.reset();
  document.getElementById('complianceBalanceBox').innerHTML='';
  document.getElementById('compliancePaymentError').textContent='';
  document.getElementById('compliancePaymentSuccess').textContent='';
  document.getElementById('compliancePaymentDialog').showModal();
}
async function showComplianceBalance(){
  const username=document.getElementById('compliancePaymentUsername').value.trim();
  const error=document.getElementById('compliancePaymentError'),box=document.getElementById('complianceBalanceBox');
  error.textContent=''; box.innerHTML='';
  if(!username) return error.textContent='Enter a member username first.';
  try{
    const data=await api('/api/admin/savings-compliance-balance?username='+encodeURIComponent(username));
    box.innerHTML='<p class="helper"><strong>'+escapeHTML(data.member.name)+'</strong> • Outstanding: <strong>'+naira(data.outstandingTotal)+'</strong></p>'+(data.charges.length?'<div class="mini-grid">'+data.charges.map(c=>'<div><span>'+escapeHTML(c.planType)+' • '+escapeHTML(String(c.periodMonth).slice(0,7))+'</span><b>'+naira(c.outstanding)+'</b><small>Charge '+naira(c.chargeAmount)+' • paid '+naira(c.paidAmount)+'</small></div>').join('')+'</div>':'<p class="empty-state">No outstanding compliance charges.</p>');
    document.getElementById('compliancePaymentAmount').max=data.outstandingTotal||'';
  }catch(err){ error.textContent=err.message; }
}
document.getElementById('loadComplianceBalance').addEventListener('click',showComplianceBalance);
document.getElementById('compliancePaymentForm').addEventListener('submit',async(e)=>{
  e.preventDefault();
  const error=document.getElementById('compliancePaymentError'),success=document.getElementById('compliancePaymentSuccess');
  error.textContent=''; success.textContent='';
  try{
    const data=await api('/api/admin/savings-compliance-payments',{method:'POST',body:JSON.stringify({username:document.getElementById('compliancePaymentUsername').value,amount:Number(document.getElementById('compliancePaymentAmount').value),note:document.getElementById('compliancePaymentNote').value})});
    success.textContent='Payment '+data.payment.reference+' recorded. Remaining compliance balance: '+naira(data.outstandingAfter)+'.';
    await showComplianceBalance();
  }catch(err){ error.textContent=err.message; }
});
`;
}
fs.writeFileSync(appPath,app);

// 5) Cache bump.
index=fs.readFileSync(indexPath,'utf8').replace(/app\\.js\\?v=26/g,'app.js?v=27').replace(/styles\\.css\\?v=26/g,'styles.css?v=27');
fs.writeFileSync(indexPath,index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v26/g,'taimako-v27');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=26/g,'sw.js?v=27');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 27 compliance charge settlement applied.');
