const fs=require('fs');
let h=fs.readFileSync('www/index.html','utf8');
if(!h.includes('id="summaryReportDialog"')) h=h.replace('</body>','<dialog id="summaryReportDialog" class="wide-dialog"><div class="dialog-card"><div class="dialog-head"><h3>Summary Report</h3><button type="button" class="icon-btn" data-close="summaryReportDialog">×</button></div><p class="form-error" id="summaryReportError"></p><div id="summaryReportBody"></div></div></dialog></body>');
fs.writeFileSync('www/index.html',h);

let s=fs.readFileSync('www/app.js','utf8');
if(!s.includes("['SUMMARY REPORT'")){
 s=s.replace("['AUDIT LOG', 'Review administrator activity history'],","['AUDIT LOG', 'Review administrator activity history'],\n    ['SUMMARY REPORT', 'View cooperative totals and pending work'],");
 s=s.replace("if (title === 'AUDIT LOG') { openAuditLogDialog(); }","if (title === 'AUDIT LOG') { openAuditLogDialog(); }\n  if (title === 'SUMMARY REPORT') { openSummaryReportDialog(); }");
 s=s.replace("'AUDIT LOG':'view_reports',","'AUDIT LOG':'view_reports',\n    'SUMMARY REPORT':'view_reports',");
 s=s.replace("'AUDIT LOG','LINK FLEXIBLE'","'AUDIT LOG','SUMMARY REPORT','LINK FLEXIBLE'");
 s+="\nasync function openSummaryReportDialog(){const d=document.getElementById('summaryReportDialog'),b=document.getElementById('summaryReportBody'),e=document.getElementById('summaryReportError');e.textContent='';b.innerHTML='Loading…';d.showModal();try{const x=await api('/api/admin/summary-report'),A=x.accounts,B=x.balances,P=x.pending;const rows=[['Regular Members',A.regular_active],['Flexible Accounts',A.flexible_active],['Administrators',A.admin_active],['Regular Savings',naira(B.regular)],['Target Savings',naira(B.target)],['Constant Savings',naira(B.constant)],['Welfare Savings',naira(B.welfare)],['Flexible Savings',naira(B.flexible)],['Outstanding Loans',naira(B.loan_principal)],['Loan Interest',naira(B.loan_interest)],['Pending Deposits',P.payments],['Pending Withdrawals',P.withdrawals],['Pending Loans',P.loans]];b.innerHTML='<div class=\"mini-grid\">'+rows.map(v=>'<div><span>'+v[0]+'</span><b>'+v[1]+'</b></div>').join('')+'</div>';}catch(err){b.innerHTML='';e.textContent=err.message;}}\n";
}
fs.writeFileSync('www/app.js',s);
console.log('TAIMAKO Stage 37 summary UI applied.');
