const fs=require('fs');

let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('loan_product VARCHAR(20)')){
  schema=schema.replace(
    '  requested_amount NUMERIC(14,2) NOT NULL CHECK (requested_amount > 0),',
    "  requested_amount NUMERIC(14,2) NOT NULL CHECK (requested_amount > 0),\n  loan_product VARCHAR(20) NOT NULL DEFAULT 'REGULAR' CHECK (loan_product IN ('REGULAR','TARGET','CONSTANT')),\n  interest_rate NUMERIC(6,3) NOT NULL DEFAULT 5"
  );
}
if(!schema.includes('loan_product VARCHAR(20) NOT NULL DEFAULT \'REGULAR\' CHECK (loan_product IN (\'REGULAR\',\'TARGET\',\'CONSTANT\'))') || (schema.match(/loan_product VARCHAR\(20\)/g)||[]).length<2){
  schema=schema.replace(
    '  approved_principal NUMERIC(14,2) NOT NULL CHECK (approved_principal > 0),',
    "  approved_principal NUMERIC(14,2) NOT NULL CHECK (approved_principal > 0),\n  loan_product VARCHAR(20) NOT NULL DEFAULT 'REGULAR' CHECK (loan_product IN ('REGULAR','TARGET','CONSTANT')),\n  interest_rate NUMERIC(6,3) NOT NULL DEFAULT 5"
  );
}
fs.writeFileSync('server/db/schema.sql',schema);

let a=fs.readFileSync('server/routes/account.js','utf8');
if(!a.includes("const loanProduct = String(req.body?.loanProduct")){
  a=a.replace(
    "  const amount = Number(req.body?.amount);\n  const guarantorUsername = String(req.body?.guarantorUsername || '').trim().toUpperCase();",
    "  const amount = Number(req.body?.amount);\n  const loanProduct = String(req.body?.loanProduct || 'REGULAR').trim().toUpperCase();\n  const guarantorUsername = String(req.body?.guarantorUsername || '').trim().toUpperCase();\n  if (!['REGULAR','TARGET','CONSTANT'].includes(loanProduct)) return res.status(400).json({ error:'Select a valid loan product.' });"
  );
}
if(!a.includes('let interestRate = loanProduct === \'REGULAR\' ? 5 : 3;')){
  const marker='    const savings = totalSavings(me);';
  const block=`    let interestRate = loanProduct === 'REGULAR' ? 5 : 3;
    if (loanProduct === 'CONSTANT') {
      const plan=await client.query("SELECT duration_months,status FROM savings_plans WHERE account_id=$1 AND plan_type='CONSTANT'",[me.id]);
      if(!plan.rowCount || plan.rows[0].status!=='active'){ await client.query('ROLLBACK'); return res.status(400).json({error:'An active Constant Savings plan is required for a Constant loan.'}); }
    }
    if (loanProduct === 'TARGET') {
      const plan=await client.query("SELECT duration_months,status FROM savings_plans WHERE account_id=$1 AND plan_type='TARGET'",[me.id]);
      if(!plan.rowCount || plan.rows[0].status!=='active'){ await client.query('ROLLBACK'); return res.status(400).json({error:'An active Target Savings plan is required for a Target loan.'}); }
      if(Number(plan.rows[0].duration_months)>12){ await client.query('ROLLBACK'); return res.status(400).json({error:'Target loan at 3% is available only when the Target Savings duration is 12 months or less.'}); }
    }
`;
  if(!a.includes(marker)){console.error('Stage 47 account loan marker missing');process.exit(1);}
  a=a.replace(marker,block+marker);
}
if(!a.includes('loan_product, interest_rate')){
  a=a.replace(
    '`INSERT INTO loan_applications(reference, borrower_account_id, requested_amount, borrower_savings_at_application, self_backed_limit, guarantor_required_amount, guarantor_account_id, purpose)\n       VALUES($1,$2,$3,$4,$5,$6,$7,$8)\n       RETURNING reference, requested_amount, self_backed_limit, guarantor_required_amount, status, purpose, created_at`,\n      [reference, me.id, amount, savings, selfLimit, guarantorRequired, guarantorId, purpose || null]',
    '`INSERT INTO loan_applications(reference, borrower_account_id, requested_amount, borrower_savings_at_application, self_backed_limit, guarantor_required_amount, guarantor_account_id, purpose, loan_product, interest_rate)\n       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)\n       RETURNING reference, requested_amount, self_backed_limit, guarantor_required_amount, loan_product, interest_rate, status, purpose, created_at`,\n      [reference, me.id, amount, savings, selfLimit, guarantorRequired, guarantorId, purpose || null, loanProduct, interestRate]'
  );
}
fs.writeFileSync('server/routes/account.js',a);

let ad=fs.readFileSync('server/routes/admin.js','utf8');
if(!ad.includes('const interestRate = Number(app.interest_rate ||')){
  ad=ad.replace(
    '    const interest = Number((amount*0.05).toFixed(2));',
    "    const interestRate = Number(app.interest_rate || (app.loan_product === 'REGULAR' ? 5 : 3));\n    const interest = Number((amount*(interestRate/100)).toFixed(2));"
  );
}
if(!ad.includes('approved_principal,loan_product,interest_rate,base_interest')){
  ad=ad.replace(
    '`INSERT INTO loans(reference,application_id,borrower_account_id,guarantor_account_id,guarantor_required_amount,approved_principal,base_interest,due_date,last_accrual_date)\n       VALUES($1,$2,$3,$4,$5,$6,$7,CURRENT_DATE+30,CURRENT_DATE+30)\n       RETURNING reference,approved_principal,base_interest,due_date`,\n      [loanReference, app.id, app.borrower_account_id, guarantorId, guarantorRequired, amount, interest]',
    '`INSERT INTO loans(reference,application_id,borrower_account_id,guarantor_account_id,guarantor_required_amount,approved_principal,loan_product,interest_rate,base_interest,due_date,last_accrual_date)\n       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE+30,CURRENT_DATE+30)\n       RETURNING reference,approved_principal,loan_product,interest_rate,base_interest,due_date`,\n      [loanReference, app.id, app.borrower_account_id, guarantorId, guarantorRequired, amount, app.loan_product || \'REGULAR\', interestRate, interest]'
  );
}
ad=ad.replace(
  '[loanReference,app.borrower_account_id,req.auth.sub,amount,`Member loan approved. Initial 5% interest: ₦${interest.toFixed(2)}. Due in 30 days.`]',
  '[loanReference,app.borrower_account_id,req.auth.sub,amount,`Member ${app.loan_product || \'REGULAR\'} loan approved. Initial ${interestRate}% interest: ₦${interest.toFixed(2)}. Due in 30 days.`]'
);
fs.writeFileSync('server/routes/admin.js',ad);

let h=fs.readFileSync('www/index.html','utf8');
if(!h.includes('id="loanProduct"')){
  h=h.replace(
    '<div id="loanCapacityInfo" class="member-confirm show"></div>',
    '<div id="loanCapacityInfo" class="member-confirm show"></div><label>Loan Type<select id="loanProduct" required><option value="REGULAR">REGULAR - 5%</option><option value="CONSTANT">CONSTANT - 3%</option><option value="TARGET">TARGET - 3% (12 months or less)</option></select></label>'
  );
}
h=h.replace('Initial interest is 5% for 30 days.','Regular loan interest is 5% for 30 days. Constant loan interest is 3% for 30 days. Target loan interest is 3% for 30 days when the Target duration is 12 months or less.');
h=h.replace('Approved loans receive a 30-day due date and 5% initial interest.','Approved loans receive a 30-day due date. Interest follows the selected savings product.');
fs.writeFileSync('www/index.html',h);

let s=fs.readFileSync('www/app.js','utf8');
if(!s.includes("loanProduct:document.getElementById('loanProduct').value")){
  s=s.replace(
    "      amount:document.getElementById('loanAmount').value,\n      guarantorUsername:document.getElementById('loanGuarantor').value,",
    "      amount:document.getElementById('loanAmount').value,\n      loanProduct:document.getElementById('loanProduct').value,\n      guarantorUsername:document.getElementById('loanGuarantor').value,"
  );
}
if(!s.includes('Loan type: ${escapeHTML(a.loan_product ||')){
  s=s.replace(
    'loanApplySuccess.textContent=`Application ${a.reference} submitted. Requested ${naira(a.requested_amount)}. Guarantor coverage required: ${naira(a.guarantor_required_amount)}.`;',
    'loanApplySuccess.textContent=`Application ${a.reference} submitted. Loan type: ${a.loan_product || \'REGULAR\'} at ${Number(a.interest_rate || 5)}%. Requested ${naira(a.requested_amount)}. Guarantor coverage required: ${naira(a.guarantor_required_amount)}.`;'
  );
}
fs.writeFileSync('www/app.js',s);

console.log('TAIMAKO Stage 47 product-specific member loan rates applied.');