const fs=require('fs');

let index=fs.readFileSync('server/index.js','utf8');

if(!index.includes("stage136_backfill_bank_transfer_audit")){
  const marker="app.listen(port, () => {";
  if(!index.includes(marker)){console.error('Stage 136 startup marker missing');process.exit(1);}

  const migration=[
    "  const auditBackfillKey='stage136_backfill_bank_transfer_audit';",
    "  const auditBackfillDone=await pool.query('SELECT 1 FROM system_migrations WHERE migration_key=$1',[auditBackfillKey]);",
    "  if(!auditBackfillDone.rowCount){",
    "    const client=await pool.connect();",
    "    try{",
    "      await client.query('BEGIN');",
    "      const inserted=await client.query(\"INSERT INTO admin_audit_log(admin_account_id,action_code,target_type,target_id,target_username,details,created_at) SELECT t.created_by_account_id,'PAYMENT_REQUEST_APPROVED','payment_request',COALESCE(p.id::text,t.reference),a.username,jsonb_build_object('destination',t.destination,'amount',t.amount,'reference',t.reference,'backfilled',true),COALESCE(t.approved_at,t.created_at) FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN payment_requests p ON p.reference=t.reference AND p.account_id=t.account_id WHERE t.transaction_type='bank_transfer' AND t.status='approved' AND NOT EXISTS (SELECT 1 FROM admin_audit_log l WHERE l.action_code='PAYMENT_REQUEST_APPROVED' AND l.details->>'reference'=t.reference)\");",
    "      await client.query('INSERT INTO system_migrations(migration_key) VALUES($1)',[auditBackfillKey]);",
    "      await client.query('COMMIT');",
    "      console.log('TAIMAKO Stage 136 audit backfill completed. Entries:',inserted.rowCount);",
    "    }catch(error){",
    "      await client.query('ROLLBACK');",
    "      throw error;",
    "    }finally{",
    "      client.release();",
    "    }",
    "  }"
  ].join('\n');
  index=index.replace(marker,migration+'\n'+marker);
}

fs.writeFileSync('server/index.js',index);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=136');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=136');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=136');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v136';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 136 historical bank-transfer audit backfill added.');