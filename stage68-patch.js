const fs=require('fs');

// Stage 68: complete Cash Credit account confirmation and destination workflow.

// Add dedicated cash-credit balance columns for fee/card/form destinations.
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('membership_card NUMERIC')){
  schema=schema.replace(
    '\nCOMMIT;',
    "\nALTER TABLE member_balances ADD COLUMN IF NOT EXISTS membership_card NUMERIC(14,2) NOT NULL DEFAULT 0;\n"+
    "ALTER TABLE member_balances ADD COLUMN IF NOT EXISTS flexible_card NUMERIC(14,2) NOT NULL DEFAULT 0;\n"+
    "ALTER TABLE member_balances ADD COLUMN IF NOT EXISTS application_form NUMERIC(14,2) NOT NULL DEFAULT 0;\n\nCOMMIT;"
  );
}
fs.writeFileSync('server/db/schema.sql',schema);

// Add fresh confirmation + posting endpoints that support Admin, Regular and Flexible accounts.
let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes("router.get('/cash-credit-v68/member'")){
  const routes=String.raw`

router.get('/cash-credit-v68/member', requireAdminPermission('cash_credit'), async (req,res)=>{
  const username=String(req.query.username||'').trim().toUpperCase();
  const accountType=String(req.query.account||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter username.'});
  if(!['ADMIN','REGULAR','FLEXIBLE'].includes(accountType)) return res.status(400).json({error:'Select ADMIN, REGULAR or FLEXIBLE.'});

  const result=await pool.query(
    "SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1 LIMIT 1",
    [username]
  );
  if(!result.rowCount || !result.rows[0].is_active) return res.status(404).json({error:'Active account not found.'});

  const account=result.rows[0];
  const expected={ADMIN:'admin',REGULAR:'regular',FLEXIBLE:'flexible'}[accountType];
  if(String(account.role||'').toLowerCase()!==expected){
    return res.status(400).json({error:'Username does not belong to the selected '+accountType+' account type.'});
  }

  res.json({account:{id:account.id,username:account.username,name:account.full_name,role:account.role,type:accountType}});
});

router.post('/cash-credit-v68', requireAdminPermission('cash_credit'), async (req,res)=>{
  const username=String(req.body?.username||'').trim().toUpperCase();
  const accountType=String(req.body?.account||'').trim().toUpperCase();
  const destination=String(req.body?.destination||'').trim().toUpperCase();
  const amount=Number(req.body?.amount);

  const allowedAccounts=['ADMIN','REGULAR','FLEXIBLE'];
  const allowedDestinations=['REGULAR','TARGET','CONSTANT','LOAN','INTEREST','REGISTRATION','MEMBERSHIP CARD','FLEXIBLE CARD','APPLICATION FORM'];
  if(!allowedAccounts.includes(accountType)) return res.status(400).json({error:'Select ADMIN, REGULAR or FLEXIBLE.'});
  if(!allowedDestinations.includes(destination)) return res.status(400).json({error:'Select a valid Account Type.'});
  if(!username) return res.status(400).json({error:'Enter username.'});
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({error:'Enter an amount greater than zero.'});

  const columnMap={
    'REGULAR':'regular',
    'TARGET':'target',
    'CONSTANT':'constant',
    'LOAN':'loan_principal',
    'INTEREST':'loan_interest',
    'REGISTRATION':'registration',
    'MEMBERSHIP CARD':'membership_card',
    'FLEXIBLE CARD':'flexible_card',
    'APPLICATION FORM':'application_form'
  };
  const column=columnMap[destination];

  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const found=await client.query(
      "SELECT id,username,full_name,role,is_active FROM accounts WHERE username=$1 FOR UPDATE",
      [username]
    );
    if(!found.rowCount || !found.rows[0].is_active){
      await client.query('ROLLBACK');
      return res.status(404).json({error:'Active account not found.'});
    }

    const account=found.rows[0];
    const expected={ADMIN:'admin',REGULAR:'regular',FLEXIBLE:'flexible'}[accountType];
    if(String(account.role||'').toLowerCase()!==expected){
      await client.query('ROLLBACK');
      return res.status(400).json({error:'Username does not belong to the selected '+accountType+' account type.'});
    }

    await client.query('INSERT INTO member_balances(account_id) VALUES($1) ON CONFLICT(account_id) DO NOTHING',[account.id]);
    const updated=await client.query(
      'UPDATE member_balances SET '+column+'='+column+'+$1, updated_at=NOW() WHERE account_id=$2 RETURNING *',
      [amount,account.id]
    );

    const reference='CASH-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase();
    await client.query(
      "INSERT INTO transactions(reference,account_id,created_by_account_id,transaction_type,destination,amount,status,note,approved_at) VALUES($1,$2,$3,'cash_credit',$4,$5,'completed',$6,NOW())",
      [reference,account.id,req.auth.sub,destination,amount,'Cash credit to '+destination]
    );

    await client.query('COMMIT');
    try{
      if(typeof writeAdminAudit==='function'){
        await writeAdminAudit(pool,req,'CASH_CREDIT_POSTED','account',account.id,account.username,{accountType,destination,amount,reference});
      }
    }catch(_){}

    res.json({
      successful:true,
      reference,
      account:{username:account.username,name:account.full_name,role:account.role,type:accountType},
      destination,
      amount,
      balance:Number(updated.rows[0]?.[column]||0)
    });
  }catch(error){
    try{await client.query('ROLLBACK');}catch(_){}
    console.error('Cash Credit v68 error:',error);
    res.status(500).json({error:'Cash credit could not be posted.'});
  }finally{
    client.release();
  }
});
`;
  admin=admin.replace('\nmodule.exports = router;',routes+'\nmodule.exports = router;');
}
fs.writeFileSync('server/routes/admin.js',admin);

// Rebuild the Cash Credit dialog fields to the required order.
let html=fs.readFileSync('www/index.html','utf8');
const start=html.indexOf('<dialog id="cashCreditV66Dialog">');
if(start<0){ console.error('Stage 68 Cash Credit dialog not found'); process.exit(1); }
const end=html.indexOf('</dialog>',start);
if(end<0){ console.error('Stage 68 Cash Credit dialog end not found'); process.exit(1); }

const dialog=String.raw`<dialog id="cashCreditV66Dialog">
    <form class="dialog-card" id="cashCreditV66Form" autocomplete="off">
      <div class="dialog-head">
        <h3>CASH CREDIT</h3>
        <button type="button" class="icon-btn" data-close="cashCreditV66Dialog" aria-label="Close">×</button>
      </div>

      <label>Account
        <select id="cashCreditAccount" required>
          <option value="">-Select Account</option>
          <option value="ADMIN">ADMIN</option>
          <option value="REGULAR">REGULAR</option>
          <option value="FLEXIBLE">FLEXIBLE</option>
        </select>
      </label>

      <label>Username
        <input id="cashCreditUsername" placeholder="ENTER USERNAME" autocomplete="off" required />
      </label>

      <div style="margin:8px 0 10px">
        <button type="button" class="secondary" id="cashCreditConfirm" style="width:auto;min-width:120px">CONFIRM</button>
      </div>

      <div id="cashCreditMemberName" class="member-confirm" style="display:none;margin:8px 0 14px;font-size:17px;font-weight:800;color:#075d32"></div>

      <label>Account Type
        <select id="cashCreditDestination" required disabled>
          <option value="">-Select Account Type</option>
          <option value="REGULAR">REGULAR</option>
          <option value="TARGET">TARGET</option>
          <option value="CONSTANT">CONSTANT</option>
          <option value="LOAN">LOAN</option>
          <option value="INTEREST">INTEREST</option>
          <option value="REGISTRATION">REGISTRATION</option>
          <option value="MEMBERSHIP CARD">MEMBERSHIP CARD</option>
          <option value="FLEXIBLE CARD">FLEXIBLE CARD</option>
          <option value="APPLICATION FORM">APPLICATION FORM</option>
        </select>
      </label>

      <label>Amount
        <input id="cashCreditAmount" type="number" min="0.01" step="0.01" inputmode="decimal" required />
      </label>

      <p class="form-error" id="cashCreditV66Error" role="alert"></p>

      <div style="margin-top:12px">
        <button class="primary" id="cashCreditPost" type="submit" style="width:auto;min-width:130px;max-width:180px;padding-left:18px;padding-right:18px">POST CASH</button>
      </div>

      <div id="cashCreditSuccessOverlay" style="display:none;text-align:center;padding:22px 10px 12px" role="status" aria-live="polite">
        <div style="width:88px;height:88px;margin:0 auto 12px;border-radius:50%;background:#07883f;color:white;display:flex;align-items:center;justify-content:center;font-size:58px;font-weight:900;line-height:1">✓</div>
        <div style="color:#07883f;font-size:24px;font-weight:900">SUCCESSFUL</div>
      </div>
    </form>
  </dialog>`;

html=html.slice(0,start)+dialog+html.slice(end+'</dialog>'.length);
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=68');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=68');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=68');
fs.writeFileSync('www/index.html',html);

// Replace the standalone Cash Credit behavior.
const client=String.raw`(() => {
  function getSession(){
    try{return JSON.parse(sessionStorage.getItem('tmcs-session')||'{}');}
    catch(_){return {};}
  }

  async function request(path,options={}){
    const session=getSession();
    const headers={...(options.headers||{})};
    if(session.token) headers.Authorization='Bearer '+session.token;
    if(options.body&&!headers['Content-Type']) headers['Content-Type']='application/json';
    const response=await fetch(path,{...options,headers,cache:'no-store'});
    let body={};
    try{body=await response.json();}catch(_){}
    if(!response.ok) throw new Error(body.error||'Request failed ('+response.status+').');
    return body;
  }

  const state={confirmedUsername:'',confirmedAccount:'',posting:false,successTimer:null};

  function e(){
    return {
      dialog:document.getElementById('cashCreditV66Dialog'),
      form:document.getElementById('cashCreditV66Form'),
      account:document.getElementById('cashCreditAccount'),
      username:document.getElementById('cashCreditUsername'),
      confirm:document.getElementById('cashCreditConfirm'),
      details:document.getElementById('cashCreditMemberName'),
      destination:document.getElementById('cashCreditDestination'),
      amount:document.getElementById('cashCreditAmount'),
      post:document.getElementById('cashCreditPost'),
      error:document.getElementById('cashCreditV66Error'),
      success:document.getElementById('cashCreditSuccessOverlay')
    };
  }

  function clearConfirmation(){
    const x=e();
    state.confirmedUsername='';
    state.confirmedAccount='';
    if(x.details){x.details.textContent='';x.details.style.display='none';}
    if(x.destination){x.destination.value='';x.destination.disabled=true;}
    if(x.error)x.error.textContent='';
  }

  function reset(){
    const x=e();
    if(x.form)x.form.reset();
    clearConfirmation();
    if(x.account)x.account.disabled=false;
    if(x.username)x.username.disabled=false;
    if(x.confirm)x.confirm.disabled=false;
    if(x.amount)x.amount.disabled=false;
    if(x.post){x.post.disabled=false;x.post.style.display='';x.post.textContent='POST CASH';}
    if(x.success)x.success.style.display='none';
    state.posting=false;
  }

  function openCashCredit(){
    const x=e();
    if(!x.dialog)return;
    reset();
    if(typeof x.dialog.showModal==='function')x.dialog.showModal();
    else x.dialog.setAttribute('open','');
  }
  window.openCashCreditV67=openCashCredit;

  async function confirmAccount(){
    const x=e();
    clearConfirmation();
    const account=(x.account?.value||'').trim().toUpperCase();
    const username=(x.username?.value||'').trim().toUpperCase();
    if(!account){x.error.textContent='Select an Account.';return;}
    if(!username){x.error.textContent='Enter username.';return;}

    x.confirm.disabled=true;
    x.confirm.textContent='CONFIRMING...';
    try{
      const data=await request('/api/admin/cash-credit-v68/member?account='+encodeURIComponent(account)+'&username='+encodeURIComponent(username));
      state.confirmedUsername=username;
      state.confirmedAccount=account;
      x.details.textContent=data.account.name+' — '+data.account.username+' — '+account;
      x.details.style.display='block';
      x.destination.disabled=false;
    }catch(err){
      x.error.textContent=err.message;
    }finally{
      x.confirm.disabled=false;
      x.confirm.textContent='CONFIRM';
    }
  }

  async function postCash(event){
    event.preventDefault();
    event.stopPropagation();
    const x=e();
    if(state.posting)return;

    const account=(x.account?.value||'').trim().toUpperCase();
    const username=(x.username?.value||'').trim().toUpperCase();
    const destination=(x.destination?.value||'').trim().toUpperCase();
    const amount=Number(x.amount?.value);

    x.error.textContent='';
    if(!account){x.error.textContent='Select an Account.';return;}
    if(!username){x.error.textContent='Enter username.';return;}
    if(state.confirmedUsername!==username||state.confirmedAccount!==account){
      x.error.textContent='Confirm the account details before posting cash.';
      return;
    }
    if(!destination){x.error.textContent='Select Account Type.';return;}
    if(!Number.isFinite(amount)||amount<=0){x.error.textContent='Enter an amount greater than zero.';return;}

    state.posting=true;
    x.post.disabled=true;
    x.post.textContent='POSTING...';

    try{
      await request('/api/admin/cash-credit-v68',{
        method:'POST',
        body:JSON.stringify({account,username,destination,amount})
      });

      x.success.style.display='block';
      x.account.disabled=true;
      x.username.disabled=true;
      x.confirm.disabled=true;
      x.destination.disabled=true;
      x.amount.disabled=true;
      x.post.style.display='none';

      if(state.successTimer)clearTimeout(state.successTimer);
      state.successTimer=setTimeout(()=>reset(),3000);
    }catch(err){
      x.error.textContent=err.message;
      state.posting=false;
      x.post.disabled=false;
      x.post.textContent='POST CASH';
    }
  }

  function init(){
    const x=e();
    if(!x.dialog||!x.form)return;
    x.account.addEventListener('change',clearConfirmation);
    x.username.addEventListener('input',()=>{
      x.username.value=x.username.value.toUpperCase();
      clearConfirmation();
    });
    x.confirm.addEventListener('click',confirmAccount);
    x.form.addEventListener('submit',postCash,true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();`;
fs.writeFileSync('www/cash-credit-v66.js',client);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=68'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v68';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 68 complete Cash Credit workflow applied.');