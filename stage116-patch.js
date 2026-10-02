const fs=require('fs');

function show(path,terms){
  const s=fs.readFileSync(path,'utf8');
  console.log('--- DIAGNOSTIC '+path+' ---');
  for(const term of terms){
    let from=0,count=0;
    while(count<8){
      const i=s.indexOf(term,from);
      if(i<0) break;
      console.log('\nTERM:',term,'AT',i,'\n'+s.slice(Math.max(0,i-700),Math.min(s.length,i+1800)));
      from=i+term.length; count++;
    }
  }
}
show('server/routes/account.js',['payment_requests','payment-requests','bank_transfer','receipt_original_name']);
show('server/routes/admin.js',['payment_requests','payment-requests']);
show('www/app.js',['paymentForm','paymentRequest','payment-request','bank transfer','BANK TRANSFER']);
show('www/index.html',['BANK TRANSFER','paymentForm','paymentRequest']);
console.log('TAIMAKO Stage 116 payment-flow diagnostic complete.');
