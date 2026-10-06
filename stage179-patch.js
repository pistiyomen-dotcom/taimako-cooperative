const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes('tmcsSetupCreateDelegatedV179')){
  const marker='function renderDashboard() {';
  const code=`
/* tmcsSetupCreateDelegatedV179 */
document.addEventListener('click', async (event)=>{
  const button=event.target.closest?.('#setupCreateV173');
  if(!button) return;
  event.preventDefault();
  event.stopPropagation();

  const error=document.getElementById('setupErrorV173');
  const success=document.getElementById('setupSuccessV173');
  if(error) error.textContent='';
  if(success) success.textContent='';

  try{
    if(!confirmedSetupMemberV173) throw new Error('Confirm the member first.');

    const planType=String(document.getElementById('setupTypeV173')?.value||'').trim().toUpperCase();
    const plannedAmount=String(document.getElementById('setupPlannedV173')?.value||'').trim();
    const monthlyRequiredSavings=String(document.getElementById('setupMonthlyV173')?.value||'').trim();
    const startDate=String(document.getElementById('setupStartV173')?.value||'').trim();
    const endDate=String(document.getElementById('setupEndV173')?.value||'').trim();

    if(!['TARGET','CONSTANT','WELFARE'].includes(planType)) throw new Error('Select TARGET, CONSTANT or WELFARE.');
    if(!startDate) throw new Error('Select start date.');
    if(!endDate) throw new Error('Select end date.');

    if(planType==='TARGET'||planType==='CONSTANT'){
      if(!plannedAmount || Number(plannedAmount)<=0) throw new Error('Planned Amount is mandatory for '+planType+'.');
      if(!monthlyRequiredSavings || Number(monthlyRequiredSavings)<=0) throw new Error('Monthly Required Savings is mandatory for '+planType+'.');
    }

    if(planType==='WELFARE'){
      if(plannedAmount && Number(plannedAmount)<=0) throw new Error('Enter a valid Planned Amount or leave it blank.');
      if(monthlyRequiredSavings && Number(monthlyRequiredSavings)<=0) throw new Error('Enter a valid Monthly Required Savings or leave it blank.');
    }

    button.disabled=true;
    button.textContent='CREATING...';

    const data=await api('/api/admin/setup-savings-plan',{
      method:'POST',
      body:JSON.stringify({
        username:confirmedSetupMemberV173.username,
        planType,
        plannedAmount,
        monthlyRequiredSavings,
        startDate,
        endDate
      })
    });

    const verify=await api('/api/admin/savings-plans?username='+encodeURIComponent(confirmedSetupMemberV173.username),{cache:'no-store'});
    const saved=(verify.plans||[]).find(p=>String(p.planType||'').toUpperCase()===planType && String(p.status||'').toLowerCase()==='active');
    if(!saved) throw new Error(planType+' was not saved. Please try again.');

    if(success) success.textContent=data.member.name+' – '+planType+' CREATED SUCCESSFULLY';
  }catch(e){
    if(error) error.textContent=e.message||'Unable to create savings setup.';
  }finally{
    button.disabled=false;
    button.textContent='CREATE';
  }
},true);

`;
  if(!app.includes(marker)){console.error('Stage 179 render marker missing');process.exit(1);}
  app=app.replace(marker,code+marker);
}

/* Disable older direct CREATE handler to avoid duplicate or dead bindings */
app=app.replace(
  "document.getElementById('setupCreateV173')?.addEventListener('click',async()=>{",
  "document.getElementById('setupCreateV173')?.addEventListener('tmcs-disabled-create',async()=>{"
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=179'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=179');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=179');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=179');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v179';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 179 SETUP CREATE action fixed with save verification.');
