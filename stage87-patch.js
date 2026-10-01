const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  '<button class="primary" type="submit">SUBMIT LOAN APPLICATION</button>',
  '<button class="primary" id="loanSubmitBtn" type="submit">SUBMIT LOAN APPLICATION</button>'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=87');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=87');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=87');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

app=app.replace(
`function openLoanApplyDialog() {
  loanApplyForm.reset(); loanApplyError.textContent=''; loanApplySuccess.textContent='';
  const savings=Number(state.balances?.totalSavings||0); const limit=savings*0.90;
  loanCapacityInfo.innerHTML=\`<strong>Total savings: \${naira(savings)}</strong><br>90% self-backed loan capacity: \${naira(limit)}. Any requested amount above this needs guarantor coverage for the difference.\`;
  openDialog(loanApplyDialog);
}`,
`async function openLoanApplyDialog() {
  loanApplyForm.reset(); loanApplyError.textContent=''; loanApplySuccess.textContent='';
  const submitBtn=document.getElementById('loanSubmitBtn');
  if(submitBtn) submitBtn.disabled=false;
  const savings=Number(state.balances?.totalSavings||0); const limit=savings*0.90;
  loanCapacityInfo.innerHTML=\`<strong>Total savings: \${naira(savings)}</strong><br>90% self-backed loan capacity: \${naira(limit)}. Any requested amount above this needs guarantor coverage for the difference.\`;
  openDialog(loanApplyDialog);

  try {
    const current=await api('/api/account/loans',{cache:'no-store'});
    const principal=Number(current.current?.principal||0);
    const interest=Number(current.current?.interest||0);
    const pending=(current.applications||[]).find(a=>String(a.status).toLowerCase()==='pending');

    if(principal>0 || interest>0){
      loanApplyError.textContent='APPLICATION NOT SENT: You already have an active loan balance. Clear the active loan before applying for another loan.';
      if(submitBtn) submitBtn.disabled=true;
      return;
    }
    if(pending){
      loanApplyError.textContent=\`APPLICATION ALREADY PENDING: \${pending.reference}. Admin can review it under LOANS.\`;
      if(submitBtn) submitBtn.disabled=true;
    }
  } catch(error) {
    loanApplyError.textContent='Could not check current loan status: '+error.message;
  }
}`
);

app=app.replace(
`  } catch(error) { loanApplyError.textContent=error.message; }
});`,
`  } catch(error) {
    loanApplyError.textContent='APPLICATION NOT SENT: '+error.message;
    loanApplyError.scrollIntoView({behavior:'smooth',block:'center'});
  }
});`
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=87'");
fs.writeFileSync('www/app.js',app);

let css=fs.readFileSync('www/styles.css','utf8');
css += "\n#loanApplyForm .form-error:not(:empty){background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:12px;font-size:14px;line-height:1.4;}\n#loanApplyForm .form-success:not(:empty){background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:12px;font-size:14px;line-height:1.4;}\n#loanSubmitBtn:disabled{opacity:.55;cursor:not-allowed;}\n";
fs.writeFileSync('www/styles.css',css);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v87';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 87 clear loan application blocking feedback applied.');