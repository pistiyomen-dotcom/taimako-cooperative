const fs=require('fs');

// Self-service savings plan progress endpoint for Regular members.
const accountPath='server/routes/account.js';
let account=fs.readFileSync(accountPath,'utf8');
if(!account.includes("router.get('/savings-plan-progress'")){
  const route=`
router.get('/savings-plan-progress', requireAuth, async (req,res) => {
  const result=await pool.query('SELECT a.username,a.full_name,a.role, COALESCE(b.target_balance,0) AS target_balance, COALESCE(b.constant_balance,0) AS constant_balance, COALESCE(b.welfare_balance,0) AS welfare_balance, p.plan_type,p.start_date,p.duration_months,p.target_amount,p.monthly_amount,p.minimum_balance,p.disbursement_months,p.status FROM accounts a LEFT JOIN member_balances b ON b.account_id=a.id LEFT JOIN savings_plans p ON p.account_id=a.id WHERE a.id=$1 AND a.is_active=TRUE ORDER BY p.plan_type',[req.auth.sub]);
  if(!result.rows.length) return res.status(404).json({error:'Active account not found.'});
  const first=result.rows[0];
  if(first.role!=='regular') return res.status(400).json({error:'Savings plan progress applies to Regular member accounts.'});
  const plans=result.rows.filter(r=>r.plan_type).map(r=>{
    const type=r.plan_type;
    const balance=Number(type==='TARGET'?r.target_balance:type==='CONSTANT'?r.constant_balance:r.welfare_balance)||0;
    const start=new Date(r.start_date);
    const end=new Date(start); end.setUTCMonth(end.getUTCMonth()+Number(r.duration_months||0));
    let benchmark=0;
    if(type==='TARGET') benchmark=Number(r.target_amount||0);
    if(type==='CONSTANT') benchmark=Number(r.minimum_balance||300000);
    const progressPercent=benchmark>0?Math.min(100,Number(((balance/benchmark)*100).toFixed(1))):null;
    return {planType:type,startDate:r.start_date,endDate:end.toISOString().slice(0,10),durationMonths:Number(r.duration_months||0),
      currentBalance:balance,targetAmount:Number(r.target_amount||0),monthlyAmount:Number(r.monthly_amount||0),
      minimumBalance:Number(r.minimum_balance||0),disbursementMonths:Number(r.disbursement_months||0),status:r.status,progressPercent};
  });
  res.json({member:{username:first.username,name:first.full_name},plans});
});
`;
  account=account.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(accountPath,account);

// Member savings plan progress dialog.
const indexPath='www/index.html';
let index=fs.readFileSync(indexPath,'utf8');
if(!index.includes('id="memberSavingsPlansDialog"')){
  const dialog=`
  <dialog id="memberSavingsPlansDialog" class="wide-dialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>My Savings Plans</h3><button type="button" class="icon-btn" data-close="memberSavingsPlansDialog" aria-label="Close">×</button></div>
      <p class="helper">Your active Target, Constant and Welfare plan details and progress.</p>
      <div id="memberSavingsPlansList"></div>
      <p class="form-error" id="memberSavingsPlansError" role="alert"></p>
    </div>
  </dialog>
`;
  index=index.replace('</body>',dialog+'\n</body>');
}
fs.writeFileSync(indexPath,index);

const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');

const oldActions="    ['PAY', 'TRANSACTION HISTORY', 'LOAN STATUS', 'APPLY FOR LOAN', 'WITHDRAW'].forEach((label) => {";
const newActions="    ['PAY', 'TRANSACTION HISTORY', 'SAVINGS PLANS', 'LOAN STATUS', 'APPLY FOR LOAN', 'WITHDRAW'].forEach((label) => {";
if(app.includes(oldActions)) app=app.replace(oldActions,newActions);

const oldClick="      btn.addEventListener('click', () => label === 'PAY' ? openPaymentDialog() : label === 'WITHDRAW' ? openWithdrawalDialog() : label === 'TRANSACTION HISTORY' ? openTransactionHistory(false) : label === 'LOAN STATUS' ? openLoanStatusDialog() : openLoanApplyDialog());";
const newClick="      btn.addEventListener('click', () => label === 'PAY' ? openPaymentDialog() : label === 'WITHDRAW' ? openWithdrawalDialog() : label === 'TRANSACTION HISTORY' ? openTransactionHistory(false) : label === 'SAVINGS PLANS' ? openMemberSavingsPlans() : label === 'LOAN STATUS' ? openLoanStatusDialog() : openLoanApplyDialog());";
if(!app.includes(oldClick)){ console.error('Stage 24 regular member action handler target not found'); process.exit(1); }
app=app.replace(oldClick,newClick);

if(!app.includes('async function openMemberSavingsPlans()')){
  app += `
async function openMemberSavingsPlans() {
  const dialog=document.getElementById('memberSavingsPlansDialog');
  const list=document.getElementById('memberSavingsPlansList');
  const error=document.getElementById('memberSavingsPlansError');
  error.textContent='';
  list.innerHTML='<p class="helper">Loading savings plans…</p>';
  dialog.showModal();
  try {
    const data=await api('/api/account/savings-plan-progress');
    if(!data.plans.length){ list.innerHTML='<p class="empty-state">No Target, Constant or Welfare plan has been configured for your account yet.</p>'; return; }
    list.innerHTML='<div class="mini-grid">'+data.plans.map(p=>{
      let detail='';
      if(p.planType==='TARGET') detail='<small>Target: '+naira(p.targetAmount)+' • Monthly: '+naira(p.monthlyAmount)+'</small>';
      if(p.planType==='CONSTANT') detail='<small>Monthly: '+naira(p.monthlyAmount)+' • Protected minimum: '+naira(p.minimumBalance||300000)+'</small>';
      if(p.planType==='WELFARE') detail='<small>Disbursement period: '+escapeHTML(p.disbursementMonths||0)+' months</small>';
      const progress=p.progressPercent===null?'':'<small>Progress: '+escapeHTML(p.progressPercent)+'%</small>';
      return '<div><span>'+escapeHTML(p.planType)+'</span><b>'+naira(p.currentBalance)+'</b><small>'+escapeHTML(p.durationMonths)+' months • '+escapeHTML(String(p.startDate).slice(0,10))+' to '+escapeHTML(String(p.endDate).slice(0,10))+'</small>'+detail+progress+'</div>';
    }).join('')+'</div>';
  } catch(err){ list.innerHTML=''; error.textContent=err.message; }
}
`;
}
fs.writeFileSync(appPath,app);

// Cache bump.
index=fs.readFileSync(indexPath,'utf8').replace(/app\\.js\\?v=23/g,'app.js?v=24').replace(/styles\\.css\\?v=23/g,'styles.css?v=24');
fs.writeFileSync(indexPath,index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v23/g,'taimako-v24');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=23/g,'sw.js?v=24');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 24 member savings-plan progress applied.');
