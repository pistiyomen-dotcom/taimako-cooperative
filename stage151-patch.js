const fs=require('fs');

/* Disable the old automatic dividend-summary engine */
let index=fs.readFileSync('server/index.js','utf8');

index=index.replace(
  /\s*try\{\s*await processDividendCycle\(\);\s*\}catch\(error\)\{\s*console\.error\('Initial dividend cycle check failed:',error\.message\);\s*\}/g,
  ''
);

index=index.replace(
  /\s*processDividendCycle\(\)\.catch\(error=>console\.error\('Dividend scheduled check failed:',error\.message\)\);/g,
  ''
);

index=index.replace(
  /\s*console\.log\('DIVIDEND_MONTHLY_SCHEDULER active[^']*'\);/g,
  ''
);

/* One-time removal of all saved old Dividend Summary calculations */
if(!index.includes("stage151_reset_old_dividend_summary")){
  const marker="  const loanResetKey='stage88_all_member_loan_dashboard_reset';";
  const reset=`
  const dividendResetKey='stage151_reset_old_dividend_summary';
  const dividendResetDone=await pool.query('SELECT 1 FROM system_migrations WHERE migration_key=$1',[dividendResetKey]);
  if(!dividendResetDone.rowCount){
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const cleared=await client.query('DELETE FROM dividend_summaries');
      await client.query('INSERT INTO system_migrations(migration_key) VALUES($1)',[dividendResetKey]);
      await client.query('COMMIT');
      console.log('TAIMAKO Stage 151 old Dividend Summary cleared. Rows:',cleared.rowCount);
    }catch(error){
      await client.query('ROLLBACK');
      throw error;
    }finally{
      client.release();
    }
  }

`;
  if(!index.includes(marker)){console.error('Stage 151 startup migration marker missing');process.exit(1);}
  index=index.replace(marker,reset+marker);
}

fs.writeFileSync('server/index.js',index);

/* Preserve tile/API but force the old saved summary to remain empty */
let admin=fs.readFileSync('server/routes/admin.js','utf8');
const routeStart=admin.indexOf("router.get('/dividend-summary'");
if(routeStart>=0){
  const routeEnd=admin.indexOf("\nrouter.",routeStart+10);
  const end=routeEnd>routeStart?routeEnd:admin.length;
  const replacement=`router.get('/dividend-summary', requireAdminPermission('view_reports'), async (_req,res)=>{
  res.json({summary:null});
});
`;
  admin=admin.slice(0,routeStart)+replacement+admin.slice(end);
}
fs.writeFileSync('server/routes/admin.js',admin);

/* Keep the dashboard tile; show it as reset/empty until the new idea is supplied */
let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes('tmcsStage151DividendReset')){
  app += `
\n/* tmcsStage151DividendReset */
window.openDividendSummaryV107=async function(){
  const dialog=document.getElementById('dividendSummaryDialog');
  const box=document.getElementById('dividendSummaryContent') || document.getElementById('dividendSummaryList');
  const error=document.getElementById('dividendSummaryError');
  if(error) error.textContent='';
  if(box) box.innerHTML='<p class="empty-state">No dividend calculation is currently configured.</p>';
  if(dialog) openDialog(dialog);
};
`;
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=151'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=151');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=151');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=151');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v151';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 151 old Dividend Summary system reset applied.');
