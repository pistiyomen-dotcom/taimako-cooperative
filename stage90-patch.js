const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  '<button class="primary" id="loanSubmitBtn" type="submit">SUBMIT LOAN APPLICATION</button>',
  '<button class="primary" id="loanSubmitBtn" type="button">SUBMIT LOAN APPLICATION</button>'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=90');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=90');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=90');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

const start=app.indexOf("loanApplyForm.addEventListener('submit'");
const end=app.indexOf("\nasync function loadPendingLoans()",start);
if(start<0||end<0){ console.error('Stage 90 loan submit handler marker missing'); process.exit(1); }

const replacement=`const loanSubmitBtn=document.getElementById('loanSubmitBtn');
loanSubmitBtn.addEventListener('click', async () => {
  loanApplyError.textContent='';
  loanApplySuccess.textContent='SENDING LOAN APPLICATION…';
  loanSubmitBtn.disabled=true;
  try {
    const amount=Number(document.getElementById('loanAmount').value);
    if(!Number.isFinite(amount)||amount<=0) throw new Error('Enter a valid loan amount.');

    const payload={
      amount,
      loanProduct:document.getElementById('loanProduct').value,
      guarantorUsername:document.getElementById('loanGuarantor').value,
      purpose:document.getElementById('loanPurpose').value
    };

    const data=await api('/api/account/loan-applications',{
      method:'POST',
      cache:'no-store',
      body:JSON.stringify(payload)
    });

    const a=data.application;
    loanApplySuccess.textContent=\`SENT SUCCESSFULLY: \${a.reference}. Loan type: \${a.loan_product || payload.loanProduct}. Requested \${naira(a.requested_amount)}.\`;
    document.getElementById('loanAmount').value='';
    document.getElementById('loanPurpose').value='';
    document.getElementById('loanGuarantor').value='';
  } catch(error) {
    loanApplySuccess.textContent='';
    loanApplyError.textContent='APPLICATION NOT SENT: '+error.message;
    loanApplyError.scrollIntoView({behavior:'smooth',block:'center'});
  } finally {
    loanSubmitBtn.disabled=false;
  }
});
`;

app=app.slice(0,start)+replacement+app.slice(end);
app=app.replace(/if\(submitBtn\) submitBtn\.disabled=true;/g,'');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=90'");
fs.writeFileSync('www/app.js',app);

let account=fs.readFileSync('server/routes/account.js','utf8');
account=account.replace(
  "router.post('/loan-applications', requireAuth, async (req, res) => {",
  "router.post('/loan-applications', requireAuth, async (req, res) => {\n  console.log('LOAN_APPLICATION_POST_RECEIVED', req.auth?.sub || 'unknown');"
);
fs.writeFileSync('server/routes/account.js',account);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v90';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 90 direct loan submit button applied.');