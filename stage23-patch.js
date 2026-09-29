const fs=require('fs');

// Narrow the public home-page tiles without changing their titles or navigation.
const cssPath='www/styles.css';
let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('/* Stage 23 home tile width */')){
  css += `\n/* Stage 23 home tile width */\n.menu-card { width: min(100%, 180px); justify-self: center; }\n@media (max-width: 560px) {\n  .menu-card { width: min(100%, 152px); }\n}\n`;
}
fs.writeFileSync(cssPath,css);

// Add an Admin read-only savings-plan progress endpoint.
const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes("router.get('/savings-plan-progress'")){
  const route=`
router.get('/savings-plan-progress', async (req, res) => {
  const username=String(req.query.username||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter a member username.'});
  const result=await pool.query('SELECT a.username,a.full_name,a.role, COALESCE(b.target_balance,0) AS target_balance, COALESCE(b.constant_balance,0) AS constant_balance, COALESCE(b.welfare_balance,0) AS welfare_balance, p.plan_type,p.start_date,p.duration_months,p.target_amount,p.monthly_amount,p.minimum_balance,p.disbursement_months,p.status FROM accounts a LEFT JOIN member_balances b ON b.account_id=a.id LEFT JOIN savings_plans p ON p.account_id=a.id WHERE a.username=$1 AND a.is_active=TRUE ORDER BY p.plan_type',[username]);
  if(!result.rows.length) return res.status(404).json({error:'Active member account not found.'});
  const first=result.rows[0];
  if(first.role!=='regular') return res.status(400).json({error:'Savings plan progress applies to Regular member accounts.'});
  const plans=result.rows.filter(r=>r.plan_type).map(r=>{
    const type=r.plan_type;
    const balance=Number(type==='TARGET'?r.target_balance:type==='CONSTANT'?r.constant_balance:r.welfare_balance)||0;
    const start=new Date(r.start_date);
    const end=new Date(start); end.setUTCMonth(end.getUTCMonth()+Number(r.duration_months||0));
    let benchmark=0;
    if(type==='TARGET') benchmark=Number(r.target_amount||0);
    if(type==='CONSTANT') benchmark=Number(r.minimum_balance||300000);
    const progressPercent=benchmark>0?Math.min(100,Number(((balance/benchmark)*100).toFixed(1))):null;
    return {planType:type,startDate:r.start_date,endDate:end.toISOString().slice(0,10),durationMonths:r.duration_months,
      currentBalance:money(balance),targetAmount:money(r.target_amount),monthlyAmount:money(r.monthly_amount),
      minimumBalance:money(r.minimum_balance),disbursementMonths:r.disbursement_months,status:r.status,progressPercent};
  });
  res.json({member:{username:first.username,name:first.full_name},plans});
});
`;
  admin=admin.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync(adminPath,admin);

// Enhance VIEW CURRENT in Savings Plan Setup with balance/progress details.
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
const oldFetch="    const data=await api('/api/admin/savings-plans?username=' + encodeURIComponent(username));";
const newFetch="    const data=await api('/api/admin/savings-plan-progress?username=' + encodeURIComponent(username));";
if(app.includes(oldFetch)) app=app.replace(oldFetch,newFetch);

const oldBox="    box.innerHTML='<div class=\"mini-grid\">'+data.plans.map(p=>'<div><span>'+escapeHTML(p.planType)+'</span><b>'+escapeHTML(p.durationMonths)+' months</b><small>Start: '+escapeHTML(String(p.startDate).slice(0,10))+'</small></div>').join('')+'</div>';";
const newBox="    box.innerHTML='<div class=\"mini-grid\">'+data.plans.map(p=>'<div><span>'+escapeHTML(p.planType)+'</span><b>'+naira(p.currentBalance)+'</b><small>'+escapeHTML(p.durationMonths)+' months • '+escapeHTML(String(p.startDate).slice(0,10))+' to '+escapeHTML(String(p.endDate).slice(0,10))+'</small>'+(p.progressPercent===null?'':'<small>Progress: '+escapeHTML(p.progressPercent)+'%</small>')+'</div>').join('')+'</div>';";
if(app.includes(oldBox)) app=app.replace(oldBox,newBox);
fs.writeFileSync(appPath,app);

// Cache bump.
let index=fs.readFileSync('www/index.html','utf8').replace(/app\\.js\\?v=22/g,'app.js?v=23').replace(/styles\\.css\\?v=22/g,'styles.css?v=23');
fs.writeFileSync('www/index.html',index);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/taimako-v22/g,'taimako-v23');
fs.writeFileSync('www/sw.js',sw);
app=fs.readFileSync(appPath,'utf8').replace(/sw\\.js\\?v=22/g,'sw.js?v=23');
fs.writeFileSync(appPath,app);

console.log('TAIMAKO Stage 23 compact tile width and savings-plan progress applied.');
