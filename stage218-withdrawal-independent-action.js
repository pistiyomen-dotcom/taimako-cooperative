const fs=require('fs');
const htmlFile='www/index.html',jsFile='www/app.js';
let html=fs.readFileSync(htmlFile,'utf8');
let js=fs.readFileSync(jsFile,'utf8');
const old='<button class="primary" type="submit">SUBMIT WITHDRAWAL REQUEST</button>';
if(!html.includes(old)) throw Error('Withdrawal submit HTML button missing');
html=html.replace(old,'<button class="primary" type="button" id="tmcsWithdrawalSubmitV218">SUBMIT WITHDRAWAL REQUEST</button>');
const start="withdrawalForm.addEventListener('submit', async (e) => {";
const end="\nasync function loadPendingWithdrawals()";
const i=js.indexOf(start),j=js.indexOf(end,i);
if(i<0||j<0)throw Error('Withdrawal submit handler section missing');
const block=`/* Independent withdrawal action: never navigate or submit the HTML form. */
withdrawalForm.addEventListener('submit',event=>event.preventDefault(),true);
document.getElementById('tmcsWithdrawalSubmitV218')?.addEventListener('click', async (e)=>{
  e.preventDefault();
  e.stopPropagation();
  const button=e.currentTarget;
  if(button.disabled)return;
  const error=document.getElementById('withdrawalError');
  const success=document.getElementById('withdrawalSuccess');
  error.textContent='';
  success.textContent='';
  const amountText=String(document.getElementById('withdrawalAmount').value||'');
  const note=String(document.getElementById('withdrawalNote').value||'').trim();
  const source=String(withdrawalSource.value||'');
  if(!Number.isFinite(Number(amountText))||Number(amountText)<=0){error.textContent='Enter a valid withdrawal amount.';return;}
  if(!source){error.textContent='Select a withdrawal account.';return;}
  if(!note){error.textContent='Enter Account Details.';return;}
  button.disabled=true;
  const label=button.textContent;
  button.textContent='SUBMITTING…';
  try{
    const data=await api('/api/account/withdrawal-requests',{
      method:'POST',body:JSON.stringify({source,amount:amountText,note})
    });
    if(!data?.request?.reference)throw new Error('Request confirmation was not received. Please check with Admin before trying again.');
    let message='Request submitted. Reference: '+data.request.reference+'.';
    if(data.request.fee_percent!=null){
      message+=' Current estimate: '+data.request.fee_percent+'% charge, payout '+naira(data.request.payout_amount)+'.';
    }
    success.textContent=message;
    document.getElementById('withdrawalAmount').value='';
    document.getElementById('withdrawalNote').value='';
  }catch(err){
    error.textContent=err?.message||'Withdrawal request failed. Please contact Admin.';
  }finally{
    button.disabled=false;button.textContent=label;
  }
});
`;
js=js.slice(0,i)+block+js.slice(j);
if(!js.includes("tmcsWithdrawalSubmitV218"))throw Error('Replacement action missing');
fs.writeFileSync(htmlFile,html);
fs.writeFileSync(jsFile,js);
console.log('Independent withdrawal click action implemented; native form submit eliminated.');
