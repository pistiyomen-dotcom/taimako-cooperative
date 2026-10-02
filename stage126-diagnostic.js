const fs=require('fs');
function check(path,term){
  const s=fs.readFileSync(path,'utf8');
  const i=s.indexOf(term);
  console.log('VERIFY126 '+path+' '+term+' '+(i<0?'NOT_FOUND':'FOUND'));
  if(i>=0) console.log(JSON.stringify(s.slice(Math.max(0,i-180),Math.min(s.length,i+700))));
}
check('server/routes/account.js','b.constant_balance');
check('server/routes/account.js','b.constant');
check('www/app.js','/BANK\\\\s*TRANSFER/i');
check('www/app.js','/BANK\\s*TRANSFER/i');
check('www/app.js',"paymentSuccess.textContent='Processing bank-transfer submission…';");
console.log('TAIMAKO Stage 126 verification complete.');
