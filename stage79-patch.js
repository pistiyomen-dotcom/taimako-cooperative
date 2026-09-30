const fs=require('fs');

// Stage 79: improve Admin Audit Log display.

let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes('function formatAuditDateDMY')){
  app=app.replace(
    'async function openAuditLogDialog(){',
    `function formatAuditDateDMY(value){
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return '—';
  const dd=String(d.getDate()).padStart(2,'0');
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const yyyy=d.getFullYear();
  return dd+'/'+mm+'/'+yyyy;
}

async function openAuditLogDialog(){`
  );
}

const oldLine="    box.innerHTML='<div class=\"mini-grid\">'+data.entries.map(e=>'<div><span>'+escapeHTML(e.action_code)+'</span><b>'+escapeHTML(e.admin_username||'SYSTEM')+'</b><small>'+escapeHTML(e.target_username||e.target_id||e.target_type||'—')+'</small><small>'+escapeHTML(new Date(e.created_at).toLocaleString())+'</small></div>').join('')+'</div>';";
const newLine="    box.innerHTML='<div class=\"mini-grid audit-log-grid\">'+data.entries.map(e=>{const amount=e.details&&e.details.amount!==undefined&&e.details.amount!==null?naira(Number(e.details.amount)):'—';const username=e.target_username||e.admin_username||'SYSTEM';return '<div><span>'+escapeHTML(e.action_code)+'</span><small><strong>ADMIN:</strong> '+escapeHTML(e.admin_username||'SYSTEM')+'</small><small><strong>USERNAME:</strong> '+escapeHTML(username)+'</small><small><strong>AMOUNT:</strong> '+escapeHTML(amount)+'</small><small><strong>DATE:</strong> '+escapeHTML(formatAuditDateDMY(e.created_at))+'</small></div>';}).join('')+'</div>';";
if(!app.includes(oldLine)){
  console.error('Stage 79 audit log UI marker missing');
  process.exit(1);
}
app=app.replace(oldLine,newLine);
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=79'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=79');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=79');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=79');
fs.writeFileSync('www/index.html',html);

let css=fs.readFileSync('www/styles.css','utf8');
if(!css.includes('tmcs-audit-log-stage79')){
  css += '\n/* tmcs-audit-log-stage79 */\n.audit-log-grid>div small{display:block;margin-top:4px;}\n.audit-log-grid>div strong{font-weight:800;}\n';
}
fs.writeFileSync('www/styles.css',css);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v79';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 79 Admin Audit Log amount/username/date formatting applied.');