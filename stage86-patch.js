const fs=require('fs');

let account=fs.readFileSync('server/routes/account.js','utf8');
account=account.replace(
`INSERT INTO loan_applications(reference, borrower_account_id, requested_amount, borrower_savings_at_application, self_backed_limit, guarantor_required_amount, guarantor_account_id, purpose, loan_product, interest_rate)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
`INSERT INTO loan_applications(reference, borrower_account_id, requested_amount, borrower_savings_at_application, self_backed_limit, guarantor_required_amount, guarantor_account_id, purpose, loan_product, interest_rate, status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')`
);
fs.writeFileSync('server/routes/account.js',account);

let admin=fs.readFileSync('server/routes/admin.js','utf8');
admin=admin.replace(
"  const result = await pool.query(\n    `SELECT la.id,la.reference,la.requested_amount,la.borrower_savings_at_application,la.self_backed_limit,",
"  res.set('Cache-Control','no-store, no-cache, must-revalidate');\n  const result = await pool.query(\n    `SELECT la.id,la.reference,la.requested_amount,la.borrower_savings_at_application,la.self_backed_limit,"
);
admin=admin.replace(
"     WHERE la.status=$1 ORDER BY la.created_at ASC LIMIT 200`, [status]",
"     WHERE LOWER(TRIM(la.status))=$1 ORDER BY la.created_at ASC LIMIT 200`, [status]"
);
fs.writeFileSync('server/routes/admin.js',admin);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(
"    const data=await api('/api/account/loan-applications',{method:'POST',body:JSON.stringify({",
"    const data=await api('/api/account/loan-applications',{method:'POST',cache:'no-store',body:JSON.stringify({"
);
app=app.replace(
"    const a=data.application;\n    loanApplySuccess.textContent=`Application ${a.reference} submitted.",
"    const a=data.application;\n    const verify=await api('/api/account/loan-applications?verify='+encodeURIComponent(a.reference),{cache:'no-store'});\n    if(!(verify.applications||[]).some(x=>x.reference===a.reference && String(x.status).toLowerCase()==='pending')) throw new Error('Loan application was not confirmed as pending. Please submit again.');\n    loanApplySuccess.textContent=`Application ${a.reference} submitted."
);
app=app.replace(
"    const data=await api('/api/admin/loan-applications?status=pending');",
"    const data=await api('/api/admin/loan-applications?status=pending&_='+Date.now(),{cache:'no-store'});"
);
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=86'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=86');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=86');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=86');
html=html.replace('Regular loan interest is 5% for 30 days. Constant loan interest is 3% for 30 days. Target loan interest is 3% for 30 days when the Target duration is 12 months or less.','Loan interest is 5% of the approved loan for the first 30 days.');
html=html.replace('Approved loans receive a 30-day due date. Interest follows the selected savings product.','Approved loans receive a 30-day due date and 5% initial interest.');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v86';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 86 loan submission verification and fresh Admin LOANS applied.');