const fs=require('fs');
function replaceOnceV242(source,oldText,newText,label){
  const i=source.indexOf(oldText);
  if(i<0)throw new Error('Stage 242: missing '+label);
  if(source.indexOf(oldText,i+oldText.length)>=0)throw new Error('Stage 242: non-unique '+label);
  return source.slice(0,i)+newText+source.slice(i+oldText.length);
}
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('TAIMAKO_CASH_REQUISITIONS_V242')){
  schema+=String.raw`
-- TAIMAKO_CASH_REQUISITIONS_V242
CREATE TABLE IF NOT EXISTS cash_requisitions_v242 (
 id BIGSERIAL PRIMARY KEY,
 description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 1000),
 account_source VARCHAR(32) NOT NULL CHECK (account_source IN ('MANAGEMENT BALANCE','TMCS LTD BALANCE')),
 amount NUMERIC(16,2) NOT NULL CHECK (amount > 0),
 status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 initiated_by INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
 approved_by INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
 rejected_by INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 approved_at TIMESTAMPTZ,
 rejected_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS cash_requisitions_v242_status_created_idx ON cash_requisitions_v242(status,created_at DESC);
CREATE INDEX IF NOT EXISTS cash_requisitions_v242_approved_idx ON cash_requisitions_v242(approved_at) WHERE status='approved';
`;
  fs.writeFileSync(schemaPath,schema);
}
const adminPath='server/routes/admin.js';
let admin=fs.readFileSync(adminPath,'utf8');
if(!admin.includes("router.get('/cash-requisitions-v242'")){
 const marker="router.get('/setup-member'";
 if(!admin.includes(marker))throw new Error('Stage 242: Admin route insertion point missing');
 const routes=String.raw`
router.post('/cash-requisitions-v242', requireAdminPermission('manage_accounts'), async (req,res)=>{
 const description=String(req.body?.description||'').trim();
 const accountSource=String(req.body?.accountSource||'').trim().toUpperCase();
 const amount=Number(req.body?.amount);
 if(!description||description.length>1000)return res.status(400).json({error:'Enter a description (maximum 1,000 characters).'});
 if(!['MANAGEMENT BALANCE','TMCS LTD BALANCE'].includes(accountSource))return res.status(400).json({error:'Select a valid account.'});
 if(!Number.isFinite(amount)||amount<=0||Math.round(amount*100)/100!==amount)return res.status(400).json({error:'Enter a valid amount with no more than two decimal places.'});
 const created=await pool.query("INSERT INTO cash_requisitions_v242(description,account_source,amount,initiated_by) VALUES($1,$2,$3,$4) RETURNING id,description,account_source,amount,status,created_at",[description,accountSource,amount,Number(req.auth.sub)]);
 res.status(201).json({request:created.rows[0]});
});
router.get('/cash-requisitions-v242', requireAdminPermission('manage_accounts'), async (req,res)=>{
 const result=await pool.query("SELECT r.id,r.description,r.account_source,r.amount,r.status,r.created_at,r.approved_at,COALESCE(i.full_name,i.username,'Admin') AS initiated_by,COALESCE(a.full_name,a.username,'') AS approved_by FROM cash_requisitions_v242 r LEFT JOIN accounts i ON i.id=r.initiated_by LEFT JOIN accounts a ON a.id=r.approved_by WHERE r.status='pending' ORDER BY r.created_at ASC,r.id ASC");
 res.set('Cache-Control','no-store');res.json({requests:result.rows});
});
router.post('/cash-requisitions-v242/:id/approve', requireAdminPermission('manage_accounts'), async (req,res)=>{
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid requisition.'});
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const found=await client.query("SELECT id,account_source,amount,status FROM cash_requisitions_v242 WHERE id=$1 FOR UPDATE",[id]);
  const item=found.rows[0];
  if(!item){await client.query('ROLLBACK');return res.status(404).json({error:'Cash request not found.'});}
  if(item.status!=='pending'){await client.query('ROLLBACK');return res.status(409).json({error:'This cash request has already been reviewed.'});}
  const amount=Number(item.amount);
  if(item.account_source==='MANAGEMENT BALANCE'){
   const balance=await client.query('SELECT management_balance FROM cooperative_financials WHERE id=1 FOR UPDATE');
   if(!balance.rows[0])throw Object.assign(new Error('Management Balance account is not configured.'),{statusCode:409});
   if(Number(balance.rows[0].management_balance||0)<amount)throw Object.assign(new Error('Insufficient Management Balance to approve this request.'),{statusCode:400});
   await client.query('UPDATE cooperative_financials SET management_balance=management_balance-$1 WHERE id=1',[amount]);
  }else if(item.account_source==='TMCS LTD BALANCE'){
   const balance=await client.query('SELECT available_balance FROM tmcs_cooperative_ledger WHERE id=1 FOR UPDATE');
   if(!balance.rows[0])throw Object.assign(new Error('TMCS LTD Balance ledger is not configured.'),{statusCode:409});
   if(Number(balance.rows[0].available_balance||0)<amount)throw Object.assign(new Error('Insufficient TMCS LTD Balance to approve this request.'),{statusCode:400});
   await client.query('UPDATE tmcs_cooperative_ledger SET available_balance=available_balance-$1,updated_at=NOW() WHERE id=1',[amount]);
  }else throw Object.assign(new Error('Unknown account source.'),{statusCode:400});
  const updated=await client.query("UPDATE cash_requisitions_v242 SET status='approved',approved_by=$2,approved_at=NOW() WHERE id=$1 AND status='pending' RETURNING id,description,account_source,amount,status,approved_at",[id,Number(req.auth.sub)]);
  if(!updated.rowCount)throw Object.assign(new Error('This cash request has already been reviewed.'),{statusCode:409});
  await client.query('COMMIT');res.json({request:updated.rows[0]});
 }catch(err){try{await client.query('ROLLBACK');}catch(_){}res.status(err.statusCode||500).json({error:err.statusCode?err.message:'Could not approve cash request. No balance change was committed.'});}
 finally{client.release();}
});
router.post('/cash-requisitions-v242/:id/reject', requireAdminPermission('manage_accounts'), async (req,res)=>{
 const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Invalid requisition.'});
 const result=await pool.query("UPDATE cash_requisitions_v242 SET status='rejected',rejected_by=$2,rejected_at=NOW() WHERE id=$1 AND status='pending' RETURNING id,status",[id,Number(req.auth.sub)]);
 if(!result.rowCount)return res.status(409).json({error:'Cash request not found or already reviewed.'});
 res.json({request:result.rows[0]});
});
router.get('/expenditure-report-v242', requireAdminPermission('manage_accounts'), async (req,res)=>{
 const effectiveFrom='2026-11-01T00:00:00+01:00';
 const rows=await pool.query("SELECT r.id,r.description,r.account_source,r.amount,r.created_at,r.approved_at,COALESCE(i.full_name,i.username,'Admin') AS initiated_by,COALESCE(a.full_name,a.username,'') AS approved_by FROM cash_requisitions_v242 r LEFT JOIN accounts i ON i.id=r.initiated_by LEFT JOIN accounts a ON a.id=r.approved_by WHERE r.status='approved' AND r.approved_at >= $1::timestamptz ORDER BY r.approved_at DESC,r.id DESC",[effectiveFrom]);
 const totals=await pool.query("SELECT account_source,COALESCE(SUM(amount),0) AS total FROM cash_requisitions_v242 WHERE status='approved' AND approved_at >= $1::timestamptz GROUP BY account_source",[effectiveFrom]);
 const map={'MANAGEMENT BALANCE':0,'TMCS LTD BALANCE':0};for(const row of totals.rows)map[row.account_source]=Number(row.total||0);
 res.set('Cache-Control','no-store');res.json({effectiveFrom:'01/11/2026',requests:rows.rows,totals:{management:Number(map['MANAGEMENT BALANCE']||0),tmcsLtd:Number(map['TMCS LTD BALANCE']||0)}});
});
`;
 admin=admin.replace(marker,routes+marker);fs.writeFileSync(adminPath,admin);
}
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
const tileAnchor="['MANAGEMENT BALANCE', naira(b.managementBalance)],";
if(!app.includes("['CASH REQUEST', 'Submit a cash requisition']")){
 if(!app.includes(tileAnchor))throw new Error('Stage 242: Admin dashboard tile anchor missing');
 app=replaceOnceV242(app,tileAnchor,tileAnchor+"\n    ['CASH REQUEST', 'Submit a cash requisition'],\n    ['EXPENDITURE REPORT', 'View approved cash expenditure'],",'Admin balance tile collection');
}
const htmlPath='www/index.html';
let html=fs.readFileSync(htmlPath,'utf8');
if(!html.includes('tmcsCashRequestDialogV242')){
 const dialogs=String.raw`
<dialog id="tmcsCashRequestDialogV242" style="width:min(560px,94vw);border:0;border-radius:14px;padding:20px;max-height:90vh;overflow:auto">
<h2 style="margin-top:0">CASH REQUEST</h2>
<form id="tmcsCashRequestFormV242">
<label for="tmcsCashRequestDescriptionV242">Description</label><textarea id="tmcsCashRequestDescriptionV242" rows="3" maxlength="1000" required style="width:100%;box-sizing:border-box;margin:6px 0 14px"></textarea>
<label for="tmcsCashRequestAccountV242">Select account</label><select id="tmcsCashRequestAccountV242" required style="width:100%;margin:6px 0 14px;padding:10px"><option value="">Select account</option><option value="MANAGEMENT BALANCE">MANAGEMENT BALANCE</option><option value="TMCS LTD BALANCE">TMCS LTD BALANCE</option></select>
<label for="tmcsCashRequestAmountV242">Amount (₦)</label><input id="tmcsCashRequestAmountV242" type="number" min="0.01" step="0.01" required style="width:100%;box-sizing:border-box;margin:6px 0 14px;padding:10px">
<p id="tmcsCashRequestNoticeV242" role="status" aria-live="polite"></p><button class="primary" type="submit" id="tmcsCashRequestSubmitV242">SUBMIT</button> <button type="button" id="tmcsCashRequestCloseV242">CLOSE</button>
</form></dialog>
<dialog id="tmcsExpenditureDialogV242" style="width:min(1000px,96vw);border:0;border-radius:14px;padding:20px;max-height:90vh;overflow:auto">
<h2 style="margin-top:0">EXPENDITURE REPORT</h2><p>Effective from <strong>01/11/2026</strong></p>
<div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0"><div style="padding:12px;border:1px solid #ddd;border-radius:10px;min-width:210px">MANAGEMENT TOTAL EXPENDITURE <strong id="tmcsManagementExpenseTotalV242">₦0.00</strong></div><div style="padding:12px;border:1px solid #ddd;border-radius:10px;min-width:210px">TMCS LTD TOTAL EXPENDITURE <strong id="tmcsLtdExpenseTotalV242">₦0.00</strong></div></div>
<p id="tmcsExpenditureNoticeV242" role="status" aria-live="polite"></p><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:760px"><thead><tr><th>Description</th><th>Account</th><th>Amount</th><th>Initiated by</th><th>Approved by</th><th>Date initiated</th><th>Date approved</th></tr></thead><tbody id="tmcsExpenditureRowsV242"><tr><td colspan="7">No approved expenditure recorded from 01/11/2026.</td></tr></tbody></table></div>
<p style="margin-top:16px"><button type="button" id="tmcsExpenditureRefreshV242">REFRESH REPORT</button> <button type="button" id="tmcsExpenditureCloseV242">CLOSE</button></p></dialog>
`;
 if(!html.includes('</body>'))throw new Error('Stage 242: HTML body closing marker missing');
 html=html.replace('</body>',dialogs+'\n</body>');
}
if(!app.includes('TAIMAKO_CASH_REQUEST_UI_V242')){
 app+=String.raw`
/* TAIMAKO_CASH_REQUEST_UI_V242 */
(function(){
 const byId=id=>document.getElementById(id);
 const normal=s=>String(s||'').replace(/\s+/g,' ').trim().toUpperCase();
 const money=n=>'₦'+Number(n||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
 const fullDate=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('en-GB',{timeZone:'Africa/Lagos',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});};
 function openCashRequest(){const d=byId('tmcsCashRequestDialogV242');if(d){byId('tmcsCashRequestNoticeV242').textContent='';byId('tmcsCashRequestFormV242').reset();if(!d.open)d.showModal();}}
 async function loadExpenditure(){
  const notice=byId('tmcsExpenditureNoticeV242');if(notice)notice.textContent='Loading report…';
  try{
   const data=await api('/api/admin/expenditure-report-v242',{cache:'no-store'});
   byId('tmcsManagementExpenseTotalV242').textContent=money(data.totals?.management);byId('tmcsLtdExpenseTotalV242').textContent=money(data.totals?.tmcsLtd);
   const tbody=byId('tmcsExpenditureRowsV242');tbody.replaceChildren();const rows=Array.isArray(data.requests)?data.requests:[];
   if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent='No approved expenditure recorded from 01/11/2026.';tr.appendChild(td);tbody.appendChild(tr);}
   for(const r of rows){const tr=document.createElement('tr');for(const v of [r.description,r.account_source,money(r.amount),r.initiated_by,r.approved_by,fullDate(r.created_at),fullDate(r.approved_at)]){const td=document.createElement('td');td.textContent=v==null?'—':String(v);td.style.cssText='padding:8px;border-bottom:1px solid #eee;text-align:left';tr.appendChild(td);}tbody.appendChild(tr);}
   notice.textContent='Report refreshed. Effective from 01/11/2026.';
  }catch(err){notice.textContent=err?.message||'Unable to load expenditure report.';}
 }
 async function renderPendingRequests(host){
  if(!host)return;let section=host.querySelector('#tmcsPendingCashRequestsV242');
  if(!section){section=document.createElement('section');section.id='tmcsPendingCashRequestsV242';section.style.cssText='margin:16px 0;padding:14px;border:1px solid #cbd7ce;border-radius:12px;background:#f8fbf7';
   section.innerHTML='<h3 style="margin-top:0">CASH REQUESTS AWAITING APPROVAL</h3><p id="tmcsPendingCashNoticeV242" role="status"></p><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:620px"><thead><tr><th>Description</th><th>Account</th><th>Amount</th><th>Initiated by</th><th>Date</th><th>Action</th></tr></thead><tbody id="tmcsPendingCashRowsV242"></tbody></table></div><button type="button" id="tmcsPendingCashRefreshV242">REFRESH CASH REQUESTS</button>';
   host.appendChild(section);
  }
  const notice=section.querySelector('#tmcsPendingCashNoticeV242'),tbody=section.querySelector('#tmcsPendingCashRowsV242');notice.textContent='Loading cash requests…';tbody.replaceChildren();
  try{
   const data=await api('/api/admin/cash-requisitions-v242',{cache:'no-store'}),rows=Array.isArray(data.requests)?data.requests:[];
   if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='No cash requests awaiting approval.';tr.appendChild(td);tbody.appendChild(tr);}
   for(const r of rows){
    const tr=document.createElement('tr');for(const v of [r.description,r.account_source,money(r.amount),r.initiated_by,fullDate(r.created_at)]){const td=document.createElement('td');td.textContent=v==null?'—':String(v);td.style.padding='7px';tr.appendChild(td);}
    const td=document.createElement('td');const approve=document.createElement('button');approve.type='button';approve.textContent='APPROVE';const reject=document.createElement('button');reject.type='button';reject.textContent='REJECT';reject.style.marginLeft='5px';
    approve.addEventListener('click',async()=>{if(!confirm('Approve this cash request and deduct '+money(r.amount)+' from '+r.account_source+'?'))return;approve.disabled=true;try{await api('/api/admin/cash-requisitions-v242/'+encodeURIComponent(r.id)+'/approve',{method:'POST',body:JSON.stringify({})});notice.textContent='Cash request approved and balance updated.';await renderPendingRequests(host);}catch(err){notice.textContent=err?.message||'Could not approve cash request.';approve.disabled=false;}});
    reject.addEventListener('click',async()=>{if(!confirm('Reject this cash request? No balance will be deducted.'))return;reject.disabled=true;try{await api('/api/admin/cash-requisitions-v242/'+encodeURIComponent(r.id)+'/reject',{method:'POST',body:JSON.stringify({})});notice.textContent='Cash request rejected.';await renderPendingRequests(host);}catch(err){notice.textContent=err?.message||'Could not reject cash request.';reject.disabled=false;}});
    td.append(approve,reject);tr.appendChild(td);tbody.appendChild(tr);
   }
   if(rows.length)notice.textContent=rows.length+' cash request(s) awaiting approval.';
  }catch(err){notice.textContent=err?.message||'Unable to load cash requests.';}
 }
 function findPendingHost(){
  const dialogs=[...document.querySelectorAll('dialog[open],[role="dialog"]')];for(const d of dialogs)if(/PENDING WITHDRAWAL/.test(normal(d.textContent)))return d;
  for(const selector of ['#pendingWithdrawalsDialog','#pendingWithdrawalDialog','#pendingWithdrawalsModal','#pendingWithdrawalModal','[id*="pendingWithdrawal" i]']){const el=document.querySelector(selector);if(el&&(/PENDING WITHDRAWAL/.test(normal(el.textContent))||el.matches('dialog[open]')))return el;}
  const heads=[...document.querySelectorAll('h1,h2,h3,h4,h5,[role="heading"],.modal-title,.dialog-title')];
  for(const h of heads){if(!/PENDING WITHDRAWAL/.test(normal(h.textContent)))continue;if(h.closest('.admin-action-card,.dashboard-card,.tile'))continue;const p=h.closest('dialog,[role="dialog"],main,section')||h.parentElement?.parentElement;if(p&&p!==document.body)return p;}
  return null;
 }
 function scanPending(){const host=findPendingHost();if(host)renderPendingRequests(host);}
 function findTileNode(target,label){let n=target;for(let i=0;n&&n!==document.body&&i<7;i++,n=n.parentElement){const t=normal(n.innerText||n.textContent);if(t===label||(t.startsWith(label+' ')&&t.length<180))return n;}return null;}
 document.addEventListener('click',function(e){
  if(findTileNode(e.target,'CASH REQUEST')){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();openCashRequest();return;}
  if(findTileNode(e.target,'EXPENDITURE REPORT')){e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();const d=byId('tmcsExpenditureDialogV242');if(d&&!d.open)d.showModal();loadExpenditure();}
 },true);
 document.addEventListener('submit',async e=>{
  if(e.target?.id!=='tmcsCashRequestFormV242')return;e.preventDefault();
  const notice=byId('tmcsCashRequestNoticeV242'),button=byId('tmcsCashRequestSubmitV242'),description=String(byId('tmcsCashRequestDescriptionV242').value||'').trim(),accountSource=String(byId('tmcsCashRequestAccountV242').value||''),amount=String(byId('tmcsCashRequestAmountV242').value||'');
  if(!description||!accountSource||!Number.isFinite(Number(amount))||Number(amount)<=0){notice.textContent='Complete all fields with a valid amount.';return;}
  button.disabled=true;notice.textContent='Submitting request…';
  try{await api('/api/admin/cash-requisitions-v242',{method:'POST',body:JSON.stringify({description,accountSource,amount})});notice.textContent='Submitted successfully. The request is now awaiting Admin approval.';byId('tmcsCashRequestFormV242').reset();scanPending();}
  catch(err){notice.textContent=err?.message||'Could not submit cash request.';}finally{button.disabled=false;}
 },true);
 document.addEventListener('click',e=>{
  if(e.target?.id==='tmcsCashRequestCloseV242')byId('tmcsCashRequestDialogV242')?.close();
  if(e.target?.id==='tmcsExpenditureCloseV242')byId('tmcsExpenditureDialogV242')?.close();
  if(e.target?.id==='tmcsExpenditureRefreshV242')loadExpenditure();
  if(e.target?.id==='tmcsPendingCashRefreshV242'){const host=e.target.closest('#tmcsPendingCashRequestsV242')?.parentElement;if(host)renderPendingRequests(host);}
 },true);
 const observer=new MutationObserver(()=>scanPending());
 const start=()=>{if(document.body)observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','class','style']});scanPending();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
`;
 fs.writeFileSync(appPath,app);
}
let finalApp=fs.readFileSync(appPath,'utf8');
finalApp=finalApp.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=254'");
fs.writeFileSync(appPath,finalApp);
html=fs.readFileSync(htmlPath,'utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=254').replace(/styles\.css\?v=\d+/g,'styles.css?v=254').replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=254').replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=254');
fs.writeFileSync(htmlPath,html);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v254';");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 242 CASH REQUEST and EXPENDITURE REPORT routes/UI installed.');
