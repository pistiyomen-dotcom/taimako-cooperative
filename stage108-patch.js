const fs=require('fs');

/* Backend member application: 90% entitlement is the self-backed limit */
let account=fs.readFileSync('server/routes/account.js','utf8');

account=account.replace(
  "    const savings=totalSavings(me);\n    const entitlement=Number((savings*0.90).toFixed(2));",
  "    const savings=Number((loanMoney(me.regular)+loanMoney(me.target)+loanMoney(me.constant)+loanMoney(me.welfare)).toFixed(2));\n    const entitlement=Number((savings*0.90).toFixed(2));"
);

account=account.replace(
  "    const guarantorRequired=Number(Math.max(0,amount-savings).toFixed(2));",
  "    const guarantorRequired=Number(Math.max(0,amount-entitlement).toFixed(2));"
);

account=account.replace(
  "if(!guarantorUsername){await client.query('ROLLBACK');return res.status(400).json({error:'Guarantor is required because the requested amount is greater than total savings.'});}",
  "if(!guarantorUsername){await client.query('ROLLBACK');return res.status(400).json({error:'Guarantor is required for any amount above your 90% loan entitlement.'});}"
);

account=account.replace(
  "const available=Number(Math.max(0,totalSavings(guarantor)-loanMoney(committed.rows[0].total)).toFixed(2));",
  "const guarantorSavings=Number((loanMoney(guarantor.regular)+loanMoney(guarantor.target)+loanMoney(guarantor.constant)+loanMoney(guarantor.welfare)).toFixed(2));\n      const available=Number(Math.max(0,guarantorSavings-loanMoney(committed.rows[0].total)).toFixed(2));"
);

fs.writeFileSync('server/routes/account.js',account);

/* Admin approval: enforce 90% self-backed entitlement */
let admin=fs.readFileSync('server/routes/admin.js','utf8');

admin=admin.replace(
  "const guarantorRequired = Number(Math.max(0, amount-savings).toFixed(2));",
  "const guarantorRequired = Number(Math.max(0, amount-selfLimit).toFixed(2));"
);

admin=admin.replace(
  "Approved amount is greater than total savings and requires ₦${guarantorRequired.toLocaleString('en-NG',{minimumFractionDigits:2})} guarantor coverage.",
  "Approved amount exceeds the member's 90% entitlement and requires ₦${guarantorRequired.toLocaleString('en-NG',{minimumFractionDigits:2})} guarantor coverage."
);

fs.writeFileSync('server/routes/admin.js',admin);

/* Frontend loan form: guarantor activates above 90% entitlement */
let app=fs.readFileSync('www/app.js','utf8');

app=app.replace(
  "const required=Number.isFinite(amount) && amount>total;",
  "const entitlement=Number((total*0.90).toFixed(2));\n  const required=Number.isFinite(amount) && amount>entitlement;"
);

app=app.replace(
  "? 'Guarantor is required because the requested amount is greater than your total savings.'\n      : 'Guarantor becomes active only when the requested loan is greater than your total savings.';",
  "? 'Guarantor is required because the requested amount is above your 90% loan entitlement.'\n      : 'Guarantor becomes active when the requested loan is above your 90% loan entitlement.';"
);

app=app.replace(
  "const needsGuarantor=amount>total;",
  "const entitlement=Number((total*0.90).toFixed(2));\n    const needsGuarantor=amount>entitlement;"
);

app=app.replace(
  "if(needsGuarantor&&!guarantorUsername) throw new Error('Enter guarantor username.');",
  "if(needsGuarantor&&!guarantorUsername) throw new Error('Enter guarantor username for the amount above your 90% entitlement.');"
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=108'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  'Guarantor becomes active only when the requested loan is greater than your total savings.',
  'Guarantor becomes active when the requested loan is above your 90% loan entitlement.'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=108');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=108');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=108');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v108';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 108 enforced 90 percent loan entitlement and guarantor coverage.');