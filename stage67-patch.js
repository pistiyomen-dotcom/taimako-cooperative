const fs=require('fs');

// Stage 67: wire Cash Credit directly into the Admin dashboard's native action handler.

let app=fs.readFileSync('www/app.js','utf8');

// Insert direct action immediately after CREATE ACCOUNT action.
if(!app.includes("if (title === 'CASH CREDIT') { window.openCashCreditV67?.(); }")){
  const marker="  if (title === 'CREATE ACCOUNT') { createAccountForm.reset(); createAccountError.textContent=''; createAccountSuccess.textContent=''; newRole.value='regular'; updateAccountHints(); openDialog(createAccountDialog); }";
  if(app.includes(marker)){
    app=app.replace(marker, marker+"\n  if (title === 'CASH CREDIT') { window.openCashCreditV67?.(); }");
  }else{
    // Fallback for builds where CREATE ACCOUNT still uses the older action text.
    const fallback="  if (title === 'CREATE ACCOUNT') {";
    const pos=app.indexOf(fallback);
    if(pos<0){ console.error('Stage 67 Admin action handler marker missing'); process.exit(1); }
    const lineEnd=app.indexOf('\n',pos);
    app=app.slice(0,lineEnd+1)+"  if (title === 'CASH CREDIT') { window.openCashCreditV67?.(); }\n"+app.slice(lineEnd+1);
  }
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=67'");
fs.writeFileSync('www/app.js',app);

let cash=fs.readFileSync('www/cash-credit-v66.js','utf8');

// Expose the form opener to the native Admin action handler.
if(!cash.includes('window.openCashCreditV67=openCashCredit;')){
  cash=cash.replace(
    "  function openCashCredit(){",
    "  function openCashCredit(){"
  );
  cash=cash.replace(
    "  async function confirmMember(){",
    "  window.openCashCreditV67=openCashCredit;\n\n  async function confirmMember(){"
  );
}

// Remove the broad capture listener to avoid conflict with the Admin dashboard's own click handler.
cash=cash.replace(/\n\s*document\.addEventListener\('click',\(event\)=>\{[\s\S]*?\},true\);/m,'');

fs.writeFileSync('www/cash-credit-v66.js',cash);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=67');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=67');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=67');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v67';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 67 direct Admin Cash Credit action applied.');