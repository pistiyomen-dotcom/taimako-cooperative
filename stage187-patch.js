const fs=require('fs');

/* Stage 187: reverse and remove Stage 186 dividend system */
let index=fs.readFileSync('server/index.js','utf8');

if(!index.includes("stage187_reverse_stage186_dividend")){
  const marker="  const loanResetKey='stage88_all_member_loan_dashboard_reset';";
  const code=`
  const dividend186RollbackKey='stage187_reverse_stage186_dividend';
  const dividend186RollbackDone=await pool.query('SELECT 1 FROM system_migrations WHERE migration_key=$1',[dividend186RollbackKey]);
  if(!dividend186RollbackDone.rowCount){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');

      const exists=await client.query("SELECT to_regclass('public.dividend_member_type_shares') AS tbl");
      if(exists.rows[0]?.tbl){
        const memberCredits=await client.query(
          "SELECT account_id,COALESCE(SUM(dividend_amount),0) AS total FROM dividend_member_type_shares WHERE credited_at IS NOT NULL GROUP BY account_id"
        );
        for(const r of memberCredits.rows){
          const amount=Number(r.total||0);
          if(amount>0){
            await client.query('UPDATE member_balances SET dividend=dividend-$1,updated_at=NOW() WHERE account_id=$2',[amount,r.account_id]);
          }
        }
        await client.query("DELETE FROM transactions WHERE transaction_type='dividend_credit' AND reference LIKE 'DIV-%'");
      }

      const columns=await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='dividend_summaries' AND column_name IN ('management_credited_at','snapshot_at')"
      );
      if(columns.rows.some(r=>r.column_name==='management_credited_at')){
        const management=await client.query(
          "SELECT COALESCE(SUM(management_ten_percent),0) AS total FROM dividend_summaries WHERE management_credited_at IS NOT NULL"
        );
        const amount=Number(management.rows[0]?.total||0);
        if(amount>0){
          await client.query('UPDATE cooperative_financials SET management_balance=management_balance-$1,updated_at=NOW() WHERE id=1',[amount]);
          console.log('TAIMAKO Stage 187 reversed Stage 186 Management Balance credit:',amount);
        }
      }

      await client.query('DELETE FROM dividend_summaries');
      await client.query('DROP TABLE IF EXISTS dividend_member_type_shares');
      await client.query('ALTER TABLE dividend_summaries DROP COLUMN IF EXISTS total_savings');
      await client.query('ALTER TABLE dividend_summaries DROP COLUMN IF EXISTS minimum_share');
      await client.query('ALTER TABLE dividend_summaries DROP COLUMN IF EXISTS snapshot_at');
      await client.query('ALTER TABLE dividend_summaries DROP COLUMN IF EXISTS management_credited_at');

      await client.query('INSERT INTO system_migrations(migration_key) VALUES($1)',[dividend186RollbackKey]);
      await client.query('COMMIT');
      console.log('TAIMAKO Stage 187 Stage 186 dividend system fully reversed.');
    }catch(error){
      await client.query('ROLLBACK');
      throw error;
    }finally{client.release();}
  }

`;
  if(!index.includes(marker)){console.error('Stage 187 startup marker missing');process.exit(1);}
  index=index.replace(marker,code+marker);
}
fs.writeFileSync('server/index.js',index);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=187'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=187');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=187');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=187');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v187';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 187 Stage 186 dividend rollback applied.');
