// Stage 237: November savings promotion with 12 monthly bonus shares and repeat-year threshold.
const fs=require('fs');

const promoSql=fs.readFileSync('server/db/november-promo-v237.sql','utf8');
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('tmcs_november_promo_eligibility_v237')){
  if(!schema.includes('\nCOMMIT;')) throw Error('Stage 237 schema insertion point not found.');
  const commitAt=schema.lastIndexOf('\nCOMMIT;');
  schema=schema.slice(0,commitAt)+'\n'+promoSql+'\n'+schema.slice(commitAt);
  fs.writeFileSync('server/db/schema.sql',schema);
}

let account=fs.readFileSync('server/routes/account.js','utf8');
const advanceMapMarker="  const advanceSavingsMapV189=Object.fromEntries(advanceSavingsMonthlyV189.rows.map(r=>[r.savings_type,{currentAmount:money(r.current_amount),currentShares:Number(r.current_shares||0),previousAmount:money(r.previous_amount),previousShares:Number(r.previous_shares||0)}]));";
if(!account.includes('promoSharesMapV237')){
  if(!account.includes(advanceMapMarker)) throw Error('Stage 237 monthly share map insertion point not found.');
  const promoQuery=[
    "  const promoSharesMonthlyV237=await pool.query(",
    "    \"SELECT savings_type,\"+",
    "    \"COALESCE(SUM(CASE WHEN period_month=date_trunc('month',CURRENT_DATE)::date THEN share_count ELSE 0 END),0) AS current_shares,\"+",
    "    \"COALESCE(SUM(CASE WHEN period_month=date_trunc('month',CURRENT_DATE-INTERVAL '1 month')::date THEN share_count ELSE 0 END),0) AS previous_shares \"+",
    "    \"FROM tmcs_november_promo_share_allocations_v237 WHERE account_id=$1 AND period_month IN (date_trunc('month',CURRENT_DATE)::date,date_trunc('month',CURRENT_DATE-INTERVAL '1 month')::date) GROUP BY savings_type\",",
    "    [req.auth.sub]",
    "  );",
    "  const promoSharesMapV237=Object.fromEntries(promoSharesMonthlyV237.rows.map(r=>[r.savings_type,{currentShares:Number(r.current_shares||0),previousShares:Number(r.previous_shares||0)}]));"
  ].join('\n');
  account=account.replace(advanceMapMarker,advanceMapMarker+'\n'+promoQuery);
}

const oldPrevious="    const advance=advanceSavingsMapV189[type]||{previousAmount:0,previousShares:0}; const previousShares=(minimumSharePerMonth>0?Math.floor(Math.max(0,monthly.previous-advance.previousAmount)/minimumSharePerMonth):0)+advance.previousShares;";
const newPrevious="    const advance=advanceSavingsMapV189[type]||{previousAmount:0,previousShares:0}; const promoPrevious=promoSharesMapV237[type]||{previousShares:0}; const previousShares=(minimumSharePerMonth>0?Math.floor(Math.max(0,monthly.previous-advance.previousAmount)/minimumSharePerMonth):0)+advance.previousShares+promoPrevious.previousShares;";
if(account.includes(oldPrevious)) account=account.replace(oldPrevious,newPrevious);
else if(!account.includes(newPrevious)) throw Error('Stage 237 previous shares calculation marker missing.');

const oldCurrent="    const advance=advanceSavingsMapV189[type]||{currentAmount:0,currentShares:0}; const currentShares=(minimumSharePerMonth>0?Math.floor(Math.max(0,monthly.current-advance.currentAmount)/minimumSharePerMonth):0)+advance.currentShares;";
const newCurrent="    const advance=advanceSavingsMapV189[type]||{currentAmount:0,currentShares:0}; const promoCurrent=promoSharesMapV237[type]||{currentShares:0}; const currentShares=(minimumSharePerMonth>0?Math.floor(Math.max(0,monthly.current-advance.currentAmount)/minimumSharePerMonth):0)+advance.currentShares+promoCurrent.currentShares;";
if(account.includes(oldCurrent)) account=account.replace(oldCurrent,newCurrent);
else if(!account.includes(newCurrent)) throw Error('Stage 237 current shares calculation marker missing.');
fs.writeFileSync('server/routes/account.js',account);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=237');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=237');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=237');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=237');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=237'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v237';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 237 November promo shares applied; actual savings remain in the payment month.');
