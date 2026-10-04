const fs=require('fs');
function inspect(path,terms){
  const s=fs.readFileSync(path,'utf8');
  for(const term of terms){
    let from=0,count=0;
    while(true){
      const i=s.indexOf(term,from);
      if(i<0||count>=6) break;
      console.log('BAL153 '+path+' '+term+' '+i);
      console.log(JSON.stringify(s.slice(Math.max(0,i-800),Math.min(s.length,i+5000))));
      from=i+term.length;count++;
    }
  }
}
inspect('server/index.js',['processManagementMonthEnd','management_balance','APPLICATION FORM','FLEXIBLE CARD','MEMBERSHIP CARD']);
inspect('server/routes/account.js',['applicationForm','flexibleCard','membershipCard','managementBalance']);
inspect('server/routes/admin.js',['management','APPLICATION FORM','FLEXIBLE CARD','MEMBERSHIP CARD']);
inspect('server/db/schema.sql',['management','APPLICATION FORM','FLEXIBLE CARD','MEMBERSHIP CARD']);
console.log('TAIMAKO Stage 153 previous-month balance inspection complete.');