const fs=require('fs');
let a=fs.readFileSync('server/routes/admin.js','utf8');
if(!a.includes("router.get('/summary-report'")){
const r=`\nrouter.get('/summary-report',requireAdminPermission('view_reports'),async(_req,res)=>{ const c=(await pool.query("SELECT COUNT(*) FILTER(WHERE role='regular' AND is_active) regular_active,COUNT(*) FILTER(WHERE role='flexible' AND is_active) flexible_active,COUNT(*) FILTER(WHERE role='admin' AND is_active) admin_active FROM accounts")).rows[0]; const b=(await pool.query("SELECT COALESCE(SUM(regular),0) regular,COALESCE(SUM(target),0) target,COALESCE(SUM(constant),0) constant,COALESCE(SUM(welfare),0) welfare,COALESCE(SUM(flexible),0) flexible,COALESCE(SUM(loan_principal),0) loan_principal,COALESCE(SUM(loan_interest),0) loan_interest FROM member_balances")).rows[0]; const p=(await pool.query("SELECT (SELECT COUNT(*) FROM payment_requests WHERE status='pending') payments,(SELECT COUNT(*) FROM withdrawal_requests WHERE status='pending') withdrawals,(SELECT COUNT(*) FROM loan_applications WHERE status='pending') loans")).rows[0]; res.json({accounts:c,balances:b,pending:p}); });\n`;
a=a.replace('\nmodule.exports = router;',r+'\nmodule.exports = router;');
}
fs.writeFileSync('server/routes/admin.js',a);
console.log('TAIMAKO Stage 37 summary endpoint applied.');
