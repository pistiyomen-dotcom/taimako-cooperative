const fs=require('fs');

let account=fs.readFileSync('server/routes/account.js','utf8');

const oldTypes="  const activeSavingsPlanTypesV173=activeSavingsPlansV173.rows.map(r=>r.plan_type);";
const newTypes="  const activeSavingsPlanTypesV173=activeSavingsPlansV173.rows.map(r=>r.plan_type);\n  const savingsPlanSetupsV174=Object.fromEntries(activeSavingsPlansV173.rows.map(r=>[r.plan_type,{startDate:r.start_date,endDate:r.end_date,plannedAmount:r.planned_amount,monthlyRequiredSavings:r.monthly_amount,status:r.status}]));";
if(!account.includes(oldTypes)){console.error('Stage 174 active setup map marker missing');process.exit(1);}
account=account.replace(oldTypes,newTypes);

const oldResp="savingsTypeBreakdown: savingsTypeBreakdownV169, activeSavingsPlanTypes: activeSavingsPlanTypesV173, minimumSharePerMonth,";
const newResp="savingsTypeBreakdown: savingsTypeBreakdownV169, activeSavingsPlanTypes: activeSavingsPlanTypesV173, savingsPlanSetups: savingsPlanSetupsV174, minimumSharePerMonth,";
if(!account.includes(oldResp)){console.error('Stage 174 member response marker missing');process.exit(1);}
account=account.replace(oldResp,newResp);
fs.writeFileSync('server/routes/account.js',account);

let app=fs.readFileSync('www/app.js','utf8');

const hiddenCards="    ['REGULAR', ''],\n    ...(['TARGET','CONSTANT','WELFARE'].filter(t=>(b.activeSavingsPlanTypes||[]).includes(t)).map(t=>[t,''])),\n    ['FLEXIBLE', naira(b.flexible)],";
const allCards="    ['REGULAR', ''],\n    ['TARGET', ''],\n    ['CONSTANT', ''],\n    ['WELFARE', ''],\n    ['FLEXIBLE', naira(b.flexible)],";
if(!app.includes(hiddenCards)){console.error('Stage 174 savings tile visibility marker missing');process.exit(1);}
app=app.replace(hiddenCards,allCards);

const oldOpen="  const data=(b.savingsTypeBreakdown||{})[type]||{};\n  const current=tmcsMonthName(0).slice(0,3);\n  const previous=tmcsMonthName(-1).slice(0,4);\n  const items=[[current+' SAVINGS',naira(data.currentMonthSavings||0)],['NUMBER OF SHARES',String(Number(data.numberOfShares||0))],[previous+' SAVINGS',naira(data.previousMonthSavings||0)],[previous+' DIVIDEND',naira(data.previousMonthDividend||0)],[type+' BALANCE',naira(data.totalBalance||0)],['DIVIDEND BALANCE',naira(data.dividendBalance||0)]];";
const newOpen="  const data=(b.savingsTypeBreakdown||{})[type]||{};\n  const setup=(b.savingsPlanSetups||{})[type]||null;\n  const current=tmcsMonthName(0).slice(0,3);\n  const previous=tmcsMonthName(-1).slice(0,4);\n  const items=[[current+' SAVINGS',naira(data.currentMonthSavings||0)],['NUMBER OF SHARES',String(Number(data.numberOfShares||0))],[previous+' SAVINGS',naira(data.previousMonthSavings||0)],[previous+' DIVIDEND',naira(data.previousMonthDividend||0)],[type+' BALANCE',naira(data.totalBalance||0)],['DIVIDEND BALANCE',naira(data.dividendBalance||0)]];\n  if(setup){\n    items.push(['PLANNED AMOUNT',setup.plannedAmount==null?'Not set':naira(setup.plannedAmount)]);\n    items.push(['START DATE',tmcsFormatDMY(setup.startDate)]);\n    items.push(['END DATE',tmcsFormatDMY(setup.endDate)]);\n    items.push(['MONTHLY REQUIRED SAVINGS',setup.monthlyRequiredSavings==null?'Not set':naira(setup.monthlyRequiredSavings)]);\n  }";
if(!app.includes(oldOpen)){console.error('Stage 174 savings detail renderer marker missing');process.exit(1);}
app=app.replace(oldOpen,newOpen);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=174'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=174');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=174');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=174');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v174';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 174 SETUP details attached to existing savings tiles.');