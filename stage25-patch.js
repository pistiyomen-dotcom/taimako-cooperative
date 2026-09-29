const fs=require('fs');

// Monthly Target/Constant savings compliance assessment. Read-only: no automatic deductions.
const accountPath='server/routes/account.js';
let account=fs.readFileSync(accountPath,'utf8');
if(!account.includes("router.get('/savings-compliance'")){
  const route=`
router.get('/savings-compliance', requireAuth, async (req,res) => {
  const accountRow=await pool.query('SELECT id,username,full_name,role,is_active FROM accounts WHERE id=$1',[req.auth.sub]);
  const me=accountRow.rows[0];
  if(!me || !me.is_active) return res.status(404).json({error:'Active account not found.'});
  if(me.role!=='regular') return res.status(400).json({error:'Savings compliance applies to Regular member accounts.'});
  const plans=await pool.query("SELECT plan_type,start_date,duration_months,monthly_amount,status FROM savings_plans WHERE account_id=$1 AND plan_type IN ('TARGET','CONSTANT') AND status='active' ORDER BY plan_type",[req.auth.sub]);
  const items=[];
  for(const p of plans.rows){
    const required=Number(p.monthly_amount||0);
    const credits=await pool.query("SELECT COALESCE(SUM(amount),0) AS contributed FROM transactions WHERE account_id=$1 AND destination=$2 AND status IN ('approved','completed') AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND date_trunc('month',COALESCE(approved_at,created_at))=date_trunc('month',NOW())",[req.auth.sub,p.plan_type]);
    const contributed=Number(credits.rows[0]?.contributed||0);
    const shortfall=Math.max(0,Number((required-contributed).toFixed(2)));
    const shortfallCharge=Number((shortfall*0.10).toFixed(2));
    items.push({planType:p.plan_type,requiredAmount:required,contributedAmount:contributed,shortfallAmount:shortfall,shortfallCharge,compliant:shortfall===0,month:new Date().toISOString().slice(0,7)});
  }
  res.json({member:{username:me.username,name:me.full_name},month:new Date().toISOString().slice(0,7),items});
});
`;
  account=account.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(accountPath,account);

const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes("router.get('/savings-compliance'")){
  const route=`
router.get('/savings-compliance', async (req,res) => {
  const username=String(req.query.username||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter a member username.'});
  const memberResult=await pool.query('SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1',[username]);
  const member=memberResult.rows[0];
  if(!member || !member.is_active) return res.status(404).json({error:'Active member account not found.'});
  if(member.role!=='regular') return res.status(400).json({error:'Savings compliance applies to Regular member accounts.'});
  const plans=await pool.query("SELECT plan_type,monthly_amount,status FROM savings_plans WHERE account_id=$1 AND plan_type IN ('TARGET','CONSTANT') AND status='active' ORDER BY plan_type",[member.id]);
  const items=[];
  for(const p of plans.rows){
    const required=Number(p.monthly_amount||0);
    const credits=await pool.query("SELECT COALESCE(SUM(amount),0) AS contributed FROM transactions WHERE account_id=$1 AND destination=$2 AND status IN ('approved','completed') AND transaction_type IN ('cash_credit','bank_transfer','flexible_transfer_in') AND date_trunc('month',COALESCE(approved_at,created_at))=date_trunc('month',NOW())",[member.id,p.plan_type]);
    const contributed=Number(credits.rows[0]?.contributed||0);
    const shortfall=Math.max(0,Number((required-contributed).toFixed(2)));
    const shortfallCharge=Number((shortfall*0.10).toFixed(2));
    items.push({planType:p.plan_type,requiredAmount:required,contributedAmount:contributed,shortfallAmount:shortfall,shortfallCharge,compliant:shortfall===0,month:new Date().toISOString().slice(0,7)});
  }
  res.json({member:{username:member.username,name:member.full_name},month:new Date().toISOString().slice(0,7),items});
});
`;
  admin=admin.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(adminPath,admin);

// Show monthly compliance inside the member SAVINGS PLANS dialog.
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
if(!app.includes("const compliance=await api('/api/account/savings-compliance')")){
  app=app.replace(
"    const data=await api('/api/account/savings-plan-progress');",
"    const data=await api('/api/account/savings-plan-progress');\n    const compliance=await api('/api/account/savings-compliance');"
  );
  app=app.replace(
"    list.innerHTML='<div class=\"mini-grid\">'+data.plans.map(p=>{",
"    const complianceMap=Object.fromEntries((compliance.items||[]).map(i=>[i.planType,i]));\n    list.innerHTML='<div class=\"mini-grid\">'+data.plans.map(p=>{"
  );
  app=app.replace(
"      const progress=p.progressPercent===null?'':'<small>Progress: '+escapeHTML(p.progressPercent)+'%</small>';",
"      const progress=p.progressPercent===null?'':'<small>Progress: '+escapeHTML(p.progressPercent)+'%</small>';\n      const c=complianceMap[p.planType];\n      const complianceText=c?'<small>This month: required '+naira(c.requiredAmount)+' • credited '+naira(c.contributedAmount)+' • shortfall '+naira(c.shortfallAmount)+' • 10% shortfall charge '+naira(c.shortfallCharge)+'</small>':'';"
  );
  app=app.replace(
"      return '<div><span>'+escapeHTML(p.planType)+'</span><b>'+naira(p.currentBalance)+'</b><small>'+escapeHTML(p.durationMonths)+' months • '+escapeHTML(String(p.startDate).slice(0,10))+' to '+escapeHTML(String(p.endDate).slice(0,10))+'</small>'+detail+progress+'</div>';",
"      return '<div><span>'+escapeHTML(p.planType)+'</span><b>'+naira(p.currentBalance)+'</b><small>'+escapeHTML(p.durationMonths)+' months • '+escapeHTML(String(p.startDate).slice(0,10))+' to '+escapeHTML(String(p.endDate).slice(0,10))+'</small>'+detail+progress+complianceText+'</div>';"
  );
}
fs.writeFileSync(appPath,app);

// Cache bump.
let index=fs.readFileSync('www/index.html','utf8').replace(/app\\.js\\?v=24/g,'app.js?v=25').replace(/styles\\.css\\?v=24/g,'styles.css?v=25');
fs.writeFileSync('www/index.html',index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v24/g,'taimako-v25');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=24/g,'sw.js?v=25');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 25 monthly savings compliance assessment applied.');
