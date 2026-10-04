const fs=require('fs');

let account=fs.readFileSync('server/routes/account.js','utf8');

const oldInit="let adminFeeTotals={applicationForm:0,flexibleCard:0,membershipCard:0};";
const newInit="let adminFeeTotals={applicationForm:0,flexibleCard:0,membershipCard:0,previousMonthProfit:0,previousMonthInterest:0,previousMonthShares:0};";
if(!account.includes(oldInit)){console.error('Stage 154 admin fee totals init marker missing');process.exit(1);}
account=account.replace(oldInit,newInit);

const oldBlock="    adminFeeTotals={\n      applicationForm:feeMap['APPLICATION FORM']||0,\n      flexibleCard:feeMap['FLEXIBLE CARD']||0,\n      membershipCard:feeMap['MEMBERSHIP CARD']||0\n    };\n    const managementResult=await pool.query('SELECT management_balance FROM cooperative_financials WHERE id=1');";
const newBlock="    adminFeeTotals={\n      applicationForm:feeMap['APPLICATION FORM']||0,\n      flexibleCard:feeMap['FLEXIBLE CARD']||0,\n      membershipCard:feeMap['MEMBERSHIP CARD']||0,\n      previousMonthProfit:0,\n      previousMonthInterest:0,\n      previousMonthShares:0\n    };\n    const previousMonthTotalsResult=await pool.query(\"SELECT destination,COALESCE(SUM(amount),0) AS total FROM transactions WHERE status IN ('approved','completed') AND transaction_type='cash_credit' AND destination IN ('APPLICATION FORM','FLEXIBLE CARD','MEMBERSHIP CARD') AND COALESCE(approved_at,created_at) >= date_trunc('month',(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') - INTERVAL '1 month') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') GROUP BY destination\");\n    const previousMap=Object.fromEntries(previousMonthTotalsResult.rows.map(r=>[r.destination,money(r.total)]));\n    adminFeeTotals.previousMonthProfit=previousMap['APPLICATION FORM']||0;\n    adminFeeTotals.previousMonthInterest=previousMap['FLEXIBLE CARD']||0;\n    adminFeeTotals.previousMonthShares=previousMap['MEMBERSHIP CARD']||0;\n    const managementResult=await pool.query('SELECT management_balance FROM cooperative_financials WHERE id=1');";
if(!account.includes(oldBlock)){console.error('Stage 154 admin fee totals block marker missing');process.exit(1);}
account=account.replace(oldBlock,newBlock);

const oldResponse="applicationForm: adminFeeTotals.applicationForm, flexibleCard: adminFeeTotals.flexibleCard, membershipCard: adminFeeTotals.membershipCard, managementBalance: adminFeeTotals.managementBalance||0";
const newResponse="applicationForm: adminFeeTotals.applicationForm, flexibleCard: adminFeeTotals.flexibleCard, membershipCard: adminFeeTotals.membershipCard, managementBalance: adminFeeTotals.managementBalance||0, previousMonthProfit: adminFeeTotals.previousMonthProfit||0, previousMonthInterest: adminFeeTotals.previousMonthInterest||0, previousMonthShares: adminFeeTotals.previousMonthShares||0";
if(!account.includes(oldResponse)){console.error('Stage 154 account response marker missing');process.exit(1);}
account=account.replace(oldResponse,newResponse);

fs.writeFileSync('server/routes/account.js',account);

let app=fs.readFileSync('www/app.js','utf8');
const oldItems="    [tmcsMonthName(0).slice(0,3)+' APPLICATION FORM',naira(b.applicationForm)],\n    [tmcsMonthName(0).slice(0,3)+' INTEREST',naira(b.flexibleCard)],\n    [tmcsMonthName(0).slice(0,3)+' SHARES',naira(b.membershipCard)],\n    ['MANAGEMENT BALANCE',naira(b.managementBalance)]\n  ];";
const newItems="    [tmcsMonthName(0).slice(0,3)+' APPLICATION FORM',naira(b.applicationForm)],\n    [tmcsMonthName(0).slice(0,3)+' INTEREST',naira(b.flexibleCard)],\n    [tmcsMonthName(0).slice(0,3)+' SHARES',naira(b.membershipCard)],\n    ['MANAGEMENT BALANCE',naira(b.managementBalance)],\n    [tmcsMonthName(-1).slice(0,3)+' PROFIT',naira(b.previousMonthProfit)],\n    [tmcsMonthName(-1).slice(0,3)+' INTEREST',naira(b.previousMonthInterest)],\n    [tmcsMonthName(-1).slice(0,3)+' SHARES',naira(b.previousMonthShares)]\n  ];";
if(!app.includes(oldItems)){console.error('Stage 154 BALANCES items marker missing');process.exit(1);}
app=app.replace(oldItems,newItems);

app=app.replace(/serviceWorker\\.register\\('\\.\\/sw\\.js\\?v=\\d+'/, "serviceWorker.register('./sw.js?v=154'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\\.js\\?v=\\d+/g,'app.js?v=154');
html=html.replace(/styles\\.css\\?v=\\d+/g,'styles.css?v=154');
html=html.replace(/bank-transfer-v129\\.js\\?v=\\d+/g,'bank-transfer-v129.js?v=154');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\\d+';/,"const CACHE = 'taimako-v154';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 154 previous-month PROFIT INTEREST SHARES tiles applied.');