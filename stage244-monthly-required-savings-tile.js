const fs=require('fs');

/* Stage 244: show configured monthly requirement on TARGET and CONSTANT.
   Read setup metadata only; never post this value to member_balances. */
let app=fs.readFileSync('www/app.js','utf8');
const marker="      ['PLANNED AMOUNT',setup?.plannedAmount==null?'Not set':naira(setup.plannedAmount)],";
const tile="      ...(type==='TARGET'||type==='CONSTANT' ? [['MONTHLY REQUIRED SAVINGS',setup?.monthlyRequiredSavings==null?'Not set':naira(setup.monthlyRequiredSavings)]] : []),";
if(!app.includes(tile)){
  if(!app.includes(marker)) throw Error('Stage 244: savings setup detail marker not found; refusing to build.');
  app=app.replace(marker,marker+'\n'+tile);
}
app=app.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=263'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=263')
         .replace(/styles\.css\?v=\d+/g,'styles.css?v=263')
         .replace(/requisition-v242\.js\?v=\d+/g,'requisition-v242.js?v=263')
         .replace(/requisition-approval-v243\.js\?v=\d+/g,'requisition-approval-v243.js?v=263');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v263';")
     .replace(/app\.js\?v=\d+/g,'app.js?v=263')
     .replace(/styles\.css\?v=\d+/g,'styles.css?v=263')
     .replace(/requisition-v242\.js\?v=\d+/g,'requisition-v242.js?v=263')
     .replace(/requisition-approval-v243\.js\?v=\d+/g,'requisition-approval-v243.js?v=263');
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 244: Monthly Required Savings tile added for TARGET and CONSTANT; no balance posting added.');

require('./stage245-existing-registered-member.js');
