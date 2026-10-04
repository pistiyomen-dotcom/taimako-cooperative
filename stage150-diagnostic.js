const fs=require('fs');

function inspect(path,terms){
  const s=fs.readFileSync(path,'utf8');
  for(const term of terms){
    let from=0,count=0;
    while(true){
      const i=s.indexOf(term,from);
      if(i<0||count>=8) break;
      console.log('DIV150 '+path+' '+term+' '+i);
      console.log(JSON.stringify(s.slice(Math.max(0,i-700),Math.min(s.length,i+4200))));
      from=i+term.length; count++;
    }
  }
}

inspect('server/index.js',['processDividendCycle','dividend_summaries','DIVIDEND_MONTHLY_SCHEDULER']);
inspect('server/routes/admin.js',["router.get('/dividend-summary'","dividend_summaries","amount_per_share"]);
inspect('server/db/schema.sql',['dividend_summaries','dividend']);
inspect('www/app.js',['DIVIDEND SUMMARY','openDividendSummary','amountPerShare','dividendSummary']);
console.log('TAIMAKO Stage 150 dividend-system inspection complete.');
