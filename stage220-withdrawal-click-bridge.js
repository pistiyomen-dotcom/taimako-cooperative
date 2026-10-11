const fs=require('fs');
const path='www/index.html';
let html=fs.readFileSync(path,'utf8');
if(!html.includes('id="tmcsWithdrawalSubmitV218"'))throw Error('Withdrawal button missing');
if(!html.includes('</body>'))throw Error('HTML body missing');
const script=`<script>
/* v220 - independent withdrawal click bridge; gives visible feedback even if app.js fails to wire its listener */
document.addEventListener('click',async function(event){
  const button=event.target.closest?.('#tmcsWithdrawalSubmitV218');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(button.disabled)return;
  const form=document.getElementById('withdrawalForm');
  const error=document.getElementById('withdrawalError');
  const success=document.getElementById('withdrawalSuccess');
  if(!form||!error||!success)return;
  error.textContent='';success.textContent='';
  const amount=String(document.getElementById('withdrawalAmount')?.value||'');
  const source=String(document.getElementById('withdrawalSource')?.value||'');
  const note=String(document.getElementById('withdrawalNote')?.value||'').trim();
  if(!Number.isFinite(Number(amount))||Number(amount)<=0){error.textContent='Enter a valid withdrawal amount.';return;}
  if(!source){error.textContent='Select a withdrawal source.';return;}
  if(!note){error.textContent='Enter Account Details.';return;}
  const previous=button.textContent;
  button.disabled=true;button.textContent='SUBMITTING...';
  success.textContent='Processing your withdrawal request...';
  try {
    if(typeof api!=='function')throw new Error('Withdrawal service is not loaded. Please reload the page.');
    const data=await api('/api/account/withdrawal-requests',{method:'POST',body:JSON.stringify({source,amount,note})});
    if(!data?.request?.reference)throw new Error('No confirmation received. Check with Admin before retrying.');
    success.textContent='Request submitted. Reference: '+data.request.reference+'.'+(data.request.fee_percent==null?'':' Estimated fee: '+data.request.fee_percent+'%.');
    document.getElementById('withdrawalAmount').value='';
    document.getElementById('withdrawalNote').value='';
  }catch(e){success.textContent='';error.textContent=e?.message||'Withdrawal request failed. Please contact Admin.';}
  finally{button.disabled=false;button.textContent=previous;}
},true);
</script>
`;
if(!html.includes('v220 - independent withdrawal click bridge'))html=html.replace('</body>',script+'</body>');
fs.writeFileSync(path,html);
console.log('Delegated capture-phase withdrawal action installed with immediate visible feedback.');
