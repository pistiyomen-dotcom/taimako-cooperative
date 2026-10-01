const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  '<input id="loanAmountV94" type="number" min="0.01" step="0.01" required />',
  '<input id="loanAmountV94" type="number" min="0.01" step="0.01" required oninput="window.updateLoanGuarantorAccessV109&&window.updateLoanGuarantorAccessV109()" onchange="window.updateLoanGuarantorAccessV109&&window.updateLoanGuarantorAccessV109()" />'
);
html=html.replace(
  '<input id="loanGuarantorV94" placeholder="5-digit Regular username" disabled />',
  '<input id="loanGuarantorV94" placeholder="5-digit Regular username" inputmode="numeric" readonly />'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=109');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=109');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=109');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

const directFn=`
window.updateLoanGuarantorAccessV109=function(){
  const amountEl=document.getElementById('loanAmountV94');
  const guarantorEl=document.getElementById('loanGuarantorV94');
  const helpEl=document.getElementById('loanGuarantorHelpV94');
  if(!amountEl||!guarantorEl) return;

  const b=state.balances||{};
  const total=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0);
  const entitlement=Number((total*0.90).toFixed(2));
  const amount=Number(amountEl.value||0);
  const required=Number.isFinite(amount)&&amount>entitlement;

  guarantorEl.disabled=false;
  guarantorEl.readOnly=!required;
  guarantorEl.required=required;
  guarantorEl.setAttribute('aria-readonly',String(!required));
  guarantorEl.style.opacity=required?'1':'0.55';

  if(required){
    guarantorEl.placeholder='Enter 5-digit Regular username';
  }else{
    guarantorEl.value='';
    guarantorEl.placeholder='Available above 90% entitlement';
  }

  if(helpEl){
    helpEl.textContent=required
      ? 'Guarantor required: requested amount is above your 90% loan entitlement.'
      : 'Guarantor becomes editable when the requested amount is above your 90% loan entitlement.';
  }
};
`;

if(!app.includes('window.updateLoanGuarantorAccessV109')){
  const marker='function freshLoanTotalSavingsV94(){';
  if(!app.includes(marker)){console.error('Stage 109 loan helper marker missing');process.exit(1);}
  app=app.replace(marker,directFn+'\n'+marker);
}

// Keep old helper synchronized with the direct mobile-safe control.
const fnStart=app.indexOf('function updateLoanGuarantorV94(){');
const fnEnd=app.indexOf('\nfunction openLoanApplyV94(){',fnStart);
if(fnStart>=0&&fnEnd>fnStart){
  const replacement=`function updateLoanGuarantorV94(){
  if(typeof window.updateLoanGuarantorAccessV109==='function') window.updateLoanGuarantorAccessV109();
}
`;
  app=app.slice(0,fnStart)+replacement+app.slice(fnEnd);
}

app=app.replace(
  "  updateLoanGuarantorV94();\n  openDialog(loanApplyDialogV94);",
  "  updateLoanGuarantorV94();\n  openDialog(loanApplyDialogV94);\n  setTimeout(()=>window.updateLoanGuarantorAccessV109&&window.updateLoanGuarantorAccessV109(),50);"
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=109'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v109';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 109 mobile-safe guarantor field access applied.');