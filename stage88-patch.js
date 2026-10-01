const fs=require('fs');

let index=fs.readFileSync('server/index.js','utf8');

const old=`async function start() {
  if (String(process.env.AUTO_INIT_DB || '').toLowerCase() === 'true') {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('TAIMAKO database schema checked/initialized.');
  }
  app.listen(port, () => console.log(\`TAIMAKO server listening on port \${port}\`));
}`;

const replacement=`async function start() {
  if (String(process.env.AUTO_INIT_DB || '').toLowerCase() === 'true') {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    console.log('TAIMAKO database schema checked/initialized.');
  }

  await pool.query(\`CREATE TABLE IF NOT EXISTS system_migrations (
    migration_key TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )\`);

  const loanResetKey='stage88_all_member_loan_dashboard_reset';
  const loanResetDone=await pool.query('SELECT 1 FROM system_migrations WHERE migration_key=$1',[loanResetKey]);

  if(!loanResetDone.rowCount){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');

      await client.query(\`
        UPDATE member_balances
        SET loan_principal=0,
            loan_interest=0,
            loan_due_date=NULL,
            updated_at=NOW()
      \`);

      await client.query(\`
        UPDATE loans
        SET status='paid',
            paid_at=COALESCE(paid_at,NOW()),
            updated_at=NOW()
        WHERE status='active'
      \`);

      await client.query(\`
        UPDATE loan_applications
        SET status='rejected',
            reviewed_at=COALESCE(reviewed_at,NOW()),
            rejection_reason=COALESCE(NULLIF(rejection_reason,''),'Loan system reset before redesign.')
        WHERE status='pending'
      \`);

      await client.query('INSERT INTO system_migrations(migration_key) VALUES($1)',[loanResetKey]);
      await client.query('COMMIT');
      console.log('TAIMAKO Stage 88 one-time loan dashboard reset completed.');
    }catch(error){
      await client.query('ROLLBACK');
      throw error;
    }finally{
      client.release();
    }
  }else{
    console.log('TAIMAKO Stage 88 loan dashboard reset already applied.');
  }

  app.listen(port, () => console.log(\`TAIMAKO server listening on port \${port}\`));
}`;

if(!index.includes(old)){
  console.error('Stage 88 startup marker missing');
  process.exit(1);
}

index=index.replace(old,replacement);
fs.writeFileSync('server/index.js',index);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=88');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=88');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=88');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=88'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v88';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 88 loan reset migration applied to source.');