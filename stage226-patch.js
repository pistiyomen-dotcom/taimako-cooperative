const fs=require('fs');
// Stage 226: Advance Cash Credit START DATE accepts and displays DD/MM/YYYY.
// Server continues to receive the original ISO date format; balances and schedules unchanged.
const htmlPath='www/index.html';
let html=fs.readFileSync(htmlPath,'utf8');
const oldInput='<input id="advanceCashCreditStartV193" type="date" required />';
const newInput='<input id="advanceCashCreditStartV193" type="text" inputmode="numeric" maxlength="10" placeholder="DD/MM/YYYY" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" title="Enter date as DD/MM/YYYY" required />';
if(!html.includes(oldInput) && !html.includes(newInput)) throw Error('Stage 226: start date input not found');
html=html.replace(oldInput,newInput);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=226');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=226');
fs.writeFileSync(htmlPath,html);
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
const oldInit="if(start){start.min=advanceCashCreditMonthFloorV193();start.value=new Date().toISOString().slice(0,10);}";
const newInit="if(start){const now=new Date();start.value=String(now.getDate()).padStart(2,'0')+'/'+String(now.getMonth()+1).padStart(2,'0')+'/'+now.getFullYear();}";
if(!app.includes(oldInit)&&!app.includes(newInit)) throw Error('Stage 226: start date initializer not found');
app=app.replace(oldInit,newInit);
const oldDate="const startDate=document.getElementById('advanceCashCreditStartV193')?.value||'';";
const newDate=`const displayedStartDate=document.getElementById('advanceCashCreditStartV193')?.value.trim()||'';
  let startDate='';
  const dateMatch=/^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/.exec(displayedStartDate);
  if(dateMatch){
    const day=Number(dateMatch[1]),month=Number(dateMatch[2]),year=Number(dateMatch[3]);
    const parsed=new Date(Date.UTC(year,month-1,day));
    if(year>=1900 && year<=9999 && parsed.getUTCFullYear()===year && parsed.getUTCMonth()===month-1 && parsed.getUTCDate()===day){
      startDate=dateMatch[3]+'-'+dateMatch[2]+'-'+dateMatch[1];
    }
  }`;
if(!app.includes(oldDate)&&!app.includes('const displayedStartDate=')) throw Error('Stage 226: submit start date not found');
app=app.replace(oldDate,newDate);
app=app.replace("if(!startDate){if(error) error.textContent='Select a date.';return;}","if(!startDate){if(error) error.textContent='Enter a valid date in DD/MM/YYYY format.';return;}");
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=226'");
fs.writeFileSync(appPath,app);
const swPath='www/sw.js';let sw=fs.readFileSync(swPath,'utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v226';");
fs.writeFileSync(swPath,sw);
console.log('Stage 226: Advance Cash Credit start date DD/MM/YYYY display, validated ISO submission.');
