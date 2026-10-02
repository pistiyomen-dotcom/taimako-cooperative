const fs=require('fs');

/* 1) Force every submitted bank transfer into pending status explicitly. */
let account=fs.readFileSync('server/routes/account.js','utf8');
account=account.replace(
  `INSERT INTO payment_requests(reference, account_id, destination, amount, receipt_path, receipt_data, receipt_original_name, receipt_mime_type, note)
     VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8)`,
  `INSERT INTO payment_requests(reference, account_id, destination, amount, receipt_path, receipt_data, receipt_original_name, receipt_mime_type, note, status)
     VALUES($1,$2,$3,$4,NULL,$5,$6,$7,$8,'pending')`
);
fs.writeFileSync('server/routes/account.js',account);

/* 2) Make official bank block visible even before Admin settings are populated. */
let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(
  "  if(!details.accountNumber||!details.bankName||!details.accountName) return;\n\n  const panel=document.createElement('div');",
  "  const bankReady=Boolean(details.accountNumber&&details.bankName&&details.accountName);\n\n  const panel=document.createElement('div');"
);
app=app.replace(
  "  panel.querySelector('.bank-number').textContent=details.accountNumber;\n  panel.querySelector('.bank-name').textContent=details.bankName;\n  panel.querySelector('.bank-account-name').textContent=details.accountName;",
  "  panel.querySelector('.bank-number').textContent=bankReady?details.accountNumber:'OFFICIAL BANK DETAILS';\n  panel.querySelector('.bank-name').textContent=bankReady?details.bankName:'NOT YET CONFIGURED';\n  panel.querySelector('.bank-account-name').textContent=bankReady?details.accountName:'Admin: open SETTINGS and save Official Transfer Details.';\n  const copyBtn=panel.querySelector('.bank-copy');\n  if(!bankReady){copyBtn.disabled=true;copyBtn.textContent='COPY';copyBtn.title='Configure official transfer details in Admin SETTINGS first.';}"
);
app=app.replace(
  "  panel.querySelector('.bank-copy').addEventListener('click',async function(){",
  "  panel.querySelector('.bank-copy').addEventListener('click',async function(){\n    if(!bankReady) return;"
);

/* 3) Refresh pending approvals whenever Admin opens the approvals dialog. */
if(!app.includes('refreshPendingApprovalsV119')){
  app += `
function refreshPendingApprovalsV119(){
  const dialog=document.getElementById('approvalsDialog');
  if(!dialog) return;
  if(dialog.open) loadPendingApprovals();
}
document.addEventListener('click',(event)=>{
  const text=String(event.target?.textContent||'').trim().toUpperCase();
  if(text.includes('PENDING') && (text.includes('APPROVAL')||text.includes('PAYMENT'))){
    setTimeout(refreshPendingApprovalsV119,50);
  }
});
document.getElementById('approvalsDialog')?.addEventListener('toggle',refreshPendingApprovalsV119);
`;
}

/* 4) Strong cache refresh. */
let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=119');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=119');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=119');
fs.writeFileSync('www/index.html',html);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=119'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v119';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 119 bank transfer pending and visible bank panel fix applied.');
