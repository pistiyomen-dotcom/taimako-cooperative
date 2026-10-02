const fs=require('fs');
function snap(path,term,before=600,after=2600){
  const s=fs.readFileSync(path,'utf8');
  const i=s.indexOf(term);
  console.log('LIVE_BUILD_SNAPSHOT '+path+' '+term+' '+JSON.stringify(i<0?'NOT_FOUND':s.slice(Math.max(0,i-before),Math.min(s.length,i+after))));
}
snap('www/index.html','Bank Transfer Payment',200,2200);
snap('www/app.js',"paymentForm.addEventListener('submit'",200,2600);
snap('www/app.js','installOfficialBankAccountV113',200,3200);
console.log('TAIMAKO Stage 122 live build inspection complete.');
