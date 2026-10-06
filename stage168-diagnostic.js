const fs=require('fs');
for(const path of ['server/routes/account.js','server/index.js','server/routes/admin.js','www/app.js']){
  const s=fs.readFileSync(path,'utf8');
  for(const term of ['dividend','DIVIDEND','loan_interest','currentMonthSavingsResult','previousMonthSavingsResult']){
    let from=0,count=0;
    while(true){
      const i=s.indexOf(term,from);
      if(i<0||count>=8) break;
      console.log('SAVE168 '+path+' '+term+' '+i);
      console.log(JSON.stringify(s.slice(Math.max(0,i-900),Math.min(s.length,i+5000))));
      from=i+term.length;count++;
    }
  }
}
console.log('TAIMAKO Stage 168 savings-action inspection complete.');
