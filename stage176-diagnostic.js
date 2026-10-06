const fs=require('fs');
for(const path of ['www/app.js','server/routes/admin.js']){
  const s=fs.readFileSync(path,'utf8');
  for(const term of ['setupConfirmV173','openSavingsSetupV173',"router.get('/savings-plans'","savings-plans?username","confirmedSetupMemberV173"]){
    let from=0,count=0;
    while(true){
      const i=s.indexOf(term,from);
      if(i<0||count>=6) break;
      console.log('SET176 '+path+' '+term+' '+i);
      console.log(JSON.stringify(s.slice(Math.max(0,i-900),Math.min(s.length,i+5200))));
      from=i+term.length;count++;
    }
  }
}
console.log('TAIMAKO Stage 176 SETUP confirm inspection complete.');
