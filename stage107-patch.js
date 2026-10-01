const fs=require('fs');

/* ---------- Schema ---------- */
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS dividend_summaries')){
  const add=`
ALTER TABLE member_balances ADD COLUMN IF NOT EXISTS dividend NUMERIC(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS dividend_summaries (
  period_month DATE PRIMARY KEY,
  total_interest NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_application_form NUMERIC(14,2) NOT NULL DEFAULT 0,
  gross_income NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_shares BIGINT NOT NULL DEFAULT 0,
  management_ten_percent NUMERIC(14,2) NOT NULL DEFAULT 0,
  distributable_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_per_share NUMERIC(18,6) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  distributed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dividend_member_shares (
  period_month DATE NOT NULL REFERENCES dividend_summaries(period_month) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  username VARCHAR(32) NOT NULL,
  share_count BIGINT NOT NULL DEFAULT 0,
  dividend_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  credited_at TIMESTAMPTZ,
  PRIMARY KEY(period_month,account_id)
);
CREATE INDEX IF NOT EXISTS idx_dividend_member_period ON dividend_member_shares(period_month,account_id);
`;
  schema=schema.replace('\nCOMMIT;',add+'\nCOMMIT;');
}
fs.writeFileSync('server/db/schema.sql',schema);

/* ---------- Dividend service ---------- */
const service=`const pool=require('./db/pool');

function n(v){return Number(v||0);}

async function lagosClock(){
  const r=await pool.query(\`
    SELECT
      (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date AS local_date,
      (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::time AS local_time,
      date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date AS period_month,
      (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') + interval '1 month - 1 day')::date AS month_end
  \`);
  return r.rows[0];
}

async function calculateDividendMonthEnd(){
  const c=await lagosClock();
  if(!c) return {processed:false,reason:'clock-unavailable'};
  const isLastDay=String(c.local_date)===String(c.month_end);
  const due=String(c.local_time).slice(0,5)>='23:55';
  if(!isLastDay||!due) return {processed:false,reason:'not-due'};

  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const lock=await client.query('SELECT pg_try_advisory_xact_lock(10623055) AS locked');
    if(lock.rows[0]?.locked!==true){await client.query('ROLLBACK');return {processed:false,reason:'locked'};}

    const exists=await client.query('SELECT 1 FROM dividend_summaries WHERE period_month=$1',[c.period_month]);
    if(exists.rowCount){await client.query('ROLLBACK');return {processed:false,reason:'already-calculated'};}

    const settings=await client.query("SELECT numeric_value FROM cooperative_settings WHERE setting_key='minimum_share_per_month'");
    const minimumShare=n(settings.rows[0]?.numeric_value)||5000;

    const income=await client.query(\`
      SELECT
        COALESCE(SUM(CASE WHEN destination='INTEREST' THEN amount ELSE 0 END),0) AS interest,
        COALESCE(SUM(CASE WHEN destination='APPLICATION FORM' THEN amount ELSE 0 END),0) AS application_form
      FROM transactions
      WHERE status IN ('approved','completed')
        AND destination IN ('INTEREST','APPLICATION FORM')
        AND COALESCE(approved_at,created_at) >= $1::date
        AND COALESCE(approved_at,created_at) < ($1::date + INTERVAL '1 month')
    \`,[c.period_month]);

    const memberSavings=await client.query(\`
      SELECT a.id,a.username,
             COALESCE(SUM(t.amount),0) AS monthly_savings
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id=a.id
        AND t.status IN ('approved','completed')
        AND t.destination IN ('REGULAR','TARGET','CONSTANT','WELFARE')
        AND t.transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in')
        AND COALESCE(t.approved_at,t.created_at) >= $1::date
        AND COALESCE(t.approved_at,t.created_at) < ($1::date + INTERVAL '1 month')
      WHERE a.role='regular' AND a.is_active=TRUE
      GROUP BY a.id,a.username
      ORDER BY a.id
    \`,[c.period_month]);

    const rows=memberSavings.rows.map(r=>{
      const shares=minimumShare>0?Math.floor(n(r.monthly_savings)/minimumShare):0;
      return {id:r.id,username:r.username,shares};
    });
    const totalShares=rows.reduce((s,r)=>s+r.shares,0);
    const totalInterest=n(income.rows[0]?.interest);
    const totalApplication=n(income.rows[0]?.application_form);
    const gross=Number((totalInterest+totalApplication).toFixed(2));
    const ten=Number((gross*0.10).toFixed(2));
    const distributable=Number((gross-ten).toFixed(2));
    const perShare=totalShares>0?Number((distributable/totalShares).toFixed(6)):0;

    await client.query(\`
      INSERT INTO dividend_summaries(
        period_month,total_interest,total_application_form,gross_income,total_shares,
        management_ten_percent,distributable_balance,amount_per_share
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    \`,[c.period_month,totalInterest,totalApplication,gross,totalShares,ten,distributable,perShare]);

    for(const r of rows){
      const dividend=Number((r.shares*perShare).toFixed(2));
      await client.query(
        'INSERT INTO dividend_member_shares(period_month,account_id,username,share_count,dividend_amount) VALUES($1,$2,$3,$4,$5)',
        [c.period_month,r.id,r.username,r.shares,dividend]
      );
    }

    await client.query('COMMIT');
    console.log('DIVIDEND_MONTH_END_SUMMARY',String(c.period_month),totalInterest,totalApplication,totalShares,ten,perShare);
    return {processed:true,periodMonth:c.period_month,totalInterest,totalApplication,totalShares,ten,perShare};
  }catch(error){
    try{await client.query('ROLLBACK');}catch(_){}
    console.error('Dividend month-end calculation failed:',error);
    throw error;
  }finally{client.release();}
}

async function distributePendingDividend(){
  const c=await lagosClock();
  if(!c) return {processed:false,reason:'clock-unavailable'};

  const pending=await pool.query(\`
    SELECT *
    FROM dividend_summaries
    WHERE distributed_at IS NULL
      AND period_month < date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date
    ORDER BY period_month ASC
    LIMIT 1
  \`);
  const summary=pending.rows[0];
  if(!summary) return {processed:false,reason:'none-pending'};

  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const lock=await client.query('SELECT pg_try_advisory_xact_lock(10600000) AS locked');
    if(lock.rows[0]?.locked!==true){await client.query('ROLLBACK');return {processed:false,reason:'locked'};}

    const fresh=await client.query('SELECT * FROM dividend_summaries WHERE period_month=$1 FOR UPDATE',[summary.period_month]);
    if(!fresh.rowCount||fresh.rows[0].distributed_at){await client.query('ROLLBACK');return {processed:false,reason:'already-distributed'};}

    const ten=n(fresh.rows[0].management_ten_percent);
    await client.query(
      'UPDATE cooperative_financials SET management_balance=management_balance+$1,updated_at=NOW() WHERE id=1',
      [ten]
    );

    const memberRows=await client.query(
      'SELECT * FROM dividend_member_shares WHERE period_month=$1 ORDER BY account_id FOR UPDATE',
      [summary.period_month]
    );
    for(const r of memberRows.rows){
      const amount=n(r.dividend_amount);
      if(amount>0){
        await client.query(
          'UPDATE member_balances SET dividend=dividend+$1,updated_at=NOW() WHERE account_id=$2',
          [amount,r.account_id]
        );
        await client.query(
          "INSERT INTO transactions(reference,account_id,transaction_type,destination,amount,status,note,approved_at) VALUES($1,$2,'dividend_credit','DIVIDEND',$3,'completed',$4,NOW())",
          ['DIV-'+String(summary.period_month).slice(0,7).replace('-','')+'-'+r.account_id,r.account_id,amount,'Monthly dividend for '+String(summary.period_month).slice(0,7)]
        );
      }
      await client.query(
        'UPDATE dividend_member_shares SET credited_at=NOW() WHERE period_month=$1 AND account_id=$2',
        [summary.period_month,r.account_id]
      );
    }

    await client.query('UPDATE dividend_summaries SET distributed_at=NOW() WHERE period_month=$1',[summary.period_month]);
    await client.query('COMMIT');
    console.log('DIVIDEND_DISTRIBUTED',String(summary.period_month),ten,memberRows.rowCount);
    return {processed:true,periodMonth:summary.period_month};
  }catch(error){
    try{await client.query('ROLLBACK');}catch(_){}
    console.error('Dividend distribution failed:',error);
    throw error;
  }finally{client.release();}
}

async function processDividendCycle(){
  await calculateDividendMonthEnd();
  await distributePendingDividend();
}

module.exports={processDividendCycle,calculateDividendMonthEnd,distributePendingDividend};
`;
fs.writeFileSync('server/services-dividend.js',service);

/* ---------- Server scheduler ---------- */
let index=fs.readFileSync('server/index.js','utf8');
if(!index.includes("require('./services-dividend')")){
  index=index.replace(
    "const { processManagementMonthEnd } = require('./services-management');",
    "const { processManagementMonthEnd } = require('./services-management');\nconst { processDividendCycle } = require('./services-dividend');"
  );
}
if(!index.includes('DIVIDEND_MONTHLY_SCHEDULER')){
  index=index.replace(
    "try{ await processManagementMonthEnd(); }catch(error){ console.error('Initial management month-end check failed:',error.message); }",
    "try{ await processManagementMonthEnd(); }catch(error){ console.error('Initial management month-end check failed:',error.message); }\n  try{ await processDividendCycle(); }catch(error){ console.error('Initial dividend cycle check failed:',error.message); }"
  );
  index=index.replace(
    "console.log('MANAGEMENT_MONTH_END_SCHEDULER active for 23:55 Africa/Lagos');",
    "console.log('MANAGEMENT_MONTH_END_SCHEDULER active for 23:55 Africa/Lagos');\n    console.log('DIVIDEND_MONTHLY_SCHEDULER active for 23:55 / first-day distribution Africa/Lagos');"
  );
  index=index.replace(
    "processManagementMonthEnd().catch(error=>console.error('Management month-end scheduled check failed:',error.message));",
    "processManagementMonthEnd().catch(error=>console.error('Management month-end scheduled check failed:',error.message));\n    processDividendCycle().catch(error=>console.error('Dividend scheduled check failed:',error.message));"
  );
}
fs.writeFileSync('server/index.js',index);

/* ---------- Admin API ---------- */
let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes("router.get('/dividend-summary'")){
  const marker="router.get('/transactions'";
  const route=`
router.get('/dividend-summary', requireAdminPermission('view_reports'), async (req,res)=>{
  const result=await pool.query(\`
    SELECT period_month,total_interest,total_application_form,gross_income,total_shares,
           management_ten_percent,distributable_balance,amount_per_share,calculated_at,distributed_at
    FROM dividend_summaries
    ORDER BY period_month DESC
    LIMIT 1
  \`);
  res.json({summary:result.rows[0]||null});
});

`;
  if(!admin.includes(marker)){console.error('Stage 107 admin route marker missing');process.exit(1);}
  admin=admin.replace(marker,route+marker);
}
fs.writeFileSync('server/routes/admin.js',admin);

/* ---------- Member API dividend balance ---------- */
let account=fs.readFileSync('server/routes/account.js','utf8');
account=account.replace(
  "b.loan_principal, b.loan_interest, b.loan_due_date, b.flexible_start_date",
  "b.loan_principal, b.loan_interest, b.loan_due_date, b.flexible_start_date, b.dividend"
);
account=account.replace(
  "loanPrincipal: money(row.loan_principal), loanInterest: money(row.loan_interest),",
  "loanPrincipal: money(row.loan_principal), loanInterest: money(row.loan_interest), dividend: money(row.dividend),"
);
fs.writeFileSync('server/routes/account.js',account);

/* ---------- Admin dialog ---------- */
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="dividendSummaryDialog"')){
  const dialog=`
  <dialog id="dividendSummaryDialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>DIVIDEND SUMMARY</h3><button type="button" class="icon-btn" data-close="dividendSummaryDialog" aria-label="Close">×</button></div>
      <div id="dividendSummaryBody"><p class="helper">No monthly dividend summary has been calculated yet.</p></div>
      <p class="form-error" id="dividendSummaryError" role="alert"></p>
    </div>
  </dialog>

`;
  const marker='<dialog id="summaryReportDialog"';
  if(!html.includes(marker)){console.error('Stage 107 dividend dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=107');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=107');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=107');
fs.writeFileSync('www/index.html',html);

/* ---------- Frontend ---------- */
let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes("['DIVIDEND SUMMARY'")){
  const marker="['MANAGEMENT BALANCE', naira(b.managementBalance)],";
  if(!app.includes(marker)){console.error('Stage 107 admin dashboard marker missing');process.exit(1);}
  app=app.replace(marker,marker+"\n    ['DIVIDEND SUMMARY', 'View latest monthly dividend calculation'],");
}
app=app.replace(
  "if (title === 'SUMMARY REPORT') { openSummaryReportDialog(); }",
  "if (title === 'SUMMARY REPORT') { openSummaryReportDialog(); }\n  if (title === 'DIVIDEND SUMMARY') { openDividendSummaryV107(); }"
);

if(!app.includes('async function openDividendSummaryV107')){
  const marker="async function api(path, options = {}) {";
  const fn=`
async function openDividendSummaryV107(){
  const dialog=document.getElementById('dividendSummaryDialog');
  const body=document.getElementById('dividendSummaryBody');
  const error=document.getElementById('dividendSummaryError');
  if(error) error.textContent='';
  if(body) body.innerHTML='<p class="helper">Loading dividend summary…</p>';
  openDialog(dialog);
  try{
    const data=await api('/api/admin/dividend-summary?ts='+Date.now(),{cache:'no-store'});
    const s=data.summary;
    if(!s){
      body.innerHTML='<p class="helper">No monthly dividend summary has been calculated yet.</p>';
      return;
    }
    const month=new Date(String(s.period_month).slice(0,10)+'T12:00:00').toLocaleString('en-US',{month:'long',year:'numeric'}).toUpperCase();
    body.innerHTML=
      '<div class="dashboard-grid">'+
      '<article class="dashboard-card"><h4>MONTH</h4><p>'+escapeHTML(month)+'</p></article>'+
      '<article class="dashboard-card"><h4>TOTAL INTEREST</h4><p>'+naira(s.total_interest)+'</p></article>'+
      '<article class="dashboard-card"><h4>TOTAL APPLICATION FORM</h4><p>'+naira(s.total_application_form)+'</p></article>'+
      '<article class="dashboard-card"><h4>TOTAL NUMBER OF SHARES</h4><p>'+Number(s.total_shares||0).toLocaleString('en-NG')+'</p></article>'+
      '<article class="dashboard-card"><h4>10%</h4><p>'+naira(s.management_ten_percent)+'</p></article>'+
      '<article class="dashboard-card"><h4>AMOUNT PER SHARE</h4><p>'+naira(s.amount_per_share)+'</p></article>'+
      '</div>'+
      '<p class="helper">'+(s.distributed_at?'Distributed to members and Management Balance.':'Calculated and retained pending first-day distribution.')+'</p>';
  }catch(err){
    body.innerHTML='';
    if(error) error.textContent=err.message;
  }
}

`;
  if(!app.includes(marker)){console.error('Stage 107 api marker missing');process.exit(1);}
  app=app.replace(marker,fn+marker);
}

app=app.replace(
  "[tmcsMonthName(-1)+' DIVIDEND', 'Not calculated yet']",
  "[tmcsMonthName(-1)+' DIVIDEND', naira(b.dividend)]"
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=107'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v107';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 107 monthly dividend summary and distribution engine applied.');