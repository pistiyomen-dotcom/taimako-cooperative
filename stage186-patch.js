const fs=require('fs');

/* ---------- Schema for the new dividend engine ---------- */
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS dividend_member_type_shares')){
  const add=`
ALTER TABLE dividend_summaries ADD COLUMN IF NOT EXISTS total_savings NUMERIC(16,2) NOT NULL DEFAULT 0;
ALTER TABLE dividend_summaries ADD COLUMN IF NOT EXISTS minimum_share NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE dividend_summaries ADD COLUMN IF NOT EXISTS snapshot_at TIMESTAMPTZ;
ALTER TABLE dividend_summaries ADD COLUMN IF NOT EXISTS management_credited_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS dividend_member_type_shares (
  period_month DATE NOT NULL REFERENCES dividend_summaries(period_month) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  username VARCHAR(32) NOT NULL,
  savings_type VARCHAR(20) NOT NULL CHECK (savings_type IN ('REGULAR','TARGET','CONSTANT','WELFARE')),
  savings_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  share_count BIGINT NOT NULL DEFAULT 0,
  dividend_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  credited_at TIMESTAMPTZ,
  PRIMARY KEY(period_month,account_id,savings_type)
);
CREATE INDEX IF NOT EXISTS idx_dividend_type_member ON dividend_member_type_shares(account_id,savings_type,period_month);
`;
  schema=schema.replace('\nCOMMIT;',add+'\nCOMMIT;');
}
fs.writeFileSync('server/db/schema.sql',schema);

/* ---------- Service ---------- */
const service="const pool=require('./db/pool');\n\nfunction n(v){return Number(v||0);}\nfunction money(v){return Number(n(v).toFixed(2));}\n\nfunction lagosNow(){\n  const parts=new Intl.DateTimeFormat('en-GB',{\n    timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit',\n    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'\n  }).formatToParts(new Date());\n  const m=Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));\n  return {year:Number(m.year),month:Number(m.month),day:Number(m.day),hour:Number(m.hour),minute:Number(m.minute),second:Number(m.second)};\n}\nfunction periodKey(y,m){return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-01';}\nfunction previousPeriod(c){\n  let y=c.year,m=c.month-1;\n  if(m===0){m=12;y--;}\n  return periodKey(y,m);\n}\nfunction currentPeriod(c){return periodKey(c.year,c.month);}\nfunction lastDayOfMonth(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate();}\n\nasync function minimumShare(client=pool){\n  const r=await client.query(\"SELECT numeric_value FROM cooperative_settings WHERE setting_key='minimum_share_per_month'\");\n  return n(r.rows[0]?.numeric_value)||5000;\n}\n\nasync function snapshotPeriod(periodMonth){\n  const client=await pool.connect();\n  try{\n    await client.query('BEGIN');\n    const lock=await client.query(\"SELECT pg_try_advisory_xact_lock(hashtext('tmcs-dividend-snapshot-'||$1::text)) AS locked\",[periodMonth]);\n    if(lock.rows[0]?.locked!==true){await client.query('ROLLBACK');return {processed:false,reason:'locked'};}\n\n    const existing=await client.query('SELECT snapshot_at FROM dividend_summaries WHERE period_month=$1 FOR UPDATE',[periodMonth]);\n    if(existing.rows[0]?.snapshot_at){await client.query('ROLLBACK');return {processed:false,reason:'already-snapshotted'};}\n\n    const minShare=await minimumShare(client);\n    const rows=await client.query(\n      \"SELECT a.id AS account_id,a.username,t.destination AS savings_type,COALESCE(SUM(t.amount),0) AS savings_amount \"+\n      \"FROM accounts a JOIN transactions t ON t.account_id=a.id \"+\n      \"WHERE a.role='regular' AND a.is_active=TRUE AND t.status IN ('approved','completed') \"+\n      \"AND t.destination IN ('REGULAR','TARGET','CONSTANT','WELFARE') \"+\n      \"AND t.transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') \"+\n      \"AND COALESCE(t.approved_at,t.created_at) >= $1::date \"+\n      \"AND COALESCE(t.approved_at,t.created_at) < ($1::date + INTERVAL '1 month') \"+\n      \"GROUP BY a.id,a.username,t.destination ORDER BY a.id,t.destination\",\n      [periodMonth]\n    );\n\n    let totalSavings=0,totalShares=0;\n    await client.query('DELETE FROM dividend_member_type_shares WHERE period_month=$1',[periodMonth]);\n    for(const r of rows.rows){\n      const amount=money(r.savings_amount);\n      const shares=minShare>0?Math.floor(amount/minShare):0;\n      totalSavings=money(totalSavings+amount);\n      totalShares+=shares;\n      await client.query(\n        \"INSERT INTO dividend_member_type_shares(period_month,account_id,username,savings_type,savings_amount,share_count) VALUES($1,$2,$3,$4,$5,$6)\",\n        [periodMonth,r.account_id,r.username,r.savings_type,amount,shares]\n      );\n    }\n\n    await client.query(\n      \"INSERT INTO dividend_summaries(period_month,total_savings,minimum_share,total_shares,snapshot_at,total_interest,total_application_form,gross_income,management_ten_percent,distributable_balance,amount_per_share) \"+\n      \"VALUES($1,$2,$3,$4,NOW(),0,0,0,0,0,0) \"+\n      \"ON CONFLICT(period_month) DO UPDATE SET total_savings=EXCLUDED.total_savings,minimum_share=EXCLUDED.minimum_share,total_shares=EXCLUDED.total_shares,snapshot_at=NOW()\",\n      [periodMonth,totalSavings,minShare,totalShares]\n    );\n\n    await client.query('COMMIT');\n    console.log('DIVIDEND_V186_SNAPSHOT',periodMonth,totalSavings,totalShares);\n    return {processed:true,periodMonth,totalSavings,totalShares};\n  }catch(error){\n    try{await client.query('ROLLBACK');}catch(_){}\n    throw error;\n  }finally{client.release();}\n}\n\nasync function calculateIncomeAndManagement(periodMonth){\n  const client=await pool.connect();\n  try{\n    await client.query('BEGIN');\n    const lock=await client.query(\"SELECT pg_try_advisory_xact_lock(hashtext('tmcs-dividend-income-'||$1::text)) AS locked\",[periodMonth]);\n    if(lock.rows[0]?.locked!==true){await client.query('ROLLBACK');return {processed:false,reason:'locked'};}\n\n    let s=await client.query('SELECT * FROM dividend_summaries WHERE period_month=$1 FOR UPDATE',[periodMonth]);\n    if(!s.rowCount || !s.rows[0].snapshot_at){\n      await client.query('ROLLBACK');\n      await snapshotPeriod(periodMonth);\n      return calculateIncomeAndManagement(periodMonth);\n    }\n    if(s.rows[0].management_credited_at){await client.query('ROLLBACK');return {processed:false,reason:'already-calculated'};}\n\n    const income=await client.query(\n      \"SELECT COALESCE(SUM(CASE WHEN destination='APPLICATION FORM' THEN amount ELSE 0 END),0) AS application_form,\"+\n      \"COALESCE(SUM(CASE WHEN destination='INTEREST' THEN amount ELSE 0 END),0) AS interest \"+\n      \"FROM transactions WHERE status IN ('approved','completed') AND destination IN ('APPLICATION FORM','INTEREST') \"+\n      \"AND COALESCE(approved_at,created_at) >= $1::date AND COALESCE(approved_at,created_at) < ($1::date + INTERVAL '1 month')\",\n      [periodMonth]\n    );\n\n    const application=money(income.rows[0]?.application_form);\n    const interest=money(income.rows[0]?.interest);\n    const gross=money(application+interest);\n    const ten=money(gross*0.10);\n    const ninety=money(gross-ten);\n    const shares=Number(s.rows[0].total_shares||0);\n    const perShare=shares>0?Number((ninety/shares).toFixed(6)):0;\n\n    const managementUpdate=await client.query(\n      'UPDATE cooperative_financials SET management_balance=management_balance+$1,updated_at=NOW() WHERE id=1',\n      [ten]\n    );\n    if(!managementUpdate.rowCount) throw new Error('Management Balance record not found.');\n\n    await client.query(\n      \"UPDATE dividend_summaries SET total_interest=$2,total_application_form=$3,gross_income=$4,management_ten_percent=$5,distributable_balance=$6,amount_per_share=$7,calculated_at=NOW(),management_credited_at=NOW() WHERE period_month=$1\",\n      [periodMonth,interest,application,gross,ten,ninety,perShare]\n    );\n\n    await client.query('COMMIT');\n    console.log('DIVIDEND_V186_0001',periodMonth,application,interest,ten,perShare);\n    return {processed:true,periodMonth,application,interest,ten,ninety,perShare};\n  }catch(error){\n    try{await client.query('ROLLBACK');}catch(_){}\n    throw error;\n  }finally{client.release();}\n}\n\nasync function distributeTypeDividends(periodMonth){\n  const client=await pool.connect();\n  try{\n    await client.query('BEGIN');\n    const lock=await client.query(\"SELECT pg_try_advisory_xact_lock(hashtext('tmcs-dividend-distribute-'||$1::text)) AS locked\",[periodMonth]);\n    if(lock.rows[0]?.locked!==true){await client.query('ROLLBACK');return {processed:false,reason:'locked'};}\n\n    const summary=await client.query('SELECT * FROM dividend_summaries WHERE period_month=$1 FOR UPDATE',[periodMonth]);\n    if(!summary.rowCount||!summary.rows[0].management_credited_at){await client.query('ROLLBACK');return {processed:false,reason:'income-not-calculated'};}\n    if(summary.rows[0].distributed_at){await client.query('ROLLBACK');return {processed:false,reason:'already-distributed'};}\n\n    const perShare=n(summary.rows[0].amount_per_share);\n    const rows=await client.query(\n      'SELECT * FROM dividend_member_type_shares WHERE period_month=$1 ORDER BY account_id,savings_type FOR UPDATE',\n      [periodMonth]\n    );\n\n    const memberTotals=new Map();\n    for(const r of rows.rows){\n      const amount=money(Number(r.share_count||0)*perShare);\n      await client.query(\n        'UPDATE dividend_member_type_shares SET dividend_amount=$1,credited_at=NOW() WHERE period_month=$2 AND account_id=$3 AND savings_type=$4',\n        [amount,periodMonth,r.account_id,r.savings_type]\n      );\n      if(amount>0) memberTotals.set(String(r.account_id),money((memberTotals.get(String(r.account_id))||0)+amount));\n    }\n\n    for(const [accountId,total] of memberTotals.entries()){\n      await client.query('UPDATE member_balances SET dividend=dividend+$1,updated_at=NOW() WHERE account_id=$2',[total,accountId]);\n      await client.query(\n        \"INSERT INTO transactions(reference,account_id,transaction_type,destination,amount,status,note,approved_at) VALUES($1,$2,'dividend_credit','DIVIDEND',$3,'completed',$4,NOW()) ON CONFLICT(reference) DO NOTHING\",\n        ['DIV-'+String(periodMonth).slice(0,7).replace('-','')+'-'+accountId,accountId,total,'Monthly dividend for '+String(periodMonth).slice(0,7)]\n      );\n    }\n\n    await client.query('UPDATE dividend_summaries SET distributed_at=NOW() WHERE period_month=$1',[periodMonth]);\n    await client.query('COMMIT');\n    console.log('DIVIDEND_V186_0002',periodMonth,rows.rowCount,memberTotals.size);\n    return {processed:true,periodMonth};\n  }catch(error){\n    try{await client.query('ROLLBACK');}catch(_){}\n    throw error;\n  }finally{client.release();}\n}\n\nasync function processDividendCycleV186(catchUp=false){\n  const c=lagosNow();\n  const previous=previousPeriod(c);\n\n  if(catchUp){\n    const previousSummary=await pool.query('SELECT snapshot_at,management_credited_at,distributed_at FROM dividend_summaries WHERE period_month=$1',[previous]);\n    if(!previousSummary.rows[0]?.snapshot_at) await snapshotPeriod(previous);\n    if(!previousSummary.rows[0]?.management_credited_at) await calculateIncomeAndManagement(previous);\n    const refreshed=await pool.query('SELECT distributed_at FROM dividend_summaries WHERE period_month=$1',[previous]);\n    if(!refreshed.rows[0]?.distributed_at) await distributeTypeDividends(previous);\n    return;\n  }\n\n  const lastDay=lastDayOfMonth(c.year,c.month);\n  if(c.day===lastDay && c.hour===23 && c.minute===59 && c.second>=59){\n    await snapshotPeriod(currentPeriod(c));\n  }\n\n  if(c.day===1 && c.hour===0 && c.minute===1){\n    const check=await pool.query('SELECT snapshot_at FROM dividend_summaries WHERE period_month=$1',[previous]);\n    if(!check.rows[0]?.snapshot_at) await snapshotPeriod(previous);\n    await calculateIncomeAndManagement(previous);\n  }\n\n  if(c.day===1 && c.hour===0 && c.minute===2){\n    await distributeTypeDividends(previous);\n  }\n}\n\nmodule.exports={processDividendCycleV186,snapshotPeriod,calculateIncomeAndManagement,distributeTypeDividends};\n";
fs.writeFileSync('server/services-dividend-v186.js',service);

/* ---------- Scheduler ---------- */
let index=fs.readFileSync('server/index.js','utf8');
if(!index.includes("require('./services-dividend-v186')")){
  const importMarker="const { processDividendCycle } = require('./services-dividend');";
  if(index.includes(importMarker)) index=index.replace(importMarker,importMarker+"\nconst { processDividendCycleV186 } = require('./services-dividend-v186');");
  else {
    const fallback="const { processManagementMonthEnd } = require('./services-management');";
    if(!index.includes(fallback)){console.error('Stage 186 scheduler import marker missing');process.exit(1);}
    index=index.replace(fallback,fallback+"\nconst { processDividendCycleV186 } = require('./services-dividend-v186');");
  }
}
if(!index.includes('DIVIDEND_V186_SCHEDULER')){
  const startMarker="try{ await processManagementMonthEnd(); }catch(error){ console.error('Initial management month-end check failed:',error.message); }";
  if(!index.includes(startMarker)){console.error('Stage 186 startup marker missing');process.exit(1);}
  index=index.replace(startMarker,startMarker+"\n  try{ await processDividendCycleV186(true); }catch(error){ console.error('Initial new dividend cycle check failed:',error.message); }");
  const listenMarker="console.log('MANAGEMENT_MONTH_END_SCHEDULER active for 23:55 Africa/Lagos');";
  if(index.includes(listenMarker)) index=index.replace(listenMarker,listenMarker+"\n    console.log('DIVIDEND_V186_SCHEDULER active for 23:59:59 / 00:01 / 00:02 Africa/Lagos');");
  const intervalMarker="  setInterval(()=>{";
  const pos=index.lastIndexOf(intervalMarker);
  if(pos<0){console.error('Stage 186 interval marker missing');process.exit(1);}
  index=index.slice(0,pos)+"  setInterval(()=>{ processDividendCycleV186(false).catch(error=>console.error('New dividend scheduled check failed:',error.message)); },1000);\n\n"+index.slice(pos);
}
fs.writeFileSync('server/index.js',index);

/* ---------- Admin DIVIDEND SUMMARY API ---------- */
let admin=fs.readFileSync('server/routes/admin.js','utf8');
const routeStart=admin.indexOf("router.get('/dividend-summary'");
if(routeStart<0){console.error('Stage 186 dividend summary route missing');process.exit(1);}
const routeEnd=admin.indexOf('\nrouter.',routeStart+10);
const routeStop=routeEnd>routeStart?routeEnd:admin.length;
const route=`router.get('/dividend-summary', requireAdminPermission('view_reports'), async (_req,res)=>{
  const settings=await pool.query("SELECT numeric_value FROM cooperative_settings WHERE setting_key='minimum_share_per_month'");
  const minimumShare=Number(settings.rows[0]?.numeric_value||5000);
  const current=await pool.query(
    "SELECT COALESCE(SUM(t.amount),0) AS total_savings FROM accounts a JOIN transactions t ON t.account_id=a.id WHERE a.role='regular' AND a.is_active=TRUE AND t.status IN ('approved','completed') AND t.destination IN ('REGULAR','TARGET','CONSTANT','WELFARE') AND t.transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND COALESCE(t.approved_at,t.created_at)>=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') AND COALESCE(t.approved_at,t.created_at)<date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')+INTERVAL '1 month'"
  );
  const currentTypes=await pool.query(
    "SELECT t.account_id,t.destination,COALESCE(SUM(t.amount),0) AS amount FROM accounts a JOIN transactions t ON t.account_id=a.id WHERE a.role='regular' AND a.is_active=TRUE AND t.status IN ('approved','completed') AND t.destination IN ('REGULAR','TARGET','CONSTANT','WELFARE') AND t.transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND COALESCE(t.approved_at,t.created_at)>=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') AND COALESCE(t.approved_at,t.created_at)<date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')+INTERVAL '1 month' GROUP BY t.account_id,t.destination"
  );
  const totalSavings=Number(current.rows[0]?.total_savings||0);
  const totalShares=currentTypes.rows.reduce((sum,r)=>sum+(minimumShare>0?Math.floor(Number(r.amount||0)/minimumShare):0),0);
  const previous=await pool.query("SELECT period_month,total_savings,minimum_share,total_shares,total_interest,total_application_form,gross_income,management_ten_percent,distributable_balance,amount_per_share,snapshot_at,management_credited_at,distributed_at FROM dividend_summaries WHERE period_month < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date ORDER BY period_month DESC LIMIT 1");
  res.json({current:{periodMonth:new Date().toISOString(),totalSavings,minimumShare,totalShares},previous:previous.rows[0]||null});
});
`;
admin=admin.slice(0,routeStart)+route+admin.slice(routeStop);
fs.writeFileSync('server/routes/admin.js',admin);

/* ---------- Member savings-type dividend values ---------- */
let account=fs.readFileSync('server/routes/account.js','utf8');
if(!account.includes('dividendTypeCreditsV186')){
  const marker="  const savingsTypeBreakdownV169={};";
  if(!account.includes(marker)){console.error('Stage 186 member savings marker missing');process.exit(1);}
  const code=`  const dividendTypeCreditsV186=await pool.query(
    "SELECT savings_type,COALESCE(SUM(CASE WHEN credited_at IS NOT NULL THEN dividend_amount ELSE 0 END),0) AS dividend_balance,COALESCE(SUM(CASE WHEN period_month=date_trunc('month',CURRENT_DATE-INTERVAL '1 month')::date AND credited_at IS NOT NULL THEN dividend_amount ELSE 0 END),0) AS previous_dividend FROM dividend_member_type_shares WHERE account_id=$1 GROUP BY savings_type",
    [req.auth.sub]
  );
  const dividendTypeMapV186=Object.fromEntries(dividendTypeCreditsV186.rows.map(r=>[r.savings_type,{balance:money(r.dividend_balance),previous:money(r.previous_dividend)}]));
`;
  account=account.replace(marker,code+marker);
  const oldBreakdown="savingsTypeBreakdownV169[type]={currentMonthSavings:monthly.current,numberOfShares:currentShares,previousMonthSavings:monthly.previous,previousMonthShares:previousSharesByType[type]||0,previousMonthDividend:previousDividend,totalBalance:typeBalanceMap[type]||0,dividendBalance:Number((dividendBalanceByTypeV171[type]||0).toFixed(2))};";
  const newBreakdown="savingsTypeBreakdownV169[type]={currentMonthSavings:monthly.current,numberOfShares:currentShares,previousMonthSavings:monthly.previous,previousMonthShares:previousSharesByType[type]||0,previousMonthDividend:(dividendTypeMapV186[type]&&dividendTypeMapV186[type].previous!==undefined?dividendTypeMapV186[type].previous:previousDividend),totalBalance:typeBalanceMap[type]||0,dividendBalance:(dividendTypeMapV186[type]&&dividendTypeMapV186[type].balance!==undefined?dividendTypeMapV186[type].balance:Number((dividendBalanceByTypeV171[type]||0).toFixed(2)))};";
  if(!account.includes(oldBreakdown)){console.error('Stage 186 member breakdown object marker missing');process.exit(1);}
  account=account.replace(oldBreakdown,newBreakdown);
}
fs.writeFileSync('server/routes/account.js',account);

/* ---------- Admin UI override ---------- */
let app=fs.readFileSync('www/app.js','utf8');
app += `
\n/* Stage 186 new Dividend Summary */
window.openDividendSummaryV107=async function(){
  const dialog=document.getElementById('dividendSummaryDialog');
  const body=document.getElementById('dividendSummaryBody');
  const error=document.getElementById('dividendSummaryError');
  if(error) error.textContent='';
  if(body) body.innerHTML='<p class="helper">Loading dividend summary…</p>';
  openDialog(dialog);
  try{
    const data=await api('/api/admin/dividend-summary?ts='+Date.now(),{cache:'no-store'});
    const c=data.current||{}; const p=data.previous;
    const currentMonth=new Date().toLocaleString('en-US',{month:'long',year:'numeric'}).toUpperCase();
    let html='<div class="dashboard-grid">'+
      '<article class="dashboard-card"><h4>CURRENT MONTH</h4><p>'+escapeHTML(currentMonth)+'</p></article>'+
      '<article class="dashboard-card"><h4>TOTAL SAVINGS</h4><p>'+naira(c.totalSavings||0)+'</p></article>'+
      '<article class="dashboard-card"><h4>MINIMUM SHARE</h4><p>'+naira(c.minimumShare||0)+'</p></article>'+
      '<article class="dashboard-card"><h4>NUMBER OF SHARES</h4><p>'+Number(c.totalShares||0).toLocaleString('en-NG')+'</p></article>'+
      '</div>';
    if(p){
      const pm=new Date(String(p.period_month).slice(0,10)+'T12:00:00').toLocaleString('en-US',{month:'long',year:'numeric'}).toUpperCase();
      html+='<h4 style="margin-top:18px">'+escapeHTML(pm)+' DIVIDEND CYCLE</h4><div class="dashboard-grid">'+
        '<article class="dashboard-card"><h4>PREVIOUS MONTH SAVINGS</h4><p>'+naira(p.total_savings||0)+'</p></article>'+
        '<article class="dashboard-card"><h4>PREVIOUS MONTH SHARES</h4><p>'+Number(p.total_shares||0).toLocaleString('en-NG')+'</p></article>'+
        '<article class="dashboard-card"><h4>APPLICATION FORM</h4><p>'+naira(p.total_application_form||0)+'</p></article>'+
        '<article class="dashboard-card"><h4>INTEREST</h4><p>'+naira(p.total_interest||0)+'</p></article>'+
        '<article class="dashboard-card"><h4>10% MANAGEMENT</h4><p>'+naira(p.management_ten_percent||0)+'</p></article>'+
        '<article class="dashboard-card"><h4>90% DIVIDEND</h4><p>'+naira(p.distributable_balance||0)+'</p></article>'+
        '<article class="dashboard-card"><h4>DIVIDEND PER SHARE</h4><p>'+naira(p.amount_per_share||0)+'</p></article>'+
        '</div>';
    }
    if(body) body.innerHTML=html;
  }catch(e){if(body) body.innerHTML='';if(error) error.textContent=e.message;}
};
`;
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=186'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=186');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=186');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=186');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v186';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 186 new dividend cycle applied.');