const fs=require('fs');
const app=fs.readFileSync('www/app.js','utf8');
for(const term of ['function dashboardCards(role)','REGULAR','TARGET','CONSTANT','WELFARE','FLEXIBLE','BALANCES']){
  const i=app.indexOf(term);
  console.log('SAV162 '+term+' '+i);
  if(i>=0) console.log(JSON.stringify(app.slice(Math.max(0,i-600),Math.min(app.length,i+5200))));
}
console.log('TAIMAKO Stage 162 member SAVINGS inspection complete.');
