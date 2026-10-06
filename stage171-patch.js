const fs=require('fs');

let account=fs.readFileSync('server/routes/account.js','utf8');

if(!account.includes('dividendBalanceByTypeV171')){
  const marker="  const savingsTypeBreakdownV169={};";
  const code=[
    "  const historicalSavingsByTypeResult=await pool.query(",
    "    \"SELECT to_char(date_trunc('month',COALESCE(approved_at,created_at)),'YYYY-MM') AS period_key,destination,COALESCE(SUM(amount),0) AS total \" +",
    "    \"FROM transactions WHERE account_id=$1 AND status IN ('approved','completed') \" +",
    "    \"AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') \" +",
    "    \"AND destination IN ('REGULAR','TARGET','CONSTANT','WELFARE') GROUP BY 1,2\",",
    "    [req.auth.sub]",
    "  );",
    "  const historicalDividendResult=await pool.query(",
    "    \"SELECT substring(note from '([0-9]{4}-[0-9]{2})') AS period_key,COALESCE(SUM(amount),0) AS total \" +",
    "    \"FROM transactions WHERE account_id=$1 AND status IN ('approved','completed') \" +",
    "    \"AND transaction_type='dividend_credit' AND destination='DIVIDEND' GROUP BY 1\",",
    "    [req.auth.sub]",
    "  );",
    "  const monthlySavingsHistory={};",
    "  for(const r of historicalSavingsByTypeResult.rows){",
    "    if(!monthlySavingsHistory[r.period_key]) monthlySavingsHistory[r.period_key]={REGULAR:0,TARGET:0,CONSTANT:0,WELFARE:0};",
    "    monthlySavingsHistory[r.period_key][r.destination]=money(r.total);",
    "  }",
    "  const dividendBalanceByTypeV171={REGULAR:0,TARGET:0,CONSTANT:0,WELFARE:0};",
    "  for(const d of historicalDividendResult.rows){",
    "    const period=d.period_key;",
    "    if(!period) continue;",
    "    const month=monthlySavingsHistory[period]||{REGULAR:0,TARGET:0,CONSTANT:0,WELFARE:0};",
    "    const shares={};",
    "    let totalShares=0;",
    "    for(const type of ['REGULAR','TARGET','CONSTANT','WELFARE']){",
    "      shares[type]=minimumSharePerMonth>0?Math.floor(Number(month[type]||0)/minimumSharePerMonth):0;",
    "      totalShares+=shares[type];",
    "    }",
    "    if(totalShares<=0) continue;",
    "    const dividendTotal=money(d.total);",
    "    for(const type of ['REGULAR','TARGET','CONSTANT','WELFARE']){",
    "      dividendBalanceByTypeV171[type]+=Number((dividendTotal*(shares[type]/totalShares)).toFixed(2));",
    "    }",
    "  }",
    "",
  ].join('\n');
  if(!account.includes(marker)){console.error('Stage 171 savings breakdown marker missing');process.exit(1);}
  account=account.replace(marker,code+marker);

  const oldObj="savingsTypeBreakdownV169[type]={currentMonthSavings:monthly.current,numberOfShares:currentShares,previousMonthSavings:monthly.previous,previousMonthDividend:previousDividend,totalBalance:typeBalanceMap[type]||0};";
  const newObj="savingsTypeBreakdownV169[type]={currentMonthSavings:monthly.current,numberOfShares:currentShares,previousMonthSavings:monthly.previous,previousMonthDividend:previousDividend,totalBalance:typeBalanceMap[type]||0,dividendBalance:Number((dividendBalanceByTypeV171[type]||0).toFixed(2))};";
  if(!account.includes(oldObj)){console.error('Stage 171 savings object marker missing');process.exit(1);}
  account=account.replace(oldObj,newObj);
}
fs.writeFileSync('server/routes/account.js',account);

let app=fs.readFileSync('www/app.js','utf8');
const oldItems="  const items=[[current+' SAVINGS',naira(data.currentMonthSavings||0)],['NUMBER OF SHARES',String(Number(data.numberOfShares||0))],[previous+' SAVINGS',naira(data.previousMonthSavings||0)],[previous+' DIVIDEND',naira(data.previousMonthDividend||0)],['TOTAL BALANCE',naira(data.totalBalance||0)]];";
const newItems="  const items=[[current+' SAVINGS',naira(data.currentMonthSavings||0)],['NUMBER OF SHARES',String(Number(data.numberOfShares||0))],[previous+' SAVINGS',naira(data.previousMonthSavings||0)],[previous+' DIVIDEND',naira(data.previousMonthDividend||0)],[type+' BALANCE',naira(data.totalBalance||0)],['DIVIDEND BALANCE',naira(data.dividendBalance||0)]];";
if(!app.includes(oldItems)){console.error('Stage 171 savings detail items marker missing');process.exit(1);}
app=app.replace(oldItems,newItems);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=171'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=171');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=171');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=171');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v171';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 171 savings account balance labels and dividend balances applied.');