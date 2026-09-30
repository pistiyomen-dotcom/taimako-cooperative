const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const start=app.indexOf('async function loadPendingApprovals() {');
const end=app.indexOf('\nasync function viewReceipt(id)',start);
if(start<0||end<0){ console.error('Stage 85 pending approvals function marker missing'); process.exit(1); }

const replacement=`async function loadPendingApprovals() {
  approvalsError.textContent=''; approvalsList.innerHTML='<p class="helper">Loading pending requests…</p>';
  try {
    const data = await api('/api/admin/payment-requests?status=pending');
    if (!data.requests.length) { approvalsList.innerHTML='<p class="empty-state">No pending bank-transfer requests.</p>'; return; }
    approvalsList.innerHTML='';
    data.requests.forEach(request => {
      const item=document.createElement('article'); item.className='approval-item';
      item.innerHTML=\`<div class="approval-head"><div><strong>\${escapeHTML(request.full_name)}</strong><span>\${escapeHTML(request.username)} • \${escapeHTML(roleLabel(request.role))}</span></div><b>\${naira(request.amount)}</b></div>
        <div class="approval-meta"><span>Destination: <b>\${escapeHTML(request.destination)}</b></span><span>Ref: \${escapeHTML(request.reference)}</span><span>\${new Date(request.created_at).toLocaleString()}</span></div>
        \${request.note ? \`<p class="approval-note">\${escapeHTML(request.note)}</p>\` : ''}
        <div class="approval-actions"><button type="button" class="secondary receipt-btn">VIEW RECEIPT</button><button type="button" class="primary approve-btn">APPROVE</button><button type="button" class="danger reject-btn">REJECT</button></div>\`;
      item.querySelector('.receipt-btn').addEventListener('click', () => viewReceipt(request.id));
      item.querySelector('.approve-btn').addEventListener('click', () => approvePayment(request.id, request.reference));
      item.querySelector('.reject-btn').addEventListener('click', () => rejectPayment(request.id, request.reference));
      approvalsList.appendChild(item);
    });
  } catch(error) { approvalsList.innerHTML=''; approvalsError.textContent=error.message; }
}
`;

app=app.slice(0,start)+replacement+app.slice(end);
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=85'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=85');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=85');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=85');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v85';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 85 restored loans to LOANS section only.');