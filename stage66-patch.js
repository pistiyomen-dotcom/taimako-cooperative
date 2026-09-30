const fs=require('fs');

// Stage 66: rebuild Cash Credit from scratch as an independent Admin workflow.

// 1) Cash-credit-specific member confirmation endpoint.
// This deliberately uses cash_credit permission so Confirm does not depend on manage_accounts.
let admin=fs.readFileSync('server/routes/admin.js','utf8');
if(!admin.includes("router.get('/cash-credit/member'")){
  const route=String.raw\`
router.get('/cash-credit/member', requireAdminPermission('cash_credit'), async (req,res)=>{
  const username=String(req.query.username||'').trim().toUpperCase();
  const accountType=String(req.query.account||'').trim().toUpperCase();
  if(!username) return res.status(400).json({error:'Enter a username.'});
  if(!['REGULAR','FLEXIBLE'].includes(accountType)) return res.status(400).json({error:'Select REGULAR or FLEXIBLE account.'});

  const result=await pool.query(
    "SELECT username,full_name,role,is_active FROM accounts WHERE username=$1 LIMIT 1",
    [username]
  );
  if(!result.rowCount || !result.rows[0].is_active) return res.status(404).json({error:'Active account not found.'});

  const member=result.rows[0];
  const expectedRole=accountType==='REGULAR'?'regular':'flexible';
  if(String(member.role||'').toLowerCase()!==expectedRole){
    return res.status(400).json({error:accountType==='REGULAR'?'Username is not a Regular member account.':'Username is not a Flexible saver account.'});
  }

  res.json({member:{username:member.username,name:member.full_name,role:member.role,account:accountType}});
});
\`;
  admin=admin.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
  fs.writeFileSync('server/routes/admin.js',admin);
}

// 2) Fresh Cash Credit dialog.
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="cashCreditV66Dialog"')){
  const dialog=String.raw\`
  <dialog id="cashCreditV66Dialog">
    <form class="dialog-card" id="cashCreditV66Form" autocomplete="off">
      <div class="dialog-head">
        <h3>CASH CREDIT</h3>
        <button type="button" class="icon-btn" data-close="cashCreditV66Dialog" aria-label="Close">×</button>
      </div>

      <label>Account
        <select id="cashCreditAccount" required>
          <option value="">-Select Account</option>
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
  </dialog>
\`;
  html=html.replace('</body>',dialog+'\n</body>');
}

// Add Cash Credit as its own Admin dashboard action after Create Account.
if(!html.includes('cash-credit-v66.js')){
  html=html.replace('</body>','  <script src="cash-credit-v66.js?v=66"></script>\n</body>');
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=66');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=66');
fs.writeFileSync('www/index.html',html);

// 3) Add the Admin CASH CREDIT dashboard card/action.
let app=fs.readFileSync('www/app.js','utf8');
if(!app.includes("['CASH CREDIT', 'Post cash directly to Regular or Flexible account']")){
  const marker="    ['CREATE ACCOUNT', 'Create Regular, Flexible or Admin account'],";
  if(app.includes(marker)){
    app=app.replace(marker,marker+"\n    ['CASH CREDIT', 'Post cash directly to Regular or Flexible account'],");
  }else{
    console.error('Stage 66 Admin CREATE ACCOUNT dashboard marker missing');
    process.exit(1);
  }
}
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=66'");
fs.writeFileSync('www/app.js',app);

// 4) Standalone client behavior. It does not reuse the removed Manual Cash Credit code.
const client=String.raw\`(() => {
  function getSession(){
    try { return JSON.parse(sessionStorage.getItem('tmcs-session') || '{}'); }
    catch(_){ return {}; }
  }

  async function request(path,options={}){
    const session=getSession();
    const headers={...(options.headers||{})};
    if(session.token) headers.Authorization='Bearer '+session.token;
    if(options.body && !headers['Content-Type']) headers['Content-Type']='application/json';
    const response=await fetch(path,{...options,headers,cache:'no-store'});
    let body={};
    try{ body=await response.json(); }catch(_){}
    if(!response.ok) throw new Error(body.error||'Request failed ('+response.status+').');
    return body;
  }

  const state={confirmedUsername:'',confirmedAccount:'',posting:false,successTimer:null};

  function els(){
    return {
      dialog:document.getElementById('cashCreditV66Dialog'),
      form:document.getElementById('cashCreditV66Form'),
      account:document.getElementById('cashCreditAccount'),
      username:document.getElementById('cashCreditUsername'),
      confirm:document.getElementById('cashCreditConfirm'),
      name:document.getElementById('cashCreditMemberName'),
      amount:document.getElementById('cashCreditAmount'),
      post:document.getElementById('cashCreditPost'),
      error:document.getElementById('cashCreditV66Error'),
      success:document.getElementById('cashCreditSuccessOverlay')
    };
  }

  function clearConfirmation(){
    const e=els();
    state.confirmedUsername='';
    state.confirmedAccount='';
    if(e.name){ e.name.textContent=''; e.name.style.display='none'; }
    if(e.error) e.error.textContent='';
  }

  function resetForm(){
    const e=els();
    if(e.form) e.form.reset();
    clearConfirmation();
    if(e.success) e.success.style.display='none';
    state.posting=false;
    if(e.post) e.post.disabled=false;
  }

  function openCashCredit(){
    const e=els();
    if(!e.dialog) return;
    resetForm();
    if(typeof e.dialog.showModal==='function') e.dialog.showModal();
    else e.dialog.setAttribute('open','');
  }

  async function confirmMember(){
    const e=els();
    clearConfirmation();
    const account=(e.account?.value||'').trim().toUpperCase();
    const username=(e.username?.value||'').trim().toUpperCase();

    if(!account){ e.error.textContent='Select an account.'; return; }
    if(!username){ e.error.textContent='Enter username.'; return; }

    e.confirm.disabled=true;
    e.confirm.textContent='CONFIRMING...';
    try{
      const data=await request('/api/admin/cash-credit/member?account='+encodeURIComponent(account)+'&username='+encodeURIComponent(username));
      state.confirmedUsername=username;
      state.confirmedAccount=account;
      e.name.textContent=data.member.name+' — '+data.member.username;
      e.name.style.display='block';
    }catch(err){
      e.error.textContent=err.message;
    }finally{
      e.confirm.disabled=false;
      e.confirm.textContent='CONFIRM';
    }
  }

  async function postCash(event){
    event.preventDefault();
    event.stopPropagation();
    const e=els();
    if(state.posting) return;

    const account=(e.account?.value||'').trim().toUpperCase();
    const username=(e.username?.value||'').trim().toUpperCase();
    const amount=Number(e.amount?.value);

    e.error.textContent='';
    if(!account){ e.error.textContent='Select an account.'; return; }
    if(!username){ e.error.textContent='Enter username.'; return; }
    if(state.confirmedUsername!==username || state.confirmedAccount!==account){
      e.error.textContent='Confirm the member before posting cash.';
      return;
    }
    if(!Number.isFinite(amount)||amount<=0){ e.error.textContent='Enter an amount greater than zero.'; return; }

    state.posting=true;
    e.post.disabled=true;
    e.post.textContent='POSTING...';

    try{
      await request('/api/admin/cash-credit',{
        method:'POST',
        body:JSON.stringify({username,destination:account,amount})
      });

      e.success.style.display='block';
      e.account.disabled=true;
      e.username.disabled=true;
      e.confirm.disabled=true;
      e.amount.disabled=true;
      e.post.style.display='none';

      if(state.successTimer) clearTimeout(state.successTimer);
      state.successTimer=setTimeout(()=>{
        e.success.style.display='none';
        e.account.disabled=false;
        e.username.disabled=false;
        e.confirm.disabled=false;
        e.amount.disabled=false;
        e.post.style.display='';
        e.post.textContent='POST CASH';
        resetForm();
      },3000);
    }catch(err){
      e.error.textContent=err.message;
      state.posting=false;
      e.post.disabled=false;
      e.post.textContent='POST CASH';
    }
  }

  function init(){
    const e=els();
    if(!e.dialog||!e.form) return;

    e.account.addEventListener('change',clearConfirmation);
    e.username.addEventListener('input',()=>{
      e.username.value=e.username.value.toUpperCase();
      clearConfirmation();
    });
    e.confirm.addEventListener('click',confirmMember);
    e.form.addEventListener('submit',postCash,true);

    document.addEventListener('click',(event)=>{
      const button=event.target.closest?.('button');
      if(!button) return;
      const text=(button.textContent||'').trim().toUpperCase();
      if(text.includes('CASH CREDIT') && !button.closest('#cashCreditV66Dialog')){
        event.preventDefault();
        event.stopImmediatePropagation();
        openCashCredit();
      }
    },true);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();\`;
fs.writeFileSync('www/cash-credit-v66.js',client);

// 5) Force a fresh PWA cache.
let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v66';");
if(!sw.includes("'./cash-credit-v66.js'")){
  sw=sw.replace("'./manifest.webmanifest'","'./manifest.webmanifest','./cash-credit-v66.js'");
}
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 66 fresh Cash Credit form and Admin dashboard applied.');