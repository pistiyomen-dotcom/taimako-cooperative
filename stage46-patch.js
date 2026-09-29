const fs=require('fs');

// Stage 46: Regular Savings November-October year-end entitlement.
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS regular_year_end_balances')){
  const table=`

CREATE TABLE IF NOT EXISTS regular_year_end_balances (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  cycle_end_year INTEGER NOT NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  credited_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  early_withdrawn_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  matured_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','paid')),
  prepared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id,cycle_end_year)
);
CREATE INDEX IF NOT EXISTS idx_regular_year_end_account ON regular_year_end_balances(account_id,cycle_end_year DESC);
`;
  schema=schema.replace('\nCOMMIT;',table+'\nCOMMIT;');
}
fs.writeFileSync('server/db/schema.sql',schema);

let a=fs.readFileSync('server/routes/account.js','utf8');
if(!a.includes('async function regularYearEndTerms')){
  const helper=`

async function ensureRegularYearEnd(accountId, asOf=new Date()) {
  const d=new Date(asOf);
  const y=d.getUTCFullYear();
  const endYear=d.getUTCMonth()>=10 ? y : y-1;
  const start=new Date(Date.UTC(endYear-1,10,1));
  const end=new Date(Date.UTC(endYear,10,1));
  const existing=await pool.query('SELECT * FROM regular_year_end_balances WHERE account_id=$1 AND cycle_end_year=$2',[accountId,endYear]);
  if(existing.rows.length) return existing.rows[0];
  const credits=await pool.query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE account_id=$1 AND destination='REGULAR' AND status IN ('approved','completed') AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND COALESCE(approved_at,created_at)>=$2 AND COALESCE(approved_at,created_at)<$3",[accountId,start,end]);
  const withdrawals=await pool.query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE account_id=$1 AND destination='REGULAR' AND status='approved' AND transaction_type='withdrawal' AND COALESCE(approved_at,created_at)>=$2 AND COALESCE(approved_at,created_at)<$3",[accountId,start,end]);
  const credited=money(credits.rows[0]?.total);
  const early=money(withdrawals.rows[0]?.total);
  const matured=Math.max(0,Number((credited-early).toFixed(2)));
  const inserted=await pool.query("INSERT INTO regular_year_end_balances(account_id,cycle_end_year,cycle_start,cycle_end,credited_amount,early_withdrawn_amount,matured_amount) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(account_id,cycle_end_year) DO UPDATE SET credited_amount=EXCLUDED.credited_amount,early_withdrawn_amount=EXCLUDED.early_withdrawn_amount,matured_amount=EXCLUDED.matured_amount RETURNING *",[accountId,endYear,start,end,credited,early,matured]);
  return inserted.rows[0];
}

async function regularYearEndTerms(accountId, amount, requestedAt=new Date()) {
  const entitlement=await ensureRegularYearEnd(accountId,new Date());
  const remaining=Math.max(0,Number((money(entitlement.matured_amount)-money(entitlement.paid_amount)).toFixed(2)));
  if(remaining>0){
    if(amount>remaining) throw new Error('Available completed-cycle Regular Savings is ₦'+remaining.toLocaleString('en-NG',{minimumFractionDigits:2})+'. Request that year-end amount separately before requesting current-cycle savings.');
    return {feePercent:0,feeAmount:0,payoutAmount:amount,ruleApplied:'Regular Savings year-end disbursement for the completed November–October cycle: no early-withdrawal charge applies.',yearEnd:true,cycleEndYear:entitlement.cycle_end_year};
  }
  const feePercent=20;
  const feeAmount=Number((amount*20/100).toFixed(2));
  return {feePercent,feeAmount,payoutAmount:Number((amount-feeAmount).toFixed(2)),ruleApplied:'Regular Savings withdrawal before the annual October year-end: 20% charge applies. A 30-day notice period is required before approval.',yearEnd:false};
}
`;
  a=a.replace('async function savingsWithdrawalTerms(accountId, source, amount, balance, requestedAt = new Date()) {',helper+'\nasync function savingsWithdrawalTerms(accountId, source, amount, balance, requestedAt = new Date()) {');
}

// Apply Regular year-end terms when the member creates a withdrawal request.
if(!a.includes("else if (source === 'REGULAR')")){
  const marker="  } else if (['TARGET','CONSTANT','WELFARE'].includes(source)) {";
  const repl=`
  } else if (source === 'REGULAR') {
    const eligibility = await regularYearEndTerms(req.auth.sub, amount, new Date());
    feePercent = eligibility.feePercent;
    feeAmount = eligibility.feeAmount;
    payoutAmount = eligibility.payoutAmount;
    ruleApplied = eligibility.ruleApplied;
  } else if (['TARGET','CONSTANT','WELFARE'].includes(source)) {
`;
  if(!a.includes(marker)){console.error('Stage 46 member Regular request marker missing');process.exit(1);}
  a=a.replace(marker,repl);
}
fs.writeFileSync('server/routes/account.js',a);

let ad=fs.readFileSync('server/routes/admin.js','utf8');
if(!ad.includes('async function adminRegularYearEndTerms')){
  const helper=`

async function adminEnsureRegularYearEnd(client, accountId, asOf=new Date()) {
  const d=new Date(asOf);
  const y=d.getUTCFullYear();
  const endYear=d.getUTCMonth()>=10 ? y : y-1;
  const start=new Date(Date.UTC(endYear-1,10,1));
  const end=new Date(Date.UTC(endYear,10,1));
  const existing=await client.query('SELECT * FROM regular_year_end_balances WHERE account_id=$1 AND cycle_end_year=$2 FOR UPDATE',[accountId,endYear]);
  if(existing.rows.length) return existing.rows[0];
  const credits=await client.query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE account_id=$1 AND destination='REGULAR' AND status IN ('approved','completed') AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND COALESCE(approved_at,created_at)>=$2 AND COALESCE(approved_at,created_at)<$3",[accountId,start,end]);
  const withdrawals=await client.query("SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE account_id=$1 AND destination='REGULAR' AND status='approved' AND transaction_type='withdrawal' AND COALESCE(approved_at,created_at)>=$2 AND COALESCE(approved_at,created_at)<$3",[accountId,start,end]);
  const credited=money(credits.rows[0]?.total);
  const early=money(withdrawals.rows[0]?.total);
  const matured=Math.max(0,Number((credited-early).toFixed(2)));
  const inserted=await client.query("INSERT INTO regular_year_end_balances(account_id,cycle_end_year,cycle_start,cycle_end,credited_amount,early_withdrawn_amount,matured_amount) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[accountId,endYear,start,end,credited,early,matured]);
  return inserted.rows[0];
}

async function adminRegularYearEndTerms(client, accountId, amount, requestedAt) {
  const entitlement=await adminEnsureRegularYearEnd(client,accountId,new Date());
  const remaining=Math.max(0,Number((money(entitlement.matured_amount)-money(entitlement.paid_amount)).toFixed(2)));
  if(remaining>0){
    if(amount>remaining) throw new Error('Available completed-cycle Regular Savings is ₦'+remaining.toLocaleString('en-NG',{minimumFractionDigits:2})+'. Approve that year-end amount separately before any current-cycle withdrawal.');
    return {feePercent:0,feeAmount:0,payoutAmount:amount,ruleApplied:'Regular Savings year-end disbursement for the completed November–October cycle: no early-withdrawal charge applies.',yearEnd:true,cycleEndYear:entitlement.cycle_end_year};
  }
  const noticeDays=adminDaysBetween(new Date(),new Date(requestedAt));
  if(noticeDays<30) throw new Error('Regular Savings early withdrawal cannot be approved until the required 30-day notice period is completed.');
  const feePercent=20;
  const feeAmount=Number((amount*20/100).toFixed(2));
  return {feePercent,feeAmount,payoutAmount:Number((amount-feeAmount).toFixed(2)),ruleApplied:'Regular Savings withdrawal before the annual October year-end: 20% charge applies after the required 30-day notice.',yearEnd:false};
}
`;
  ad=ad.replace('async function adminSavingsWithdrawalTerms(client, accountId, source, amount, balance, requestedAt) {',helper+'\nasync function adminSavingsWithdrawalTerms(client, accountId, source, amount, balance, requestedAt) {');
}

// Replace Stage 45 Regular approval helper with cycle-aware rule.
const old=`
      const eligibility = await adminSavingsWithdrawalTerms(client, request.account_id, request.source, amount, balance, request.created_at);
      feePercent = eligibility.feePercent;
      feeAmount = eligibility.feeAmount;
      payoutAmount = eligibility.payoutAmount;
      ruleApplied = eligibility.ruleApplied;
`;
const neu=`
      const eligibility = await adminRegularYearEndTerms(client, request.account_id, amount, request.created_at);
      feePercent = eligibility.feePercent;
      feeAmount = eligibility.feeAmount;
      payoutAmount = eligibility.payoutAmount;
      ruleApplied = eligibility.ruleApplied;
      request.__regularYearEnd = eligibility.yearEnd ? eligibility.cycleEndYear : null;
`;
const regBranch="    if (request.source === 'REGULAR') {\n"+old;
if(ad.includes(regBranch)){ ad=ad.replace(regBranch,"    if (request.source === 'REGULAR') {\n"+neu); }

// Mark year-end entitlement as paid only after the balance deduction succeeds.
if(!ad.includes('request.__regularYearEnd')){console.error('Stage 46 Regular approval replacement failed');process.exit(1);}
if(!ad.includes('UPDATE regular_year_end_balances SET paid_amount=paid_amount+$1')){
  const marker="    await client.query(`UPDATE member_balances SET ${column}=${column}-$1, updated_at=NOW() WHERE account_id=$2`, [amount, request.account_id]);";
  const repl=marker+"\n    if(request.__regularYearEnd){ await client.query(\"UPDATE regular_year_end_balances SET paid_amount=paid_amount+$1,status=CASE WHEN paid_amount+$1>=matured_amount THEN 'paid' ELSE 'available' END WHERE account_id=$2 AND cycle_end_year=$3\",[amount,request.account_id,request.__regularYearEnd]); }";
  if(!ad.includes(marker)){console.error('Stage 46 balance deduction marker missing');process.exit(1);}
  ad=ad.replace(marker,repl);
}
fs.writeFileSync('server/routes/admin.js',ad);

console.log('TAIMAKO Stage 46 Regular November-October year-end entitlement applied.');