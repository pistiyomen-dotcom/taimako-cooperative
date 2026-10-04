const fs=require('fs');
const app=fs.readFileSync('www/app.js','utf8');
for(const term of ['FLEXIBLE CARD','MEMBERSHIP CARD','toLocaleString','monthName','OCTOBER']){
  const i=app.indexOf(term);
  console.log('LBL147 '+term+' '+i);
  if(i>=0) console.log(JSON.stringify(app.slice(Math.max(0,i-700),Math.min(app.length,i+4200))));
}
console.log('TAIMAKO Stage 147 label inspection complete.');
