const fs=require('fs');

/* ---------- Allow FLEXIBLE in advance allocation schedule ---------- */
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('ADVANCE_FLEXIBLE_V194')){
  const sql=`
-- ADVANCE_FLEXIBLE_V194
ALTER TABLE advance_saving_allocations DROP CONSTRAINT IF EXISTS advance_saving_allocations_savings_type_check;
ALTER TABLE advance_saving_allocations ADD CONSTRAINT advance_saving_allocations_savings_type_check CHECK (savings_type IN ('REGULAR','TARGET','CONSTANT','WELFARE','FLEXIBLE'));
`;
  schema=schema.replace('\nCOMMIT;',sql+'\nCOMMIT;');
  fs.writeFileSync('server/db/schema.sql',schema);
}

 /* ---------- Admin API ---------- */
let admin=fs.readFileSync('server/routes/admin.js','utf8');

if(!admin.includes("const multerV193=require('multer');")){
  const marker="const express = require('express');";
  if(admin.includes(marker)){
    admin=admin.replace(marker,marker+"\nconst multerV193=require('multer');\nconst advanceCashUploadV193=multerV193({storage:multerV193.memoryStorage(),limits:{fileSize:10*1024*1024}});");
  }else{
    admin="const multerV193=require('multer');\nconst advanceCashUploadV193=multerV193({storage:multerV193.memoryStorage(),limits:{fileSize:10*1024*1024}});\n"+admin;
  }
}

if(!admin.includes("router.get('/advance-cash-credit/member'")){
  const routes=String.raw`
router.get('/advance-cash-credit/member', requireAdminPermission('cash_credit'), async (req,res)=>{
  const username=String(req.query.username||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter username.'});
  const result=await pool.query(
    "SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1 LIMIT 1",
    [username]
  );
  if(!result.rowCount || !result.rows[0].is_active) return res.status(404).json({error:'Active member account not found.'});
  const member=result.rows[0];
  if(String(member.role||'').toLowerCase()!=='regular') return res.status(400).json({error:'Advance Cash Credit is available only for Regular members.'});
  res.json({member:{id:member.id,username:member.username,name:member.full_name,role:member.role}});
});

router.post('/advance-cash-credit', requireAdminPermission('cash_credit'), advanceCashUploadV193.single('receipt'), async (req,res)=>{
  const username=String(req.body?.username||'').trim().toUpperCase();
  const destination=String(req.body?.destination||'').trim().toUpperCase();
  const amount=Number(req.body?.amount);
  const startDate=String(req.body?.startDate||'').trim();
  const shareCount=Number(req.body?.shareCount);

  if(!username) return res.status(400).json({error:'Enter username.'});
  if(!['REGULAR','TARGET','CONSTANT','WELFARE','FLEXIBLE'].includes(destination)) return res.status(400).json({error:'Select REGULAR, TARGET, CONSTANT, WELFARE or FLEXIBLE.'});
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({error:'Enter an amount greater than zero.'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return res.status(400).json({error:'Select a valid date.'});
  if(!Number.isInteger(shareCount)||shareCount<=0) return res.status(400).json({error:'Number of shares must be a whole number greater than zero.'});
  if(!req.file) return res.status(400).json({error:'Upload the payment receipt.'});

  const currentMonthResult=await pool.query("SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos','YYYY-MM') AS ym");
  const currentMonth=currentMonthResult.rows[0]?.ym;
  const selectedMonth=startDate.slice(0,7);
  if(selectedMonth<currentMonth) return res.status(400).json({error:'A past month cannot be selected.'});

  const dateParts=startDate.split('-').map(Number);
  const selectedDate=new Date(Date.UTC(dateParts[0],dateParts[1]-1,dateParts[2]));
  if(Number.isNaN(selectedDate.getTime()) || selectedDate.toISOString().slice(0,10)!==startDate){
    return res.status(400).json({error:'Select a valid date.'});
  }

  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const found=await client.query(
      "SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1 FOR UPDATE",
      [username]
    );
    if(!found.rowCount || !found.rows[0].is_active){
      await client.query('ROLLBACK');
      return res.status(404).json({error:'Active member account not found.'});
    }
    const member=found.rows[0];
    if(String(member.role||'').toLowerCase()!=='regular'){
      await client.query('ROLLBACK');
      return res.status(400).json({error:'Advance Cash Credit is available only for Regular members.'});
    }

    const minimumResult=await client.query("SELECT numeric_value FROM cooperative_settings WHERE setting_key='minimum_share_per_month'");
    const minimumShare=Number(minimumResult.rows[0]?.numeric_value||5000);
    const monthlyAmount=minimumShare*shareCount;
    if(amount<monthlyAmount){
      await client.query('ROLLBACK');
      return res.status(400).json({error:'Amount must cover at least '+shareCount+' share(s) for the first selected month.'});
    }

    const columnMap={REGULAR:'regular',TARGET:'target',CONSTANT:'constant',WELFARE:'welfare',FLEXIBLE:'flexible'};
    const column=columnMap[destination];
    await client.query('INSERT INTO member_balances(account_id) VALUES($1) ON CONFLICT(account_id) DO NOTHING',[member.id]);
    await client.query('UPDATE member_balances SET '+column+'='+column+'+$1,updated_at=NOW() WHERE account_id=$2',[amount,member.id]);

    const reference='ADVCASH-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
    const note='ADVANCE CASH CREDIT • Start date: '+startDate+' • Shares/month: '+shareCount;

    const requestResult=await client.query(
      "INSERT INTO payment_requests(reference,account_id,destination,amount,receipt_path,receipt_data,receipt_original_name,receipt_mime_type,note,status,request_type,advance_start_month,advance_share_count,reviewed_by_account_id,reviewed_at) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,'approved','advance_cash_credit',$9::date,$10,$11,NOW()) RETURNING id",
      [reference,member.id,destination,amount,req.file.buffer,req.file.originalname,req.file.mimetype,note,startDate,shareCount,req.auth.sub]
    );
    const paymentRequestId=requestResult.rows[0].id;

    let remaining=Math.round(amount*100)/100;
    let cursor=new Date(Date.UTC(dateParts[0],dateParts[1]-1,1));
    let guard=0;
    while(remaining>0.00001 && guard<240){
      const period=cursor.toISOString().slice(0,10);
      const existingResult=await client.query(
        'SELECT COALESCE(SUM(allocated_amount),0) AS amount FROM advance_saving_allocations WHERE account_id=$1 AND savings_type=$2 AND period_month=$3',
        [member.id,destination,period]
      );
      const existingAmount=Math.round(Number(existingResult.rows[0]?.amount||0)*100)/100;
      const remainderInBlock=monthlyAmount>0?Math.round((existingAmount%monthlyAmount)*100)/100:0;
      const amountNeeded=remainderInBlock>0.00001?Math.round((monthlyAmount-remainderInBlock)*100)/100:monthlyAmount;
      const allocation=Math.round(Math.min(remaining,amountNeeded)*100)/100;

      const oldShares=minimumShare>0?Math.floor((existingAmount+0.00001)/minimumShare):0;
      const combined=Math.round((existingAmount+allocation)*100)/100;
      const newShares=minimumShare>0?Math.floor((combined+0.00001)/minimumShare):0;
      const incrementalShares=Math.max(0,newShares-oldShares);

      await client.query(
        'INSERT INTO advance_saving_allocations(payment_request_id,account_id,savings_type,period_month,allocated_amount,allocated_shares) VALUES($1,$2,$3,$4,$5,$6)',
        [paymentRequestId,member.id,destination,period,allocation,incrementalShares]
      );

      remaining=Math.round((remaining-allocation)*100)/100;
      cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1));
      guard++;
    }
    if(remaining>0.00001){
      await client.query('ROLLBACK');
      return res.status(400).json({error:'Advance Cash Credit schedule is too long.'});
    }

    await client.query(
      "INSERT INTO transactions(reference,account_id,created_by_account_id,transaction_type,destination,amount,status,note,approved_at) VALUES($1,$2,$3,'advance_cash_credit',$4,$5,'completed',$6,NOW())",
      [reference,member.id,req.auth.sub,destination,amount,note]
    );

    await client.query('COMMIT');
    try{
      if(typeof writeAdminAudit==='function'){
        await writeAdminAudit(pool,req,'ADVANCE_CASH_CREDIT_POSTED','account',member.id,member.username,{destination,amount,startDate,shareCount,reference});
      }
    }catch(_){}

    res.json({successful:true,reference,member:{username:member.username,name:member.full_name},destination,amount,startDate,shareCount});
  }catch(error){
    try{await client.query('ROLLBACK');}catch(_){}
    console.error('Advance Cash Credit V193 error:',error);
    res.status(500).json({error:'Advance Cash Credit could not be posted.'});
  }finally{
    client.release();
  }
});
`;
  admin=admin.replace('\nmodule.exports = router;',routes+'\nmodule.exports = router;');
}
fs.writeFileSync('server/routes/admin.js',admin);

/* ---------- Admin dialog ---------- */
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="advanceCashCreditV193Dialog"')){
  const marker='<dialog id="adminSettingsDialog"';
  const dialog=String.raw`
  <dialog id="advanceCashCreditV193Dialog">
    <form class="dialog-card" id="advanceCashCreditV193Form" autocomplete="off">
      <div class="dialog-head"><h3>ADVANCE CASH CREDIT</h3><button type="button" class="icon-btn" data-close="advanceCashCreditV193Dialog" aria-label="Close">×</button></div>

      <label>Username
        <input id="advanceCashCreditUsernameV193" placeholder="ENTER 5-DIGIT USERNAME" inputmode="numeric" maxlength="5" autocomplete="off" required />
      </label>
      <div style="margin:8px 0 10px"><button type="button" class="primary" id="advanceCashCreditConfirmV193" style="width:auto;min-width:120px">CONFIRM</button></div>
      <div id="advanceCashCreditMemberV193" class="member-confirm" style="display:none;margin:8px 0 14px;font-size:17px;font-weight:800;color:#075d32"></div>

      <label>Select Main Savings
        <select id="advanceCashCreditTypeV193" required disabled>
          <option value="">- Select -</option>
          <option value="REGULAR">REGULAR</option>
          <option value="TARGET">TARGET</option>
          <option value="CONSTANT">CONSTANT</option>
          <option value="WELFARE">WELFARE</option>\n          <option value="FLEXIBLE">FLEXIBLE</option>
        </select>
      </label>

      <label>Amount (₦)<input id="advanceCashCreditAmountV193" type="number" min="0.01" step="0.01" required /></label>
      <label>Start Date<input id="advanceCashCreditStartV193" type="date" required /></label>
      <label>Number of Shares<input id="advanceCashCreditSharesV193" type="number" min="1" step="1" required /></label>
      <label>Upload Receipt<input id="advanceCashCreditReceiptV193" type="file" accept="image/*,.pdf" required /></label>

      <p class="helper">The full posted amount is credited to the selected savings balance. The advance schedule merges with any existing Advance Saving from the selected month.</p>
      <p class="form-error" id="advanceCashCreditErrorV193" role="alert"></p>
      <p class="form-success" id="advanceCashCreditSuccessV193" role="status"></p>
      <div class="dialog-actions"><button type="submit" class="primary" id="advanceCashCreditPostV193">POST CASH</button></div>
    </form>
  </dialog>

`;
  if(!html.includes(marker)){console.error('Stage 193 dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=193');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=193');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=193');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=193');
fs.writeFileSync('www/index.html',html);

/* ---------- Admin tile + client ---------- */
let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes("['ADVANCE CASH CREDIT', 'Post advance savings directly for a Regular member']")){
  const marker="    ['CASH CREDIT', 'Post cash directly to Regular or Flexible account'],";
  if(!app.includes(marker)){console.error('Stage 193 CASH CREDIT tile marker missing');process.exit(1);}
  app=app.replace(marker,marker+"\n    ['ADVANCE CASH CREDIT', 'Post advance savings directly for a Regular member'],");
}

if(!app.includes("if (title === 'ADVANCE CASH CREDIT')")){
  const marker="  if (title === 'CASH CREDIT') { window.openCashCreditV67?.(); }";
  if(!app.includes(marker)){console.error('Stage 193 CASH CREDIT action marker missing');process.exit(1);}
  app=app.replace(marker,marker+"\n  if (title === 'ADVANCE CASH CREDIT') { openAdvanceCashCreditV193(); }");
}

if(!app.includes('function openAdvanceCashCreditV193()')){
  const marker='function renderDashboard() {';
  const code=String.raw`
let advanceCashCreditConfirmedV193='';

function advanceCashCreditMonthFloorV193(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
}

function clearAdvanceCashCreditConfirmationV193(){
  advanceCashCreditConfirmedV193='';
  const member=document.getElementById('advanceCashCreditMemberV193');
  const type=document.getElementById('advanceCashCreditTypeV193');
  if(member){member.textContent='';member.style.display='none';}
  if(type){type.value='';type.disabled=true;}
}

function openAdvanceCashCreditV193(){
  const form=document.getElementById('advanceCashCreditV193Form');
  if(form) form.reset();
  clearAdvanceCashCreditConfirmationV193();
  const start=document.getElementById('advanceCashCreditStartV193');
  if(start){start.min=advanceCashCreditMonthFloorV193();start.value=new Date().toISOString().slice(0,10);}
  const error=document.getElementById('advanceCashCreditErrorV193');
  const success=document.getElementById('advanceCashCreditSuccessV193');
  if(error) error.textContent='';
  if(success) success.textContent='';
  openDialog(document.getElementById('advanceCashCreditV193Dialog'));
}

document.getElementById('advanceCashCreditUsernameV193')?.addEventListener('input',(event)=>{
  event.target.value=event.target.value.replace(/\D/g,'').slice(0,5);
  clearAdvanceCashCreditConfirmationV193();
  const error=document.getElementById('advanceCashCreditErrorV193'); if(error) error.textContent='';
});

document.getElementById('advanceCashCreditConfirmV193')?.addEventListener('click',async()=>{
  const username=document.getElementById('advanceCashCreditUsernameV193')?.value.trim()||'';
  const error=document.getElementById('advanceCashCreditErrorV193');
  const success=document.getElementById('advanceCashCreditSuccessV193');
  const member=document.getElementById('advanceCashCreditMemberV193');
  const type=document.getElementById('advanceCashCreditTypeV193');
  if(error) error.textContent=''; if(success) success.textContent='';
  clearAdvanceCashCreditConfirmationV193();
  if(!/^\d{5}$/.test(username)){if(error) error.textContent='Regular username must be exactly 5 digits.';return;}

  const button=document.getElementById('advanceCashCreditConfirmV193');
  const old=button?.textContent||'CONFIRM';
  try{
    if(button){button.disabled=true;button.textContent='CONFIRMING...';}
    const data=await api('/api/admin/advance-cash-credit/member?username='+encodeURIComponent(username),{cache:'no-store'});
    advanceCashCreditConfirmedV193=username;
    if(member){member.textContent=data.member.name+' - '+data.member.username;member.style.display='block';}
    if(type){type.disabled=false;type.focus();}
  }catch(e){if(error) error.textContent=e.message||'Unable to confirm member.';}
  finally{if(button){button.disabled=false;button.textContent=old;}}
});

document.addEventListener('submit',async(event)=>{
  if(event.target?.id!=='advanceCashCreditV193Form') return;
  event.preventDefault();
  event.stopPropagation();

  const username=document.getElementById('advanceCashCreditUsernameV193')?.value.trim()||'';
  const destination=document.getElementById('advanceCashCreditTypeV193')?.value||'';
  const amount=document.getElementById('advanceCashCreditAmountV193')?.value||'';
  const startDate=document.getElementById('advanceCashCreditStartV193')?.value||'';
  const shareCount=document.getElementById('advanceCashCreditSharesV193')?.value||'';
  const receipt=document.getElementById('advanceCashCreditReceiptV193')?.files?.[0];
  const error=document.getElementById('advanceCashCreditErrorV193');
  const success=document.getElementById('advanceCashCreditSuccessV193');
  const button=document.getElementById('advanceCashCreditPostV193');
  if(error) error.textContent=''; if(success) success.textContent='';

  if(!/^\d{5}$/.test(username)){if(error) error.textContent='Enter a valid 5-digit username.';return;}
  if(advanceCashCreditConfirmedV193!==username){if(error) error.textContent='Confirm the member before posting Advance Cash Credit.';return;}
  if(!destination){if(error) error.textContent='Select a main savings account.';return;}
  if(!Number(amount)||Number(amount)<=0){if(error) error.textContent='Enter an amount greater than zero.';return;}
  if(!startDate){if(error) error.textContent='Select a date.';return;}
  if(startDate.slice(0,7)<advanceCashCreditMonthFloorV193().slice(0,7)){if(error) error.textContent='A past month cannot be selected.';return;}
  if(!Number.isInteger(Number(shareCount))||Number(shareCount)<=0){if(error) error.textContent='Number of shares must be a whole number greater than zero.';return;}
  if(!receipt){if(error) error.textContent='Upload the payment receipt.';return;}

  const old=button?.textContent||'POST CASH';
  try{
    if(button){button.disabled=true;button.textContent='POSTING...';}
    const data=new FormData();
    data.append('username',username);
    data.append('destination',destination);
    data.append('amount',amount);
    data.append('startDate',startDate);
    data.append('shareCount',shareCount);
    data.append('receipt',receipt);

    const response=await fetch((typeof API_BASE!=='undefined'?API_BASE:'')+'/api/admin/advance-cash-credit',{
      method:'POST',
      headers:{Authorization:'Bearer '+state.token},
      body:data,
      cache:'no-store'
    });
    let body={}; try{body=await response.json();}catch(_){}
    if(!response.ok) throw new Error(body.error||('Posting failed ('+response.status+').'));

    if(success) success.textContent='SUCCESSFUL • '+body.member.name+' - '+body.member.username+' • Ref: '+body.reference;
    document.getElementById('advanceCashCreditAmountV193').value='';
    document.getElementById('advanceCashCreditSharesV193').value='';
    document.getElementById('advanceCashCreditReceiptV193').value='';
  }catch(e){if(error) error.textContent=e.message||'Unable to post Advance Cash Credit.';}
  finally{if(button){button.disabled=false;button.textContent=old;}}
},true);

`;
  if(!app.includes(marker)){console.error('Stage 193 render marker missing');process.exit(1);}
  app=app.replace(marker,code+marker);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=193'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v193';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 193 ADVANCE CASH CREDIT Admin workflow applied.');
