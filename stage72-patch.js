const fs=require('fs');

// Stage 72: reset Flexible start date to withdrawal approval date.

let admin=fs.readFileSync('server/routes/admin.js','utf8');

if(!admin.includes("flexible_start_date=CURRENT_DATE")){
  const marker="    await client.query(`UPDATE member_balances SET ${column}=${column}-$1, updated_at=NOW() WHERE account_id=$2`, [amount, request.account_id]);";
  const replacement=marker+"\n    if(request.role === 'flexible' || request.source === 'FLEXIBLE'){\n      await client.query('UPDATE member_balances SET flexible_start_date=CURRENT_DATE, updated_at=NOW() WHERE account_id=$1',[request.account_id]);\n    }";
  if(!admin.includes(marker)){
    console.error('Stage 72 withdrawal approval balance marker missing');
    process.exit(1);
  }
  admin=admin.replace(marker,replacement);
}

fs.writeFileSync('server/routes/admin.js',admin);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=72');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=72');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=72');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=72'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v72';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 72 Flexible start date reset on approved withdrawal applied.');