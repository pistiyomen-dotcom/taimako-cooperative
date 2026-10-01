const fs=require('fs');

// Stage 89: rebuild loan system after Stage 88 reset.
// Products: REGULAR 5%, WELFARE 3%, TARGET 3% (active 12-month Target plan only).
// Duration: 30 days. Principal and interest repayments are kept separate.

let schema=fs.readFileSync('server/db/schema.sql','utf8');
schema=schema.replace(/CHECK \(loan_product IN \('REGULAR','TARGET','CONSTANT'\)\)/g,
  "CHECK (loan_product IN ('REGULAR','TARGET','CONSTANT','WELFARE'))");
fs.writeFileSync('server/db/schema.sql',schema);

// Replace loan service with the new active-balance overdue engine.
const svc=`const crypto = require('crypto');
const pool = require('./db/pool');

function money(value){ const n=Number(value||0); return Number.isFinite(n)?Number(n.toFixed(2)):0; }
function totalSavings(row){ return money(money(row?.regular)+money(row?.target)+money(row?.constant)+money(row?.welfare)+money(row?.flexible)); }
function ref(prefix){ return prefix+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase(); }

async function syncActiveLoanForAccount(accountId, client=pool){
  const found=await client.query(
    \`SELECT id,approved_principal,loan_product,interest_rate,base_interest,approved_at,due_date,last_accrual_date,overdue_interest_accrued,status
       FROM loans
       WHERE borrower_account_id=$1 AND status='active'
       ORDER BY approved_at DESC LIMIT 1\`,
    [accountId]
  );
  const loan=found.rows[0];
  if(!loan) return null;

  const due=new Date(loan.approved_at);
  due.setUTCDate(due.getUTCDate()+30);
  const dueDate=due.toISOString().slice(0,10);

  await client.query(
    'UPDATE loans SET due_date=$1::date, updated_at=NOW() WHERE id=$2',
    [dueDate,loan.id]
  );
  await client.query(
    'UPDATE member_balances SET loan_due_date=$1::date, updated_at=NOW() WHERE account_id=$2',
    [dueDate,accountId]
  );

  return {...loan,due_date:dueDate};
}

async function accrueOverdueForAccount(accountId, client=pool){
  const loan=await syncActiveLoanForAccount(accountId,client);
  if(!loan) return null;

  const balances=await client.query(
    'SELECT loan_principal,loan_interest FROM member_balances WHERE account_id=$1 FOR UPDATE',
    [accountId]
  );
  const row=balances.rows[0];
  if(!row) return loan;

  const principal=money(row.loan_principal);
  if(principal<=0) return loan;

  const due=new Date(loan.due_date);
  due.setUTCHours(0,0,0,0);
  const today=new Date();
  today.setUTCHours(0,0,0,0);
  if(today<=due) return loan;

  const last=loan.last_accrual_date ? new Date(loan.last_accrual_date) : due;
  last.setUTCHours(0,0,0,0);
  const start=last>due?last:due;
  const days=Math.floor((today-start)/86400000);
  if(days<=0) return loan;

  const rate=Number(loan.interest_rate||5);
  const daily=principal*(rate/100)/30;
  const extra=Number((daily*days).toFixed(2));
  if(extra<=0) return loan;

  await client.query(
    'UPDATE member_balances SET loan_interest=loan_interest+$1,updated_at=NOW() WHERE account_id=$2',
    [extra,accountId]
  );
  await client.query(
    'UPDATE loans SET overdue_interest_accrued=overdue_interest_accrued+$1,last_accrual_date=CURRENT_DATE,updated_at=NOW() WHERE id=$2',
    [extra,loan.id]
  );
  await client.query(
    \`INSERT INTO transactions(reference,account_id,created_by_account_id,transaction_type,destination,amount,status,note,approved_at)
       VALUES($1,$2,$2,'loan_overdue_charge','INTEREST',$3,'completed',$4,NOW())\`,
    [ref('OVD'),accountId,extra,days+' overdue day(s) at '+rate+'% / 30 on active loan balance']
  );
  return {...loan,overdue_added:extra};
}

async function closeLoanIfSettled(accountId, client=pool){
  const b=await client.query(
    'SELECT loan_principal,loan_interest FROM member_balances WHERE account_id=$1 FOR UPDATE',
    [accountId]
  );
  if(!b.rowCount) return null;
  const principal=money(b.rows[0].loan_principal);
  const interest=money(b.rows[0].loan_interest);
  if(principal>0 || interest>0) return null;

  const closed=await client.query(
    \`UPDATE loans SET status='paid',paid_at=COALESCE(paid_at,NOW()),updated_at=NOW()
       WHERE borrower_account_id=$1 AND status='active' RETURNING id,reference\`,
    [accountId]
  );
  await client.query(
    'UPDATE member_balances SET loan_principal=0,loan_interest=0,loan_due_date=NULL,updated_at=NOW() WHERE account_id=$1',
    [accountId]
  );
  return closed.rows[0]||null;
}

module.exports={money,totalSavings,syncActiveLoanForAccount,accrueOverdueForAccount,closeLoanIfSettled,ref};
`;
fs.writeFileSync('server/services-loans.js',svc);

// Member application rules.
let account=fs.readFileSync('server/routes/account.js','utf8');
account=account.replace(
  "if (!['REGULAR','TARGET','CONSTANT'].includes(loanProduct)) return res.status(400).json({ error:'Select a valid loan product.' });",
  "if (!['REGULAR','WELFARE','TARGET'].includes(loanProduct)) return res.status(400).json({ error:'Select REGULAR, WELFARE or TARGET loan.' });"
);
account=account.replace(
  "    let interestRate = 5;\n    if (loanProduct === 'CONSTANT') {\n      const plan=await client.query(\"SELECT duration_months,status FROM savings_plans WHERE account_id=$1 AND plan_type='CONSTANT'\",[me.id]);\n      if(!plan.rowCount || plan.rows[0].status!=='active'){ await client.query('ROLLBACK'); return res.status(400).json({error:'An active Constant Savings plan is required for a Constant loan.'}); }\n    }\n    if (loanProduct === 'TARGET') {",
  "    let interestRate = loanProduct === 'REGULAR' ? 5 : 3;\n    if (loanProduct === 'TARGET') {"
);
account=account.replace(
  "if(Number(plan.rows[0].duration_months)>12){ await client.query('ROLLBACK'); return res.status(400).json({error:'Target loan at 3% is available only when the Target Savings duration is 12 months or less.'}); }",
  "if(Number(plan.rows[0].duration_months)!==12){ await client.query('ROLLBACK'); return res.status(400).json({error:'Target loan at 3% is available only for an active 12-month Target Savings tenure.'}); }"
);
fs.writeFileSync('server/routes/account.js',account);

// Admin approval: Admin supplies approved amount; rate follows product.
let admin=fs.readFileSync('server/routes/admin.js','utf8');
admin=admin.replace(
  "    const amount = loanMoney(app.requested_amount);",
  "    const requestedAmount = loanMoney(app.requested_amount);\n    const amount = loanMoney(req.body?.approvedAmount || requestedAmount);\n    if(amount<=0){ await client.query('ROLLBACK'); return res.status(400).json({error:'Enter a valid approved loan amount.'}); }\n    if(amount>requestedAmount){ await client.query('ROLLBACK'); return res.status(400).json({error:'Approved amount cannot exceed the member requested amount.'}); }"
);
admin=admin.replace(
  "    const interestRate = 5;\n    const interest = Number((amount*0.05).toFixed(2));",
  "    const interestRate = String(app.loan_product||'REGULAR').toUpperCase()==='REGULAR' ? 5 : 3;\n    const interest = Number((amount*(interestRate/100)).toFixed(2));"
);

// Cash Credit: LOAN and INTEREST are repayments, not credits.
const cashOld=`    const updated=await client.query(
      'UPDATE member_balances SET '+column+'='+column+'+$1, updated_at=NOW() WHERE account_id=$2 RETURNING *',
      [amount,account.id]
    );`;
const cashNew=`    let updated;
    if(destination==='LOAN' || destination==='INTEREST'){
      await accrueOverdueForAccount(account.id,client);
      const currentRow=await client.query('SELECT loan_principal,loan_interest FROM member_balances WHERE account_id=$1 FOR UPDATE',[account.id]);
      const current=Number(destination==='LOAN'?currentRow.rows[0]?.loan_principal:currentRow.rows[0]?.loan_interest)||0;
      if(current<=0){
        await client.query('ROLLBACK');
        return res.status(400).json({error:'There is no outstanding '+destination.toLowerCase()+' balance to repay.'});
      }
      if(amount>current){
        await client.query('ROLLBACK');
        return res.status(400).json({error:'Repayment exceeds outstanding '+destination.toLowerCase()+' balance of ₦'+current.toLocaleString('en-NG',{minimumFractionDigits:2})+'.'});
      }
      updated=await client.query(
        'UPDATE member_balances SET '+column+'=GREATEST(0,'+column+'-$1),updated_at=NOW() WHERE account_id=$2 RETURNING *',
        [amount,account.id]
      );
      await closeLoanIfSettled(account.id,client);
    }else{
      updated=await client.query(
        'UPDATE member_balances SET '+column+'='+column+'+$1,updated_at=NOW() WHERE account_id=$2 RETURNING *',
        [amount,account.id]
      );
    }`;
if(!admin.includes(cashOld)){ console.error('Stage 89 Cash Credit balance marker missing'); process.exit(1); }
admin=admin.replace(cashOld,cashNew);
fs.writeFileSync('server/routes/admin.js',admin);

// One-time DB migration:
// 1) allow WELFARE product while preserving historical CONSTANT rows.
// 2) install deferred correction for approved BANK TRANSFER repayments because the legacy payment approval route credits destinations.
let index=fs.readFileSync('server/index.js','utf8');
const insertMarker="  app.listen(port, () => console.log(\`TAIMAKO server listening on port \${port}\`));";
const migration=`
  const loanRulesKey='stage89_new_loan_rules';
  const loanRulesDone=await pool.query('SELECT 1 FROM system_migrations WHERE migration_key=$1',[loanRulesKey]);
  if(!loanRulesDone.rowCount){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      await client.query('ALTER TABLE loan_applications DROP CONSTRAINT IF EXISTS loan_applications_loan_product_check');
      await client.query("ALTER TABLE loan_applications ADD CONSTRAINT loan_applications_loan_product_check CHECK (loan_product IN ('REGULAR','TARGET','CONSTANT','WELFARE'))");
      await client.query('ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_loan_product_check');
      await client.query("ALTER TABLE loans ADD CONSTRAINT loans_loan_product_check CHECK (loan_product IN ('REGULAR','TARGET','CONSTANT','WELFARE'))");

      await client.query(\`
        CREATE OR REPLACE FUNCTION taimako_bank_loan_repayment_fix()
        RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE
          active_id BIGINT;
          rate NUMERIC;
          last_day DATE;
          due_day DATE;
          principal_now NUMERIC;
          pre_payment_principal NUMERIC;
          overdue_days INTEGER;
          overdue_add NUMERIC;
        BEGIN
          IF NEW.transaction_type='bank_transfer'
             AND NEW.destination IN ('LOAN','INTEREST')
             AND NEW.status IN ('approved','completed')
             AND (TG_OP='INSERT' OR OLD.status NOT IN ('approved','completed')) THEN

            SELECT id,interest_rate,last_accrual_date,due_date
              INTO active_id,rate,last_day,due_day
              FROM loans
             WHERE borrower_account_id=NEW.account_id AND status='active'
             ORDER BY approved_at DESC LIMIT 1
             FOR UPDATE;

            IF active_id IS NOT NULL THEN
              SELECT loan_principal INTO principal_now
                FROM member_balances WHERE account_id=NEW.account_id FOR UPDATE;

              IF NEW.destination='LOAN' THEN
                pre_payment_principal:=GREATEST(0,COALESCE(principal_now,0)-NEW.amount);
              ELSE
                pre_payment_principal:=GREATEST(0,COALESCE(principal_now,0));
              END IF;

              overdue_days:=GREATEST(0,CURRENT_DATE-GREATEST(COALESCE(last_day,due_day),due_day));
              IF overdue_days>0 AND pre_payment_principal>0 THEN
                overdue_add:=ROUND((pre_payment_principal*(COALESCE(rate,5)/100)/30*overdue_days)::numeric,2);
                UPDATE member_balances SET loan_interest=loan_interest+overdue_add,updated_at=NOW() WHERE account_id=NEW.account_id;
                UPDATE loans SET overdue_interest_accrued=overdue_interest_accrued+overdue_add,last_accrual_date=CURRENT_DATE,updated_at=NOW() WHERE id=active_id;
              END IF;

              IF NEW.destination='LOAN' THEN
                UPDATE member_balances SET loan_principal=GREATEST(0,loan_principal-(NEW.amount*2)),updated_at=NOW() WHERE account_id=NEW.account_id;
              ELSE
                UPDATE member_balances SET loan_interest=GREATEST(0,loan_interest-(NEW.amount*2)),updated_at=NOW() WHERE account_id=NEW.account_id;
              END IF;

              IF EXISTS(SELECT 1 FROM member_balances WHERE account_id=NEW.account_id AND loan_principal=0 AND loan_interest=0) THEN
                UPDATE loans SET status='paid',paid_at=COALESCE(paid_at,NOW()),updated_at=NOW() WHERE id=active_id;
                UPDATE member_balances SET loan_due_date=NULL,updated_at=NOW() WHERE account_id=NEW.account_id;
              END IF;
            END IF;
          END IF;
          RETURN NEW;
        END $$;
      \`);

      await client.query('DROP TRIGGER IF EXISTS trg_taimako_bank_loan_repayment_fix ON transactions');
      await client.query(\`
        CREATE CONSTRAINT TRIGGER trg_taimako_bank_loan_repayment_fix
        AFTER INSERT OR UPDATE OF status ON transactions
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION taimako_bank_loan_repayment_fix()
      \`);

      await client.query('INSERT INTO system_migrations(migration_key) VALUES($1)',[loanRulesKey]);
      await client.query('COMMIT');
      console.log('TAIMAKO Stage 89 new loan rules migration completed.');
    }catch(error){
      await client.query('ROLLBACK');
      throw error;
    }finally{ client.release(); }
  }
`;
if(!index.includes(insertMarker)){ console.error('Stage 89 startup marker missing'); process.exit(1); }
index=index.replace(insertMarker,migration+'\n'+insertMarker);
fs.writeFileSync('server/index.js',index);

// UI: new products/rates and Admin approved-amount prompt.
let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  /<option value="REGULAR">REGULAR - 5%<\/option><option value="CONSTANT">CONSTANT - 5%<\/option><option value="TARGET">TARGET - 5%<\/option>/,
  '<option value="REGULAR">REGULAR - 5%</option><option value="WELFARE">WELFARE - 3%</option><option value="TARGET">TARGET - 3% (12-month tenure)</option>'
);
html=html.replace(
  /<p class="helper">You may borrow[\s\S]*?<\/p>/,
  '<p class="helper">Loan duration is 30 days. REGULAR interest is 5%. WELFARE interest is 3%. TARGET interest is 3% and is available only for an active 12-month Target Savings tenure. Admin approval determines the amount credited as the active loan.</p>'
);
html=html.replace(
  'Approved loans receive a 30-day due date and 5% initial interest.',
  'Admin enters the approved amount. The system credits only that amount, sets a 30-day due date, and charges 5% for REGULAR or 3% for WELFARE/TARGET.'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=89');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=89');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=89');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(
  "item.querySelector('.approve-btn').addEventListener('click',()=>approveLoan(app.id,app.reference));",
  "item.querySelector('.approve-btn').addEventListener('click',()=>approveLoan(app.id,app.reference,app.requested_amount));"
);
app=app.replace(
  "async function approveLoan(id, reference) {",
  "async function approveLoan(id, reference, requestedAmount) {"
);
app=app.replace(
  "    const data=await api(\`/api/admin/loan-applications/\${id}/approve\`,{method:'POST',body:JSON.stringify({})});",
  "    const entered=window.prompt('Enter approved loan amount',String(Number(requestedAmount||0)));\n    if(entered===null) return;\n    const approvedAmount=Number(entered);\n    if(!Number.isFinite(approvedAmount)||approvedAmount<=0){ loansAdminError.textContent='Enter a valid approved loan amount.'; return; }\n    const data=await api(\`/api/admin/loan-applications/\${id}/approve\`,{method:'POST',body:JSON.stringify({approvedAmount})});"
);
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=89'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v89';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 89 rebuilt loan rules applied.');
