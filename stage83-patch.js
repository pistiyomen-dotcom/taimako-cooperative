const fs=require('fs');

let svc=fs.readFileSync('server/services-loans.js','utf8');

const oldBlock = `  const loan = found.rows[0];
  if (!loan) return null;

  const principal = money(loan.approved_principal);`;

const newBlock = `  let loan = found.rows[0];

  if (!loan) {
    const balanceResult = await client.query(
      'SELECT loan_principal, loan_interest FROM member_balances WHERE account_id=$1',
      [accountId]
    );
    const balance = balanceResult.rows[0];
    if (!balance || money(balance.loan_principal) <= 0) return null;

    const legacy = await client.query(
      \`SELECT la.id AS application_id,
              la.reference AS application_reference,
              la.requested_amount AS approved_principal,
              la.reviewed_at AS approval_date,
              t.reference AS transaction_reference,
              t.amount AS transaction_amount,
              COALESCE(t.approved_at,t.created_at) AS transaction_date
         FROM loan_applications la
         LEFT JOIN LATERAL (
           SELECT reference,amount,approved_at,created_at
           FROM transactions
           WHERE account_id=$1
             AND transaction_type='loan_disbursement'
             AND destination='LOAN'
             AND status IN ('approved','completed')
           ORDER BY COALESCE(approved_at,created_at) DESC
           LIMIT 1
         ) t ON TRUE
         WHERE la.borrower_account_id=$1
           AND la.status='approved'
         ORDER BY la.reviewed_at DESC NULLS LAST
         LIMIT 1\`,
      [accountId]
    );

    let source = legacy.rows[0];
    if (!source) {
      const txOnly = await client.query(
        \`SELECT reference AS transaction_reference,
                amount AS transaction_amount,
                COALESCE(approved_at,created_at) AS transaction_date
           FROM transactions
           WHERE account_id=$1
             AND transaction_type='loan_disbursement'
             AND destination='LOAN'
             AND status IN ('approved','completed')
           ORDER BY COALESCE(approved_at,created_at) DESC
           LIMIT 1\`,
        [accountId]
      );
      source = txOnly.rows[0];
    }

    const approvalDate = source?.approval_date || source?.transaction_date;
    const originalPrincipal = money(source?.transaction_amount || source?.approved_principal || balance.loan_principal);
    if (!approvalDate || originalPrincipal <= 0) return null;

    const due = new Date(approvalDate);
    due.setUTCDate(due.getUTCDate()+30);

    const today = new Date();
    today.setUTCHours(0,0,0,0);
    const dueDay = new Date(due);
    dueDay.setUTCHours(0,0,0,0);
    const overdueDays = Math.max(0, Math.floor((today-dueDay)/86400000));
    const baseInterest = Number((originalPrincipal*0.05).toFixed(2));
    const daily = Number((originalPrincipal*0.05/30).toFixed(2));
    const overdue = Number((daily*overdueDays).toFixed(2));

    const paidResult = await client.query(
      \`SELECT COALESCE(SUM(amount),0) AS total
         FROM transactions
         WHERE account_id=$1
           AND destination='INTEREST'
           AND status IN ('approved','completed')
           AND COALESCE(approved_at,created_at) >= $2\`,
      [accountId, approvalDate]
    );
    const interestPaid = money(paidResult.rows[0]?.total);
    const expectedInterest = Number(Math.max(0,baseInterest+overdue-interestPaid).toFixed(2));

    await client.query(
      'UPDATE member_balances SET loan_interest=$1, loan_due_date=$2::date, updated_at=NOW() WHERE account_id=$3',
      [expectedInterest,due.toISOString().slice(0,10),accountId]
    );

    return {
      approved_principal: originalPrincipal,
      due_date: due.toISOString().slice(0,10),
      loan_principal: money(balance.loan_principal),
      loan_interest: expectedInterest,
      legacy_reconciled: true
    };
  }

  const principal = money(loan.approved_principal);`;

if(!svc.includes(oldBlock)){
  console.error('Stage 83 legacy loan reconciliation marker missing');
  process.exit(1);
}
svc=svc.replace(oldBlock,newBlock);

fs.writeFileSync('server/services-loans.js',svc);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=83');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=83');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=83');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=83'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v83';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 83 legacy active-loan reconciliation applied.');