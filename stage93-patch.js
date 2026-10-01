const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
const formStart=html.indexOf('  <dialog id="loanApplyDialog">');
const formEnd=html.indexOf('  <dialog id="loansAdminDialog"',formStart);
if(formStart<0||formEnd<0){console.error('Stage 93 loan form HTML markers missing');process.exit(1);}
html=html.slice(0,formStart)+html.slice(formEnd);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=93');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=93');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=93');
html=html.replace(/<script src="\.\/loan-submit-v91\.js\?v=91"><\/script>\s*/g,'');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

// Remove top-level DOM references for the old loan form.
app=app.replace("const loanApplyDialog = document.getElementById('loanApplyDialog');\n",'');
app=app.replace("const loanApplyForm = document.getElementById('loanApplyForm');\n",'');
app=app.replace("const loanApplyError = document.getElementById('loanApplyError');\n",'');
app=app.replace("const loanApplySuccess = document.getElementById('loanApplySuccess');\n",'');
app=app.replace("const loanCapacityInfo = document.getElementById('loanCapacityInfo');\n",'');

// Remove any direct global submit function added during troubleshooting.
const globalStart=app.indexOf('window.submitLoanApplicationNow = async function(event)');
if(globalStart>=0){
  const globalEnd=app.indexOf('\n};',globalStart);
  if(globalEnd<0){console.error('Stage 93 global loan function end marker missing');process.exit(1);}
  app=app.slice(0,globalStart)+app.slice(globalEnd+3);
}

// Remove old member apply dialog opener and submit handler as one block.
const oldStart=app.indexOf('async function openLoanApplyDialog()');
const oldEnd=app.indexOf('\nasync function loadPendingLoans()',oldStart);
if(oldStart>=0&&oldEnd>oldStart){
  app=app.slice(0,oldStart)+app.slice(oldEnd);
}

// Remove APPLY FOR LOAN from Regular member action buttons.
app=app.replace(
  "['PAY', 'TRANSACTION HISTORY', 'SAVINGS PLANS', 'LOAN STATUS', 'APPLY FOR LOAN', 'WITHDRAW']",
  "['PAY', 'TRANSACTION HISTORY', 'SAVINGS PLANS', 'LOAN STATUS', 'WITHDRAW']"
);
app=app.replace(
  "label === 'LOAN STATUS' ? openLoanStatusDialog() : openLoanApplyDialog()",
  "label === 'LOAN STATUS' ? openLoanStatusDialog() : openWithdrawalDialog()"
);

// Remove any leftover Stage90 button binding if still present.
const bindStart=app.indexOf("const loanSubmitBtn=document.getElementById('loanSubmitBtn');");
const bindEnd=app.indexOf('\nasync function loadPendingLoans()',bindStart);
if(bindStart>=0&&bindEnd>bindStart){
  app=app.slice(0,bindStart)+app.slice(bindEnd);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=93'");
fs.writeFileSync('www/app.js',app);

let styles=fs.readFileSync('www/styles.css','utf8');
styles=styles.replace(/#loanApplyForm \.form-error:not\(:empty\)\{[^}]*\}\s*/g,'');
styles=styles.replace(/#loanApplyForm \.form-success:not\(:empty\)\{[^}]*\}\s*/g,'');
styles=styles.replace(/#loanSubmitBtn:disabled\{[^}]*\}\s*/g,'');
fs.writeFileSync('www/styles.css',styles);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v93';");
fs.writeFileSync('www/sw.js',sw);

try{fs.unlinkSync('www/loan-submit-v91.js');}catch(_){}

console.log('TAIMAKO Stage 93 removed old member loan application form and handlers.');