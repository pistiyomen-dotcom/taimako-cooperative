const fs=require('fs');

/* ---------- Database ---------- */
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('CREATE TABLE IF NOT EXISTS advance_saving_allocations')){
  const add=`
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS request_type VARCHAR(30) NOT NULL DEFAULT 'standard';
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS advance_start_month DATE;
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS advance_share_count INTEGER;

CREATE TABLE IF NOT EXISTS advance_saving_allocations (
  id BIGSERIAL PRIMARY KEY,
  payment_request_id BIGINT NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  savings_type VARCHAR(20) NOT NULL CHECK (savings_type IN ('REGULAR','TARGET','CONSTANT','WELFARE')),
  period_month DATE NOT NULL,
  allocated_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  allocated_shares INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(payment_request_id,period_month)
);
CREATE INDEX IF NOT EXISTS idx_advance_saving_member_month ON advance_saving_allocations(account_id,savings_type,period_month);
`;
  schema=schema.replace('\nCOMMIT;',add+'\nCOMMIT;');
}
fs.writeFileSync('server/db/schema.sql',schema);

/* ---------- Member submission endpoint + monthly allocation data ---------- */
let account=fs.readFileSync('server/routes/account.js','utf8');
if(!account.includes("router.post('/advance-saving-requests'")){
  const marker="router.post('/payment-requests', requireAuth, upload.single('receipt')";
  const route=`
router.post('/advance-saving-requests', requireAuth, upload.single('receipt'), async (req,res)=>{
  const accountResult=await pool.query('SELECT id,role,is_active FROM accounts WHERE id=$1',[req.auth.sub]);
  const me=accountResult.rows[0];
  if(!me||!me.is_active||me.role!=='regular') return res.status(403).json({error:'Only active Regular members can submit Advance Saving.'});

  const destination=String(req.body?.destination||'').trim().toUpperCase();
  const amount=Number(req.body?.amount);
  const startMonth=String(req.body?.startMonth||'').trim();
  const shareCount=Number(req.body?.shareCount);

  if(!['REGULAR','TARGET','CONSTANT','WELFARE'].includes(destination)) return res.status(400).json({error:'Select REGULAR, TARGET, CONSTANT or WELFARE.'});
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({error:'Enter an amount greater than zero.'});
  if(!/^\\d{4}-\\d{2}$/.test(startMonth)) return res.status(400).json({error:'Select a valid start month and year.'});
  if(!Number.isInteger(shareCount)||shareCount<=0) return res.status(400).json({error:'Number of shares must be a whole number greater than zero.'});
  if(!req.file) return res.status(400).json({error:'Upload the payment receipt.'});

  const currentMonthResult=await pool.query("SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos','YYYY-MM') AS ym");
  const currentMonth=currentMonthResult.rows[0]?.ym;
  if(startMonth<currentMonth) return res.status(400).json({error:'Start month cannot be in the past.'});

  const settings=await pool.query("SELECT numeric_value FROM cooperative_settings WHERE setting_key='minimum_share_per_month'");
  const minimumShare=Number(settings.rows[0]?.numeric_value||5000);
  const monthlyAmount=minimumShare*shareCount;
  if(amount<monthlyAmount) return res.status(400).json({error:'Amount must cover at least '+shareCount+' share(s) for the first selected month.'});

  const reference='ADV-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
  const note='ADVANCE SAVING • Start: '+startMonth+' • Shares/month: '+shareCount;
  const result=await pool.query(
    "INSERT INTO payment_requests(reference,account_id,destination,amount,receipt_path,receipt_data,receipt_original_name,receipt_mime_type,note,status,request_type,advance_start_month,advance_share_count) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,'pending','advance_saving',($9||'-01')::date,$10) RETURNING id,reference,destination,amount,status,note,created_at,advance_start_month,advance_share_count",
    [reference,req.auth.sub,destination,amount,req.file.buffer,req.file.originalname,req.file.mimetype,note,startMonth,shareCount]
  );
  res.status(201).json({request:result.rows[0],minimumShare,monthlyAmount});
});

`;
  if(!account.includes(marker)){console.error('Stage 189 member payment route marker missing');process.exit(1);}
  account=account.replace(marker,route+marker);
}

if(!account.includes('advanceSavingsMonthlyV189')){
  const marker="  const savingsTypeMonthlyMap=Object.fromEntries(savingsTypeMonthlyResult.rows.map(r=>[r.destination,{current:money(r.current_total),previous:money(r.previous_total)}]));";
  const block=`
  const advanceSavingsMonthlyV189=await pool.query(
    "SELECT savings_type,"+
    "COALESCE(SUM(CASE WHEN period_month=date_trunc('month',CURRENT_DATE)::date THEN allocated_amount ELSE 0 END),0) AS current_amount,"+
    "COALESCE(SUM(CASE WHEN period_month=date_trunc('month',CURRENT_DATE)::date THEN allocated_shares ELSE 0 END),0) AS current_shares,"+
    "COALESCE(SUM(CASE WHEN period_month=date_trunc('month',CURRENT_DATE-INTERVAL '1 month')::date THEN allocated_amount ELSE 0 END),0) AS previous_amount,"+
    "COALESCE(SUM(CASE WHEN period_month=date_trunc('month',CURRENT_DATE-INTERVAL '1 month')::date THEN allocated_shares ELSE 0 END),0) AS previous_shares "+
    "FROM advance_saving_allocations WHERE account_id=$1 AND period_month IN (date_trunc('month',CURRENT_DATE)::date,date_trunc('month',CURRENT_DATE-INTERVAL '1 month')::date) GROUP BY savings_type",
    [req.auth.sub]
  );
  const advanceSavingsMapV189=Object.fromEntries(advanceSavingsMonthlyV189.rows.map(r=>[r.savings_type,{currentAmount:money(r.current_amount),currentShares:Number(r.current_shares||0),previousAmount:money(r.previous_amount),previousShares:Number(r.previous_shares||0)}]));
  for(const type of ['REGULAR','TARGET','CONSTANT','WELFARE']){
    const monthly=savingsTypeMonthlyMap[type]||{current:0,previous:0};
    const advance=advanceSavingsMapV189[type]||{currentAmount:0,currentShares:0,previousAmount:0,previousShares:0};
    monthly.current=money(monthly.current+advance.currentAmount);
    monthly.previous=money(monthly.previous+advance.previousAmount);
    savingsTypeMonthlyMap[type]=monthly;
  }
`;
  if(!account.includes(marker)){console.error('Stage 189 monthly savings map marker missing');process.exit(1);}
  account=account.replace(marker,marker+block);

  const prevOld="    const previousShares=minimumSharePerMonth>0?Math.floor(monthly.previous/minimumSharePerMonth):0;";
  const prevNew="    const advance=advanceSavingsMapV189[type]||{previousAmount:0,previousShares:0}; const previousShares=(minimumSharePerMonth>0?Math.floor(Math.max(0,monthly.previous-advance.previousAmount)/minimumSharePerMonth):0)+advance.previousShares;";
  if(!account.includes(prevOld)){console.error('Stage 189 previous shares marker missing');process.exit(1);}
  account=account.replace(prevOld,prevNew);

  const currentOld="    const currentShares=minimumSharePerMonth>0?Math.floor(monthly.current/minimumSharePerMonth):0;";
  const currentNew="    const advance=advanceSavingsMapV189[type]||{currentAmount:0,currentShares:0}; const currentShares=(minimumSharePerMonth>0?Math.floor(Math.max(0,monthly.current-advance.currentAmount)/minimumSharePerMonth):0)+advance.currentShares;";
  if(!account.includes(currentOld)){console.error('Stage 189 current shares marker missing');process.exit(1);}
  account=account.replace(currentOld,currentNew);
}
fs.writeFileSync('server/routes/account.js',account);

/* ---------- Admin approval handling ---------- */
let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes('ADVANCE_SAVING_APPROVED_V189')){
  const marker="    const column = BALANCE_COLUMNS[request.destination];";
  const branch=`
    if(request.request_type==='advance_saving'){
      const column=BALANCE_COLUMNS[request.destination];
      if(!['REGULAR','TARGET','CONSTANT','WELFARE'].includes(request.destination)||!column){
        await client.query('ROLLBACK');
        return res.status(400).json({error:'Invalid Advance Saving destination.'});
      }
      const minimumResult=await client.query("SELECT numeric_value FROM cooperative_settings WHERE setting_key='minimum_share_per_month'");
      const minimumShare=Number(minimumResult.rows[0]?.numeric_value||5000);
      const shareCount=Number(request.advance_share_count||0);
      if(!Number.isInteger(shareCount)||shareCount<=0){await client.query('ROLLBACK');return res.status(400).json({error:'Invalid Advance Saving share count.'});}
      const monthlyAmount=minimumShare*shareCount;
      let remaining=money(request.amount);
      let cursor=new Date(request.advance_start_month);
      if(!Number.isFinite(remaining)||remaining<=0||Number.isNaN(cursor.getTime())){await client.query('ROLLBACK');return res.status(400).json({error:'Invalid Advance Saving request.'});}

      const monthCheck=await client.query("SELECT date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date AS current_month");
      const currentMonth=new Date(monthCheck.rows[0].current_month);
      if(cursor<currentMonth){await client.query('ROLLBACK');return res.status(400).json({error:'Advance Saving start month is now in the past. Ask the member to submit a new request.'});}

      await client.query('UPDATE member_balances SET '+column+'='+column+'+$1,updated_at=NOW() WHERE account_id=$2',[remaining,request.account_id]);
      await client.query('DELETE FROM advance_saving_allocations WHERE payment_request_id=$1',[request.id]);

      let guard=0;
      while(remaining>0.00001&&guard<240){
        const allocation=money(Math.min(remaining,monthlyAmount));
        const shares=allocation>=monthlyAmount?shareCount:(minimumShare>0?Math.floor(allocation/minimumShare):0);
        const period=cursor.toISOString().slice(0,10);
        await client.query(
          'INSERT INTO advance_saving_allocations(payment_request_id,account_id,savings_type,period_month,allocated_amount,allocated_shares) VALUES($1,$2,$3,$4,$5,$6)',
          [request.id,request.account_id,request.destination,period,allocation,shares]
        );
        remaining=money(remaining-allocation);
        cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1));
        guard++;
      }
      if(remaining>0.00001){await client.query('ROLLBACK');return res.status(400).json({error:'Advance Saving schedule is too long.'});}

      await client.query("UPDATE payment_requests SET status='approved',reviewed_by_account_id=$1,reviewed_at=NOW(),rejection_reason=NULL WHERE id=$2",[req.auth.sub,id]);
      await client.query(
        "INSERT INTO transactions(reference,account_id,created_by_account_id,transaction_type,destination,amount,status,note,approved_at) VALUES($1,$2,$3,'advance_saving',$4,$5,'approved',$6,NOW())",
        [request.reference,request.account_id,req.auth.sub,request.destination,money(request.amount),request.note||null]
      );
      await writeAdminAudit(client,req,'ADVANCE_SAVING_APPROVED_V189','payment_request',request.id,request.username,{destination:request.destination,amount:Number(request.amount),startMonth:request.advance_start_month,sharesPerMonth:shareCount,reference:request.reference});
      await client.query('COMMIT');
      res.json({approved:true,reference:request.reference,member:{username:request.username,name:request.full_name},destination:request.destination,amount:money(request.amount),advanceSaving:true});
      return;
    }

`;
  if(!admin.includes(marker)){console.error('Stage 189 admin approval marker missing');process.exit(1);}
  admin=admin.replace(marker,branch+marker);
}

const listOld="p.receipt_original_name, p.receipt_mime_type, p.rejection_reason,";
const listNew="p.receipt_original_name, p.receipt_mime_type, p.rejection_reason, p.request_type, p.advance_start_month, p.advance_share_count,";
if(admin.includes(listOld)) admin=admin.replace(listOld,listNew);
fs.writeFileSync('server/routes/admin.js',admin);

/* ---------- Member UI ---------- */
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="advanceSavingDialogV189"')){
  const marker='<dialog id="adminSettingsDialog"';
  const dialog='\n  <dialog id="advanceSavingDialogV189">\n    <form class="dialog-card" id="advanceSavingFormV189">\n      <div class="dialog-head"><h3>ADVANCE SAVING</h3><button type="button" class="icon-btn" data-close="advanceSavingDialogV189" aria-label="Close">×</button></div>\n      <div class="helper" style="margin:0 0 14px;padding:12px;border:1px solid currentColor;border-radius:10px;line-height:1.55"><strong>OFFICIAL COOPERATIVE ACCOUNT</strong><br>Bank: FCMB<br>Account Number: <strong>1027050172</strong><br>Account Name: TAIMAKO MULTIPURPOSE COOPERATIVE SOCIETY LTD</div>\n      <label>Select Main Savings<select id="advanceSavingTypeV189" required><option value="">- Select -</option><option value="REGULAR">REGULAR</option><option value="TARGET">TARGET</option><option value="CONSTANT">CONSTANT</option><option value="WELFARE">WELFARE</option></select></label>\n      <label>Amount (₦)<input id="advanceSavingAmountV189" type="number" min="0.01" step="0.01" required /></label>\n      <label>Start Month<input id="advanceSavingStartV189" type="month" required /></label>\n      <label>Number of Shares<input id="advanceSavingSharesV189" type="number" min="1" step="1" required /></label>\n      <label>Upload Receipt<input id="advanceSavingReceiptV189" type="file" accept="image/*,.pdf" required /></label>\n      <p class="helper" id="advanceSavingHelpV189"></p>\n      <p class="form-error" id="advanceSavingErrorV189" role="alert"></p>\n      <p class="form-success" id="advanceSavingSuccessV189" role="status"></p>\n      <div class="dialog-actions"><button type="submit" class="primary">SUBMIT</button></div>\n    </form>\n  </dialog>\n\n';
  if(!html.includes(marker)){console.error('Stage 189 dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=189');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=189');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=189');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes("['ADVANCE SAVING', '']")){
  const marker="['FLEXIBLE', '']";
  const pos=app.indexOf(marker);
  if(pos<0){console.error('Stage 189 FLEXIBLE dashboard card marker missing');process.exit(1);}
  const lineEnd=app.indexOf('\n',pos);
  if(lineEnd<0){console.error('Stage 189 FLEXIBLE dashboard line end missing');process.exit(1);}
  app=app.slice(0,lineEnd+1)+"    ['ADVANCE SAVING', ''],\n"+app.slice(lineEnd+1);
}

if(!app.includes('function openAdvanceSavingV189')){
  const marker='function renderDashboard() {';
  const code=`
function advanceSavingCurrentMonthV189(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function openAdvanceSavingV189(){
  const form=document.getElementById('advanceSavingFormV189');
  if(form) form.reset();
  const start=document.getElementById('advanceSavingStartV189');
  const current=advanceSavingCurrentMonthV189();
  if(start){start.min=current;start.value=current;}
  const error=document.getElementById('advanceSavingErrorV189');
  const success=document.getElementById('advanceSavingSuccessV189');
  const help=document.getElementById('advanceSavingHelpV189');
  if(error) error.textContent='';
  if(success) success.textContent='';
  if(help) help.textContent='The full approved amount goes to the selected savings balance. Monthly savings and shares will follow the selected start month and share count.';
  openDialog(document.getElementById('advanceSavingDialogV189'));
}

document.addEventListener('submit',async(event)=>{
  if(event.target?.id!=='advanceSavingFormV189') return;
  event.preventDefault();
  event.stopPropagation();
  const form=event.target;
  const button=form.querySelector('button[type="submit"]');
  const error=document.getElementById('advanceSavingErrorV189');
  const success=document.getElementById('advanceSavingSuccessV189');
  if(error) error.textContent=''; if(success) success.textContent='';
  const old=button?.textContent||'SUBMIT';
  try{
    const destination=document.getElementById('advanceSavingTypeV189').value;
    const amount=document.getElementById('advanceSavingAmountV189').value;
    const startMonth=document.getElementById('advanceSavingStartV189').value;
    const shareCount=document.getElementById('advanceSavingSharesV189').value;
    const receipt=document.getElementById('advanceSavingReceiptV189').files?.[0];
    if(!destination) throw new Error('Select a main savings account.');
    if(!Number(amount)||Number(amount)<=0) throw new Error('Enter an amount greater than zero.');
    if(!startMonth) throw new Error('Select start month and year.');
    if(startMonth<advanceSavingCurrentMonthV189()) throw new Error('Start month cannot be in the past.');
    if(!Number.isInteger(Number(shareCount))||Number(shareCount)<=0) throw new Error('Number of shares must be a whole number greater than zero.');
    if(!receipt) throw new Error('Upload the payment receipt.');
    if(button){button.disabled=true;button.textContent='SUBMITTING…';}
    const data=new FormData();
    data.append('destination',destination);data.append('amount',amount);data.append('startMonth',startMonth);data.append('shareCount',shareCount);data.append('receipt',receipt);
    const response=await fetch((typeof API_BASE!=='undefined'?API_BASE:'')+'/api/account/advance-saving-requests',{method:'POST',headers:{Authorization:'Bearer '+state.token},body:data,cache:'no-store'});
    let body={};try{body=await response.json();}catch(_){}
    if(!response.ok) throw new Error(body.error||('Submission failed ('+response.status+').'));
    if(success) success.textContent='SUBMITTED SUCCESSFULLY • PENDING ADMIN APPROVAL • Ref: '+body.request.reference;
    form.reset();
    const start=document.getElementById('advanceSavingStartV189');const current=advanceSavingCurrentMonthV189();if(start){start.min=current;start.value=current;}
  }catch(e){if(error) error.textContent=e.message||'Unable to submit Advance Saving.';}
  finally{if(button){button.disabled=false;button.textContent=old;}}
},true);

`;
  if(!app.includes(marker)){console.error('Stage 189 render marker missing');process.exit(1);}
  app=app.replace(marker,code+marker);
}

if(!app.includes("title === 'ADVANCE SAVING'")){
  const marker="if (user.role === 'regular' && title === 'BALANCES') { card.classList.add('admin-action-card');";
  const i=app.indexOf(marker);
  if(i<0){console.error('Stage 189 BALANCES action marker missing');process.exit(1);}
  const end=app.indexOf('\n',i);
  const line=app.slice(i,end);
  const action="if (user.role === 'regular' && title === 'ADVANCE SAVING') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click',openAdvanceSavingV189); card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ') openAdvanceSavingV189();}); }";
  app=app.replace(line,action+'\n    '+line);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=189'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v189';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 189 ADVANCE SAVING workflow applied.');