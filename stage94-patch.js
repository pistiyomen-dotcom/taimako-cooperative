const fs=require('fs');

/* ---------- Fresh member loan form ---------- */
let html=fs.readFileSync('www/index.html','utf8');
const adminDialogMarker='  <dialog id="loansAdminDialog" class="wide-dialog">';
if(!html.includes('id="loanApplyDialogV94"')){
  const form=`
  <dialog id="loanApplyDialogV94">
    <form class="dialog-card" id="loanApplyFormV94">
      <div class="dialog-head"><h3>APPLY FOR LOAN</h3><button type="button" class="icon-btn" data-close="loanApplyDialogV94" aria-label="Close">×</button></div>
      <p class="helper">Member loan entitlement is 90% of total savings. Loan duration is 30 days.</p>
      <div id="loanSavingsInfoV94" class="member-confirm show"></div>
      <label>Select Account
        <select id="loanAccountV94" required>
          <option value="">- Select Account -</option>
          <option value="REGULAR">REGULAR</option>
          <option value="TARGET">TARGET</option>
          <option value="CONSTANT">CONSTANT</option>
          <option value="WELFARE">WELFARE</option>
        </select>
      </label>
      <label>Amount (₦)<input id="loanAmountV94" type="number" min="0.01" step="0.01" required /></label>
      <label id="loanGuarantorLabelV94">Guarantor Username
        <input id="loanGuarantorV94" placeholder="5-digit Regular username" disabled />
      </label>
      <p class="helper" id="loanGuarantorHelpV94">Guarantor becomes active only when the requested loan is greater than your total savings.</p>
      <button class="primary" id="loanSubmitV94" type="submit">SUBMIT</button>
      <p class="form-error" id="loanErrorV94" role="alert"></p>
      <p class="form-success" id="loanSuccessV94" role="status"></p>
    </form>
  </dialog>

`;
  if(!html.includes(adminDialogMarker)){console.error('Stage 94 admin dialog marker missing');process.exit(1);}
  html=html.replace(adminDialogMarker,form+adminDialogMarker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=94');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=94');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=94');
fs.writeFileSync('www/index.html',html);

/* ---------- Fresh member loan UI logic ---------- */
let app=fs.readFileSync('www/app.js','utf8');

const domMarker="const loansAdminDialog = document.getElementById('loansAdminDialog');";
if(!app.includes("const loanApplyDialogV94")){
  const dom=`const loanApplyDialogV94 = document.getElementById('loanApplyDialogV94');
const loanApplyFormV94 = document.getElementById('loanApplyFormV94');
const loanAccountV94 = document.getElementById('loanAccountV94');
const loanAmountV94 = document.getElementById('loanAmountV94');
const loanGuarantorV94 = document.getElementById('loanGuarantorV94');
const loanGuarantorHelpV94 = document.getElementById('loanGuarantorHelpV94');
const loanSavingsInfoV94 = document.getElementById('loanSavingsInfoV94');
const loanErrorV94 = document.getElementById('loanErrorV94');
const loanSuccessV94 = document.getElementById('loanSuccessV94');
`;
  app=app.replace(domMarker,dom+domMarker);
}

app=app.replace(
  "['PAY', 'TRANSACTION HISTORY', 'SAVINGS PLANS', 'LOAN STATUS', 'WITHDRAW']",
  "['PAY', 'TRANSACTION HISTORY', 'SAVINGS PLANS', 'LOAN STATUS', 'APPLY FOR LOAN', 'WITHDRAW']"
);
app=app.replace(
  "label === 'LOAN STATUS' ? openLoanStatusDialog() : openWithdrawalDialog()",
  "label === 'LOAN STATUS' ? openLoanStatusDialog() : label === 'APPLY FOR LOAN' ? openLoanApplyV94() : openWithdrawalDialog()"
);

const logicMarker="async function loadPendingLoans()";
if(!app.includes("function openLoanApplyV94()")){
  const logic=`
function freshLoanTotalSavingsV94(){
  const b=state.balances||{};
  if(Number.isFinite(Number(b.totalSavings))) return Number(b.totalSavings||0);
  return Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0)+Number(b.flexible||0);
}

function updateLoanGuarantorV94(){
  const total=freshLoanTotalSavingsV94();
  const amount=Number(loanAmountV94?.value||0);
  const required=Number.isFinite(amount) && amount>total;
  if(loanGuarantorV94){
    loanGuarantorV94.disabled=!required;
    loanGuarantorV94.required=required;
    if(!required) loanGuarantorV94.value='';
  }
  if(loanGuarantorHelpV94){
    loanGuarantorHelpV94.textContent=required
      ? 'Guarantor is required because the requested amount is greater than your total savings.'
      : 'Guarantor becomes active only when the requested loan is greater than your total savings.';
  }
}

function openLoanApplyV94(){
  loanApplyFormV94.reset();
  loanErrorV94.textContent='';
  loanSuccessV94.textContent='';
  const total=freshLoanTotalSavingsV94();
  const entitlement=Number((total*0.90).toFixed(2));
  loanSavingsInfoV94.innerHTML='<strong>Total Savings: '+naira(total)+'</strong><br>90% Loan Entitlement: '+naira(entitlement);
  updateLoanGuarantorV94();
  openDialog(loanApplyDialogV94);
}

if(loanAmountV94) loanAmountV94.addEventListener('input',updateLoanGuarantorV94);

if(loanApplyFormV94) loanApplyFormV94.addEventListener('submit',async(event)=>{
  event.preventDefault();
  loanErrorV94.textContent='';
  loanSuccessV94.textContent='SENDING…';
  const submit=document.getElementById('loanSubmitV94');
  if(submit) submit.disabled=true;
  try{
    const loanProduct=String(loanAccountV94.value||'').trim();
    const amount=Number(loanAmountV94.value);
    const total=freshLoanTotalSavingsV94();
    if(!loanProduct) throw new Error('Select an account.');
    if(!Number.isFinite(amount)||amount<=0) throw new Error('Enter a valid loan amount.');
    const needsGuarantor=amount>total;
    const guarantorUsername=String(loanGuarantorV94.value||'').trim();
    if(needsGuarantor&&!guarantorUsername) throw new Error('Enter guarantor username.');

    const data=await api('/api/account/loan-applications',{
      method:'POST',
      cache:'no-store',
      body:JSON.stringify({loanProduct,amount,guarantorUsername})
    });

    loanSuccessV94.textContent='SUBMITTED SUCCESSFULLY: '+data.application.reference+'. Waiting for Admin approval.';
    loanAmountV94.value='';
    loanGuarantorV94.value='';
    updateLoanGuarantorV94();
  }catch(error){
    loanSuccessV94.textContent='';
    loanErrorV94.textContent='APPLICATION NOT SENT: '+error.message;
  }finally{
    if(submit) submit.disabled=false;
  }
});

`;
  if(!app.includes(logicMarker)){console.error('Stage 94 UI logic marker missing');process.exit(1);}
  app=app.replace(logicMarker,logic+logicMarker);
}

/* Improve Admin LOANS display with selected account and requested amount. */
app=app.replace(
  "<span>Savings at application: ${naira(app.borrower_savings_at_application)}</span><span>90% capacity: ${naira(app.self_backed_limit)}</span>",
  "<span>Account: ${escapeHTML(app.loan_product||'REGULAR')}</span><span>Savings at application: ${naira(app.borrower_savings_at_application)}</span><span>90% entitlement: ${naira(app.self_backed_limit)}</span>"
);
app=app.replace(">REJECT</button>",">DECLINE</button>");

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=94'");
fs.writeFileSync('www/app.js',app);

/* ---------- Fresh loan application backend rules ---------- */
let account=fs.readFileSync('server/routes/account.js','utf8');

const routeStart=account.indexOf("router.post('/loan-applications'");
const routeEnd=account.indexOf("\nrouter.get('/loans'",routeStart);
if(routeStart<0||routeEnd<0){console.error('Stage 94 account loan route markers missing');process.exit(1);}

const route=`router.post('/loan-applications', requireAuth, async (req, res) => {
  const amount=Number(req.body?.amount);
  const loanProduct=String(req.body?.loanProduct||'').trim().toUpperCase();
  const guarantorUsername=String(req.body?.guarantorUsername||'').trim().toUpperCase();

  if(!['REGULAR','TARGET','CONSTANT','WELFARE'].includes(loanProduct)) return res.status(400).json({error:'Select REGULAR, TARGET, CONSTANT or WELFARE.'});
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({error:'Enter a valid loan amount.'});

  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await accrueOverdueForAccount(req.auth.sub,client);

    const found=await client.query(
      \`SELECT a.id,a.username,a.full_name,a.role,a.is_active,
              b.regular,b.target,b.constant,b.welfare,b.flexible,b.loan_principal,b.loan_interest
       FROM accounts a JOIN member_balances b ON b.account_id=a.id
       WHERE a.id=$1 FOR UPDATE\`,[req.auth.sub]
    );
    const me=found.rows[0];
    if(!me||!me.is_active||me.role!=='regular'){await client.query('ROLLBACK');return res.status(403).json({error:'Only active Regular members can apply for a loan.'});}
    if(loanMoney(me.loan_principal)>0||loanMoney(me.loan_interest)>0){await client.query('ROLLBACK');return res.status(409).json({error:'Clear the active loan and interest before applying for another loan.'});}

    const pending=await client.query("SELECT reference FROM loan_applications WHERE borrower_account_id=$1 AND status='pending' LIMIT 1",[me.id]);
    if(pending.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'You already have a pending loan application: '+pending.rows[0].reference});}

    const savings=totalSavings(me);
    const entitlement=Number((savings*0.90).toFixed(2));

    let interestRate=5;
    if(loanProduct==='CONSTANT'||loanProduct==='WELFARE') interestRate=3;
    if(loanProduct==='TARGET'){
      const plan=await client.query("SELECT duration_months FROM savings_plans WHERE account_id=$1 AND plan_type='TARGET' AND status='active' LIMIT 1",[me.id]);
      interestRate=plan.rowCount&&Number(plan.rows[0].duration_months)===12 ? 3 : 5;
    }

    const guarantorRequired=Number(Math.max(0,amount-savings).toFixed(2));
    let guarantorId=null;
    let guarantor=null;
    if(guarantorRequired>0){
      if(!guarantorUsername){await client.query('ROLLBACK');return res.status(400).json({error:'Guarantor is required because the requested amount is greater than total savings.'});}
      const g=await client.query(
        \`SELECT a.id,a.username,a.full_name,a.role,a.is_active,b.regular,b.target,b.constant,b.welfare,b.flexible
         FROM accounts a JOIN member_balances b ON b.account_id=a.id
         WHERE a.username=$1 FOR UPDATE\`,[guarantorUsername]
      );
      guarantor=g.rows[0];
      if(!guarantor||!guarantor.is_active||guarantor.role!=='regular'||guarantor.id===me.id){await client.query('ROLLBACK');return res.status(400).json({error:'Guarantor must be another active Regular member.'});}
      const committed=await client.query("SELECT COALESCE(SUM(guarantor_required_amount),0) AS total FROM loans WHERE guarantor_account_id=$1 AND status='active'",[guarantor.id]);
      const available=Number(Math.max(0,totalSavings(guarantor)-loanMoney(committed.rows[0].total)).toFixed(2));
      if(available<guarantorRequired){await client.query('ROLLBACK');return res.status(400).json({error:'Guarantor does not have enough available savings coverage.'});}
      guarantorId=guarantor.id;
    }

    const reference=loanRef('LAP');
    const created=await client.query(
      \`INSERT INTO loan_applications(reference,borrower_account_id,requested_amount,borrower_savings_at_application,self_backed_limit,guarantor_required_amount,guarantor_account_id,purpose,loan_product,interest_rate,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9,'pending')
       RETURNING id,reference,requested_amount,borrower_savings_at_application,self_backed_limit,guarantor_required_amount,loan_product,interest_rate,status,created_at\`,
      [reference,me.id,amount,savings,entitlement,guarantorRequired,guarantorId,loanProduct,interestRate]
    );

    await client.query('COMMIT');
    console.log('FRESH_LOAN_APPLICATION_CREATED',reference,me.username,loanProduct,amount);
    res.status(201).json({application:{...created.rows[0],guarantor:guarantor?{username:guarantor.username,name:guarantor.full_name}:null}});
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
});
`;

account=account.slice(0,routeStart)+route+account.slice(routeEnd);
fs.writeFileSync('server/routes/account.js',account);

/* ---------- Admin approval rules ---------- */
let admin=fs.readFileSync('server/routes/admin.js','utf8');

admin=admin.replace(
  "la.guarantor_required_amount,la.purpose,la.status,la.created_at,la.reviewed_at,la.rejection_reason,",
  "la.guarantor_required_amount,la.purpose,la.loan_product,la.interest_rate,la.status,la.created_at,la.reviewed_at,la.rejection_reason,"
);

admin=admin.replace(
  "const selfLimit = Number((savings * 0.90).toFixed(2));",
  "const selfLimit = Number((savings * 0.90).toFixed(2));"
);
admin=admin.replace(
  "const guarantorRequired = Number(Math.max(0, amount-selfLimit).toFixed(2));",
  "const guarantorRequired = Number(Math.max(0, amount-savings).toFixed(2));"
);
admin=admin.replace(
  "Current savings require ₦${guarantorRequired.toLocaleString('en-NG',{minimumFractionDigits:2})} guarantor coverage.",
  "Approved amount is greater than total savings and requires ₦${guarantorRequired.toLocaleString('en-NG',{minimumFractionDigits:2})} guarantor coverage."
);

fs.writeFileSync('server/routes/admin.js',admin);

/* ---------- Overdue rule: Regular 5%; Target/Constant/Welfare 3% ---------- */
let service=fs.readFileSync('server/services-loans.js','utf8');
service=service.replace(
  "  const rate=money(loan.interest_rate);\n  const daily=Number((principal*(rate/100)/30).toFixed(2));",
  "  const product=String(loan.loan_product||'REGULAR').toUpperCase();\n  const rate=product==='REGULAR' ? 5 : 3;\n  const daily=Number((principal*(rate/100)/30).toFixed(2));"
);
fs.writeFileSync('server/services-loans.js',service);

/* ---------- Cache ---------- */
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v94';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 94 complete fresh loan system applied.');