const fs=require('fs');
let app=fs.readFileSync('www/app.js','utf8');

app=app.replace(
  "const accumulatedLoanSavings=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0);\n  const activeLoanText=Number(b.loanPrincipal||0)>0",
  "const accumulatedLoanSavings=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0);\n  const minimumSharePerMonth=Number(b.minimumSharePerMonth||5000);\n  const currentMonthSavings=Number(b.totalSavings||0);\n  const calculatedShares=minimumSharePerMonth>0?Math.floor(currentMonthSavings/minimumSharePerMonth):0;\n  const totalRegistrationFee=Number(b.totalRegistrationFee||0);\n  const registrationDone=totalRegistrationFee>0&&Number(b.registration||0)>=totalRegistrationFee;\n  const activeLoanText=Number(b.loanPrincipal||0)>0"
);

app=app.replace("['REGISTRATION', b.registrationComplete ? '✓' : naira(b.registration)]","['REGISTRATION', registrationDone ? '✓' : naira(b.registration)]");
app=app.replace("['TOTAL SAVINGS', naira(accumulatedLoanSavings)], ['NUMBER OF SHARES', String(b.numberOfShares ?? 0)]","['TOTAL SAVINGS', naira(accumulatedLoanSavings)], ['NUMBER OF SHARES', String(calculatedShares)]");

app=app.replace(
  "const total=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0);\n  const active=Number(b.loanPrincipal||0)>0",
  "const total=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0);\n  const minimumSharePerMonth=Number(b.minimumSharePerMonth||5000);\n  const currentMonthSavings=Number(b.totalSavings||0);\n  const shares=minimumSharePerMonth>0?Math.floor(currentMonthSavings/minimumSharePerMonth):0;\n  const totalRegistrationFee=Number(b.totalRegistrationFee||0);\n  const registrationDone=totalRegistrationFee>0&&Number(b.registration||0)>=totalRegistrationFee;\n  const registrationText=registrationDone?'✓':naira(b.registration);\n  const active=Number(b.loanPrincipal||0)>0"
);

app=app.replace(
  "if(title==='TOTAL SAVINGS'){\n      const wanted=naira(total);\n      if(p.textContent!==wanted) p.textContent=wanted;\n    }\n    if(title==='ACTIVE LOAN'){",
  "if(title==='REGISTRATION'){\n      if(p.textContent!==registrationText) p.textContent=registrationText;\n      if(registrationDone){p.style.color='#07883f';p.style.fontSize='34px';p.style.fontWeight='900';}\n      else{p.style.color='';p.style.fontSize='';p.style.fontWeight='';}\n    }\n    if(title==='TOTAL SAVINGS'){\n      const wanted=naira(total);\n      if(p.textContent!==wanted) p.textContent=wanted;\n    }\n    if(title==='NUMBER OF SHARES'){\n      const wanted=String(shares);\n      if(p.textContent!==wanted) p.textContent=wanted;\n    }\n    if(title==='ACTIVE LOAN'){"
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=104'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=104').replace(/styles\.css\?v=\d+/g,'styles.css?v=104').replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=104');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v104';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 104 registration/share stability applied.');