const fs=require('fs');

/* Expose previous-month shares per savings type */
let account=fs.readFileSync('server/routes/account.js','utf8');

const oldObj="savingsTypeBreakdownV169[type]={currentMonthSavings:monthly.current,numberOfShares:currentShares,previousMonthSavings:monthly.previous,previousMonthDividend:previousDividend,totalBalance:typeBalanceMap[type]||0,dividendBalance:Number((dividendBalanceByTypeV171[type]||0).toFixed(2))};";
const newObj="savingsTypeBreakdownV169[type]={currentMonthSavings:monthly.current,numberOfShares:currentShares,previousMonthSavings:monthly.previous,previousMonthShares:previousSharesByType[type]||0,previousMonthDividend:previousDividend,totalBalance:typeBalanceMap[type]||0,dividendBalance:Number((dividendBalanceByTypeV171[type]||0).toFixed(2))};";

if(account.includes(oldObj)){
  account=account.replace(oldObj,newObj);
}else if(!account.includes('previousMonthShares:previousSharesByType[type]||0')){
  console.error('Stage 184 savings breakdown marker missing');
  process.exit(1);
}
fs.writeFileSync('server/routes/account.js',account);

/* Insert calendar-based previous-month shares immediately after previous-month savings */
let app=fs.readFileSync('www/app.js','utf8');

const genericOld="      ['PREVIOUS MONTH',''],\n";
if(app.includes(genericOld)) app=app.replaceAll(genericOld,'');

const oldPair="      [previous+' SAVINGS',naira(data.previousMonthSavings||0)],\n      [previous+' DIVIDEND',naira(data.previousMonthDividend||0)],";
const newPair="      [previous+' SAVINGS',naira(data.previousMonthSavings||0)],\n      [previous+' SHARES',String(Number(data.previousMonthShares||0))],\n      [previous+' DIVIDEND',naira(data.previousMonthDividend||0)],";

let count=0;
while(app.includes(oldPair)){
  app=app.replace(oldPair,newPair);
  count++;
}
if(count<2 && !app.includes("[previous+' SHARES',String(Number(data.previousMonthShares||0))]")){
  console.error('Stage 184 previous-month savings markers missing');
  process.exit(1);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=184'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=184');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=184');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=184');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v184';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 184 calendar-based previous-month SHARES tiles applied.');
