const fs=require('fs');

function mustReplace(source,oldText,newText,label){
  if(!source.includes(oldText)) throw new Error('Stage 242: missing marker: '+label);
  return source.replace(oldText,newText);
}

/* Fresh REQUISITION feature: independent table and explicit pending-approval lifecycle. */
const schemaPath='server/db/schema.sql';
let schema=fs.readFileSync(schemaPath,'utf8');
if(!schema.includes('TMCS_REQUISITION_REQUESTS_V242')){
  schema += String.raw`

-- TMCS_REQUISITION_REQUESTS_V242
CREATE TABLE IF NOT EXISTS cash_requisition_requests (
  id BIGSERIAL PRIMARY KEY,
  reference VARCHAR(32) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  amount NUMERIC(16,2) NOT NULL CHECK (amount > 0),
  debit_account VARCHAR(32) NOT NULL CHECK (debit_account IN ('MANAGEMENT BALANCE','TMCS LTD BALANCE')),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by BIGINT REFERENCES accounts(id),
  requested_by_username VARCHAR(80) NOT NULL,
  requested_by_name VARCHAR(160) NOT NULL,
  reviewed_by BIGINT REFERENCES accounts(id),
  reviewed_by_username VARCHAR(80),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cash_requisition_pending_idx
  ON cash_requisition_requests(status,created_at DESC);
`;
  fs.writeFileSync(schemaPath,schema);
}

/* Submission endpoint uses the signed-in Admin identity and never deducts a balance. */
let account=fs.readFileSync('server/routes/account.js','utf8');
if(!account.includes("router.post('/requisition-requests-v242'")){
  const route=String.raw`
router.post('/requisition-requests-v242', requireAuth, async (req,res)=>{
  const description=String(req.body?.description||'').trim();
  const amount=Number(req.body?.amount);
  const debitAccount=String(req.body?.debitAccount||'').trim().toUpperCase();
  if(String(req.auth?.role||'').toLowerCase()!=='admin') return res.status(403).json({error:'Only an administrator can submit a requisition.'});
  if(!description || description.length>2000) return res.status(400).json({error:'Enter a description (up to 2,000 characters).'});
  if(!Number.isFinite(amount)||amount<=0||!Number.isSafeInteger(Math.round(amount*100))) return res.status(400).json({error:'Enter a valid amount greater than zero.'});
  if(!['MANAGEMENT BALANCE','TMCS LTD BALANCE'].includes(debitAccount)) return res.status(400).json({error:'Select Management Balance or TMCS LTD Balance.'});
  const identity=await pool.query('SELECT id,username,full_name FROM accounts WHERE id=$1 AND role=$2 AND is_active=TRUE',[req.auth.sub,'admin']);
  if(!identity.rowCount) return res.status(401).json({error:'Active administrator account not found.'});
  const crypto=require('crypto');
  const reference='REQ-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
  const result=await pool.query(
    "INSERT INTO cash_requisition_requests(reference,description,amount,debit_account,requested_by,requested_by_username,requested_by_name,status) VALUES($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING id,reference,description,amount,debit_account,status,created_at",
    [reference,description,amount,debitAccount,identity.rows[0].id,identity.rows[0].username,identity.rows[0].full_name]
  );
  res.status(201).json({request:result.rows[0]});
});
`;
  account=mustReplace(account,'\nmodule.exports = router;',route+'\nmodule.exports = router;','account route export');
  fs.writeFileSync('server/routes/account.js',account);
}

/* Admin list and decision endpoints; balance is debited only after approval, atomically. */
let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes("router.get('/requisition-requests-v242'")){
  const routes=String.raw`
router.get('/requisition-requests-v242', requireAdminPermission('cash_credit'), async(req,res)=>{
  const status=String(req.query.status||'pending').toLowerCase();
  if(!['pending','approved','rejected','all'].includes(status)) return res.status(400).json({error:'Invalid requisition status.'});
  const params=[];
  let where='';
  if(status!=='all'){params.push(status);where='WHERE r.status=$1';}
  const result=await pool.query(
    "SELECT r.id,r.reference,r.description,r.amount,r.debit_account,r.status,r.requested_by_username,r.requested_by_name,r.reviewed_by_username,r.reviewed_at,r.rejection_reason,r.created_at FROM cash_requisition_requests r "+where+" ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 200",
    params
  );
  res.set('Cache-Control','no-store');
  res.json({requests:result.rows});
});

router.post('/requisition-requests-v242/:id/approve', requireAdminPermission('cash_credit'), async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<=0) return res.status(400).json({error:'Invalid requisition.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const found=await client.query('SELECT * FROM cash_requisition_requests WHERE id=$1 FOR UPDATE',[id]);
    const request=found.rows[0];
    if(!request){await client.query('ROLLBACK');return res.status(404).json({error:'Requisition not found.'});}
    if(request.status!=='pending'){await client.query('ROLLBACK');return res.status(409).json({error:'This requisition has already been reviewed.'});}
    const amount=Number(request.amount);
    if(request.debit_account==='MANAGEMENT BALANCE'){
      const balanceResult=await client.query('SELECT management_balance FROM cooperative_financials WHERE id=1 FOR UPDATE');
      if(!balanceResult.rowCount){await client.query('ROLLBACK');return res.status(400).json({error:'Management Balance record is not available.'});}
      const available=Number(balanceResult.rows[0].management_balance||0);
      if(available<amount){await client.query('ROLLBACK');return res.status(400).json({error:'Insufficient Management Balance to approve this requisition.'});}
      await client.query('UPDATE cooperative_financials SET management_balance=management_balance-$1 WHERE id=1',[amount]);
    }else{
      const balanceResult=await client.query('SELECT available_balance FROM tmcs_cooperative_ledger WHERE id=1 FOR UPDATE');
      if(!balanceResult.rowCount){await client.query('ROLLBACK');return res.status(400).json({error:'TMCS LTD Balance record is not available.'});}
      const available=Number(balanceResult.rows[0].available_balance||0);
      if(available<amount){await client.query('ROLLBACK');return res.status(400).json({error:'Insufficient TMCS LTD Balance to approve this requisition.'});}
      await client.query('UPDATE tmcs_cooperative_ledger SET available_balance=available_balance-$1,updated_at=NOW() WHERE id=1',[amount]);
    }
    const reviewer=await client.query('SELECT username FROM accounts WHERE id=$1',[req.auth.sub]);
    const reviewerUsername=reviewer.rows[0]?.username||String(req.auth.username||'ADMIN');
    const updated=await client.query(
      "UPDATE cash_requisition_requests SET status='approved',reviewed_by=$1,reviewed_by_username=$2,reviewed_at=NOW() WHERE id=$3 RETURNING id,reference,status,debit_account,amount",
      [req.auth.sub,reviewerUsername,id]
    );
    try{await writeAdminAudit(client,req,'REQUISITION_APPROVED','cash_requisition',String(id),request.reference,{amount:amount,debitAccount:request.debit_account,initiatedBy:request.requested_by_username});}catch(_){}
    await client.query('COMMIT');
    res.json({request:updated.rows[0]});
  }catch(error){
    try{await client.query('ROLLBACK');}catch(_){}
    throw error;
  }finally{client.release();}
});

router.post('/requisition-requests-v242/:id/reject', requireAdminPermission('cash_credit'), async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<=0) return res.status(400).json({error:'Invalid requisition.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const found=await client.query('SELECT * FROM cash_requisition_requests WHERE id=$1 FOR UPDATE',[id]);
    const request=found.rows[0];
    if(!request){await client.query('ROLLBACK');return res.status(404).json({error:'Requisition not found.'});}
    if(request.status!=='pending'){await client.query('ROLLBACK');return res.status(409).json({error:'This requisition has already been reviewed.'});}
    const reviewer=await client.query('SELECT username FROM accounts WHERE id=$1',[req.auth.sub]);
    const reviewerUsername=reviewer.rows[0]?.username||String(req.auth.username||'ADMIN');
    const updated=await client.query(
      "UPDATE cash_requisition_requests SET status='rejected',reviewed_by=$1,reviewed_by_username=$2,reviewed_at=NOW(),rejection_reason=$3 WHERE id=$4 RETURNING id,reference,status",
      [req.auth.sub,reviewerUsername,String(req.body?.reason||'').trim().slice(0,1000)||null,id]
    );
    try{await writeAdminAudit(client,req,'REQUISITION_REJECTED','cash_requisition',String(id),request.reference,{amount:Number(request.amount),debitAccount:request.debit_account});}catch(_){}
    await client.query('COMMIT');
    res.json({request:updated.rows[0]});
  }catch(error){
    try{await client.query('ROLLBACK');}catch(_){}
    throw error;
  }finally{client.release();}
});
`;
  admin=mustReplace(admin,'\nmodule.exports = router;',routes+'\nmodule.exports = router;','admin route export');
  fs.writeFileSync('server/routes/admin.js',admin);
}

/* Add the tile to the existing Admin tile array and wire it through the native action dispatcher. */
let app=fs.readFileSync('www/app.js','utf8');
const tile="    ['REQUISITION', 'Submit a cash request for approval'],";
if(!app.includes(tile)){
  const anchor="    ['CASH CREDIT', 'Post cash directly to Regular or Flexible account'],";
  app=mustReplace(app,anchor,anchor+'\n'+tile,'Admin tile list');
}
/* Add REQUISITION to the same action-permission map used by the Admin dashboard. */
const permissionStart = app.indexOf('function adminPermissionForAction(title){');
const permissionEnd = permissionStart < 0 ? -1 : app.indexOf('\nfunction adminActionAllowed(title)', permissionStart);
if(permissionStart < 0 || permissionEnd < 0) throw new Error('Stage 242: Admin action permission function was not found.');
let permissionFn = app.slice(permissionStart, permissionEnd);
if(!permissionFn.includes("'REQUISITION'")){
  permissionFn = permissionFn.replace("'CASH CREDIT':'cash_credit',", "'CASH CREDIT':'cash_credit',\n    'REQUISITION':'cash_credit',");
  if(!permissionFn.includes("'REQUISITION':'cash_credit'")) throw new Error('Stage 242: could not add REQUISITION permission entry.');
  app = app.slice(0, permissionStart) + permissionFn + app.slice(permissionEnd);
}
if(!app.includes("if (title === 'REQUISITION') { window.openRequisitionV242?.(); }")){
  const anchor="  if (title === 'CASH CREDIT') { window.openCashCreditV67?.(); }";
  app=mustReplace(app,anchor,anchor+"\n  if (title === 'REQUISITION') { window.openRequisitionV242?.(); }",'native Admin action dispatcher');
}

/* Extend the current Pending Approvals tile's existing loader rather than adding another click handler. */
const loadStart=app.indexOf('async function loadPendingApprovals() {');
const loadEnd=app.indexOf('\nasync function viewReceipt(id)',loadStart);
if(loadStart<0||loadEnd<0) throw new Error('Stage 242: existing Pending Approvals loader was not found.');
let loader=app.slice(loadStart,loadEnd);
if(!loader.includes("api('/api/admin/requisition-requests-v242?status=pending')")){
  loader=loader.replace(
    "const [payments,loans]=await Promise.all([\n      api('/api/admin/payment-requests?status=pending'),\n      api('/api/admin/loan-applications?status=pending')\n    ]);",
    "const [payments,loans,requisitions]=await Promise.all([\n      api('/api/admin/payment-requests?status=pending'),\n      api('/api/admin/loan-applications?status=pending'),\n      api('/api/admin/requisition-requests-v242?status=pending')\n    ]);"
  );
  loader=loader.replace("const loanApplications=loans.applications||[];","const loanApplications=loans.applications||[];\n    const requisitionRequests=requisitions.requests||[];");
  loader=loader.replace("if (!paymentRequests.length && !loanApplications.length)","if (!paymentRequests.length && !loanApplications.length && !requisitionRequests.length)");
  const insertAt=loader.lastIndexOf('  } catch(error) {');
  if(insertAt<0) throw new Error('Stage 242: Pending Approvals render boundary missing.');
  const render=String.raw`
    requisitionRequests.forEach(request => {
      const item=document.createElement('article');
      item.className='approval-item';
      const amount=naira(request.amount);
      item.innerHTML='<div class="approval-head"><div><strong>REQUISITION • '+escapeHTML(request.requested_by_name||'Admin')+'</strong><span>'+escapeHTML(request.requested_by_username||'')+' • '+escapeHTML(request.reference)+'</span></div><b>'+amount+'</b></div>'+
        '<div class="approval-meta"><span>Debit account: <b>'+escapeHTML(request.debit_account)+'</b></span><span>Status: <b>PENDING</b></span><span>'+new Date(request.created_at).toLocaleString()+'</span></div>'+
        '<p class="approval-note">'+escapeHTML(request.description)+'</p>'+
        '<div class="approval-actions"><button type="button" class="primary approve-btn">APPROVE & DEBIT</button><button type="button" class="danger reject-btn">REJECT</button></div>';
      item.querySelector('.approve-btn').addEventListener('click',async()=>{
        const button=item.querySelector('.approve-btn');button.disabled=true;button.textContent='APPROVING…';
        try{await api('/api/admin/requisition-requests-v242/'+encodeURIComponent(request.id)+'/approve',{method:'POST',body:JSON.stringify({})});await loadPendingApprovals();}
        catch(error){approvalsError.textContent=error.message;button.disabled=false;button.textContent='APPROVE & DEBIT';}
      });
      item.querySelector('.reject-btn').addEventListener('click',async()=>{
        const button=item.querySelector('.reject-btn');button.disabled=true;button.textContent='REJECTING…';
        try{await api('/api/admin/requisition-requests-v242/'+encodeURIComponent(request.id)+'/reject',{method:'POST',body:JSON.stringify({})});await loadPendingApprovals();}
        catch(error){approvalsError.textContent=error.message;button.disabled=false;button.textContent='REJECT';}
      });
      approvalsList.appendChild(item);
    });
`;
  loader=loader.slice(0,insertAt)+render+loader.slice(insertAt);
  app=app.slice(0,loadStart)+loader+app.slice(loadEnd);
}

/* Persist the Admin tile, permission map, dispatcher, and Pending Approvals loader edits. */
app=app.replace("serviceWorker.register('./sw.js?v=259'", "serviceWorker.register('./sw.js?v=260'");
fs.writeFileSync('www/app.js',app);

/* The form has one submit path and calls the API directly; no delegated tile click listeners. */
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="requisitionV242Dialog"')){
  const dialog=String.raw`
<dialog id="requisitionV242Dialog">
  <form class="dialog-card" id="requisitionV242Form" autocomplete="off">
    <div class="dialog-head">
      <h3>Cash Request Form</h3>
      <button type="button" class="icon-btn" data-close="requisitionV242Dialog" aria-label="Close">×</button>
    </div>
    <label>Description
      <textarea id="requisitionV242Description" rows="3" maxlength="2000" required placeholder="Describe the cash request"></textarea>
    </label>
    <label>Amount
      <input id="requisitionV242Amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0.00" />
    </label>
    <label>Debit account
      <select id="requisitionV242DebitAccount" required>
        <option value="">-Select Debit Account-</option>
        <option value="MANAGEMENT BALANCE">Management Balance</option>
        <option value="TMCS LTD BALANCE">TMCS LTD Balance</option>
      </select>
    </label>
    <p id="requisitionV242Error" class="form-error" role="alert"></p>
    <p id="requisitionV242Success" role="status" aria-live="polite" style="color:#08783b;font-weight:800"></p>
    <div style="margin-top:12px"><button class="primary" id="requisitionV242Submit" type="submit">SUBMIT</button></div>
  </form>
</dialog>
`;
  html=html.replace('</body>',dialog+'\n<script src="requisition-v242.js?v=260"></script>\n</body>');
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=260')
         .replace(/styles\.css\?v=\d+/g,'styles.css?v=260')
         .replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=260');
fs.writeFileSync('www/index.html',html);

const client=String.raw`
(()=>{
  function el(id){return document.getElementById(id);}
  function session(){try{return JSON.parse(sessionStorage.getItem('tmcs-session')||'{}');}catch(_){return {};}}
  async function request(path,options){
    options=options||{};
    const s=session(),headers=Object.assign({},options.headers||{});
    if(s.token)headers.Authorization='Bearer '+s.token;
    if(options.body&&!headers['Content-Type'])headers['Content-Type']='application/json';
    const response=await fetch(path,Object.assign({},options,{headers:headers,cache:'no-store'}));
    let data={};try{data=await response.json();}catch(_){}
    if(!response.ok)throw new Error(data.error||'Request failed ('+response.status+').');
    return data;
  }
  function reset(){
    if(el('requisitionV242Form'))el('requisitionV242Form').reset();
    el('requisitionV242Error').textContent='';
    el('requisitionV242Success').textContent='';
    el('requisitionV242Submit').disabled=false;
    el('requisitionV242Submit').textContent='SUBMIT';
  }
  function open(){
    const dialog=el('requisitionV242Dialog');if(!dialog)return;
    reset();
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  window.openRequisitionV242=open;
  function init(){
    const form=el('requisitionV242Form');if(!form)return;
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const error=el('requisitionV242Error'),success=el('requisitionV242Success'),button=el('requisitionV242Submit');
      error.textContent='';success.textContent='';
      const description=String(el('requisitionV242Description').value||'').trim();
      const amount=Number(el('requisitionV242Amount').value);
      const debitAccount=String(el('requisitionV242DebitAccount').value||'');
      if(!description){error.textContent='Enter a description.';return;}
      if(!Number.isFinite(amount)||amount<=0){error.textContent='Enter a valid amount greater than zero.';return;}
      if(!debitAccount){error.textContent='Select a debit account.';return;}
      button.disabled=true;button.textContent='SUBMITTING…';
      try{
        const data=await request('/api/account/requisition-requests-v242',{method:'POST',body:JSON.stringify({description:description,amount:amount,debitAccount:debitAccount})});
        if(!data.request||String(data.request.status).toLowerCase()!=='pending')throw new Error('The server did not confirm a pending requisition.');
        success.textContent='SUBMITTED SUCCESSFULLY • PENDING APPROVAL • Ref: '+data.request.reference;
        el('requisitionV242Description').value='';el('requisitionV242Amount').value='';el('requisitionV242DebitAccount').value='';
        button.textContent='SUBMITTED';
      }catch(e){error.textContent=e&&e.message?e.message:'Unable to submit requisition.';button.disabled=false;button.textContent='SUBMIT';}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
`;
fs.writeFileSync('www/requisition-v242.js',client);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\\d+';/,"const CACHE = 'taimako-v260';")
  .replace(/app\\.js\\?v=\\d+/g,'app.js?v=260')
  .replace(/styles\\.css\\?v=\\d+/g,'styles.css?v=260')
  .replace(/cash-credit-v66\\.js\\?v=\\d+/g,'cash-credit-v66.js?v=260');
if(!sw.includes("'./requisition-v242.js'"))sw=sw.replace("'./manifest.webmanifest'","'./manifest.webmanifest','./requisition-v242.js'");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 242 fresh REQUISITION form and Pending Approvals integration applied.');
