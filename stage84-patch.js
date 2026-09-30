const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const start=app.indexOf('async function loadPendingApprovals() {');
const end=app.indexOf('\nasync function viewReceipt(id)',start);
if(start<0||end<0){ console.error('Stage 84 pending approvals function marker missing'); process.exit(1); }

const replacement=`async function loadPendingApprovals() {
  approvalsError.textContent='';
  approvalsList.innerHTML='<p class="helper">Loading pending requests…</p>';
  try {
    const [payments,loans]=await Promise.all([
      api('/api/admin/payment-requests?status=pending'),
      api('/api/admin/loan-applications?status=pending')
    ]);

    const paymentRequests=payments.requests||[];
    const loanApplications=loans.applications||[];

    if (!paymentRequests.length && !loanApplications.length) {
      approvalsList.innerHTML='<p class="empty-state">No pending approvals.</p>';
      return;
    }

    approvalsList.innerHTML='';

    paymentRequests.forEach(request => {
      const item=document.createElement('article');
      item.className='approval-item';
      item.innerHTML=\`<div class="approval-head"><div><strong>PAYMENT • \${escapeHTML(request.full_name)}</strong><span>\${escapeHTML(request.username)} • \${escapeHTML(roleLabel(request.role))}</span></div><b>\${naira(request.amount)}</b></div>
        <div class="approval-meta"><span>Destination: <b>\${escapeHTML(request.destination)}</b></span><span>Ref: \${escapeHTML(request.reference)}</span><span>\${new Date(request.created_at).toLocaleString()}</span></div>
        \${request.note ? \`<p class="approval-note">\${escapeHTML(request.note)}</p>\` : ''}
        <div class="approval-actions"><button type="button" class="secondary receipt-btn">VIEW RECEIPT</button><button type="button" class="primary approve-btn">APPROVE</button><button type="button" class="danger reject-btn">REJECT</button></div>\`;
      item.querySelector('.receipt-btn').addEventListener('click', () => viewReceipt(request.id));
      item.querySelector('.approve-btn').addEventListener('click', () => approvePayment(request.id, request.reference));
      item.querySelector('.reject-btn').addEventListener('click', () => rejectPayment(request.id, request.reference));
      approvalsList.appendChild(item);
    });

    loanApplications.forEach(loan => {
      const item=document.createElement('article');
      item.className='approval-item';
      const guarantor=loan.guarantor_username ? \`${escapeHTML(loan.guarantor_name)} (\${escapeHTML(loan.guarantor_username)})\` : 'Not required at application';
      item.innerHTML=\`<div class="approval-head"><div><strong>LOAN • \${escapeHTML(loan.full_name)}</strong><span>\${escapeHTML(loan.username)} • \${escapeHTML(loan.reference)}</span></div><b>\${naira(loan.requested_amount)}</b></div>
        <div class="approval-meta"><span>90% capacity: \${naira(loan.self_backed_limit)}</span><span>Guarantor coverage: \${naira(loan.guarantor_required_amount)}</span><span>Guarantor: \${guarantor}</span><span>\${new Date(loan.created_at).toLocaleString()}</span></div>
        \${loan.purpose ? \`<p class="approval-note">Purpose: \${escapeHTML(loan.purpose)}</p>\` : ''}
        <div class="approval-actions"><button type="button" class="primary approve-btn">APPROVE LOAN</button><button type="button" class="danger reject-btn">REJECT</button></div>\`;
      item.querySelector('.approve-btn').addEventListener('click', async()=>{ await approveLoan(loan.id,loan.reference); await loadPendingApprovals(); });
      item.querySelector('.reject-btn').addEventListener('click', async()=>{ await rejectLoan(loan.id,loan.reference); await loadPendingApprovals(); });
      approvalsList.appendChild(item);
    });
  } catch(error) {
    approvalsList.innerHTML='';
    approvalsError.textContent=error.message;
  }
}
`;

app=app.slice(0,start)+replacement+app.slice(end);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=84'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=84');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=84');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=84');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v84';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 84 merged loan applications into Pending Approvals.');