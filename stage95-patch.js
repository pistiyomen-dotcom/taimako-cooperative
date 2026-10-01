const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

// After successful member submission, verify the application is visible from the member loan endpoint.
const successNeedle="loanSuccessV94.textContent='SUBMITTED SUCCESSFULLY: '+data.application.reference+'. Waiting for Admin approval.';";
const successReplace=`const verify=await api('/api/account/loans',{cache:'no-store'});
    const visible=(verify.applications||[]).some(x=>x.reference===data.application.reference && String(x.status).toLowerCase()==='pending');
    if(!visible) throw new Error('Application was created but could not be verified as pending. Please try again.');
    loanSuccessV94.textContent='SUBMITTED SUCCESSFULLY: '+data.application.reference+'. Waiting for Admin approval.';`;
if(!app.includes(successNeedle)){console.error('Stage 95 member success marker missing');process.exit(1);}
app=app.replace(successNeedle,successReplace);

// Replace Admin LOANS loader with a more explicit/robust version.
const loadStart=app.indexOf('async function loadPendingLoans()');
const loadEnd=app.indexOf('\nasync function approveLoan(',loadStart);
if(loadStart<0||loadEnd<0){console.error('Stage 95 admin loader markers missing');process.exit(1);}

const loader=`async function loadPendingLoans() {
  loansAdminError.textContent='';
  loansAdminSuccess.textContent='';
  loansAdminList.innerHTML='<p class="helper">Loading pending loan applications…</p>';
  if(activeLoansAdminList) activeLoansAdminList.innerHTML='<p class="helper">Loading active loans…</p>';
  try {
    const data=await api('/api/admin/loan-applications?status=pending&_='+Date.now(),{cache:'no-store'});
    const items=Array.isArray(data.applications)?data.applications:[];
    if(!items.length){
      loansAdminList.innerHTML='<p class="empty-state">Pending applications: 0</p>';
    } else {
      loansAdminList.innerHTML='<p class="helper"><strong>Pending applications: '+items.length+'</strong></p>';
      items.forEach(app=>{
        const item=document.createElement('article');
        item.className='approval-item';
        const guarantor=app.guarantor_username ? escapeHTML(app.guarantor_name)+' ('+escapeHTML(app.guarantor_username)+')' : 'Not required';
        item.innerHTML='<div class="approval-head"><div><strong>'+escapeHTML(app.full_name)+'</strong><span>'+escapeHTML(app.username)+' • '+escapeHTML(app.reference)+'</span></div><b>'+naira(app.requested_amount)+'</b></div>'+
          '<div class="approval-meta"><span>Account: '+escapeHTML(app.loan_product||'REGULAR')+'</span><span>Savings: '+naira(app.borrower_savings_at_application)+'</span><span>90% entitlement: '+naira(app.self_backed_limit)+'</span><span>Guarantor: '+guarantor+'</span></div>'+
          '<div class="approval-actions"><button type="button" class="primary approve-btn">APPROVE</button><button type="button" class="danger reject-btn">DECLINE</button></div>';
        item.querySelector('.approve-btn').addEventListener('click',()=>approveLoan(app.id,app.reference,app.requested_amount));
        item.querySelector('.reject-btn').addEventListener('click',()=>rejectLoan(app.id,app.reference));
        loansAdminList.appendChild(item);
      });
    }

    const active=await api('/api/admin/loans?status=active&_='+Date.now(),{cache:'no-store'});
    const activeItems=Array.isArray(active.loans)?active.loans:[];
    if(activeLoansAdminList){
      if(!activeItems.length) activeLoansAdminList.innerHTML='<p class="empty-state">No active loans.</p>';
      else {
        activeLoansAdminList.innerHTML='';
        activeItems.forEach(l=>{
          const x=document.createElement('article');
          x.className='approval-item';
          const g=l.guarantor_username?escapeHTML(l.guarantor_name)+' ('+escapeHTML(l.guarantor_username)+')':'Not required';
          x.innerHTML='<div class="approval-head"><div><strong>'+escapeHTML(l.full_name)+'</strong><span>'+escapeHTML(l.username)+' • '+escapeHTML(l.reference)+'</span></div><b>'+naira(l.current_principal)+'</b></div>'+
            '<div class="approval-meta"><span>Interest: '+naira(l.current_interest)+'</span><span>Due: '+escapeHTML(l.due_date)+'</span><span>Overdue accrued: '+naira(l.overdue_interest_accrued)+'</span><span>Guarantor: '+g+'</span></div>';
          activeLoansAdminList.appendChild(x);
        });
      }
    }
  } catch(error) {
    loansAdminList.innerHTML='';
    if(activeLoansAdminList) activeLoansAdminList.innerHTML='';
    loansAdminError.textContent='LOANS LOAD FAILED: '+error.message;
  }
}
`;
app=app.slice(0,loadStart)+loader+app.slice(loadEnd);
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=95'");
fs.writeFileSync('www/app.js',app);

let admin=fs.readFileSync('server/routes/admin.js','utf8');
admin=admin.replace(
  "res.json({ applications:result.rows });",
  "console.log('ADMIN_PENDING_LOANS_COUNT', status, result.rows.length);\n  res.json({ applications:result.rows });"
);
fs.writeFileSync('server/routes/admin.js',admin);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v95';");
fs.writeFileSync('www/sw.js',sw);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=95');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=95');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=95');
fs.writeFileSync('www/index.html',html);

console.log('TAIMAKO Stage 95 verified member-to-admin loan handoff applied.');