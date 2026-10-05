const fs=require('fs');

let account=fs.readFileSync('server/routes/account.js','utf8');

const oldCurrent=`  const currentMonthSavings = money(currentMonthSavingsResult.rows[0]?.total);
  const cooperativeSettingsResult=await pool.query("SELECT setting_key,numeric_value FROM cooperative_settings WHERE setting_key IN ('minimum_share_per_month','total_registration_fee')");
`;

const newCurrent=`  const currentMonthSavings = money(currentMonthSavingsResult.rows[0]?.total);
  const previousMonthSavingsResult = await pool.query(
    "SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE account_id=$1 AND status IN ('approved','completed') AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND destination IN ('REGULAR','TARGET','CONSTANT','WELFARE') AND COALESCE(approved_at,created_at) >= date_trunc('month',CURRENT_DATE - INTERVAL '1 month') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_DATE)",
    [req.auth.sub]
  );
  const previousMonthSavings = money(previousMonthSavingsResult.rows[0]?.total);
  const cooperativeSettingsResult=await pool.query("SELECT setting_key,numeric_value FROM cooperative_settings WHERE setting_key IN ('minimum_share_per_month','total_registration_fee')");
`;

if(!account.includes(oldCurrent)){console.error('Stage 161 current-month member savings marker missing');process.exit(1);}
account=account.replace(oldCurrent,newCurrent);

const oldResp=`      totalSavings: currentMonthSavings, numberOfShares: Math.floor(currentMonthSavings / minimumSharePerMonth), minimumSharePerMonth, totalRegistrationFee, registrationComplete: totalRegistrationFee > 0 && money(row.registration) >= totalRegistrationFee,
`;

const newResp=`      totalSavings: currentMonthSavings, numberOfShares: Math.floor(currentMonthSavings / minimumSharePerMonth), previousMonthSavings, previousMonthMemberShares: minimumSharePerMonth>0?Math.floor(previousMonthSavings/minimumSharePerMonth):0, minimumSharePerMonth, totalRegistrationFee, registrationComplete: totalRegistrationFee > 0 && money(row.registration) >= totalRegistrationFee,
`;

if(!account.includes(oldResp)){console.error('Stage 161 member response marker missing');process.exit(1);}
account=account.replace(oldResp,newResp);

fs.writeFileSync('server/routes/account.js',account);

let app=fs.readFileSync('www/app.js','utf8');

const oldItems=`    ['TOTAL SAVINGS',naira(totalSavings)],
    [tmcsMonthName(0).slice(0,3)+' SAVINGS',naira(currentMonthSavings)],
    [tmcsMonthName(0).slice(0,3)+' SHARES',String(currentMonthShares)],
    [tmcsMonthName(-1).slice(0,4)+' DIVIDEND',naira(b.dividend)]
`;

const newItems=`    ['TOTAL SAVINGS',naira(totalSavings)],
    [tmcsMonthName(0).slice(0,3)+' SAVINGS',naira(currentMonthSavings)],
    [tmcsMonthName(0).slice(0,3)+' SHARES',String(currentMonthShares)],
    [tmcsMonthName(-1).slice(0,4)+' SAVINGS',naira(b.previousMonthSavings||0)],
    [tmcsMonthName(-1).slice(0,4)+' SHARES',String(Number(b.previousMonthMemberShares||0))],
    [tmcsMonthName(-1).slice(0,4)+' DIVIDEND',naira(b.dividend)]
`;

if(!app.includes(oldItems)){console.error('Stage 161 member BALANCES item marker missing');process.exit(1);}
app=app.replace(oldItems,newItems);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=161'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=161');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=161');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=161');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v161';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 161 member previous-month SAVINGS and SHARES applied.');
