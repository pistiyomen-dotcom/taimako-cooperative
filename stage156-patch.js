const fs=require('fs');

let account=fs.readFileSync('server/routes/account.js','utf8');

const oldPrevBlock=`const previousMonthSavingsResult=await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE status IN ('approved','completed') AND destination IN ('REGULAR','TARGET','CONSTANT','WELFARE') AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND COALESCE(approved_at,created_at) >= date_trunc('month',(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') - INTERVAL '1 month') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')"
    );
    const previousMonthSavings=money(previousMonthSavingsResult.rows[0]?.total);
    adminFeeTotals.previousMonthShares=Math.floor(previousMonthSavings/minimumSharePerMonth);`;

const newPrevBlock=`const monthlySavingsTotalsResult=await pool.query(
      "SELECT COALESCE(SUM(CASE WHEN COALESCE(approved_at,created_at) >= date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') + INTERVAL '1 month' THEN amount ELSE 0 END),0) AS current_total, COALESCE(SUM(CASE WHEN COALESCE(approved_at,created_at) >= date_trunc('month',(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') - INTERVAL '1 month') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') THEN amount ELSE 0 END),0) AS previous_total FROM transactions WHERE status IN ('approved','completed') AND destination IN ('REGULAR','TARGET','CONSTANT','WELFARE') AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND COALESCE(approved_at,created_at) >= date_trunc('month',(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') - INTERVAL '1 month') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') + INTERVAL '1 month'"
    );
    adminFeeTotals.currentMonthTotalSavings=money(monthlySavingsTotalsResult.rows[0]?.current_total);
    adminFeeTotals.previousMonthTotalSavings=money(monthlySavingsTotalsResult.rows[0]?.previous_total);
    adminFeeTotals.currentMonthShares=minimumSharePerMonth>0?Math.floor(adminFeeTotals.currentMonthTotalSavings/minimumSharePerMonth):0;
    adminFeeTotals.previousMonthShares=minimumSharePerMonth>0?Math.floor(adminFeeTotals.previousMonthTotalSavings/minimumSharePerMonth):0;`;

if(!account.includes(oldPrevBlock)){console.error('Stage 156 monthly savings block marker missing');process.exit(1);}
account=account.replace(oldPrevBlock,newPrevBlock);

const oldResp="managementBalance: adminFeeTotals.managementBalance||0, previousMonthProfit: adminFeeTotals.previousMonthProfit||0, previousMonthInterest: adminFeeTotals.previousMonthInterest||0, previousMonthShares: adminFeeTotals.previousMonthShares||0";
const newResp="managementBalance: adminFeeTotals.managementBalance||0, currentMonthTotalSavings: adminFeeTotals.currentMonthTotalSavings||0, previousMonthTotalSavings: adminFeeTotals.previousMonthTotalSavings||0, currentMonthShares: adminFeeTotals.currentMonthShares||0, previousMonthProfit: adminFeeTotals.previousMonthProfit||0, previousMonthInterest: adminFeeTotals.previousMonthInterest||0, previousMonthShares: adminFeeTotals.previousMonthShares||0";
if(!account.includes(oldResp)){console.error('Stage 156 response marker missing');process.exit(1);}
account=account.replace(oldResp,newResp);

fs.writeFileSync('server/routes/account.js',account);

let app=fs.readFileSync('www/app.js','utf8');

const oldCurrentShare="[tmcsMonthName(0).slice(0,3)+' SHARES',String(Number(b.numberOfShares||0))],";
const newCurrentShare="[tmcsMonthName(0).slice(0,3)+' SHARES',String(Number(b.currentMonthShares||0))],";
if(!app.includes(oldCurrentShare)){console.error('Stage 156 current share marker missing');process.exit(1);}
app=app.replace(oldCurrentShare,newCurrentShare);

const oldProfit="[tmcsMonthName(-1).slice(0,3)+' PROFIT',naira(b.previousMonthProfit)],";
const newPrevApp="[(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' APPLICATION FORM',naira(b.previousMonthProfit)],";
if(!app.includes(oldProfit)){console.error('Stage 156 previous application marker missing');process.exit(1);}
app=app.replace(oldProfit,newPrevApp);

const currentMarker="[tmcsMonthName(0).slice(0,3)+' APPLICATION FORM',naira(b.applicationForm)],";
const currentWithSavings="[tmcsMonthName(0).slice(0,3)+' APPLICATION FORM',naira(b.applicationForm)],\n    [tmcsMonthName(0).slice(0,3)+' TOTAL SAVINGS',naira(b.currentMonthTotalSavings)],";
if(!app.includes(currentMarker)){console.error('Stage 156 current application marker missing');process.exit(1);}
app=app.replace(currentMarker,currentWithSavings);

const prevMarker="[(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' APPLICATION FORM',naira(b.previousMonthProfit)],";
const prevWithSavings="[(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' APPLICATION FORM',naira(b.previousMonthProfit)],\n    [(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' TOTAL SAVINGS',naira(b.previousMonthTotalSavings)],";
if(!app.includes(prevMarker)){console.error('Stage 156 previous savings insertion marker missing');process.exit(1);}
app=app.replace(prevMarker,prevWithSavings);

const oldPrevInterest="[tmcsMonthName(-1).slice(0,3)+' INTEREST',naira(b.previousMonthInterest)],";
const newPrevInterest="[(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' INTEREST',naira(b.previousMonthInterest)],";
if(app.includes(oldPrevInterest)) app=app.replace(oldPrevInterest,newPrevInterest);

const oldPrevShares="[tmcsMonthName(-1).slice(0,3)+' SHARES',String(Number(b.previousMonthShares||0))]";
const newPrevShares="[(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' SHARES',String(Number(b.previousMonthShares||0))]";
if(app.includes(oldPrevShares)) app=app.replace(oldPrevShares,newPrevShares);

app=app.replace("serviceWorker.register('./sw.js?v=155'","serviceWorker.register('./sw.js?v=156'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=156');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=156');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=156');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v156';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 156 BALANCES total savings and SEPT application label applied.');
