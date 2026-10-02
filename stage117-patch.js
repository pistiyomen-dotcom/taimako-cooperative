const fs=require('fs');
function one(path,term,before=500,after=3000){
  const s=fs.readFileSync(path,'utf8');
  const i=s.indexOf(term);
  console.log('SNAPSHOT '+path+' '+term+' '+JSON.stringify(i<0?'NOT_FOUND':s.slice(Math.max(0,i-before),Math.min(s.length,i+after))));
}
one('server/routes/account.js',"router.post('/payment-requests'",200,4200);
one('server/routes/admin.js',"router.get('/payment-requests'",200,2800);
one('www/app.js',"paymentForm.addEventListener('submit'",400,2200);
one('www/index.html','id="paymentForm"',500,2500);
console.log('TAIMAKO Stage 117 focused payment diagnostic complete.');
