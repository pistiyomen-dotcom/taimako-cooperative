const fs=require('fs');

function around(path,term,before=500,after=2200){
  const s=fs.readFileSync(path,'utf8');
  const i=s.indexOf(term);
  console.log('TRACE127 '+path+' '+term+' '+JSON.stringify(i<0?'NOT_FOUND':s.slice(Math.max(0,i-before),Math.min(s.length,i+after))));
}

around('www/app.js','function startBankTransferV113',300,2200);
around('www/app.js',"if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startBankTransferV113)",300,1000);
around('server/index.js',"/api/public/bank-details",500,1800);
around('server/db/schema.sql','public_payment_settings',300,1600);

console.log('TAIMAKO Stage 127 bank display startup trace complete.');
