const fs=require('fs');
for(const path of ['server/routes/admin.js','server/routes/account.js','server/index.js','server/db/schema.sql','www/app.js']){
  const s=fs.readFileSync(path,'utf8');
  for(const term of ['applicationForm','application_form','management_balance','managementBalance','loan_interest','interest','dividend_summaries','DIVIDEND SUMMARY','dividend_credit','minimum_share_per_month','member_balances']){
    let from=0,count=0;
    while(true){
      const i=s.indexOf(term,from);
      if(i<0||count>=10) break;
      console.log('DIV185 '+path+' '+term+' '+i);
      console.log(JSON.stringify(s.slice(Math.max(0,i-900),Math.min(s.length,i+6200))));
      from=i+term.length;count++;
    }
  }
}
console.log('TAIMAKO Stage 185 dividend architecture inspection complete.');
