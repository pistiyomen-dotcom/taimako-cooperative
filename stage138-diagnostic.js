const fs=require('fs');

function around(path,terms){
  const s=fs.readFileSync(path,'utf8');
  for(const term of terms){
    const i=s.indexOf(term);
    console.log('TX138 '+path+' '+term+' '+i);
    if(i>=0) console.log(JSON.stringify(s.slice(Math.max(0,i-500),Math.min(s.length,i+3200))));
  }
}

around('server/routes/admin.js',["router.get('/transactions'","transactions"]);
around('www/app.js',['loadTransactions','transactionList','TRANSACTIONS','transactionsDialog']);
around('www/index.html',['TRANSACTIONS','transactionsDialog']);

console.log('TAIMAKO Stage 138 transaction summary inspection complete.');
