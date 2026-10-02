const fs=require('fs');

function snap(path,term,before=300,after=2200){
  const s=fs.readFileSync(path,'utf8');
  const i=s.indexOf(term);
  console.log('FINAL124 '+path+' '+term+' '+JSON.stringify(i<0?'NOT_FOUND':s.slice(Math.max(0,i-before),Math.min(s.length,i+after))));
}

snap('www/app.js','installOfficialBankAccountV113',200,2600);
snap('www/app.js',"paymentForm.noValidate=true",200,2600);
snap('www/app.js',"paymentForm.addEventListener('submit'",200,2600);
snap('www/index.html','Bank Transfer Payment',200,1800);
snap('server/routes/account.js',"router.post('/payment-requests'",200,2600);

console.log('TAIMAKO Stage 124 final bank-transfer inspection complete.');
