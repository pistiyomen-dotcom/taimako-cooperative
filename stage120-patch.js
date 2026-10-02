const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

/* Replace the member bank-transfer submit handler with a dedicated multipart request.
   This deliberately avoids the generic api() helper so FormData keeps its browser-generated boundary. */
const start=app.indexOf("paymentForm.addEventListener('submit', async (e) => {");
const end=app.indexOf("\nasync function loadPendingApprovals()",start);
if(start<0||end<0){console.error('Stage 120 payment submit handler marker missing');process.exit(1);}

const handler=`paymentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  paymentError.textContent='';
  paymentSuccess.textContent='';
  const submitButton=paymentForm.querySelector('button[type="submit"]');
  const originalText=submitButton?.textContent||'SUBMIT FOR APPROVAL';
  try {
    if(submitButton){submitButton.disabled=true;submitButton.textContent='SUBMITTING…';}
    const form = new FormData();
    form.append('destination', paymentDestination.value);
    form.append('amount', document.getElementById('paymentAmount').value);
    form.append('note', document.getElementById('paymentNote').value);
    const receipt = document.getElementById('paymentReceipt').files[0];
    if (!receipt) throw new Error('Upload the bank-transfer receipt.');
    form.append('receipt', receipt);

    const response=await fetch(\`\${API_BASE}/api/account/payment-requests\`,{
      method:'POST',
      headers:{Authorization:\`Bearer \${state.token}\`},
      body:form
    });
    let data={};
    try{data=await response.json();}catch(_){}
    if(!response.ok) throw new Error(data.error||\`Submission failed (\${response.status}).\`);
    if(!data.request?.reference) throw new Error('Payment request was not confirmed by the server.');

    paymentSuccess.textContent = \`SUBMITTED SUCCESSFULLY • PENDING ADMIN APPROVAL • Ref: \${data.request.reference}\`;
    document.getElementById('paymentAmount').value='';
    document.getElementById('paymentNote').value='';
    document.getElementById('paymentReceipt').value='';
  } catch(error) {
    paymentError.textContent=error.message||'Unable to submit payment.';
  } finally {
    if(submitButton){submitButton.disabled=false;submitButton.textContent=originalText;}
  }
});
`;

app=app.slice(0,start)+handler+app.slice(end);

/* Use the exact official transfer details supplied by the cooperative whenever Admin settings are blank. */
app=app.replace(
  "  const bankReady=Boolean(details.accountNumber&&details.bankName&&details.accountName);",
  "  details.accountNumber=details.accountNumber||'1027050172';\n  details.bankName=details.bankName||'FCMB';\n  details.accountName=details.accountName||'TAIMAKO MULTIPURPOSE COOPERATIVE SOCIETY LTD';\n  const bankReady=true;"
);

/* Strong cache refresh. */
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=120'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=120');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=120');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=120');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v120';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 120 dedicated bank-transfer multipart submit and official details applied.');
