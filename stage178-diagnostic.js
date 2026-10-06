const fs=require('fs');
for(const path of ['www/app.js','server/routes/admin.js','server/routes/account.js']){
  const s=fs.readFileSync(path,'utf8');
  for(const term of ['setupCreateV173',"router.post('/setup-savings-plan'","activeSavingsPlanTypesV173","savingsPlanSetupsV174","CREATED SUCCESSFULLY"]){
    let from=0,count=0;
    while(true){
      const i=s.indexOf(term,from);
      if(i<0||count>=8) break;
      console.log('SET178 '+path+' '+term+' '+i);
      console.log(JSON.stringify(s.slice(Math.max(0,i-1000),Math.min(s.length,i+6200))));
      from=i+term.length;count++;
    }
  }
}
console.log('TAIMAKO Stage 178 SETUP CREATE inspection complete.');
