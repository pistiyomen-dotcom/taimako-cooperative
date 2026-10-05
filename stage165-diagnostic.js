const fs=require('fs');
const app=fs.readFileSync('www/app.js','utf8');
for(const term of ["function dashboardCards","ACTIVE LOAN","LOAN INTEREST","TOTAL SAVINGS","NUMBER OF SHARES","BALANCES"]){
  const i=app.indexOf(term);
  console.log('LOAN165 '+term+' '+i);
  if(i>=0) console.log(JSON.stringify(app.slice(Math.max(0,i-900),Math.min(app.length,i+5200))));
}
console.log('TAIMAKO Stage 165 member LOAN inspection complete.');
