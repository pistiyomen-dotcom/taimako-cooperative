const fs=require('fs');
let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes("router.post('/setup-savings-plan'"))throw Error('SETUP endpoint absent');
const marker="router.post('/setup-savings-plan', requireAdminPermission('manage_accounts'), async (req,res)=>{";
const guard=`const minSetupMonthsV230={TARGET:6,WELFARE:12,CONSTANT:36};
const getMinimumsV230=async()=>{
 const data=await pool.query("SELECT setting_key,numeric_value FROM cooperative_settings WHERE setting_key IN ('setup_min_target_months','setup_min_welfare_months','setup_min_constant_months')");
 const mins={...minSetupMonthsV230};
 for(const r of data.rows){
  const type=r.setting_key.replace('setup_min_','').replace('_months','').toUpperCase();
  const n=Number(r.numeric_value);
  if(type in mins && Number.isInteger(n)&&n>=minSetupMonthsV230[type])mins[type]=n;
 }
 return mins;
};
const addMonthsV230=(iso,n)=>{
 const [y,m,d]=iso.split('-').map(Number);
 const first=new Date(Date.UTC(y,m-1+n,1));
 const lastDay=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 return new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(d,lastDay)));
};
router.get('/setup-duration-settings-v230',requireAdminPermission('manage_accounts'),async(req,res)=>{
 res.json({minimumMonths:await getMinimumsV230()});
});
router.put('/setup-duration-settings-v230',requireAdminPermission('manage_accounts'),async(req,res)=>{
 const values=req.body?.minimumMonths||{};
 for(const [type,min] of Object.entries(minSetupMonthsV230)){
  const n=Number(values[type]);
  if(!Number.isInteger(n)||n<min||n>600)return res.status(400).json({error:type+' must be at least '+min+' months.'});
 }
 for(const type of Object.keys(minSetupMonthsV230)){
  await pool.query("INSERT INTO cooperative_settings(setting_key,numeric_value) VALUES($1,$2) ON CONFLICT(setting_key) DO UPDATE SET numeric_value=EXCLUDED.numeric_value",['setup_min_'+type.toLowerCase()+'_months',Number(values[type])]);
 }
 res.json({minimumMonths:await getMinimumsV230()});
});
`;
if(admin.includes('getMinimumsV230'))throw Error('already implemented');
admin=admin.replace(marker,guard+marker);
const needle="  const start=new Date(startDate+'T00:00:00Z');";
if(!admin.includes(needle))throw Error('validation marker not found');
admin=admin.replace(needle,`  const minimumsV230=await getMinimumsV230();
  const minMonthsV230=minimumsV230[planType];
  if(minMonthsV230&&new Date(endDate+'T00:00:00Z')<addMonthsV230(startDate,minMonthsV230))return res.status(400).json({error:planType+' setup requires a minimum duration of '+minMonthsV230+' months.'});
`+needle);
fs.writeFileSync('server/routes/admin.js',admin);
let html=fs.readFileSync('www/index.html','utf8');
const sMarker='<dialog id="adminSettingsDialog"';
if(!html.includes(sMarker))throw Error('Settings dialog missing');
const panel=`<section id="tmcsSetupDurationSettingsV230" style="padding:14px;margin:12px 0;border:1px solid #cbd7ce;border-radius:12px;background:#f8fbf7">
<h4>MINIMUM SETUP DURATION</h4>
<label>TARGET (months)<input id="tmcsTargetMinV230" type="number" min="6" max="600" step="1" value="6"></label>
<label>WELFARE (months)<input id="tmcsWelfareMinV230" type="number" min="12" max="600" step="1" value="12"></label>
<label>CONSTANT (months)<input id="tmcsConstantMinV230" type="number" min="36" max="600" step="1" value="36"></label>
<button type="button" id="tmcsSaveSetupMinimumsV230" class="primary">SAVE SETUP DURATION</button>
<p id="tmcsSetupMinimumNoticeV230" role="status" aria-live="polite"></p>
</section>
`;
html=html.replace(sMarker,sMarker); 
const place='<dialog id="adminSettingsDialog"';
const at=html.indexOf(place);
const openEnd=html.indexOf('>',at);
const close=html.indexOf('</dialog>',openEnd);
if(close<0)throw Error('Settings close not found');
html=html.slice(0,close)+panel+html.slice(close);
const script=`/* tmcsSetupDurationControlsV230 */
(function(){
 const fields={TARGET:'tmcsTargetMinV230',WELFARE:'tmcsWelfareMinV230',CONSTANT:'tmcsConstantMinV230'};
 const floors={TARGET:6,WELFARE:12,CONSTANT:36};
 const notice=()=>document.getElementById('tmcsSetupMinimumNoticeV230');
 async function load(){
  try{
   const data=await api('/api/admin/setup-duration-settings-v230',{cache:'no-store'});
   for(const key of Object.keys(fields))document.getElementById(fields[key]).value=data.minimumMonths[key];
  }catch(_){}
 }
 document.addEventListener('click',async e=>{
  if(e.target?.id==='tmcsSaveSetupMinimumsV230'){
   const values={};
   for(const key of Object.keys(fields)){
    const n=Number(document.getElementById(fields[key]).value);
    if(!Number.isInteger(n)||n<floors[key]){notice().textContent=key+' minimum is '+floors[key]+' months.';return;}
    values[key]=n;
   }
   try{
    const data=await api('/api/admin/setup-duration-settings-v230',{method:'PUT',body:JSON.stringify({minimumMonths:values})});
    notice().textContent='SETUP DURATION SAVED';
   }catch(err){notice().textContent=err.message;}
  }
  if(e.target?.id==='setupCreateV173'){
    const type=document.getElementById('setupTypeV173')?.value;
    const start=document.getElementById('setupStartV173')?.value;
    const end=document.getElementById('setupEndV173')?.value;
    if(type&&start&&end){
      const n=Number(document.getElementById(fields[type])?.value||floors[type]);
      const d=new Date(start+'T00:00:00Z');
      const expected=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1));
      const endDate=new Date(end+'T00:00:00Z');
      if(endDate<expected){const msg=document.getElementById('setupErrorV173');if(msg)msg.textContent=type+' setup requires at least '+n+' months.';}
    }
  }
 },true);
 document.addEventListener('click',e=>{if(e.target?.closest?.('[data-action="settings"]'))load();},true);
 const obs=new MutationObserver(()=>{if(document.getElementById('adminSettingsDialog')?.open&&!window.tmcsDurationLoadedV230){window.tmcsDurationLoadedV230=true;load();}if(!document.getElementById('adminSettingsDialog')?.open)window.tmcsDurationLoadedV230=false;});
 document.addEventListener('DOMContentLoaded',()=>obs.observe(document.body,{attributes:true,subtree:true,attributeFilter:['open']}));
})();`;
fs.writeFileSync('www/index.html',html);
let app=fs.readFileSync('www/app.js','utf8');
app+='\n'+script+'\n';
fs.writeFileSync('www/app.js',app);
console.log('Stage 230 minimum setup duration settings and server validation installed.');

// Keep Advance Cash Credit date presentation in DD/MM/YYYY without changing posting logic.
require('./stage226-patch.js');
