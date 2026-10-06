const fs=require('fs');

/* ---------- database additions ---------- */
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('ALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS end_date')){
  const add="\nALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS end_date DATE;\nALTER TABLE savings_plans ADD COLUMN IF NOT EXISTS planned_amount NUMERIC(14,2);\n";
  schema=schema.replace('\nCOMMIT;',add+'\nCOMMIT;');
  fs.writeFileSync('server/db/schema.sql',schema);
}

/* ---------- admin API ---------- */
let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes("router.post('/setup-savings-plan'")){
  const marker="router.get('/savings-plans'";
  const route="
router.post('/setup-savings-plan', requireAdminPermission('manage_accounts'), async (req,res)=>{\n"+
"  const username=String(req.body?.username||'').trim().toUpperCase();\n"+
"  const planType=String(req.body?.planType||'').trim().toUpperCase();\n"+
"  const startDate=String(req.body?.startDate||'').trim();\n"+
"  const endDate=String(req.body?.endDate||'').trim();\n"+
"  const plannedRaw=req.body?.plannedAmount;\n"+
"  const monthlyRaw=req.body?.monthlyRequiredSavings;\n"+
"  const plannedAmount=(plannedRaw===''||plannedRaw==null)?null:Number(plannedRaw);\n"+
"  const monthlyAmount=(monthlyRaw===''||monthlyRaw==null)?null:Number(monthlyRaw);\n"+
"  if(!username) return res.status(400).json({error:'Enter member username.'});\n"+
"  if(!['TARGET','CONSTANT','WELFARE'].includes(planType)) return res.status(400).json({error:'Select TARGET, CONSTANT or WELFARE.'});\n"+
"  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(startDate)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(endDate)) return res.status(400).json({error:'Select valid start and end dates.'});\n"+
"  const start=new Date(startDate+'T00:00:00Z'), end=new Date(endDate+'T00:00:00Z');\n"+
"  if(!(end>start)) return res.status(400).json({error:'End date must be after start date.'});\n"+
"  if(planType!=='WELFARE'){\n"+
"    if(!Number.isFinite(plannedAmount)||plannedAmount<=0) return res.status(400).json({error:'Planned amount is required for '+planType+'.'});\n"+
"    if(!Number.isFinite(monthlyAmount)||monthlyAmount<=0) return res.status(400).json({error:'Monthly required savings is required for '+planType+'.'});\n"+
"  }\n"+
"  if(planType==='WELFARE'){\n"+
"    if(plannedAmount!=null&&(!Number.isFinite(plannedAmount)||plannedAmount<=0)) return res.status(400).json({error:'Enter a valid planned amount or leave it blank.'});\n"+
"    if(monthlyAmount!=null&&(!Number.isFinite(monthlyAmount)||monthlyAmount<=0)) return res.status(400).json({error:'Enter a valid monthly required savings or leave it blank.'});\n"+
"  }\n"+
"  const memberResult=await pool.query('SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1',[username]);\n"+
"  const member=memberResult.rows[0];\n"+
"  if(!member||!member.is_active) return res.status(404).json({error:'Active member account not found.'});\n"+
"  if(member.role!=='regular') return res.status(400).json({error:'SETUP is for Regular member accounts.'});\n"+
"  let months=(end.getUTCFullYear()-start.getUTCFullYear())*12+(end.getUTCMonth()-start.getUTCMonth());\n"+
"  if(end.getUTCDate()>=start.getUTCDate()) months+=1;\n"+
"  if(months<1) months=1;\n"+
"  const result=await pool.query(\n"+
"    \"INSERT INTO savings_plans(account_id,plan_type,start_date,end_date,duration_months,target_amount,planned_amount,monthly_amount,minimum_balance,disbursement_months,status,created_by_account_id) VALUES($1,$2,$3,$4,$5,$6,$6,$7,NULL,NULL,'active',$8) ON CONFLICT(account_id,plan_type) DO UPDATE SET start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,duration_months=EXCLUDED.duration_months,target_amount=EXCLUDED.target_amount,planned_amount=EXCLUDED.planned_amount,monthly_amount=EXCLUDED.monthly_amount,status='active',created_by_account_id=EXCLUDED.created_by_account_id,updated_at=NOW() RETURNING plan_type,start_date,end_date,duration_months,planned_amount,monthly_amount,status\",\n"+
"    [member.id,planType,startDate,endDate,months,plannedAmount,monthlyAmount,req.auth.sub]\n"+
"  );\n"+
"  await writeAdminAudit(pool,req,'CREATE_SAVINGS_SETUP','savings_plan',planType,username,{planType,startDate,endDate,plannedAmount,monthlyRequiredSavings:monthlyAmount});\n"+
"  res.json({member:{username:member.username,name:member.full_name},plan:result.rows[0]});\n"+
"});\n\n";
  if(!admin.includes(marker)){console.error('Stage 173 savings plans route marker missing');process.exit(1);}
  admin=admin.replace(marker,route+marker);
}
fs.writeFileSync('server/routes/admin.js',admin);

/* ---------- member API: expose active setup types ---------- */
let account=fs.readFileSync('server/routes/account.js','utf8');
if(!account.includes('activeSavingsPlanTypesV173')){
  const marker="  const cooperativeSettingsResult=await pool.query(";
  const block="  const activeSavingsPlansV173=await pool.query(\"SELECT plan_type,start_date,end_date,planned_amount,monthly_amount,status FROM savings_plans WHERE account_id=$1 AND status='active' ORDER BY plan_type\",[req.auth.sub]);\n  const activeSavingsPlanTypesV173=activeSavingsPlansV173.rows.map(r=>r.plan_type);\n";
  if(!account.includes(marker)){console.error('Stage 173 account setup marker missing');process.exit(1);}
  account=account.replace(marker,block+marker);

  const resp="savingsTypeBreakdown: savingsTypeBreakdownV169, minimumSharePerMonth,";
  if(!account.includes(resp)){console.error('Stage 173 member response marker missing');process.exit(1);}
  account=account.replace(resp,"savingsTypeBreakdown: savingsTypeBreakdownV169, activeSavingsPlanTypes: activeSavingsPlanTypesV173, minimumSharePerMonth,");
}
fs.writeFileSync('server/routes/account.js',account);

/* ---------- Admin SETUP dialog ---------- */
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="adminSavingsSetupDialogV173"')){
  const marker='<dialog id="adminSettingsDialog"';
  const dialog='\n  <dialog id="adminSavingsSetupDialogV173">\n    <div class="dialog-card">\n      <div class="dialog-head"><h3>SETUP</h3><button type="button" class="icon-btn" data-close="adminSavingsSetupDialogV173" aria-label="Close">×</button></div>\n      <label>Username<input id="setupUsernameV173" maxlength="5" inputmode="numeric" /></label>\n      <div class="dialog-actions"><button type="button" class="secondary" id="setupConfirmV173">CONFIRM</button></div>\n      <div id="setupMemberConfirmV173" class="member-confirm"></div>\n      <label>Select Savings Type<select id="setupTypeV173"><option value="">- Select -</option><option value="TARGET">TARGET</option><option value="CONSTANT">CONSTANT</option><option value="WELFARE">WELFARE</option></select></label>\n      <label>Planned Amount (₦)<input id="setupPlannedV173" type="number" min="0.01" step="0.01" /></label>\n      <label>Start Date<input id="setupStartV173" type="date" /></label>\n      <label>End Date<input id="setupEndV173" type="date" /></label>\n      <label>Monthly Required Savings (₦)<input id="setupMonthlyV173" type="number" min="0.01" step="0.01" /></label>\n      <p class="helper" id="setupHelpV173"></p>\n      <p class="form-error" id="setupErrorV173" role="alert"></p>\n      <p class="form-success" id="setupSuccessV173" role="status"></p>\n      <div class="dialog-actions"><button type="button" class="primary" id="setupCreateV173">CREATE</button></div>\n    </div>\n  </dialog>\n\n';
  if(!html.includes(marker)){console.error('Stage 173 setup dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=173');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=173');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=173');
fs.writeFileSync('www/index.html',html);

/* ---------- Frontend ---------- */
let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes("['SETUP', 'Create member savings setup']")){
  const marker="['PUBLIC INFORMATION', 'Edit home-page information'],";
  if(!app.includes(marker)){console.error('Stage 173 admin tile marker missing');process.exit(1);}
  app=app.replace(marker,marker+"\n    ['SETUP', 'Create member savings setup'],");
}

if(!app.includes("if (title === 'SETUP')")){
  const marker="if (title === 'PUBLIC INFORMATION') { openPublicInformationV146(); }";
  if(!app.includes(marker)){console.error('Stage 173 admin action marker missing');process.exit(1);}
  app=app.replace(marker,marker+"\n  if (title === 'SETUP') { openSavingsSetupV173(); }");
}

if(!app.includes('function openSavingsSetupV173')){
  const marker='function renderDashboard() {';
  const code="\nlet confirmedSetupMemberV173=null;\n"+
"function updateSetupRequirementsV173(){\n"+
"  const type=document.getElementById('setupTypeV173')?.value||'';\n"+
"  const planned=document.getElementById('setupPlannedV173');\n"+
"  const monthly=document.getElementById('setupMonthlyV173');\n"+
"  const help=document.getElementById('setupHelpV173');\n"+
"  const mandatory=type==='TARGET'||type==='CONSTANT';\n"+
"  if(planned) planned.required=mandatory;\n"+
"  if(monthly) monthly.required=mandatory;\n"+
"  if(help) help.textContent=mandatory?'Planned Amount and Monthly Required Savings are mandatory for '+type+'.':type==='WELFARE'?'Planned Amount and Monthly Required Savings are optional for WELFARE.':'';\n"+
"}\n"+
"function openSavingsSetupV173(){\n"+
"  confirmedSetupMemberV173=null;\n"+
"  ['setupUsernameV173','setupPlannedV173','setupStartV173','setupEndV173','setupMonthlyV173'].forEach(id=>{const el=document.getElementById(id);if(el) el.value='';});\n"+
"  const type=document.getElementById('setupTypeV173');if(type) type.value='';\n"+
"  const confirm=document.getElementById('setupMemberConfirmV173');if(confirm){confirm.textContent='';confirm.className='member-confirm';}\n"+
"  document.getElementById('setupErrorV173').textContent='';document.getElementById('setupSuccessV173').textContent='';\n"+
"  updateSetupRequirementsV173();openDialog(document.getElementById('adminSavingsSetupDialogV173'));\n"+
"}\n"+
"document.getElementById('setupTypeV173')?.addEventListener('change',updateSetupRequirementsV173);\n"+
"document.getElementById('setupConfirmV173')?.addEventListener('click',async()=>{\n"+
"  const error=document.getElementById('setupErrorV173'), success=document.getElementById('setupSuccessV173'), box=document.getElementById('setupMemberConfirmV173');\n"+
"  error.textContent='';success.textContent='';confirmedSetupMemberV173=null;box.textContent='';box.className='member-confirm';\n"+
"  try{const username=document.getElementById('setupUsernameV173').value.trim();if(!username) throw new Error('Enter username.');const data=await api('/api/admin/savings-plans?username='+encodeURIComponent(username),{cache:'no-store'});confirmedSetupMemberV173=data.member;box.textContent=data.member.name+' – '+data.member.username;box.className='member-confirm show';}catch(e){error.textContent=e.message;}\n"+
"});\n"+
"document.getElementById('setupCreateV173')?.addEventListener('click',async()=>{\n"+
"  const error=document.getElementById('setupErrorV173'),success=document.getElementById('setupSuccessV173');error.textContent='';success.textContent='';\n"+
"  try{if(!confirmedSetupMemberV173) throw new Error('Confirm the member first.');const planType=document.getElementById('setupTypeV173').value;const planned=document.getElementById('setupPlannedV173').value;const monthly=document.getElementById('setupMonthlyV173').value;const startDate=document.getElementById('setupStartV173').value;const endDate=document.getElementById('setupEndV173').value;if(!planType) throw new Error('Select savings type.');if(!startDate||!endDate) throw new Error('Select start and end dates.');if((planType==='TARGET'||planType==='CONSTANT')&&(!planned||!monthly)) throw new Error('Planned Amount and Monthly Required Savings are mandatory for '+planType+'.');const data=await api('/api/admin/setup-savings-plan',{method:'POST',body:JSON.stringify({username:confirmedSetupMemberV173.username,planType,plannedAmount:planned,monthlyRequiredSavings:monthly,startDate,endDate})});success.textContent=data.member.name+': '+data.plan.plan_type+' CREATED SUCCESSFULLY';}catch(e){error.textContent=e.message;}\n"+
"});\n\n";
  if(!app.includes(marker)){console.error('Stage 173 render marker missing');process.exit(1);}
  app=app.replace(marker,code+marker);
}

/* TARGET / CONSTANT / WELFARE only appear if activated by SETUP */
const oldCards="    ['REGULAR', ''],\n    ['TARGET', ''],\n    ['CONSTANT', ''],\n    ['WELFARE', ''],\n    ['FLEXIBLE', naira(b.flexible)],";
const newCards="    ['REGULAR', ''],\n    ...(['TARGET','CONSTANT','WELFARE'].filter(t=>(b.activeSavingsPlanTypes||[]).includes(t)).map(t=>[t,''])),\n    ['FLEXIBLE', naira(b.flexible)],";
if(app.includes(oldCards)) app=app.replace(oldCards,newCards);
else if(!app.includes("activeSavingsPlanTypes||[]")){console.error('Stage 173 member plan visibility marker missing');process.exit(1);}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=173'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v173';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 173 Admin SETUP savings-plan workflow applied.');
