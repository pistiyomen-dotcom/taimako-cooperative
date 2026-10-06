const fs=require('fs');
for(const path of ['server/db/schema.sql','server/routes/admin.js','server/routes/account.js','www/app.js','www/index.html']){
  const s=fs.readFileSync(path,'utf8');
  for(const term of ['savings_plans','SAVINGS PLAN SETUP','openSavingsPlanDialog','savingsPlan','duration_months','monthly_required']){
    let from=0,count=0;
    while(true){
      const i=s.indexOf(term,from);
      if(i<0||count>=10) break;
      console.log('SET172 '+path+' '+term+' '+i);
      console.log(JSON.stringify(s.slice(Math.max(0,i-1000),Math.min(s.length,i+6500))));
      from=i+term.length;count++;
    }
  }
}
console.log('TAIMAKO Stage 172 setup-system inspection complete.');
