const fs = require('fs');

// 1) Database foundation for per-member savings plans.
const schemaPath = 'server/db/schema.sql';
let schema = fs.readFileSync(schemaPath, 'utf8');
if (!schema.includes('CREATE TABLE IF NOT EXISTS savings_plans')) {
  const table = `

CREATE TABLE IF NOT EXISTS savings_plans (
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('TARGET','CONSTANT','WELFARE')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_months INTEGER NOT NULL CHECK (duration_months > 0),
  target_amount NUMERIC(14,2),
  monthly_amount NUMERIC(14,2),
  minimum_balance NUMERIC(14,2),
  disbursement_months INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_by_account_id BIGINT REFERENCES accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, plan_type),
  CHECK (target_amount IS NULL OR target_amount > 0),
  CHECK (monthly_amount IS NULL OR monthly_amount > 0),
  CHECK (minimum_balance IS NULL OR minimum_balance >= 0),
  CHECK (disbursement_months IS NULL OR disbursement_months > 0)
);

CREATE INDEX IF NOT EXISTS idx_savings_plans_type_status ON savings_plans(plan_type, status);
`;
  schema = schema.replace('\nCOMMIT;', table + '\nCOMMIT;');
  fs.writeFileSync(schemaPath, schema);
}

// 2) Admin API to create/update and inspect savings plans.
const adminPath = 'server/routes/admin.js';
let admin = fs.readFileSync(adminPath, 'utf8');
if (!admin.includes("router.post('/savings-plans'")) {
  const routes = `

router.get('/savings-plans', async (req, res) => {
  const username = String(req.query.username || '').trim().toUpperCase();
  if (!username) return res.status(400).json({ error: 'Enter a member username.' });
  const result = await pool.query(
    \`SELECT a.username, a.full_name, a.role,
            p.plan_type, p.start_date, p.duration_months, p.target_amount, p.monthly_amount,
            p.minimum_balance, p.disbursement_months, p.status, p.updated_at
     FROM accounts a
     LEFT JOIN savings_plans p ON p.account_id=a.id
     WHERE a.username=$1 AND a.is_active=TRUE
     ORDER BY p.plan_type\`, [username]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Active member account not found.' });
  const member = result.rows[0];
  if (member.role !== 'regular') return res.status(400).json({ error: 'Savings plans are configured for Regular member accounts.' });
  res.json({
    member: { username: member.username, name: member.full_name, role: member.role },
    plans: result.rows.filter(r => r.plan_type).map(r => ({
      planType:r.plan_type, startDate:r.start_date, durationMonths:r.duration_months,
      targetAmount:money(r.target_amount), monthlyAmount:money(r.monthly_amount),
      minimumBalance:money(r.minimum_balance), disbursementMonths:r.disbursement_months,
      status:r.status, updatedAt:r.updated_at
    }))
  });
});

router.post('/savings-plans', async (req, res) => {
  const username = String(req.body?.username || '').trim().toUpperCase();
  const planType = String(req.body?.planType || '').trim().toUpperCase();
  const startDate = String(req.body?.startDate || '').trim();
  const durationMonths = Number(req.body?.durationMonths);
  let targetAmount = Number(req.body?.targetAmount || 0);
  let monthlyAmount = Number(req.body?.monthlyAmount || 0);
  let minimumBalance = Number(req.body?.minimumBalance || 0);
  let disbursementMonths = Number(req.body?.disbursementMonths || 0);

  if (!username) return res.status(400).json({ error: 'Member username is required.' });
  if (!['TARGET','CONSTANT','WELFARE'].includes(planType)) return res.status(400).json({ error: 'Select Target, Constant or Welfare.' });
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(startDate)) return res.status(400).json({ error: 'Select a valid plan start date.' });
  if (!Number.isInteger(durationMonths) || durationMonths <= 0) return res.status(400).json({ error: 'Enter a valid duration in months.' });

  if (planType === 'TARGET') {
    if (durationMonths < 6) return res.status(400).json({ error: 'Target Savings minimum duration is 6 months.' });
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) return res.status(400).json({ error: 'Enter the member target amount.' });
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) monthlyAmount = Number((targetAmount / durationMonths).toFixed(2));
    minimumBalance = 0; disbursementMonths = 0;
  }
  if (planType === 'CONSTANT') {
    if (durationMonths < 60) return res.status(400).json({ error: 'Constant Savings minimum locked duration is 5 years (60 months).' });
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) return res.status(400).json({ error: 'Enter the compulsory monthly savings amount.' });
    if (!Number.isFinite(minimumBalance) || minimumBalance <= 0) minimumBalance = 300000;
    targetAmount = 0; disbursementMonths = 0;
  }
  if (planType === 'WELFARE') {
    if (durationMonths < 12) return res.status(400).json({ error: 'Welfare Savings minimum savings duration is 12 months.' });
    if (!Number.isInteger(disbursementMonths) || disbursementMonths < 12) return res.status(400).json({ error: 'Welfare disbursement duration must be at least 12 months.' });
    targetAmount = 0; monthlyAmount = 0; minimumBalance = 0;
  }

  const member = await pool.query('SELECT id, username, full_name, role, is_active FROM accounts WHERE username=$1', [username]);
  const account = member.rows[0];
  if (!account || !account.is_active) return res.status(404).json({ error: 'Active member account not found.' });
  if (account.role !== 'regular') return res.status(400).json({ error: 'Savings plans are configured for Regular member accounts.' });

  const result = await pool.query(
    \`INSERT INTO savings_plans(account_id,plan_type,start_date,duration_months,target_amount,monthly_amount,minimum_balance,disbursement_months,status,created_by_account_id)
     VALUES($1,$2,$3,$4,NULLIF($5,0),NULLIF($6,0),NULLIF($7,0),NULLIF($8,0),'active',$9)
     ON CONFLICT(account_id,plan_type) DO UPDATE SET
       start_date=EXCLUDED.start_date, duration_months=EXCLUDED.duration_months,
       target_amount=EXCLUDED.target_amount, monthly_amount=EXCLUDED.monthly_amount,
       minimum_balance=EXCLUDED.minimum_balance, disbursement_months=EXCLUDED.disbursement_months,
       status='active', updated_at=NOW()
     RETURNING plan_type,start_date,duration_months,target_amount,monthly_amount,minimum_balance,disbursement_months,status,updated_at\`,
    [account.id, planType, startDate, durationMonths, targetAmount, monthlyAmount, minimumBalance, disbursementMonths, req.auth.sub]
  );
  const p = result.rows[0];
  res.json({
    member:{ username:account.username, name:account.full_name },
    plan:{ planType:p.plan_type, startDate:p.start_date, durationMonths:p.duration_months,
      targetAmount:money(p.target_amount), monthlyAmount:money(p.monthly_amount),
      minimumBalance:money(p.minimum_balance), disbursementMonths:p.disbursement_months,
      status:p.status, updatedAt:p.updated_at }
  });
});
`;
  admin = admin.replace('\nmodule.exports = router;', routes + '\nmodule.exports = router;');
  fs.writeFileSync(adminPath, admin);
}

// 3) Admin dialog in browser UI.
const indexPath = 'www/index.html';
let index = fs.readFileSync(indexPath, 'utf8');
if (!index.includes('id="savingsPlanDialog"')) {
  const dialog = `
  <dialog id="savingsPlanDialog">
    <form class="dialog-card" id="savingsPlanForm">
      <div class="dialog-head"><h3>Savings Plan Setup</h3><button type="button" class="icon-btn" data-close="savingsPlanDialog" aria-label="Close">×</button></div>
      <p class="helper">Record the member's Target, Constant or Welfare plan. Saving again updates the same plan.</p>
      <label>Member Username<input id="planUsername" inputmode="numeric" required /></label>
      <label>Plan Type<select id="planType" required><option value="TARGET">TARGET</option><option value="CONSTANT">CONSTANT</option><option value="WELFARE">WELFARE</option></select></label>
      <label>Start Date<input id="planStartDate" type="date" required /></label>
      <label>Duration (months)<input id="planDurationMonths" type="number" min="1" step="1" required /></label>
      <label>Target Amount (₦)<input id="planTargetAmount" type="number" min="0" step="0.01" /></label>
      <label>Monthly Amount (₦)<input id="planMonthlyAmount" type="number" min="0" step="0.01" /></label>
      <label>Minimum Balance (₦)<input id="planMinimumBalance" type="number" min="0" step="0.01" value="300000" /></label>
      <label>Welfare Disbursement Duration (months)<input id="planDisbursementMonths" type="number" min="0" step="1" /></label>
      <p class="helper" id="savingsPlanHelp"></p>
      <p class="form-error" id="savingsPlanError" role="alert"></p>
      <p class="form-success" id="savingsPlanSuccess" role="status"></p>
      <div class="dialog-actions"><button type="button" class="secondary" id="loadSavingsPlans">VIEW CURRENT</button><button class="primary" type="submit">SAVE PLAN</button></div>
      <div id="savingsPlanCurrent"></div>
    </form>
  </dialog>
`;
  index = index.replace('</body>', dialog + '\n</body>');
  fs.writeFileSync(indexPath, index);
}

// 4) Browser behavior and admin dashboard card.
const appPath = 'www/app.js';
let app = fs.readFileSync(appPath, 'utf8');
if (!app.includes("['SAVINGS PLAN SETUP'")) {
  app = app.replace(
    "    ['CASH CREDIT', 'Credit member payment to the selected destination'],",
    "    ['CASH CREDIT', 'Credit member payment to the selected destination'],\n    ['SAVINGS PLAN SETUP', 'Set Target, Constant and Welfare plan terms'],"
  );
  app = app.replace(
    "  if (title === 'CASH CREDIT') { cashCreditForm.reset(); cashCreditError.textContent=''; cashCreditSuccess.textContent=''; creditMemberConfirm.className='member-confirm'; creditMemberConfirm.textContent=''; openDialog(cashCreditDialog); }",
    "  if (title === 'CASH CREDIT') { cashCreditForm.reset(); cashCreditError.textContent=''; cashCreditSuccess.textContent=''; creditMemberConfirm.className='member-confirm'; creditMemberConfirm.textContent=''; openDialog(cashCreditDialog); }\n  if (title === 'SAVINGS PLAN SETUP') { openSavingsPlanDialog(); }"
  );

  const behavior = `
function updateSavingsPlanHelp() {
  const type=document.getElementById('planType').value;
  const help=document.getElementById('savingsPlanHelp');
  if(type==='TARGET') help.textContent='Target: minimum 6 months. Enter target amount; monthly amount may be left blank for automatic calculation.';
  if(type==='CONSTANT') help.textContent='Constant: minimum 60 months (5 years). Enter compulsory monthly amount. Minimum balance defaults to ₦300,000.';
  if(type==='WELFARE') help.textContent='Welfare: minimum 12 months savings and minimum 12 months disbursement duration.';
}
function openSavingsPlanDialog() {
  const form=document.getElementById('savingsPlanForm');
  form.reset();
  document.getElementById('planMinimumBalance').value='300000';
  document.getElementById('planStartDate').value=new Date().toISOString().slice(0,10);
  document.getElementById('savingsPlanError').textContent='';
  document.getElementById('savingsPlanSuccess').textContent='';
  document.getElementById('savingsPlanCurrent').innerHTML='';
  updateSavingsPlanHelp();
  openDialog(document.getElementById('savingsPlanDialog'));
}
document.getElementById('planType').addEventListener('change', updateSavingsPlanHelp);
document.getElementById('savingsPlanForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const error=document.getElementById('savingsPlanError'), success=document.getElementById('savingsPlanSuccess');
  error.textContent=''; success.textContent='';
  try{
    const data=await api('/api/admin/savings-plans',{method:'POST',body:JSON.stringify({
      username:document.getElementById('planUsername').value,
      planType:document.getElementById('planType').value,
      startDate:document.getElementById('planStartDate').value,
      durationMonths:Number(document.getElementById('planDurationMonths').value),
      targetAmount:Number(document.getElementById('planTargetAmount').value||0),
      monthlyAmount:Number(document.getElementById('planMonthlyAmount').value||0),
      minimumBalance:Number(document.getElementById('planMinimumBalance').value||0),
      disbursementMonths:Number(document.getElementById('planDisbursementMonths').value||0)
    })});
    success.textContent=`${data.member.name}: ${data.plan.planType} plan saved successfully.`;
    await showCurrentSavingsPlans();
  }catch(err){error.textContent=err.message;}
});
async function showCurrentSavingsPlans(){
  const error=document.getElementById('savingsPlanError'), box=document.getElementById('savingsPlanCurrent');
  error.textContent=''; box.innerHTML='';
  const username=document.getElementById('planUsername').value.trim();
  if(!username) return error.textContent='Enter a member username first.';
  try{
    const data=await api(`/api/admin/savings-plans?username=${encodeURIComponent(username)}`);
    if(!data.plans.length){box.innerHTML='<p class="empty-state">No Target, Constant or Welfare plan has been configured for this member.</p>';return;}
    box.innerHTML='<div class="mini-grid">'+data.plans.map(p=>`<div><span>${escapeHTML(p.planType)}</span><b>${escapeHTML(p.durationMonths)} months</b><small>Start: ${escapeHTML(String(p.startDate).slice(0,10))}</small></div>`).join('')+'</div>';
  }catch(err){error.textContent=err.message;}
}
document.getElementById('loadSavingsPlans').addEventListener('click', showCurrentSavingsPlans);
`;
  app = app.replace('\nfunction memberSummary(data) {', '\n' + behavior + '\nfunction memberSummary(data) {');
  fs.writeFileSync(appPath, app);
}

// 5) Force browsers/PWA to receive this UI change immediately.
let sw = fs.readFileSync('www/sw.js','utf8').replace(/taimako-v16/g,'taimako-v18');
fs.writeFileSync('www/sw.js', sw);
index = fs.readFileSync(indexPath,'utf8').replace(/app\.js\?v=16/g,'app.js?v=18').replace(/styles\.css\?v=16/g,'styles.css?v=18');
fs.writeFileSync(indexPath,index);
app = fs.readFileSync(appPath,'utf8').replace(/sw\.js\?v=16/g,'sw.js?v=18');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 18 Savings Plan Setup applied.');
