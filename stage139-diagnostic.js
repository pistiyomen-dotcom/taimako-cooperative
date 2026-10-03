const fs=require('fs');
function compact(path,startTerm,endTerm){
  const s=fs.readFileSync(path,'utf8');
  const a=s.indexOf(startTerm);
  if(a<0){console.log('TX139 '+path+' NOT_FOUND '+startTerm);return;}
  const b=endTerm?s.indexOf(endTerm,a+startTerm.length):-1;
  const chunk=s.slice(a,b>a?b:Math.min(s.length,a+5000)).replace(/\s+/g,' ');
  console.log('TX139 '+path+' '+chunk);
}
compact('server/routes/admin.js',"router.get('/transactions'","router.");
compact('www/app.js',"if (title === 'TRANSACTIONS')","if (title ===");
compact('www/app.js',"transactionsDialog","\n\n");
