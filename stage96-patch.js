const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace('<form class="dialog-card" id="loanApplyFormV94">','<div class="dialog-card" id="loanApplyFormV94">');
html=html.replace('<button class="primary" id="loanSubmitV94" type="submit">SUBMIT</button>','<button class="primary" id="loanSubmitV94" type="button" onclick="return window.submitFreshLoanV96()">SUBMIT</button>');
html=html.replace(
  '      <p class="form-success" id="loanSuccessV94" role="status"></p>\n    </form>\n  </dialog>\n\n  <dialog id="loansAdminDialog"',
  '      <p class="form-success" id="loanSuccessV94" role="status"></p>\n    </div>\n  </dialog>\n\n  <dialog id="loansAdminDialog"'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=96');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=96');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=96');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

// Remove the native-form submit listener completely.
const oldStart=app.indexOf("if(loanApplyFormV94) loanApplyFormV94.addEventListener('submit'");
const oldEnd=app.indexOf("\nasync function loadPendingLoans()",oldStart);
if(oldStart>=0 && oldEnd>oldStart){
  app=app.slice(0,oldStart)+app.slice(oldEnd);
}

// The dialog is no longer a form, so clear fields manually.
app=app.replace(
  "  loanApplyFormV94.reset();\n  loanErrorV94.textContent='';",
  "  loanAccountV94.value='';\n  loanAmountV94.value='';\n  loanGuarantorV94.value='';\n  loanErrorV94.textContent='';"
);

// Define one direct submission function before session helpers.
// This runs independently of any later event-binding code.
const directFn=`
window.submitFreshLoanV96=async function(){
  const submit=document.getElementById('loanSubmitV94');
  const accountEl=document.getElementById('loanAccountV94');
  const amountEl=document.getElementById('loanAmountV94');
  const guarantorEl=document.getElementById('loanGuarantorV94');
  const errorEl=document.getElementById('loanErrorV94');
  const successEl=document.getElementById('loanSuccessV94');

  if(!submit||!accountEl||!amountEl||!guarantorEl||!errorEl||!successEl) return false;

  errorEl.textContent='';
  successEl.textContent='SENDING...';
  submit.disabled=true;

  try{
    const loanProduct=String(accountEl.value||'').trim().toUpperCase();
    const amount=Number(amountEl.value);
    const b=state.balances||{};
    const total=Number.isFinite(Number(b.totalSavings))
      ? Number(b.totalSavings||0)
      : Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0)+Number(b.flexible||0);

    if(!loanProduct) throw new Error('Select an account.');
    if(!Number.isFinite(amount)||amount<=0) throw new Error('Enter a valid loan amount.');

    const needsGuarantor=amount>total;
    const guarantorUsername=String(guarantorEl.value||'').trim();
    if(needsGuarantor&&!guarantorUsername) throw new Error('Enter guarantor username.');

    const data=await api('/api/account/loan-applications',{
      method:'POST',
      cache:'no-store',
      body:JSON.stringify({loanProduct,amount,guarantorUsername})
    });

    const reference=data?.application?.reference;
    if(!reference) throw new Error('Server did not return a loan application reference.');

    successEl.textContent='SUBMITTED SUCCESSFULLY: '+reference+'. Waiting for Admin approval.';
    amountEl.value='';
    guarantorEl.value='';
    if(typeof updateLoanGuarantorV94==='function') updateLoanGuarantorV94();
  }catch(error){
    successEl.textContent='';
    errorEl.textContent='APPLICATION NOT SENT: '+(error?.message||String(error));
  }finally{
    submit.disabled=false;
  }
  return false;
};

`;

const marker="function saveSession() {";
if(!app.includes('window.submitFreshLoanV96')){
  if(!app.includes(marker)){console.error('Stage 96 saveSession marker missing');process.exit(1);}
  app=app.replace(marker,directFn+marker);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=96'");
fs.writeFileSync('www/app.js',app);

let account=fs.readFileSync('server/routes/account.js','utf8');
if(!account.includes("LOAN_V96_POST_RECEIVED")){
  account=account.replace(
    "router.post('/loan-applications', requireAuth, async (req, res) => {",
    "router.post('/loan-applications', requireAuth, async (req, res) => {\n  console.log('LOAN_V96_POST_RECEIVED', req.auth?.sub || 'unknown');"
  );
}
fs.writeFileSync('server/routes/account.js',account);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v96';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 96 removed native loan form submission completely.');