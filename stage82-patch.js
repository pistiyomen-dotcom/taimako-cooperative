const fs=require('fs');

let svc=fs.readFileSync('server/services-loans.js','utf8');

if(!svc.includes('async function syncActiveLoanForAccount')){
  const marker="async function accrueOverdueForAccount(accountId, client = pool) {";
  const block=[
    "async function syncActiveLoanForAccount(accountId, client = pool) {",
    "  const found = await client.query(",
    "    `SELECT id, approved_principal, approved_at, due_date, overdue_interest_accrued",
    "       FROM loans",
    "       WHERE borrower_account_id=$1 AND status='active'",
    "       ORDER BY approved_at DESC LIMIT 1`,",
    "    [accountId]",
    "  );",
    "  const loan = found.rows[0];",
    "  if (!loan) return null;",
    "",
    "  const principal = money(loan.approved_principal);",
    "  const baseInterest = Number((principal * 0.05).toFixed(2));",
    "",
    "  const payments = await client.query(",
    "    `SELECT COALESCE(SUM(amount),0) AS total",
    "       FROM transactions",
    "       WHERE account_id=$1",
    "         AND destination='INTEREST'",
    "         AND status IN ('approved','completed')",
    "         AND transaction_type IN ('cash_credit','bank_transfer')",
    "         AND COALESCE(approved_at,created_at) >= $2`,",
    "    [accountId, loan.approved_at]",
    "  );",
    "",
    "  const interestPaid = money(payments.rows[0]?.total);",
    "  const overdue = money(loan.overdue_interest_accrued);",
    "  const expectedInterest = Number(Math.max(0, baseInterest + overdue - interestPaid).toFixed(2));",
    "",
    "  await client.query(",
    "    `UPDATE loans",
    "       SET interest_rate=5,",
    "           base_interest=$1,",
    "           due_date=(approved_at::date + 30),",
    "           updated_at=NOW()",
    "       WHERE id=$2`,",
    "    [baseInterest, loan.id]",
    "  );",
    "",
    "  await client.query(",
    "    `UPDATE member_balances",
    "       SET loan_interest=$1,",
    "           loan_due_date=(SELECT approved_at::date + 30 FROM loans WHERE id=$2),",
    "           updated_at=NOW()",
    "       WHERE account_id=$3`,",
    "    [expectedInterest, loan.id, accountId]",
    "  );",
    "",
    "  return { ...loan, baseInterest, expectedInterest };",
    "}",
    "",
    "async function accrueOverdueForAccount(accountId, client = pool) {",
    "  await syncActiveLoanForAccount(accountId, client);"
  ].join('\n');
  if(!svc.includes(marker)){ console.error('Stage 82 accrue marker missing'); process.exit(1); }
  svc=svc.replace(marker,block);
  svc=svc.replace(
    "module.exports = { money, totalSavings, accrueOverdueForAccount, closeLoanIfSettled, ref };",
    "module.exports = { money, totalSavings, syncActiveLoanForAccount, accrueOverdueForAccount, closeLoanIfSettled, ref };"
  );
}

fs.writeFileSync('server/services-loans.js',svc);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=82');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=82');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=82');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=82'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v82';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 82 active loan dashboard reconciliation applied.');