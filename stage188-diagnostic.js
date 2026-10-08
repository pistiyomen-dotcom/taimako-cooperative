const fs=require('fs');
for(const path of ['server/routes/account.js','server/routes/admin.js','server/db/schema.sql','www/app.js','www/index.html']){
  const s=fs.readFileSync(path,'utf8');
  for(const term of ["payment-requests","upload.single('receipt')","minimum_share_per_month","savingsTypeBreakdownV169","approve","cash_credit","bank_transfer","memberSavingTypeDialogV169"]){
    let from=0,count=0;
    while(true){
      const i=s.indexOf(term,from);
      if(i<0||count>=10) break;
      console.log('ADV188 '+path+' '+term+' '+i);
      console.log(JSON.stringify(s.slice(Math.max(0,i-1200),Math.min(s.length,i+7000))));
      from=i+term.length;count++;
    }
  }
}
console.log('TAIMAKO Stage 188 advance saving inspection complete.');
