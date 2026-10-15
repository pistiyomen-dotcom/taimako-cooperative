const fs=require('fs');

function replaceOnce(source,oldText,newText,label){
  const first=source.indexOf(oldText);
  if(first<0) throw new Error('Stage 240: marker missing: '+label);
  if(source.indexOf(oldText,first+oldText.length)>=0) throw new Error('Stage 240: marker is not unique: '+label);
  return source.slice(0,first)+newText+source.slice(first+oldText.length);
}

/* Cooperative accounting ledger. The existing dividend calculation and sharing code are deliberately untouched. */
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('TMCS_COOPERATIVE_LEDGER_V240')){
  schema+=String.raw`

-- TMCS_COOPERATIVE_LEDGER_V240
CREATE TABLE IF NOT EXISTS tmcs_cooperative_ledger (
  id SMALLINT PRIMARY KEY CHECK (id=1),
  available_balance NUMERIC(16,2) NOT NULL DEFAULT 0,
  loan_balance NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (loan_balance>=0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Opening position reflects balances already held for members and outstanding loan principal.
INSERT INTO tmcs_cooperative_ledger(id,available_balance,loan_balance)
SELECT 1,
       COALESCE(SUM(COALESCE(regular,0)+COALESCE(target,0)+COALESCE(constant,0)+COALESCE(welfare,0)+COALESCE(flexible,0)),0)
         - COALESCE(SUM(COALESCE(loan_principal,0)),0),
       COALESCE(SUM(COALESCE(loan_principal,0)),0)
FROM member_balances
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS tmcs_ledger_applied_transactions (
  transaction_id BIGINT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  applied_status VARCHAR(20) NOT NULL,
  balance_delta NUMERIC(16,2) NOT NULL DEFAULT 0,
  loan_delta NUMERIC(16,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION tmcs_apply_cooperative_ledger_v240() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  next_balance_delta NUMERIC(16,2) := 0;
  next_loan_delta NUMERIC(16,2) := 0;
  previous_balance_delta NUMERIC(16,2) := 0;
  previous_loan_delta NUMERIC(16,2) := 0;
  was_applied BOOLEAN := FALSE;
BEGIN
  IF NEW.status IN ('approved','completed') THEN
    IF NEW.transaction_type IN ('cash_credit','bank_transfer','advance_saving','advance_cash_credit')
       AND NEW.destination IN ('REGULAR','TARGET','CONSTANT','WELFARE','FLEXIBLE') THEN
      next_balance_delta := NEW.amount;
    ELSIF NEW.transaction_type='withdrawal'
       AND NEW.destination IN ('REGULAR','TARGET','CONSTANT','WELFARE','FLEXIBLE') THEN
      next_balance_delta := -NEW.amount;
    ELSIF NEW.transaction_type='loan_disbursement' AND NEW.destination='LOAN' THEN
      next_balance_delta := -NEW.amount;
      next_loan_delta := NEW.amount;
    ELSIF NEW.transaction_type='bank_transfer' AND NEW.destination='LOAN' THEN
      next_balance_delta := NEW.amount;
      next_loan_delta := -NEW.amount;
    ELSIF NEW.transaction_type='bank_transfer' AND NEW.destination='INTEREST' THEN
      next_balance_delta := NEW.amount;
    END IF;
  END IF;

  SELECT balance_delta,loan_delta INTO previous_balance_delta,previous_loan_delta
  FROM tmcs_ledger_applied_transactions WHERE transaction_id=NEW.id FOR UPDATE;
  was_applied := FOUND;

  IF NOT was_applied THEN
    IF next_balance_delta<>0 OR next_loan_delta<>0 THEN
      INSERT INTO tmcs_ledger_applied_transactions(transaction_id,applied_status,balance_delta,loan_delta)
      VALUES(NEW.id,NEW.status,next_balance_delta,next_loan_delta);
      UPDATE tmcs_cooperative_ledger
      SET available_balance=available_balance+next_balance_delta,
          loan_balance=loan_balance+next_loan_delta,
          updated_at=NOW()
      WHERE id=1;
    END IF;
  ELSE
    UPDATE tmcs_cooperative_ledger
    SET available_balance=available_balance+(next_balance_delta-previous_balance_delta),
        loan_balance=loan_balance+(next_loan_delta-previous_loan_delta),
        updated_at=NOW()
    WHERE id=1;
    UPDATE tmcs_ledger_applied_transactions
    SET applied_status=NEW.status,balance_delta=next_balance_delta,loan_delta=next_loan_delta,updated_at=NOW()
    WHERE transaction_id=NEW.id;
  END IF;

  IF EXISTS(SELECT 1 FROM tmcs_cooperative_ledger WHERE id=1 AND loan_balance<0) THEN
    RAISE EXCEPTION 'TMCS LTD LOAN ledger cannot become negative';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tmcs_cooperative_ledger_v240 ON transactions;
CREATE TRIGGER tmcs_cooperative_ledger_v240
AFTER INSERT OR UPDATE OF status,amount,destination,transaction_type ON transactions
FOR EACH ROW EXECUTE FUNCTION tmcs_apply_cooperative_ledger_v240();
`;
  fs.writeFileSync(schemaPath,schema);
}

/* Correct the Admin INTEREST tile and expose the two cooperative ledger balances. */
const accountPath='server/routes/account.js';
let account=fs.readFileSync(accountPath,'utf8');
const adminFeeInitBase="let adminFeeTotals={applicationForm:0,flexibleCard:0,membershipCard:0};";
const adminFeeInitV154="let adminFeeTotals={applicationForm:0,flexibleCard:0,membershipCard:0,previousMonthProfit:0,previousMonthInterest:0,previousMonthShares:0};";
if(account.includes(adminFeeInitBase)){
  account=replaceOnce(account,adminFeeInitBase,"let adminFeeTotals={applicationForm:0,flexibleCard:0,membershipCard:0,currentMonthInterest:0,tmcsLTDCooperativeBalance:0,tmcsLTDLoanBalance:0};",'admin fee totals initialization');
}else if(account.includes(adminFeeInitV154)){
  account=replaceOnce(account,adminFeeInitV154,"let adminFeeTotals={applicationForm:0,flexibleCard:0,membershipCard:0,previousMonthProfit:0,previousMonthInterest:0,previousMonthShares:0,currentMonthInterest:0,tmcsLTDCooperativeBalance:0,tmcsLTDLoanBalance:0};",'Stage 154 admin fee totals initialization');
}else if(!account.includes('currentMonthInterest:0,tmcsLTDCooperativeBalance:0')){
  throw new Error('Stage 240: admin fee totals initialization marker missing');
}

const oldAdminBlock=String.raw`    const managementResult=await pool.query('SELECT management_balance FROM cooperative_financials WHERE id=1');
    adminFeeTotals.managementBalance=money(managementResult.rows[0]?.management_balance);`;
const newAdminBlock=String.raw`    const interestResult=await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE status IN ('approved','completed') AND transaction_type='bank_transfer' AND destination='INTEREST' AND COALESCE(approved_at,created_at) >= date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') + INTERVAL '1 month'"
    );
    adminFeeTotals.currentMonthInterest=money(interestResult.rows[0]?.total);
    const cooperativeLedgerResult=await pool.query('SELECT available_balance,loan_balance FROM tmcs_cooperative_ledger WHERE id=1');
    adminFeeTotals.tmcsLTDCooperativeBalance=money(cooperativeLedgerResult.rows[0]?.available_balance);
    adminFeeTotals.tmcsLTDLoanBalance=money(cooperativeLedgerResult.rows[0]?.loan_balance);
    const managementResult=await pool.query('SELECT management_balance FROM cooperative_financials WHERE id=1');
    adminFeeTotals.managementBalance=money(managementResult.rows[0]?.management_balance);`;
account=replaceOnce(account,oldAdminBlock,newAdminBlock,'admin balances ledger query');
const oldResponse="applicationForm: adminFeeTotals.applicationForm, flexibleCard: adminFeeTotals.flexibleCard, membershipCard: adminFeeTotals.membershipCard, managementBalance: adminFeeTotals.managementBalance||0";
const newResponse="applicationForm: adminFeeTotals.applicationForm, flexibleCard: adminFeeTotals.flexibleCard, membershipCard: adminFeeTotals.membershipCard, managementBalance: adminFeeTotals.managementBalance||0, currentMonthInterest: adminFeeTotals.currentMonthInterest||0, tmcsLTDCooperativeBalance: adminFeeTotals.tmcsLTDCooperativeBalance||0, tmcsLTDLoanBalance: adminFeeTotals.tmcsLTDLoanBalance||0";
if(account.includes(oldResponse)){
  account=replaceOnce(account,oldResponse,newResponse,'admin balance API response');
}else if(!account.includes('tmcsLTDCooperativeBalance: adminFeeTotals.tmcsLTDCooperativeBalance')){
  throw new Error('Stage 240: admin balance response marker missing');
}
fs.writeFileSync(accountPath,account);

/* Keep the existing balance/dividend cards; only fix interest source and add the two requested tiles. */
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
const interestPattern=/(\[tmcsMonthName\(0\)\.slice\(0,3\)\+' INTEREST',\s*)naira\(b\.flexibleCard\)(\],)/g;
const interestBefore=app;
app=app.replace(interestPattern,"$1naira(b.currentMonthInterest)$2");
if(app===interestBefore) throw new Error('Stage 240: current-month INTEREST tile marker missing');
const managementLabel=app.indexOf('MANAGEMENT BALANCE');
if(managementLabel<0) throw new Error('Stage 240: existing MANAGEMENT BALANCE tile label missing');
const managementLineStart=app.lastIndexOf('\n',managementLabel)+1;
let managementLineEnd=app.indexOf('\n',managementLabel);
if(managementLineEnd<0) managementLineEnd=app.length;
let managementLine=app.slice(managementLineStart,managementLineEnd);
if(!managementLine.includes('naira(b.managementBalance)')) throw new Error('Stage 240: MANAGEMENT BALANCE line did not contain the expected value expression');
if(!app.includes("['TMCS LTD BALANCE', naira(b.tmcsLTDCooperativeBalance)]")){
  if(!managementLine.trimEnd().endsWith(',')){
    app=app.slice(0,managementLineEnd)+','+app.slice(managementLineEnd);
    managementLineEnd++;
    managementLine+=',';
  }
  app=app.slice(0,managementLineEnd)+"\n    ['TMCS LTD BALANCE', naira(b.tmcsLTDCooperativeBalance)],\n    ['TMCS LTD LOAN', naira(b.tmcsLTDLoanBalance)],"+app.slice(managementLineEnd);
}
app=app.replace("!['MANAGEMENT BALANCE'].includes(title)","!['MANAGEMENT BALANCE','TMCS LTD BALANCE','TMCS LTD LOAN'].includes(title)");
if(!app.includes("naira(b.currentMonthInterest)")||!app.includes("['TMCS LTD BALANCE', naira(b.tmcsLTDCooperativeBalance)]")||!app.includes("['TMCS LTD LOAN', naira(b.tmcsLTDLoanBalance)]")) throw new Error('Stage 240: final Admin balance UI verification failed');
/* Ensure the browser checks the new service-worker script URL, not the old v154/v239 URL. */
app=app.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g, "serviceWorker.register('./sw.js?v=240'");
fs.writeFileSync(appPath,app);

/* Bust the existing v239 browser and service-worker caches so members receive the new Admin tiles. */
const htmlPath='www/index.html';
let html=fs.readFileSync(htmlPath,'utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=240')
         .replace(/styles\.css\?v=\d+/g,'styles.css?v=240')
         .replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=240')
         .replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=240');
fs.writeFileSync(htmlPath,html);
const swPath='www/sw.js';
let sw=fs.readFileSync(swPath,'utf8').replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v240';");
fs.writeFileSync(swPath,sw);


console.log('TAIMAKO Stage 240 cooperative ledgers and current-month interest tile applied; dividend-sharing logic untouched.');
