const fs=require('fs');

/* ---------- Persistent settings schema ---------- */
let schema=fs.readFileSync('server/db/schema.sql','utf8');
const schemaInsert=`
CREATE TABLE IF NOT EXISTS cooperative_settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  numeric_value NUMERIC(14,2) NOT NULL CHECK (numeric_value >= 0),
  updated_by_account_id BIGINT REFERENCES accounts(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO cooperative_settings(setting_key,numeric_value)
VALUES ('minimum_share_per_month',5000)
ON CONFLICT(setting_key) DO NOTHING;
INSERT INTO cooperative_settings(setting_key,numeric_value)
VALUES ('total_registration_fee',0)
ON CONFLICT(setting_key) DO NOTHING;
`;
if(!schema.includes('CREATE TABLE IF NOT EXISTS cooperative_settings')){
  schema=schema.replace('\nCOMMIT;',schemaInsert+'\nCOMMIT;');
}
fs.writeFileSync('server/db/schema.sql',schema);

/* ---------- Admin settings API ---------- */
let admin=fs.readFileSync('server/routes/admin.js','utf8');
const adminRouteMarker="router.post('/accounts'";
if(!admin.includes("router.get('/settings'")){
  const routes=`
router.get('/settings', requireAdminPermission('manage_accounts'), async (req,res)=>{
  const result=await pool.query("SELECT setting_key,numeric_value FROM cooperative_settings WHERE setting_key IN ('minimum_share_per_month','total_registration_fee')");
  const map=Object.fromEntries(result.rows.map(r=>[r.setting_key,money(r.numeric_value)]));
  res.json({
    minimumSharePerMonth: map.minimum_share_per_month ?? 5000,
    totalRegistrationFee: map.total_registration_fee ?? 0
  });
});

router.put('/settings', requireAdminPermission('manage_accounts'), async (req,res)=>{
  const minimumSharePerMonth=Number(req.body?.minimumSharePerMonth);
  const totalRegistrationFee=Number(req.body?.totalRegistrationFee);
  if(!Number.isFinite(minimumSharePerMonth)||minimumSharePerMonth<=0) return res.status(400).json({error:'Minimum share per month must be greater than zero.'});
  if(!Number.isFinite(totalRegistrationFee)||totalRegistrationFee<=0) return res.status(400).json({error:'Total registration fee must be greater than zero.'});

  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query(
      "INSERT INTO cooperative_settings(setting_key,numeric_value,updated_by_account_id,updated_at) VALUES('minimum_share_per_month',$1,$3,NOW()),('total_registration_fee',$2,$3,NOW()) ON CONFLICT(setting_key) DO UPDATE SET numeric_value=EXCLUDED.numeric_value,updated_by_account_id=EXCLUDED.updated_by_account_id,updated_at=NOW()",
      [minimumSharePerMonth,totalRegistrationFee,req.auth.sub]
    );
    await writeAdminAudit(client,req,'UPDATE_SETTINGS','settings',null,null,{minimumSharePerMonth,totalRegistrationFee});
    await client.query('COMMIT');
    res.json({minimumSharePerMonth,totalRegistrationFee});
  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{client.release();}
});

`;
  if(!admin.includes(adminRouteMarker)){console.error('Stage 101 admin route marker missing');process.exit(1);}
  admin=admin.replace(adminRouteMarker,routes+adminRouteMarker);
}
fs.writeFileSync('server/routes/admin.js',admin);

/* ---------- Member account calculations use settings ---------- */
let account=fs.readFileSync('server/routes/account.js','utf8');

account=account.replace(
  "destination IN ('REGULAR','TARGET','CONSTANT','WELFARE','FLEXIBLE')",
  "destination IN ('REGULAR','TARGET','CONSTANT','WELFARE')"
);

const settingsNeedle="  const currentMonthSavings = money(currentMonthSavingsResult.rows[0]?.total);";
if(!account.includes("const cooperativeSettingsResult")){
  const settingsCode=`
  const cooperativeSettingsResult=await pool.query("SELECT setting_key,numeric_value FROM cooperative_settings WHERE setting_key IN ('minimum_share_per_month','total_registration_fee')");
  const cooperativeSettings=Object.fromEntries(cooperativeSettingsResult.rows.map(r=>[r.setting_key,money(r.numeric_value)]));
  const minimumSharePerMonth=cooperativeSettings.minimum_share_per_month>0 ? cooperativeSettings.minimum_share_per_month : 5000;
  const totalRegistrationFee=cooperativeSettings.total_registration_fee>0 ? cooperativeSettings.total_registration_fee : 0;
`;
  if(!account.includes(settingsNeedle)){console.error('Stage 101 account settings marker missing');process.exit(1);}
  account=account.replace(settingsNeedle,settingsNeedle+settingsCode);
}

account=account.replace(
  "totalSavings: currentMonthSavings, numberOfShares: Math.floor(currentMonthSavings / 5000),",
  "totalSavings: currentMonthSavings, numberOfShares: Math.floor(currentMonthSavings / minimumSharePerMonth), minimumSharePerMonth, totalRegistrationFee, registrationComplete: totalRegistrationFee > 0 && money(row.registration) >= totalRegistrationFee,"
);
fs.writeFileSync('server/routes/account.js',account);

/* ---------- Admin SETTINGS dialog ---------- */
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="adminSettingsDialog"')){
  const dialog=`
  <dialog id="adminSettingsDialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>SETTINGS</h3><button type="button" class="icon-btn" data-close="adminSettingsDialog" aria-label="Close">×</button></div>
      <p class="helper">Set reviewable cooperative values used automatically by member dashboards.</p>
      <label>Minimum Share Per Month (₦)
        <input id="minimumShareSetting" type="number" min="0.01" step="0.01" inputmode="decimal" />
      </label>
      <label>Total Registration Fee (₦)
        <input id="registrationFeeSetting" type="number" min="0.01" step="0.01" inputmode="decimal" />
      </label>
      <p class="form-error" id="adminSettingsError" role="alert"></p>
      <p class="form-success" id="adminSettingsSuccess" role="status"></p>
      <div class="dialog-actions"><button type="button" class="primary" id="saveAdminSettings">SAVE SETTINGS</button></div>
    </div>
  </dialog>

`;
  const marker='<dialog id="summaryReportDialog"';
  if(!html.includes(marker)){console.error('Stage 101 settings dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=101');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=101');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=101');
fs.writeFileSync('www/index.html',html);

/* ---------- Frontend admin settings + member registration check ---------- */
let app=fs.readFileSync('www/app.js','utf8');

app=app.replace(
  "['CREATE ACCOUNT', 'Create Regular, Flexible or Admin account'],",
  "['CREATE ACCOUNT', 'Create Regular, Flexible or Admin account'],\n    ['SETTINGS', 'Set minimum share and registration fee'],"
);

app=app.replace(
  "if (title === 'CREATE ACCOUNT') {",
  "if (title === 'SETTINGS') { openAdminSettingsV101(); }\n  if (title === 'CREATE ACCOUNT') {"
);

const apiMarker="async function api(path, options = {}) {";
if(!app.includes('async function openAdminSettingsV101()')){
  const settingsUi=`
async function openAdminSettingsV101(){
  const dialog=document.getElementById('adminSettingsDialog');
  const error=document.getElementById('adminSettingsError');
  const success=document.getElementById('adminSettingsSuccess');
  error.textContent=''; success.textContent='';
  openDialog(dialog);
  try{
    const data=await api('/api/admin/settings',{cache:'no-store'});
    document.getElementById('minimumShareSetting').value=Number(data.minimumSharePerMonth||5000);
    document.getElementById('registrationFeeSetting').value=Number(data.totalRegistrationFee||0) || '';
  }catch(errorObj){error.textContent=errorObj.message;}
}

document.getElementById('saveAdminSettings')?.addEventListener('click',async()=>{
  const error=document.getElementById('adminSettingsError');
  const success=document.getElementById('adminSettingsSuccess');
  error.textContent=''; success.textContent='';
  try{
    const minimumSharePerMonth=Number(document.getElementById('minimumShareSetting').value);
    const totalRegistrationFee=Number(document.getElementById('registrationFeeSetting').value);
    const data=await api('/api/admin/settings',{
      method:'PUT',
      body:JSON.stringify({minimumSharePerMonth,totalRegistrationFee})
    });
    success.textContent='SETTINGS SAVED SUCCESSFULLY';
  }catch(errorObj){error.textContent=errorObj.message;}
});

`;
  if(!app.includes(apiMarker)){console.error('Stage 101 api marker missing');process.exit(1);}
  app=app.replace(apiMarker,settingsUi+apiMarker);
}

app=app.replace(
  "['REGISTRATION', naira(b.registration)], ['REGULAR', naira(b.regular)]",
  "['REGISTRATION', b.registrationComplete ? '✓' : naira(b.registration)], ['REGULAR', naira(b.regular)]"
);

const renderValueMarker="const p = document.createElement('p'); p.textContent = value;";
if(!app.includes("title === 'REGISTRATION' && value === '✓'")){
  app=app.replace(
    renderValueMarker,
    renderValueMarker+"\n    if(title === 'REGISTRATION' && value === '✓'){ p.style.color='#07883f'; p.style.fontSize='34px'; p.style.fontWeight='900'; }"
  );
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=101'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v101';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 101 reviewable share and registration settings applied.');