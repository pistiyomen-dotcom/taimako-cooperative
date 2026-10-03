const fs=require('fs');

let admin=fs.readFileSync('server/routes/admin.js','utf8');
admin=admin.replace(
  "creator.username AS created_by_username FROM transactions t",
  "creator.username AS created_by_username, creator.full_name AS created_by_name FROM transactions t"
);
fs.writeFileSync('server/routes/admin.js',admin);

let app=fs.readFileSync('www/app.js','utf8');
const oldMeta=`<div class="approval-meta"><span>${escapeHTML(transactionDirection(tx.transaction_type))}</span><span>Destination: <b>${escapeHTML(tx.destination || '—')}</b></span><span>Status: ${escapeHTML(tx.status)}</span><span>${new Date(tx.created_at).toLocaleString()}</span></div>`;
const newMeta=`<div class="approval-meta"><span>${escapeHTML(transactionDirection(tx.transaction_type))}</span><span>Destination: <b>${escapeHTML(tx.destination || '—')}</b></span><span>Status: ${escapeHTML(tx.status)}</span>${adminMode ? `<span>Action by: <b>${escapeHTML(tx.created_by_name || tx.created_by_username || 'SYSTEM')}</b></span>` : ''}<span>${new Date(tx.created_at).toLocaleString()}</span></div>`;
if(!app.includes(oldMeta)){console.error('Stage 141 transaction meta marker missing');process.exit(1);}
app=app.replace(oldMeta,newMeta);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=141'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=141');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=141');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=141');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v141';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 141 Admin transaction action-by name applied.');
