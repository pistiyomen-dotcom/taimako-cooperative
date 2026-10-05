const fs=require('fs');
const s=fs.readFileSync('server/routes/account.js','utf8');
for(const term of ['currentMonthSavingsResult','currentMonthSavings','minimumSharePerMonth','res.json({ user','totalSavings:']){
  const i=s.indexOf(term);
  console.log('MEM160 '+term+' '+i);
  if(i>=0) console.log(JSON.stringify(s.slice(Math.max(0,i-1200),Math.min(s.length,i+5500))));
}
console.log('TAIMAKO Stage 160 member balance-source inspection complete.');
