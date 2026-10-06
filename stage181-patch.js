const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const oldBlock=`  const items=[[current+' SAVINGS',naira(data.currentMonthSavings||0)],['NUMBER OF SHARES',String(Number(data.numberOfShares||0))],[previous+' SAVINGS',naira(data.previousMonthSavings||0)],[previous+' DIVIDEND',naira(data.previousMonthDividend||0)],[type+' BALANCE',naira(data.totalBalance||0)],['DIVIDEND BALANCE',naira(data.dividendBalance||0)]];
  if(type==='TARGET') items.push(['SHORTSAVED CHARGE',naira(0)]);
  if(setup){
    items.push(['PLANNED AMOUNT',setup.plannedAmount==null?'Not set':naira(setup.plannedAmount)]);
    items.push(['START DATE',tmcsFormatDMY(setup.startDate)]);
    items.push(['END DATE',tmcsFormatDMY(setup.endDate)]);
    items.push(['MONTHLY REQUIRED SAVINGS',setup.monthlyRequiredSavings==null?'Not set':naira(setup.monthlyRequiredSavings)]);
  }`;

const newBlock=`  let items;
  if(type==='TARGET'){
    items=[
      ['PLANNED AMOUNT',setup?.plannedAmount==null?'Not set':naira(setup.plannedAmount)],
      ['START DATE',setup?.startDate?tmcsFormatDMY(setup.startDate):'Not set'],
      ['END DATE',setup?.endDate?tmcsFormatDMY(setup.endDate):'Not set'],
      [current+' SAVINGS',naira(data.currentMonthSavings||0)],
      ['NUMBER OF SHARES',String(Number(data.numberOfShares||0))],
      [previous+' SAVINGS',naira(data.previousMonthSavings||0)],
      [previous+' DIVIDEND',naira(data.previousMonthDividend||0)],
      ['DIVIDEND BALANCE',naira(data.dividendBalance||0)],
      ['TARGET BALANCE',naira(data.totalBalance||0)],
      ['SHORTSAVED CHARGE',naira(0)]
    ];
  }else{
    items=[
      [current+' SAVINGS',naira(data.currentMonthSavings||0)],
      ['NUMBER OF SHARES',String(Number(data.numberOfShares||0))],
      [previous+' SAVINGS',naira(data.previousMonthSavings||0)],
      [previous+' DIVIDEND',naira(data.previousMonthDividend||0)],
      [type+' BALANCE',naira(data.totalBalance||0)],
      ['DIVIDEND BALANCE',naira(data.dividendBalance||0)]
    ];
    if(setup){
      items.push(['PLANNED AMOUNT',setup.plannedAmount==null?'Not set':naira(setup.plannedAmount)]);
      items.push(['START DATE',tmcsFormatDMY(setup.startDate)]);
      items.push(['END DATE',tmcsFormatDMY(setup.endDate)]);
      items.push(['MONTHLY REQUIRED SAVINGS',setup.monthlyRequiredSavings==null?'Not set':naira(setup.monthlyRequiredSavings)]);
    }
  }`;

if(!app.includes(oldBlock)){
  console.error('Stage 181 TARGET tile-order marker missing');
  process.exit(1);
}
app=app.replace(oldBlock,newBlock);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=181'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=181');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=181');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=181');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v181';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 181 TARGET tiles rearranged.');
