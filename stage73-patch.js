const fs=require('fs');

// Stage 73: if Flexible balance is zero, first deposit starts a new Flexible cycle.

let admin=fs.readFileSync('server/routes/admin.js','utf8');

const cashMarker = "    const updated=await client.query(\n      'UPDATE member_balances SET '+column+'='+column+'+$1, updated_at=NOW() WHERE account_id=$2 RETURNING *',\n      [amount,account.id]\n    );";
if(admin.includes(cashMarker) && !admin.includes('Stage 73 v68 flexible first-deposit reset')){
  const insert = "    /* Stage 73 v68 flexible first-deposit reset */\n    if(destination==='FLEXIBLE'){\n      const before=await client.query('SELECT flexible FROM member_balances WHERE account_id=$1 FOR UPDATE',[account.id]);\n      if(Number(before.rows[0]?.flexible||0)<=0){\n        await client.query('UPDATE member_balances SET flexible_start_date=CURRENT_DATE WHERE account_id=$1',[account.id]);\n      }\n    }\n\n";
  admin=admin.replace(cashMarker,insert+cashMarker);
}

const payMarker = "    await client.query(`UPDATE member_balances SET ${column}=${column}+$1, updated_at=NOW() WHERE account_id=$2`, [request.amount, request.account_id]);";
if(admin.includes(payMarker) && !admin.includes('Stage 73 payment Flexible first-deposit reset')){
  const insert = "    /* Stage 73 payment Flexible first-deposit reset */\n    if(request.destination==='FLEXIBLE'){\n      const beforeFlexible=await client.query('SELECT flexible FROM member_balances WHERE account_id=$1 FOR UPDATE',[request.account_id]);\n      if(Number(beforeFlexible.rows[0]?.flexible||0)<=0){\n        await client.query('UPDATE member_balances SET flexible_start_date=CURRENT_DATE WHERE account_id=$1',[request.account_id]);\n      }\n    }\n";
  admin=admin.replace(payMarker,insert+payMarker);
}

fs.writeFileSync('server/routes/admin.js',admin);

let account=fs.readFileSync('server/routes/account.js','utf8');
account=account.replace(
  'UPDATE member_balances SET flexible=flexible+$1,updated_at=NOW() WHERE account_id=$2',
  'UPDATE member_balances SET flexible_start_date=CASE WHEN flexible<=0 THEN CURRENT_DATE ELSE flexible_start_date END, flexible=flexible+$1,updated_at=NOW() WHERE account_id=$2'
);
fs.writeFileSync('server/routes/account.js',account);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=73');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=73');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=73');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=73'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v73';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 73 Flexible first-deposit start-date reset applied.');