const fs=require('fs');

let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes('ADVANCE_SAVING_MERGE_V190')){
  const old=`      let guard=0;
      while(remaining>0.00001&&guard<240){
        const allocation=money(Math.min(remaining,monthlyAmount));
        const shares=allocation>=monthlyAmount?shareCount:(minimumShare>0?Math.floor(allocation/minimumShare):0);
        const period=cursor.toISOString().slice(0,10);
        await client.query(
          'INSERT INTO advance_saving_allocations(payment_request_id,account_id,savings_type,period_month,allocated_amount,allocated_shares) VALUES($1,$2,$3,$4,$5,$6)',
          [request.id,request.account_id,request.destination,period,allocation,shares]
        );
        remaining=money(remaining-allocation);
        cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1));
        guard++;
      }`;

  const replacement=`      // ADVANCE_SAVING_MERGE_V190:
      // Merge a newly approved advance into any existing future schedule.
      // A partly funded month is completed first, then the balance continues
      // in full monthly blocks based on the newly selected share count.
      let guard=0;
      while(remaining>0.00001&&guard<240){
        const period=cursor.toISOString().slice(0,10);
        const existingResult=await client.query(
          'SELECT COALESCE(SUM(allocated_amount),0) AS amount FROM advance_saving_allocations WHERE account_id=$1 AND savings_type=$2 AND period_month=$3',
          [request.account_id,request.destination,period]
        );
        const existingAmount=money(existingResult.rows[0]?.amount||0);
        const remainderInBlock=monthlyAmount>0?money(existingAmount%monthlyAmount):0;
        const amountNeeded=remainderInBlock>0.00001?money(monthlyAmount-remainderInBlock):monthlyAmount;
        const allocation=money(Math.min(remaining,amountNeeded));

        const oldShares=minimumShare>0?Math.floor((existingAmount+0.00001)/minimumShare):0;
        const newCombinedAmount=money(existingAmount+allocation);
        const newShares=minimumShare>0?Math.floor((newCombinedAmount+0.00001)/minimumShare):0;
        const incrementalShares=Math.max(0,newShares-oldShares);

        await client.query(
          'INSERT INTO advance_saving_allocations(payment_request_id,account_id,savings_type,period_month,allocated_amount,allocated_shares) VALUES($1,$2,$3,$4,$5,$6)',
          [request.id,request.account_id,request.destination,period,allocation,incrementalShares]
        );
        remaining=money(remaining-allocation);
        cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1));
        guard++;
      }`;

  if(!admin.includes(old)){console.error('Stage 190 advance allocation loop marker missing');process.exit(1);}
  admin=admin.replace(old,replacement);

  admin=admin.replace(
    "await writeAdminAudit(client,req,'ADVANCE_SAVING_APPROVED_V189'",
    "await writeAdminAudit(client,req,'ADVANCE_SAVING_MERGE_V190'"
  );
}
fs.writeFileSync('server/routes/admin.js',admin);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=190');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=190');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=190');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(
  'The full approved amount goes to the selected savings balance. Monthly savings and shares will follow the selected start month and share count.',
  'The full approved amount goes to the selected savings balance. If you already have active Advance Saving, the new approved payment will merge with it from your selected start month, complete any partly funded month first, then continue forward.'
);
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=190'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v190';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 190 Advance Saving merge/top-up workflow applied.');
