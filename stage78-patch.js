const fs=require('fs');

// Stage 78: add SUM BALANCE to Admin Total/Summary Report.

let admin=fs.readFileSync('server/routes/admin.js','utf8');

const oldBalanceQuery = `const b=(await pool.query("SELECT COALESCE(SUM(regular),0) regular,COALESCE(SUM(target),0) target,COALESCE(SUM(constant),0) constant,COALESCE(SUM(welfare),0) welfare,COALESCE(SUM(flexible),0) flexible,COALESCE(SUM(loan_principal),0) loan_principal,COALESCE(SUM(loan_interest),0) loan_interest FROM member_balances")).rows[0];`;
const newBalanceQuery = `const b=(await pool.query("SELECT COALESCE(SUM(mb.regular),0) regular,COALESCE(SUM(mb.target),0) target,COALESCE(SUM(mb.constant),0) constant,COALESCE(SUM(mb.welfare),0) welfare,COALESCE(SUM(mb.flexible),0) flexible,COALESCE(SUM(mb.loan_principal),0) loan_principal,COALESCE(SUM(mb.loan_interest),0) loan_interest,COALESCE(SUM(mb.regular+mb.target+mb.constant+mb.welfare+mb.flexible+mb.loan_interest),0) sum_balance FROM member_balances mb JOIN accounts a ON a.id=mb.account_id WHERE a.role='regular'")).rows[0];`;
if(!admin.includes(oldBalanceQuery)){
  console.error('Stage 78 summary balance query marker missing');
  process.exit(1);
}
admin=admin.replace(oldBalanceQuery,newBalanceQuery);
fs.writeFileSync('server/routes/admin.js',admin);

let app=fs.readFileSync('www/app.js','utf8');
const oldRows="const rows=[['Regular Members',A.regular_active],['Flexible Accounts',A.flexible_active],['Administrators',A.admin_active],['Regular Savings',naira(B.regular)],['Target Savings',naira(B.target)],['Constant Savings',naira(B.constant)],['Welfare Savings',naira(B.welfare)],['Flexible Savings',naira(B.flexible)],['Outstanding Loans',naira(B.loan_principal)],['Loan Interest',naira(B.loan_interest)],['Pending Deposits',P.payments],['Pending Withdrawals',P.withdrawals],['Pending Loans',P.loans]];";
const newRows="const rows=[['SUM BALANCE',naira(B.sum_balance)],['Regular Members',A.regular_active],['Flexible Accounts',A.flexible_active],['Administrators',A.admin_active],['Regular Savings',naira(B.regular)],['Target Savings',naira(B.target)],['Constant Savings',naira(B.constant)],['Welfare Savings',naira(B.welfare)],['Flexible Savings',naira(B.flexible)],['Outstanding Loans',naira(B.loan_principal)],['Loan Interest',naira(B.loan_interest)],['Pending Deposits',P.payments],['Pending Withdrawals',P.withdrawals],['Pending Loans',P.loans]];";
if(!app.includes(oldRows)){
  console.error('Stage 78 summary UI rows marker missing');
  process.exit(1);
}
app=app.replace(oldRows,newRows);
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=78'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=78');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=78');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=78');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v78';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 78 Admin SUM BALANCE applied.');