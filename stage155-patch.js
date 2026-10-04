const fs=require('fs');

let account=fs.readFileSync('server/routes/account.js','utf8');

/* Replace previous-month shares source: no longer MEMBERSHIP CARD money */
const oldPrevQuery="SELECT destination,COALESCE(SUM(amount),0) AS total FROM transactions WHERE status IN ('approved','completed') AND transaction_type='cash_credit' AND destination IN ('APPLICATION FORM','FLEXIBLE CARD','MEMBERSHIP CARD') AND COALESCE(approved_at,created_at) >= date_trunc('month',(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') - INTERVAL '1 month') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') GROUP BY destination";
const newPrevQuery="SELECT destination,COALESCE(SUM(amount),0) AS total FROM transactions WHERE status IN ('approved','completed') AND transaction_type='cash_credit' AND destination IN ('APPLICATION FORM','FLEXIBLE CARD') AND COALESCE(approved_at,created_at) >= date_trunc('month',(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') - INTERVAL '1 month') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') GROUP BY destination";
if(!account.includes(oldPrevQuery)){console.error('Stage 155 previous-month fee query marker missing');process.exit(1);}
account=account.replace(oldPrevQuery,newPrevQuery);

const oldAssign="adminFeeTotals.previousMonthShares=previousMap['MEMBERSHIP CARD']||0;";
const newAssign=`const previousMonthSavingsResult=await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE status IN ('approved','completed') AND destination IN ('REGULAR','TARGET','CONSTANT','WELFARE') AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND COALESCE(approved_at,created_at) >= date_trunc('month',(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos') - INTERVAL '1 month') AND COALESCE(approved_at,created_at) < date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')"
    );
    const previousMonthSavings=money(previousMonthSavingsResult.rows[0]?.total);
    adminFeeTotals.previousMonthShares=Math.floor(previousMonthSavings/minimumSharePerMonth);`;
if(!account.includes(oldAssign)){console.error('Stage 155 previous shares assignment marker missing');process.exit(1);}
account=account.replace(oldAssign,newAssign);

fs.writeFileSync('server/routes/account.js',account);

let app=fs.readFileSync('www/app.js','utf8');

const oldCurrent="[tmcsMonthName(0).slice(0,3)+' SHARES',naira(b.membershipCard)],";
const newCurrent="[tmcsMonthName(0).slice(0,3)+' SHARES',String(Number(b.numberOfShares||0))],";
if(!app.includes(oldCurrent)){console.error('Stage 155 current shares tile marker missing');process.exit(1);}
app=app.replace(oldCurrent,newCurrent);

const oldPrevious="[tmcsMonthName(-1).slice(0,3)+' SHARES',naira(b.previousMonthShares)]";
const newPrevious="[tmcsMonthName(-1).slice(0,3)+' SHARES',String(Number(b.previousMonthShares||0))]";
if(!app.includes(oldPrevious)){console.error('Stage 155 previous shares tile marker missing');process.exit(1);}
app=app.replace(oldPrevious,newPrevious);

app=app.replace("serviceWorker.register('./sw.js?v=154'","serviceWorker.register('./sw.js?v=155'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=155');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=155');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=155');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v155';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 155 share-count correction applied.');
