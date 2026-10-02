const fs=require('fs');

let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS public_payment_settings')){
  const table=`
CREATE TABLE IF NOT EXISTS public_payment_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
  schema=schema.replace('\nCOMMIT;',table+'\nCOMMIT;');
  fs.writeFileSync('server/db/schema.sql',schema);
}

let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes("router.get('/public-payment-settings'")){
  const routes=`
router.get('/public-payment-settings', requireAdminPermission('manage_accounts'), async (_req,res)=>{
  const result=await pool.query("SELECT setting_key,setting_value FROM public_payment_settings WHERE setting_key IN ('copy_value','line_two','line_three')");
  const map=Object.fromEntries(result.rows.map(r=>[r.setting_key,String(r.setting_value||'')]));
  res.json({copyValue:map.copy_value||'',lineTwo:map.line_two||'',lineThree:map.line_three||''});
});

router.put('/public-payment-settings', requireAdminPermission('manage_accounts'), async (req,res)=>{
  const copyValue=String(req.body?.copyValue||'').trim();
  const lineTwo=String(req.body?.lineTwo||'').trim();
  const lineThree=String(req.body?.lineThree||'').trim();
  if(!copyValue||!lineTwo||!lineThree) return res.status(400).json({error:'Complete all payment detail fields.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    for(const [key,value] of [['copy_value',copyValue],['line_two',lineTwo],['line_three',lineThree]]){
      await client.query("INSERT INTO public_payment_settings(setting_key,setting_value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=NOW()",[key,value]);
    }
    await client.query('COMMIT');
    res.json({copyValue,lineTwo,lineThree});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});
`;
  admin=admin.replace('\nmodule.exports = router;',routes+'\nmodule.exports = router;');
  fs.writeFileSync('server/routes/admin.js',admin);
}

let index=fs.readFileSync('server/index.js','utf8');
index=index.replace(
`  app.get('/api/public/bank-details', (_req,res)=>{
    res.json({
      accountNumber:String(process.env.OFFICIAL_BANK_ACCOUNT_NUMBER||''),
      bankName:String(process.env.OFFICIAL_BANK_NAME||''),
      accountName:String(process.env.OFFICIAL_BANK_ACCOUNT_NAME||'')
    });
  });`,
`  app.get('/api/public/bank-details', async (_req,res,next)=>{
    try{
      const result=await pool.query("SELECT setting_key,setting_value FROM public_payment_settings WHERE setting_key IN ('copy_value','line_two','line_three')");
      const map=Object.fromEntries(result.rows.map(r=>[r.setting_key,String(r.setting_value||'')]));
      res.json({accountNumber:map.copy_value||'',bankName:map.line_two||'',accountName:map.line_three||''});
    }catch(error){next(error);}
  });`
);
fs.writeFileSync('server/index.js',index);

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="publicPaymentCopyValue"')){
  const marker='<p class="form-error" id="adminSettingsError" role="alert"></p>';
  const fields=`
      <hr />
      <h4>OFFICIAL TRANSFER DETAILS</h4>
      <p class="helper">These three centered lines appear at the top of the BANK TRANSFER PAYMENT FORM. The first line has the COPY button.</p>
      <label>First line / Copy value<input id="publicPaymentCopyValue" type="text" autocomplete="off" /></label>
      <label>Second line<input id="publicPaymentLineTwo" type="text" autocomplete="off" /></label>
      <label>Third line<input id="publicPaymentLineThree" type="text" autocomplete="off" /></label>
`;
  if(!html.includes(marker)){console.error('Stage 114 Admin SETTINGS marker missing');process.exit(1);}
  html=html.replace(marker,fields+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=114');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=114');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=114');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes('loadPublicPaymentSettingsV114')){
  app+=`
async function loadPublicPaymentSettingsV114(){
  try{
    const data=await api('/api/admin/public-payment-settings',{cache:'no-store'});
    document.getElementById('publicPaymentCopyValue').value=data.copyValue||'';
    document.getElementById('publicPaymentLineTwo').value=data.lineTwo||'';
    document.getElementById('publicPaymentLineThree').value=data.lineThree||'';
  }catch(_){}
}
const oldOpenAdminSettingsV101=openAdminSettingsV101;
openAdminSettingsV101=async function(){
  await oldOpenAdminSettingsV101();
  await loadPublicPaymentSettingsV114();
};
document.getElementById('saveAdminSettings')?.addEventListener('click',async()=>{
  try{
    const copyValue=String(document.getElementById('publicPaymentCopyValue')?.value||'').trim();
    const lineTwo=String(document.getElementById('publicPaymentLineTwo')?.value||'').trim();
    const lineThree=String(document.getElementById('publicPaymentLineThree')?.value||'').trim();
    if(copyValue||lineTwo||lineThree){
      await api('/api/admin/public-payment-settings',{method:'PUT',body:JSON.stringify({copyValue,lineTwo,lineThree})});
    }
  }catch(error){
    const box=document.getElementById('adminSettingsError');
    if(box) box.textContent=error.message;
  }
});
`;
}
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=114'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v114';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 114 Admin-configured public transfer details applied.');
