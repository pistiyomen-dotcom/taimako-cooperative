const fs=require('fs');

// Stage 196: Regular member ADVANCE SAVING REPORT.

let account=fs.readFileSync('server/routes/account.js','utf8');
if(!account.includes("router.get('/advance-saving-report'")){
  const marker="router.post('/advance-saving-requests', requireAuth, upload.single('receipt'), async (req,res)=>{";
  const route=String.raw`
router.get('/advance-saving-report', requireAuth, async (req,res)=>{
  const me=(await pool.query('SELECT id,role,is_active FROM accounts WHERE id=$1',[req.auth.sub])).rows[0];
  if(!me||!me.is_active||me.role!=='regular') return res.status(403).json({error:'Only active Regular members can view Advance Saving Report.'});

  const requests=await pool.query(
    "SELECT id,reference,destination,amount,status,note,created_at,reviewed_at,advance_start_month,advance_share_count "+
    "FROM payment_requests WHERE account_id=$1 AND request_type='advance_saving' AND status='approved' "+
    "ORDER BY COALESCE(reviewed_at,created_at) DESC,id DESC",
    [req.auth.sub]
  );

  const ids=requests.rows.map(r=>r.id);
  let allocations=[];
  if(ids.length){
    const q=await pool.query(
      "SELECT payment_request_id,savings_type,period_month,allocated_amount,allocated_shares "+
      "FROM advance_saving_allocations WHERE account_id=$1 AND payment_request_id=ANY($2::bigint[]) "+
      "ORDER BY payment_request_id,period_month",
      [req.auth.sub,ids]
    );
    allocations=q.rows;
  }

  const byRequest=new Map();
  for(const row of allocations){
    if(!byRequest.has(String(row.payment_request_id))) byRequest.set(String(row.payment_request_id),[]);
    byRequest.get(String(row.payment_request_id)).push({
      savingsType:row.savings_type,
      periodMonth:row.period_month,
      amount:Number(row.allocated_amount||0),
      shares:Number(row.allocated_shares||0)
    });
  }

  res.json({
    reports:requests.rows.map(r=>({
      id:r.id,
      reference:r.reference,
      destination:r.destination,
      amount:Number(r.amount||0),
      status:r.status,
      note:r.note,
      submittedAt:r.created_at,
      approvedAt:r.reviewed_at,
      startMonth:r.advance_start_month,
      sharesPerMonth:Number(r.advance_share_count||0),
      allocations:byRequest.get(String(r.id))||[]
    }))
  });
});

`;
  if(!account.includes(marker)){console.error('Stage 196 advance-saving route marker missing');process.exit(1);}
  account=account.replace(marker,route+marker);
}
fs.writeFileSync('server/routes/account.js',account);

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="advanceSavingReportV196Dialog"')){
  const marker='<dialog id="adminSettingsDialog"';
  const dialog=String.raw`
  <dialog id="advanceSavingReportV196Dialog">
    <div class="dialog-card" style="max-width:760px">
      <div class="dialog-head">
        <h3>ADVANCE SAVING REPORT</h3>
        <button type="button" class="icon-btn" data-close="advanceSavingReportV196Dialog" aria-label="Close">×</button>
      </div>
      <div id="advanceSavingReportV196Status" class="helper">Loading report...</div>
      <div id="advanceSavingReportV196List" style="display:grid;gap:12px;margin-top:10px"></div>
    </div>
  </dialog>

`;
  if(!html.includes(marker)){console.error('Stage 196 report dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=196');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=196');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=196');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=196');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes("['ADVANCE SAVING REPORT', 'Open approved advance saving report']")){
  const marker="    ['ADVANCE SAVING', 'Open advance savings payment form'],";
  if(!app.includes(marker)){console.error('Stage 196 ADVANCE SAVING tile marker missing');process.exit(1);}
  app=app.replace(marker,marker+"\n    ['ADVANCE SAVING REPORT', 'Open approved advance saving report'],");
}

if(!app.includes("title === 'ADVANCE SAVING REPORT'")){
  const marker="if (user.role === 'regular' && title === 'ADVANCE SAVING') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', openAdvanceSavingV189); card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') openAdvanceSavingV189(); }); }";
  if(!app.includes(marker)){console.error('Stage 196 Advance Saving action marker missing');process.exit(1);}
  const action="if (user.role === 'regular' && title === 'ADVANCE SAVING REPORT') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', openAdvanceSavingReportV196); card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') openAdvanceSavingReportV196(); }); }";
  app=app.replace(marker,marker+"\n    "+action);
}

if(!app.includes('function openAdvanceSavingReportV196()')){
  const marker='function renderDashboard() {';
  const code=String.raw`
function advanceReportMoneyV196(value){
  const n=Number(value||0);
  try{return new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',minimumFractionDigits:2}).format(n);}
  catch(_){return '₦'+n.toLocaleString();}
}
function advanceReportDateV196(value){
  if(!value) return '—';
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return String(value).slice(0,10);
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}
function advanceReportMonthV196(value){
  if(!value) return '—';
  const s=String(value).slice(0,7);
  const p=s.split('-');
  if(p.length!==2) return s;
  const d=new Date(Number(p[0]),Number(p[1])-1,1);
  return d.toLocaleString('en-US',{month:'short',year:'numeric'}).toUpperCase();
}
function advanceReportEscapeV196(value){
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function openAdvanceSavingReportV196(){
  const dialog=document.getElementById('advanceSavingReportV196Dialog');
  const status=document.getElementById('advanceSavingReportV196Status');
  const list=document.getElementById('advanceSavingReportV196List');
  if(status) status.textContent='Loading report...';
  if(list) list.innerHTML='';
  openDialog(dialog);
  try{
    const data=await api('/api/account/advance-saving-report',{cache:'no-store'});
    const reports=Array.isArray(data?.reports)?data.reports:[];
    if(!reports.length){
      if(status) status.textContent='No approved Advance Saving record yet.';
      return;
    }
    if(status) status.textContent=reports.length+' approved Advance Saving record'+(reports.length===1?'':'s')+'.';
    if(list) list.innerHTML=reports.map((r,index)=>{
      const allocations=Array.isArray(r.allocations)?r.allocations:[];
      const schedule=allocations.length
        ? '<div style="margin-top:10px"><strong>MONTHLY ALLOCATION</strong>'+
          '<div style="overflow:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:.92rem">'+
          '<thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd">Month</th><th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">Amount</th><th style="text-align:right;padding:6px;border-bottom:1px solid #ddd">Shares</th></tr></thead>'+
          '<tbody>'+allocations.map(a=>'<tr><td style="padding:6px;border-bottom:1px solid #eee">'+advanceReportMonthV196(a.periodMonth)+'</td><td style="padding:6px;text-align:right;border-bottom:1px solid #eee">'+advanceReportMoneyV196(a.amount)+'</td><td style="padding:6px;text-align:right;border-bottom:1px solid #eee">'+Number(a.shares||0)+'</td></tr>').join('')+'</tbody></table></div></div>'
        : '<div class="helper" style="margin-top:8px">No monthly allocation rows recorded.</div>';
      return '<section style="border:1px solid #d8e0db;border-radius:12px;padding:12px;background:#fff">'+
        '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">'+
        '<div><strong style="font-size:1.05rem">#'+(index+1)+' '+advanceReportEscapeV196(r.destination||'')+'</strong><div class="helper">'+advanceReportEscapeV196(r.reference||'')+'</div></div>'+
        '<strong style="color:#08783e">APPROVED</strong></div>'+
        '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px">'+
        '<div><span class="helper">Amount</span><br><strong>'+advanceReportMoneyV196(r.amount)+'</strong></div>'+
        '<div><span class="helper">Shares / Month</span><br><strong>'+Number(r.sharesPerMonth||0)+'</strong></div>'+
        '<div><span class="helper">Start Month</span><br><strong>'+advanceReportMonthV196(r.startMonth)+'</strong></div>'+
        '<div><span class="helper">Submitted</span><br><strong>'+advanceReportDateV196(r.submittedAt)+'</strong></div>'+
        '<div><span class="helper">Approved by Admin</span><br><strong>'+advanceReportDateV196(r.approvedAt)+'</strong></div>'+
        '</div>'+schedule+'</section>';
    }).join('');
  }catch(e){
    if(status) status.textContent=e.message||'Unable to load Advance Saving Report.';
  }
}

`;
  if(!app.includes(marker)){console.error('Stage 196 render marker missing');process.exit(1);}
  app=app.replace(marker,code+marker);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=196'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v196';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 196 Advance Saving Report applied.');
