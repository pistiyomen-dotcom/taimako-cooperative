const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

/* Add PREVIOUS MONTH immediately after previous-month savings in all savings detail layouts */
const targetOld="[previous+' SAVINGS',naira(data.previousMonthSavings||0)],\n      [previous+' DIVIDEND',naira(data.previousMonthDividend||0)],";
const targetNew="[previous+' SAVINGS',naira(data.previousMonthSavings||0)],\n      ['PREVIOUS MONTH',''],\n      [previous+' DIVIDEND',naira(data.previousMonthDividend||0)],";

let count=0;
while(app.includes(targetOld)){
  app=app.replace(targetOld,targetNew);
  count++;
}
if(count<2){
  console.error('Stage 184 previous-month savings markers incomplete: '+count);
  process.exit(1);
}

/* Hide the empty value line for the PREVIOUS MONTH label tile */
if(!app.includes("title === 'PREVIOUS MONTH'")){
  const marker="const p=document.createElement('p');p.textContent=value;";
  if(app.includes(marker)){
    app=app.replace(marker,marker+"if(title==='PREVIOUS MONTH') p.style.display='none';");
  }else{
    const marker2="const p = document.createElement('p'); p.textContent = value;";
    if(!app.includes(marker2)){console.error('Stage 184 detail card renderer marker missing');process.exit(1);}
    app=app.replace(marker2,marker2+"\n    if(title==='PREVIOUS MONTH') p.style.display='none';");
  }
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

console.log('TAIMAKO Stage 184 PREVIOUS MONTH tiles inserted in Regular savings accounts.');
