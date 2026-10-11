const fs=require('fs');
const accountPath='server/routes/account.js';
let server=fs.readFileSync(accountPath,'utf8');
const needle="    ruleApplied = eligibility.ruleApplied;\n\n  } else if (source === 'REGULAR')";
if(!server.includes(needle))throw Error('Flexible charge guard location missing');
server=server.replace(needle,`    ruleApplied = eligibility.ruleApplied;
    if (feePercent > 0 && req.body?.acceptCharge !== true) {
      return res.status(400).json({ error:'Accept the 20% Flexible withdrawal charge before submitting.' });
    }

  } else if (source === 'REGULAR')`);
const marker="router.post('/withdrawal-requests', requireAuth, async (req, res) => {";
if(!server.includes(marker))throw Error('Withdraw POST missing');
server=server.replace(marker,`router.get('/withdrawal-charge', requireAuth, async (req,res) => {
  const amount=Number(req.query.amount);
  if(!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:'Enter a valid amount.'});
  const result=await pool.query(
    \`SELECT a.role,b.flexible_start_date FROM accounts a JOIN member_balances b ON b.account_id=a.id WHERE a.id=$1\`,[req.auth.sub]);
  if(!result.rows[0])return res.status(404).json({error:'Account not found.'});
  const terms=await flexibleWithdrawalTerms(req.auth.sub,amount,result.rows[0].flexible_start_date);
  res.json({feePercent:terms.feePercent,feeAmount:terms.feeAmount,payoutAmount:terms.payoutAmount,ruleApplied:terms.ruleApplied});
});

`+marker);
fs.writeFileSync(accountPath,server);
const hPath='www/index.html';
let html=fs.readFileSync(hPath,'utf8');
html=html.replace('>SUBMIT WITHDRAWAL REQUEST</button>','>SUBMIT</button>');
if(!html.includes('id="tmcsWithdrawalSubmitV218">SUBMIT</button>'))throw Error('Submission label missing');
html=html.replace('id="tmcsWithdrawalSubmitV218">SUBMIT</button>',`id="tmcsWithdrawalSubmitV218">SUBMIT</button>
      <div id="tmcsWithdrawalChargeV221" hidden style="padding:10px;border:1px solid #bb8a32;border-radius:8px;margin:8px 0">
        <p id="tmcsWithdrawalChargeTextV221">A 20% withdrawal charge applies.</p>
        <button type="button" id="tmcsWithdrawalAcceptV221">ACCEPT</button>
        <button type="button" id="tmcsWithdrawalDeclineV221">DECLINE</button>
      </div>`);
const old="if(!note){error.textContent='Enter Account Details.';return;}";
if(!html.includes(old))throw Error('Capture handler field requirement missing');
html=html.replace(old,'');
const condition="const previous=button.textContent;";
if(!html.includes(condition))throw Error('Capture handler active location missing');
html=html.replace(condition,`if(source==='FLEXIBLE' && !window.tmcsFlexibleConsentV221){
    error.textContent='Please confirm withdrawal charge conditions before submitting.';
    return;
  }
  const previous=button.textContent;`);
html=html.replace("success.textContent='Request submitted. Reference: '+data.request.reference+'.'+(data.request.fee_percent==null?'':' Estimated fee: '+data.request.fee_percent+'%.');","success.textContent='Submitted successfully';");
html=html.replace("JSON.stringify({source,amount,note})","JSON.stringify({source,amount,note,acceptCharge:source==='FLEXIBLE'&&window.tmcsFlexibleConsentV221===true})");
const script=`<script>
/* Flexible fee consent v221; calculate terms from the server before activating submit */
(function(){
 const get=id=>document.getElementById(id);
 let accepted=false,ready=false,sourceAmount='';
 const btn=()=>get('tmcsWithdrawalSubmitV218');
 const box=()=>get('tmcsWithdrawalChargeV221');
 const setEnabled=()=>{
  const b=btn();if(!b)return;
  const source=get('withdrawalSource')?.value;
  b.disabled=source==='FLEXIBLE' && (!ready || !accepted);
 };
 async function recalc(){
  const source=get('withdrawalSource')?.value;
  const amount=String(get('withdrawalAmount')?.value||'');
  accepted=false;ready=false;window.tmcsFlexibleConsentV221=false;
  if(box())box().hidden=true;
  if(source!=='FLEXIBLE'){ready=true;accepted=true;setEnabled();return;}
  if(!Number.isFinite(Number(amount))||Number(amount)<=0){setEnabled();return;}
  sourceAmount=amount;
  setEnabled();
  try{
   const data=await api('/api/account/withdrawal-charge?amount='+encodeURIComponent(amount));
   if(amount!==String(get('withdrawalAmount')?.value||''))return;
   ready=true;
   if(Number(data.feePercent)>0){
    if(box())box().hidden=false;
    get('tmcsWithdrawalChargeTextV221').textContent='A 20% withdrawal charge applies (₦'+Number(data.feeAmount).toLocaleString('en-NG',{minimumFractionDigits:2})+'). Do you accept?';
   }else{accepted=true;window.tmcsFlexibleConsentV221=true;}
  }catch(e){get('withdrawalError').textContent=e?.message||'Could not verify withdrawal charge.';}
  setEnabled();
 }
 document.addEventListener('input',e=>{if(e.target?.id==='withdrawalAmount')recalc();},true);
 document.addEventListener('change',e=>{if(e.target?.id==='withdrawalSource')recalc();},true);
 document.addEventListener('click',e=>{
  if(e.target?.id==='tmcsWithdrawalAcceptV221'){accepted=true;window.tmcsFlexibleConsentV221=true;if(box())box().hidden=true;setEnabled();}
  if(e.target?.id==='tmcsWithdrawalDeclineV221'){accepted=false;window.tmcsFlexibleConsentV221=false;if(box())box().hidden=true;setEnabled();}
 },true);
 document.addEventListener('click',e=>{
  if(e.target?.closest?.('[data-action="withdraw"]'))setTimeout(recalc,0);
 },true);
 new MutationObserver(()=>{if(get('withdrawalDialog')?.open && !ready && Number(get('withdrawalAmount')?.value)>0)recalc();}).observe(document.body,{childList:true,subtree:true});
 setEnabled();
})();
</script>`;
html=html.replace('</body>',script+'</body>');
fs.writeFileSync(hPath,html);
console.log('Withdrawal fee preview and acceptance enforced on both client and server.');
