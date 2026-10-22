const fs=require('fs');

/*
 * Stage 255: harden monthly dividend eligibility.
 * User clarified that the recent numeric entries were test figures; keep that
 * context explicit and do not interpret the observed test income as real income.
 * Count all savings-credit transaction types used by the cooperative ledger.
 * Do not post management or member credits if a month has no eligible shares.
 * Permit a zero-share snapshot to be refreshed until the cycle is financially posted.
 */
require('./stage186-patch.js');

const servicePath='server/services-dividend-v186.js';
let service=fs.readFileSync(servicePath,'utf8');
service=service.replaceAll(
  "IN ('cash_credit','bank_transfer','flexible_transfer_in')",
  "IN ('cash_credit','bank_transfer','flexible_transfer_in','advance_saving','advance_cash_credit')"
);

const oldSnapshotCheck="const existing=await client.query('SELECT snapshot_at FROM dividend_summaries WHERE period_month=$1 FOR UPDATE',[periodMonth]);\n    if(existing.rows[0]?.snapshot_at){await client.query('ROLLBACK');return {processed:false,reason:'already-snapshotted'};}";
const newSnapshotCheck="const existing=await client.query('SELECT snapshot_at,total_shares,management_credited_at FROM dividend_summaries WHERE period_month=$1 FOR UPDATE',[periodMonth]);\n    if(existing.rows[0]?.snapshot_at && (Number(existing.rows[0]?.total_shares||0)>0 || existing.rows[0]?.management_credited_at)){\n      await client.query('ROLLBACK');return {processed:false,reason:'already-snapshotted'};\n    }\n    // A prior zero-share snapshot is provisional; refresh it until a financial credit is posted.";
if(service.includes(oldSnapshotCheck)){
  service=service.replace(oldSnapshotCheck,newSnapshotCheck);
}else if(!service.includes("A prior zero-share snapshot is provisional")){
  throw new Error('Stage 255: snapshot idempotency guard not found.');
}

const oldShares="const shares=Number(s.rows[0].total_shares||0);\n    const perShare=shares>0?Number((ninety/shares).toFixed(6)):0;";
const newShares="const shares=Number(s.rows[0].total_shares||0);\n    if(shares<=0){\n      await client.query('ROLLBACK');\n      console.log('DIVIDEND_V255_HELD_NO_ELIGIBLE_SHARES',periodMonth,'test figures are not treated as member income');\n      return {processed:false,periodMonth,reason:'no-eligible-shares',application,interest,gross};\n    }\n    const perShare=Number((ninety/shares).toFixed(6));";
if(service.includes(oldShares)){
  service=service.replace(oldShares,newShares);
}else if(!service.includes('DIVIDEND_V255_HELD_NO_ELIGIBLE_SHARES')){
  throw new Error('Stage 255: no-share management-credit guard marker not found.');
}
fs.writeFileSync(servicePath,service);

/* Keep the Admin current-month share preview aligned with the snapshot's eligible transaction types. */
const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
admin=admin.replaceAll(
  "IN ('cash_credit','bank_transfer','flexible_transfer_in')",
  "IN ('cash_credit','bank_transfer','flexible_transfer_in','advance_saving','advance_cash_credit')"
);
fs.writeFileSync(adminPath,admin);

/* Bump browser assets after Stage 186 rewrites them. */
let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=255'");
fs.writeFileSync('www/app.js',app);
let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=255')
         .replace(/styles\.css\?v=\d+/g,'styles.css?v=255')
         .replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=255');
fs.writeFileSync('www/index.html',html);
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v255';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 255: savings-credit types aligned; zero-share cycles held safely; test figures explicitly treated as test data.');
