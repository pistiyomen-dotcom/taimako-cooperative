const fs=require('fs');

let a=fs.readFileSync('server/routes/account.js','utf8');
if(!a.includes("router.get('/linked-flexible'")){
  const route=`

router.get('/linked-flexible', requireAuth, async (req,res) => {
  const me=await pool.query('SELECT id,role,is_active FROM accounts WHERE id=$1',[req.auth.sub]);
  const account=me.rows[0];
  if(!account || !account.is_active || account.role!=='regular') return res.status(403).json({error:'Only active Regular members can use this transfer.'});
  const result=await pool.query("SELECT id,username,full_name,is_active FROM accounts WHERE role='flexible' AND linked_regular_account_id=$1 ORDER BY id LIMIT 1",[req.auth.sub]);
  const flex=result.rows[0];
  res.json({linked:Boolean(flex&&flex.is_active),flexible:flex?{username:flex.username,name:flex.full_name}:null});
});

router.post('/regular-flexible-transfer', requireAuth, async (req,res) => {
  const amount=Number(req.body?.amount);
  const note=String(req.body?.note||'').trim();
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({error:'Enter an amount greater than zero.'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const sourceResult=await client.query("SELECT a.id,a.username,a.full_name,a.role,a.is_active,b.regular FROM accounts a JOIN member_balances b ON b.account_id=a.id WHERE a.id=$1 FOR UPDATE",[req.auth.sub]);
    const source=sourceResult.rows[0];
    if(!source||!source.is_active||source.role!=='regular'){await client.query('ROLLBACK');return res.status(403).json({error:'Only active Regular members can transfer to Flexible.'});}
    if(amount>money(source.regular)){await client.query('ROLLBACK');return res.status(400).json({error:'Transfer amount exceeds the available Regular balance.'});}
    const targetResult=await client.query("SELECT a.id,a.username,a.full_name,a.is_active,b.flexible FROM accounts a JOIN member_balances b ON b.account_id=a.id WHERE a.role='flexible' AND a.linked_regular_account_id=$1 ORDER BY a.id LIMIT 1 FOR UPDATE",[source.id]);
    const target=targetResult.rows[0];
    if(!target||!target.is_active){await client.query('ROLLBACK');return res.status(400).json({error:'No active Flexible account is linked to this Regular member.'});}
    await client.query('UPDATE member_balances SET regular=regular-$1,updated_at=NOW() WHERE account_id=$2',[amount,source.id]);
    await client.query('UPDATE member_balances SET flexible=flexible+$1,updated_at=NOW() WHERE account_id=$2',[amount,target.id]);
    const reference='RFX-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
    await client.query('INSERT INTO transfers(reference,from_account_id,to_account_id,destination,amount) VALUES($1,$2,$3,$4,$5)',[reference,source.id,target.id,'FLEXIBLE',amount]);
    await client.query("INSERT INTO transactions(reference,account_id,created_by_account_id,transaction_type,destination,amount,status,note,approved_at) VALUES($1,$2,$2,'regular_transfer_out','REGULAR',$3,'completed',$4,NOW())",[reference+'-D',source.id,amount,'Transfer '+reference+' to linked Flexible '+target.username+(note?' • '+note:'')]);
    await client.query("INSERT INTO transactions(reference,account_id,created_by_account_id,transaction_type,destination,amount,status,note,approved_at) VALUES($1,$2,$3,'flexible_transfer_in','FLEXIBLE',$4,'completed',$5,NOW())",[reference+'-C',target.id,source.id,amount,'Transfer '+reference+' from linked Regular '+source.username+(note?' • '+note:'')]);
    await client.query('COMMIT');
    res.json({transfer:{reference,amount,to:{username:target.username,name:target.full_name}}});
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
});
`;
  a=a.replace('\nmodule.exports = router;',route+'\nmodule.exports = router;');
}
fs.writeFileSync('server/routes/account.js',a);

let h=fs.readFileSync('www/index.html','utf8');
if(!h.includes('id="regularFlexibleDialog"')){
  const dialog=`
  <dialog id="regularFlexibleDialog">
    <form class="dialog-card" id="regularFlexibleForm">
      <div class="dialog-head"><h3>Deposit to Linked Flexible</h3><button type="button" class="icon-btn" data-close="regularFlexibleDialog" aria-label="Close">×</button></div>
      <div id="regularFlexibleInfo" class="member-confirm show"></div>
      <label>Amount (₦)<input id="regularFlexibleAmount" type="number" min="0.01" step="0.01" required /></label>
      <label>Note (optional)<input id="regularFlexibleNote" /></label>
      <button class="primary" type="submit">TRANSFER TO FLEXIBLE</button>
      <p class="form-error" id="regularFlexibleError"></p>
      <p class="form-success" id="regularFlexibleSuccess"></p>
    </form>
  </dialog>
`;
  h=h.replace('</body>',dialog+'\n</body>');
}
fs.writeFileSync('www/index.html',h);

let s=fs.readFileSync('www/app.js','utf8');
if(!s.includes("'FLEXIBLE DEPOSIT'")){
  s=s.replace("['PAY', 'TRANSACTION HISTORY', 'SAVINGS PLANS', 'LOAN STATUS', 'APPLY FOR LOAN', 'WITHDRAW']","['PAY', 'TRANSACTION HISTORY', 'SAVINGS PLANS', 'LOAN STATUS', 'APPLY FOR LOAN', 'WITHDRAW', 'FLEXIBLE DEPOSIT']");
  s=s.replace("label === 'SAVINGS PLANS' ? openMemberSavingsPlans() : label === 'LOAN STATUS' ? openLoanStatusDialog() : openLoanApplyDialog()","label === 'SAVINGS PLANS' ? openMemberSavingsPlans() : label === 'LOAN STATUS' ? openLoanStatusDialog() : label === 'FLEXIBLE DEPOSIT' ? openRegularFlexibleDialog() : openLoanApplyDialog()");
}
if(!s.includes('async function openRegularFlexibleDialog()')){
  s += [
    '',
    'async function openRegularFlexibleDialog(){',
    '  const d=document.getElementById(\'regularFlexibleDialog\'),info=document.getElementById(\'regularFlexibleInfo\'),err=document.getElementById(\'regularFlexibleError\'),ok=document.getElementById(\'regularFlexibleSuccess\');',
    '  err.textContent=\'\';ok.textContent=\'\';info.innerHTML=\'Checking linked Flexible account…\';document.getElementById(\'regularFlexibleForm\').reset();d.showModal();',
    '  try{const x=await api(\'/api/account/linked-flexible\');if(!x.linked){info.innerHTML=\'No active Flexible account is linked to this Regular member.\';return;}info.innerHTML=\'<strong>\'+escapeHTML(x.flexible.name)+\'</strong><br>\'+escapeHTML(x.flexible.username)+\' • Linked Flexible account\';}catch(e){err.textContent=e.message;}',
    '}',
    'document.getElementById(\'regularFlexibleForm\').addEventListener(\'submit\',async(e)=>{',
    '  e.preventDefault();const err=document.getElementById(\'regularFlexibleError\'),ok=document.getElementById(\'regularFlexibleSuccess\');err.textContent=\'\';ok.textContent=\'\';',
    '  try{const x=await api(\'/api/account/regular-flexible-transfer\',{method:\'POST\',body:JSON.stringify({amount:document.getElementById(\'regularFlexibleAmount\').value,note:document.getElementById(\'regularFlexibleNote\').value})});ok.textContent=\'Transfer completed. Reference: \'+x.transfer.reference+\'. \'+naira(x.transfer.amount)+\' sent to \'+x.transfer.to.name+\' (\'+x.transfer.to.username+\').\';document.getElementById(\'regularFlexibleAmount\').value=\'\';document.getElementById(\'regularFlexibleNote\').value=\'\';await refreshAccount();renderApp();}catch(ex){err.textContent=ex.message;}',
    '});',
    ''
  ].join('\n');
}
fs.writeFileSync('www/app.js',s);

console.log('TAIMAKO Stage 43 Regular to linked Flexible transfer applied.');