const fs=require('fs');

/* ---------- Schema: management balance + month-end transfer ledger ---------- */
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS cooperative_financials')){
  const add=`
CREATE TABLE IF NOT EXISTS cooperative_financials (
  id SMALLINT PRIMARY KEY CHECK (id=1),
  management_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (management_balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO cooperative_financials(id,management_balance)
VALUES(1,0)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS management_fee_transfers (
  period_month DATE PRIMARY KEY,
  membership_card_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  flexible_card_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
  schema=schema.replace('\nCOMMIT;',add+'\nCOMMIT;');
}
fs.writeFileSync('server/db/schema.sql',schema);

/* ---------- Month-end service ---------- */
const service=`const pool=require('./db/pool');

async function processManagementMonthEnd(){
  const clock=await pool.query(\`
    SELECT
      (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date AS local_date,
      (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::time AS local_time,
      date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date AS period_month,
      (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') + interval '1 month - 1 day')::date AS month_end
  \`);
  const c=clock.rows[0];
  if(!c) return {processed:false,reason:'clock-unavailable'};
  const isLastDay=String(c.local_date)===String(c.month_end);
  const due=String(c.local_time).slice(0,5)>='23:55';
  if(!isLastDay || !due) return {processed:false,reason:'not-due'};

  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const lock=await client.query('SELECT pg_try_advisory_xact_lock(10523055) AS locked');
    if(lock.rows[0]?.locked!==true){
      await client.query('ROLLBACK');
      return {processed:false,reason:'locked'};
    }

    const exists=await client.query('SELECT 1 FROM management_fee_transfers WHERE period_month=$1',[c.period_month]);
    if(exists.rowCount){
      await client.query('ROLLBACK');
      return {processed:false,reason:'already-processed'};
    }

    const totals=await client.query(\`
      SELECT
        COALESCE(SUM(b.membership_card),0) AS membership_card,
        COALESCE(SUM(b.flexible_card),0) AS flexible_card
      FROM accounts a
      JOIN member_balances b ON b.account_id=a.id
      WHERE a.role='admin'
    \`);
    const membership=Number(totals.rows[0]?.membership_card||0);
    const flexible=Number(totals.rows[0]?.flexible_card||0);
    const total=Number((membership+flexible).toFixed(2));

    await client.query(
      'UPDATE cooperative_financials SET management_balance=management_balance+$1,updated_at=NOW() WHERE id=1',
      [total]
    );
    await client.query(
      'INSERT INTO management_fee_transfers(period_month,membership_card_amount,flexible_card_amount,total_amount) VALUES($1,$2,$3,$4)',
      [c.period_month,membership,flexible,total]
    );
    await client.query(\`
      UPDATE member_balances b
      SET membership_card=0, flexible_card=0, updated_at=NOW()
      FROM accounts a
      WHERE a.id=b.account_id AND a.role='admin'
    \`);

    await client.query('COMMIT');
    console.log('MANAGEMENT_MONTH_END_TRANSFER',String(c.period_month),membership,flexible,total);
    return {processed:true,periodMonth:c.period_month,membership,flexible,total};
  }catch(error){
    try{await client.query('ROLLBACK');}catch(_){}
    console.error('Management month-end transfer failed:',error);
    throw error;
  }finally{
    client.release();
  }
}

module.exports={processManagementMonthEnd};
`;
fs.writeFileSync('server/services-management.js',service);

/* ---------- Server startup scheduler ---------- */
let index=fs.readFileSync('server/index.js','utf8');
if(!index.includes("require('./services-management')")){
  index=index.replace(
    "const pool = require('./db/pool');",
    "const pool = require('./db/pool');\nconst { processManagementMonthEnd } = require('./services-management');"
  );
}
const listenMarker="  app.listen(port, () => console.log(`TAIMAKO server listening on port ${port}`));";
if(!index.includes('MANAGEMENT_MONTH_END_SCHEDULER')){
  if(!index.includes(listenMarker)){console.error('Stage 106 listen marker missing');process.exit(1);}
  index=index.replace(listenMarker,`
  try{ await processManagementMonthEnd(); }catch(error){ console.error('Initial management month-end check failed:',error.message); }

  app.listen(port, () => {
    console.log(\`TAIMAKO server listening on port \${port}\`);
    console.log('MANAGEMENT_MONTH_END_SCHEDULER active for 23:55 Africa/Lagos');
  });

  setInterval(()=>{
    processManagementMonthEnd().catch(error=>console.error('Management month-end scheduled check failed:',error.message));
  },30000);
`);
}
fs.writeFileSync('server/index.js',index);

/* ---------- Account API: current-month fee totals + management balance ---------- */
let account=fs.readFileSync('server/routes/account.js','utf8');
const oldTotals=`    const adminFeeTotalsResult=await pool.query(
      "SELECT COALESCE(SUM(b.application_form),0) AS application_form, COALESCE(SUM(b.flexible_card),0) AS flexible_card, COALESCE(SUM(b.membership_card),0) AS membership_card FROM accounts a JOIN member_balances b ON b.account_id=a.id WHERE a.role='admin' AND a.is_active=TRUE"
    );
    const feeRow=adminFeeTotalsResult.rows[0]||{};
    adminFeeTotals={
      applicationForm:money(feeRow.application_form),
      flexibleCard:money(feeRow.flexible_card),
      membershipCard:money(feeRow.membership_card)
    };`;
const newTotals=`    const adminFeeTotalsResult=await pool.query(
      "SELECT destination,COALESCE(SUM(amount),0) AS total FROM transactions WHERE status IN ('approved','completed') AND transaction_type='cash_credit' AND destination IN ('APPLICATION FORM','FLEXIBLE CARD','MEMBERSHIP CARD') AND COALESCE(approved_at,created_at) >= date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') + INTERVAL '1 month' GROUP BY destination"
    );
    const feeMap=Object.fromEntries(adminFeeTotalsResult.rows.map(r=>[r.destination,money(r.total)]));
    adminFeeTotals={
      applicationForm:feeMap['APPLICATION FORM']||0,
      flexibleCard:feeMap['FLEXIBLE CARD']||0,
      membershipCard:feeMap['MEMBERSHIP CARD']||0
    };
    const managementResult=await pool.query('SELECT management_balance FROM cooperative_financials WHERE id=1');
    adminFeeTotals.managementBalance=money(managementResult.rows[0]?.management_balance);`;
if(account.includes(oldTotals)) account=account.replace(oldTotals,newTotals);
else if(!account.includes("managementResult=await pool.query('SELECT management_balance")){
  console.error('Stage 106 admin totals marker missing');process.exit(1);
}

account=account.replace(
  "membershipCard: adminFeeTotals.membershipCard",
  "membershipCard: adminFeeTotals.membershipCard, managementBalance: adminFeeTotals.managementBalance||0"
);
fs.writeFileSync('server/routes/account.js',account);

/* ---------- Admin dashboard labels ---------- */
let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(
  "['APPLICATION FORM', naira(b.applicationForm)],\n    ['FLEXIBLE CARD', naira(b.flexibleCard)],\n    ['MEMBERSHIP CARD', naira(b.membershipCard)],",
  "[tmcsMonthName(0)+' APPLICATION FORM', naira(b.applicationForm)],\n    [tmcsMonthName(0)+' FLEXIBLE CARD', naira(b.flexibleCard)],\n    [tmcsMonthName(0)+' MEMBERSHIP CARD', naira(b.membershipCard)],\n    ['MANAGEMENT BALANCE', naira(b.managementBalance)],"
);

const oldClick="    if (user.role === 'admin' && !['APPLICATION FORM','FLEXIBLE CARD','MEMBERSHIP CARD'].includes(title)) {";
const newClick="    if (user.role === 'admin' && !['MANAGEMENT BALANCE'].includes(title) && !title.endsWith(' APPLICATION FORM') && !title.endsWith(' FLEXIBLE CARD') && !title.endsWith(' MEMBERSHIP CARD')) {";
if(app.includes(oldClick)) app=app.replace(oldClick,newClick);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=106'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=106');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=106');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=106');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v106';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 106 management balance and calendar fee dashboards applied.');