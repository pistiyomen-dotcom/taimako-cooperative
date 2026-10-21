const fs=require('fs');
function rep(s,a,b,label){if(!s.includes(a))throw Error('Stage 249 missing '+label);return s.replace(a,b);}
let schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('TMCS_REGISTRATION_BALANCE_V249')){
schema += "\n-- TMCS_REGISTRATION_BALANCE_V249\n"+
"CREATE TABLE IF NOT EXISTS registration_balance_control (id INTEGER PRIMARY KEY CHECK(id=1), balance NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK(balance>=0), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());\n"+
"INSERT INTO registration_balance_control(id,balance) VALUES(1,0) ON CONFLICT(id) DO NOTHING;\n"+
"CREATE TABLE IF NOT EXISTS registration_balance_ledger (id BIGSERIAL PRIMARY KEY, reference VARCHAR(64) NOT NULL UNIQUE, entry_type VARCHAR(8) NOT NULL CHECK(entry_type IN ('CREDIT','DEBIT')), amount NUMERIC(16,2) NOT NULL CHECK(amount>0), source_type VARCHAR(24) NOT NULL, source_reference VARCHAR(64) NOT NULL, member_username VARCHAR(80), created_by_username VARCHAR(80), details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(source_type,source_reference));\n"+
"CREATE INDEX IF NOT EXISTS registration_balance_ledger_created_idx ON registration_balance_ledger(created_at DESC);\n";
fs.writeFileSync('server/db/schema.sql',schema);
}
let admin=fs.readFileSync('server/routes/admin.js','utf8');
const cashMarker="[reference,account.id,req.auth.sub,destination,amount,'Cash credit to '+destination]\n    );\n\n    await client.query('COMMIT');";
if(!admin.includes('REGISTRATION_BALANCE_CREDIT_V249')){
const cashCode="[reference,account.id,req.auth.sub,destination,amount,'Cash credit to '+destination]\n    );\n\n"+
"    /* REGISTRATION_BALANCE_CREDIT_V249 */\n"+
"    if(destination==='REGISTRATION'){\n"+
"      await client.query('INSERT INTO registration_balance_control(id,balance) VALUES(1,0) ON CONFLICT(id) DO NOTHING');\n"+
"      const regEntry=await client.query(\"INSERT INTO registration_balance_ledger(reference,entry_type,amount,source_type,source_reference,member_username,created_by_username,details) VALUES($1,'CREDIT',$2,'CASH_CREDIT',$3,$4,$5,$6::jsonb) ON CONFLICT(source_type,source_reference) DO NOTHING RETURNING id\",['REG-CC-'+reference,amount,reference,account.username,String(req.auth.username||'ADMIN'),JSON.stringify({destination:destination,transactionReference:reference})]);\n"+
"      if(regEntry.rowCount) await client.query('UPDATE registration_balance_control SET balance=balance+$1,updated_at=NOW() WHERE id=1',[amount]);\n"+
"    }\n\n    await client.query('COMMIT');";
admin=rep(admin,cashMarker,cashCode,'Stage 68 cash-credit commit marker');
}
const p0=admin.indexOf("router.post('/payment-requests/:id/approve'");
if(p0<0)throw Error('Stage 249 payment approval route not found');
const p1=admin.indexOf('\nrouter.',p0+10),pe=p1>p0?p1:admin.length;
let pr=admin.slice(p0,pe);
if(!pr.includes('REGISTRATION_BALANCE_APPROVAL_V249')){
const code="    /* REGISTRATION_BALANCE_APPROVAL_V249 */\n"+
"    if(String(request.destination||'').trim().toUpperCase()==='REGISTRATION'){\n"+
"      await client.query('INSERT INTO registration_balance_control(id,balance) VALUES(1,0) ON CONFLICT(id) DO NOTHING');\n"+
"      const regEntry=await client.query(\"INSERT INTO registration_balance_ledger(reference,entry_type,amount,source_type,source_reference,member_username,created_by_username,details) VALUES($1,'CREDIT',$2,'BANK_TRANSFER',$3,$4,$5,$6::jsonb) ON CONFLICT(source_type,source_reference) DO NOTHING RETURNING id\",['REG-BANK-'+String(request.reference),Number(request.amount),String(request.reference),String(request.username||''),String(req.auth.username||'ADMIN'),JSON.stringify({destination:'REGISTRATION',paymentRequestId:request.id,transactionReference:request.reference})]);\n"+
"      if(regEntry.rowCount) await client.query('UPDATE registration_balance_control SET balance=balance+$1,updated_at=NOW() WHERE id=1',[Number(request.amount)]);\n"+
"    }\n";
pr=rep(pr,"    await client.query('COMMIT');",code+"    await client.query('COMMIT');",'bank-transfer approval commit');
admin=admin.slice(0,p0)+pr+admin.slice(pe);
}
if(!admin.includes("router.get('/registration-balance-v249'")){
const getRoute="\nrouter.get('/registration-balance-v249',requireAdminPermission('cash_credit'),async(req,res)=>{\n"+
" const [b,e]=await Promise.all([pool.query('SELECT balance,updated_at FROM registration_balance_control WHERE id=1'),pool.query('SELECT reference,entry_type,amount,source_type,source_reference,member_username,created_by_username,details,created_at FROM registration_balance_ledger ORDER BY created_at DESC,id DESC LIMIT 100')]);\n"+
" res.set('Cache-Control','no-store');res.json({balance:Number(b.rows[0]?.balance||0),updatedAt:b.rows[0]?.updated_at||null,entries:e.rows});\n});\n";
admin=rep(admin,'\nmodule.exports = router;',getRoute+'\nmodule.exports = router;','admin router export');
}
fs.writeFileSync('server/routes/admin.js',admin);

let account=fs.readFileSync('server/routes/account.js','utf8');
if(!account.includes("'REGISTRATION BALANCE'")){
account=rep(account,"if(!['MANAGEMENT BALANCE','TMCS LTD BALANCE'].includes(debitAccount)) return res.status(400).json({error:'Select Management Balance or TMCS LTD Balance.'});","if(!['MANAGEMENT BALANCE','TMCS LTD BALANCE','REGISTRATION BALANCE'].includes(debitAccount)) return res.status(400).json({error:'Select Management Balance, TMCS LTD Balance or Registration Balance.'});",'requisition debit validation');
fs.writeFileSync('server/routes/account.js',account);
}
schema=fs.readFileSync('server/db/schema.sql','utf8');
if(!schema.includes('TMCS_REQUISITION_REGISTRATION_BALANCE_V249')){
schema += "\n-- TMCS_REQUISITION_REGISTRATION_BALANCE_V249\n"+
"ALTER TABLE cash_requisition_requests DROP CONSTRAINT IF EXISTS cash_requisition_requests_debit_account_check;\n"+
"ALTER TABLE cash_requisition_requests ADD CONSTRAINT cash_requisition_requests_debit_account_check CHECK(debit_account IN ('MANAGEMENT BALANCE','TMCS LTD BALANCE','REGISTRATION BALANCE'));\n";
fs.writeFileSync('server/db/schema.sql',schema);
}
admin=fs.readFileSync('server/routes/admin.js','utf8');
const r0=admin.indexOf("router.post('/requisition-requests-v242/:id/approve'");
if(r0<0)throw Error('Stage 249 requisition approval route not found');
const r1=admin.indexOf('\nrouter.',r0+10),re=r1>r0?r1:admin.length;
let rr=admin.slice(r0,re);
if(!rr.includes('REGISTRATION_BALANCE_REQUISITION_DEBIT_V249')){
const old="}else{\n      const balanceResult=await client.query('SELECT available_balance FROM tmcs_cooperative_ledger WHERE id=1 FOR UPDATE');";
const branch="}else if(request.debit_account==='REGISTRATION BALANCE'){\n"+
"      /* REGISTRATION_BALANCE_REQUISITION_DEBIT_V249 */\n"+
"      const balanceResult=await client.query('SELECT balance FROM registration_balance_control WHERE id=1 FOR UPDATE');\n"+
"      if(!balanceResult.rowCount){await client.query('ROLLBACK');return res.status(400).json({error:'Registration Balance record is not available.'});}\n"+
"      const available=Number(balanceResult.rows[0].balance||0);\n"+
"      if(available<amount){await client.query('ROLLBACK');return res.status(400).json({error:'Insufficient Registration Balance to approve this requisition.'});}\n"+
"      const reviewer=await client.query('SELECT username FROM accounts WHERE id=$1',[req.auth.sub]);const reviewerUsername=reviewer.rows[0]?.username||String(req.auth.username||'ADMIN');\n"+
"      const inserted=await client.query(\"INSERT INTO registration_balance_ledger(reference,entry_type,amount,source_type,source_reference,created_by_username,details) VALUES($1,'DEBIT',$2,'REQUISITION',$3,$4,$5::jsonb) ON CONFLICT(source_type,source_reference) DO NOTHING RETURNING id\",['REG-REQ-'+String(request.reference),amount,String(request.reference),reviewerUsername,JSON.stringify({requisitionId:request.id,debitAccount:'REGISTRATION BALANCE',requestedBy:request.requested_by_username})]);\n"+
"      if(!inserted.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'A Registration Balance debit already exists for this requisition.'});}\n"+
"      await client.query('UPDATE registration_balance_control SET balance=balance-$1,updated_at=NOW() WHERE id=1',[amount]);\n"+
"    }else{\n      const balanceResult=await client.query('SELECT available_balance FROM tmcs_cooperative_ledger WHERE id=1 FOR UPDATE');";
rr=rep(rr,old,branch,'requisition TMCS balance branch');
admin=admin.slice(0,r0)+rr+admin.slice(re);
}
fs.writeFileSync('server/routes/admin.js',admin);

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('value="REGISTRATION BALANCE"')) html=rep(html,'<option value="TMCS LTD BALANCE">TMCS LTD Balance</option>','<option value="TMCS LTD BALANCE">TMCS LTD Balance</option>\n        <option value="REGISTRATION BALANCE">REGISTRATION BALANCE</option>','requisition form option');
if(!html.includes('id="registrationBalanceV249Dialog"')){
const dialog="\n<dialog id=\"registrationBalanceV249Dialog\" style=\"box-sizing:border-box;width:min(900px,calc(100vw - 24px));max-width:calc(100vw - 24px);max-height:92vh;padding:0;overflow:auto;border:0;border-radius:12px\"><section class=\"dialog-card\" style=\"box-sizing:border-box;width:100%;max-width:100%;padding:clamp(12px,2.5vw,24px)\"><div class=\"dialog-head\"><h3>REGISTRATION BALANCE</h3><button type=\"button\" class=\"icon-btn\" id=\"registrationBalanceV249Close\" aria-label=\"Close\">×</button></div><p>Available balance</p><div id=\"registrationBalanceV249Amount\" style=\"font-size:clamp(1.7rem,5vw,2.5rem);font-weight:900;color:#145c36\">₦0.00</div><p id=\"registrationBalanceV249Updated\" role=\"status\" aria-live=\"polite\"></p><div style=\"display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0\"><strong>Recent transactions</strong><button type=\"button\" class=\"secondary\" id=\"registrationBalanceV249Refresh\">REFRESH</button></div><p id=\"registrationBalanceV249Message\" role=\"status\" aria-live=\"polite\"></p><div id=\"registrationBalanceV249Entries\"></div></section></dialog>\n";
html=rep(html,'</body>',dialog+'<script src=\"registration-balance-v249.js?v=269\"></script>\n</body>','registration balance dialog');
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=269').replace(/styles\.css\?v=\d+/g,'styles.css?v=269').replace(/requisition-v242\.js\?v=\d+/g,'requisition-v242.js?v=269').replace(/requisition-approval-v243\.js\?v=\d+/g,'requisition-approval-v243.js?v=269').replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=269');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
const tile="    ['REGISTRATION BALANCE', 'View registration fees collected and recent transactions'],";
if(!app.includes(tile))app=rep(app,"    ['CASH CREDIT', 'Post cash directly to Regular or Flexible account'],","    ['CASH CREDIT', 'Post cash directly to Regular or Flexible account'],\n"+tile,'Admin tile list');
const ps=app.indexOf('function adminPermissionForAction(title){'),pe=ps<0?-1:app.indexOf('\nfunction adminActionAllowed(title)',ps);
if(ps<0||pe<0)throw Error('Stage 249 Admin permission map not found');
let pm=app.slice(ps,pe);
if(!pm.includes("'REGISTRATION BALANCE':'cash_credit'")){pm=rep(pm,"'CASH CREDIT':'cash_credit',","'CASH CREDIT':'cash_credit',\n    'REGISTRATION BALANCE':'cash_credit',",'permission entry');app=app.slice(0,ps)+pm+app.slice(pe);}
const dispatch="if (title === 'CASH CREDIT') { window.openCashCreditV67?.(); }";
if(!app.includes("title === 'REGISTRATION BALANCE'"))app=rep(app,dispatch,dispatch+"\n  if (title === 'REGISTRATION BALANCE') { window.openRegistrationBalanceV249?.(); }",'Admin action dispatcher');
app=app.replace(/serviceWorker\.register\(['"]\.\/sw\.js\?v=\d+['"]/g,"serviceWorker.register('./sw.js?v=269'");
fs.writeFileSync('www/app.js',app);

const client="(()=>{const $=id=>document.getElementById(id);function session(){try{return JSON.parse(sessionStorage.getItem('tmcs-session')||'{}')}catch(_){return {}}}async function api(path){if(typeof window.api==='function')return window.api(path,{cache:'no-store'});if(typeof api==='function'&&api!==arguments.callee)return api(path,{cache:'no-store'});const s=session(),headers={};if(s.token)headers.Authorization='Bearer '+s.token;const r=await fetch(path,{headers,cache:'no-store'});let d={};try{d=await r.json()}catch(_){}if(!r.ok)throw Error(d.error||'Request failed ('+r.status+')');return d}function money(v){return '₦'+Number(v||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}function node(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e}function date(v){const d=new Date(v);return isNaN(d.getTime())?'—':d.toLocaleString('en-GB')}async function load(){const msg=$('registrationBalanceV249Message'),list=$('registrationBalanceV249Entries');msg.textContent='Loading…';list.replaceChildren();try{const data=await api('/api/admin/registration-balance-v249');$('registrationBalanceV249Amount').textContent=money(data.balance);$('registrationBalanceV249Updated').textContent=data.updatedAt?'Last updated: '+date(data.updatedAt):'No registration payments recorded yet.';const entries=Array.isArray(data.entries)?data.entries:[];msg.textContent=entries.length?entries.length+' ledger entry/entries shown (latest 100).':'No ledger entries yet.';entries.forEach(item=>{const card=node('article','approval-item'),head=node('div','approval-head'),who=node('div');who.append(node('strong','',(item.entry_type==='CREDIT'?'CREDIT':'DEBIT')+' • '+(item.source_type||'')),node('span','',(item.reference||'')+' • '+date(item.created_at)));head.append(who,node('b','',(item.entry_type==='DEBIT'?'−':'+')+money(item.amount)));card.append(head);const meta=node('div','approval-meta');if(item.member_username)meta.append(node('span','','Member: '+item.member_username));if(item.created_by_username)meta.append(node('span','','Recorded by: '+item.created_by_username));if(item.source_reference)meta.append(node('span','','Source: '+item.source_reference));card.append(meta);list.append(card)})}catch(e){msg.textContent='Unable to load Registration Balance: '+e.message}}function open(){const d=$('registrationBalanceV249Dialog');if(!d)return;if(d.showModal)d.showModal();else d.setAttribute('open','');load()}window.openRegistrationBalanceV249=open;function init(){$('registrationBalanceV249Close')?.addEventListener('click',()=>$('registrationBalanceV249Dialog')?.close());$('registrationBalanceV249Refresh')?.addEventListener('click',load)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init()})();";
fs.writeFileSync('www/registration-balance-v249.js',client);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v269';").replace(/app\.js\?v=\d+/g,'app.js?v=269').replace(/styles\.css\?v=\d+/g,'styles.css?v=269').replace(/requisition-v242\.js\?v=\d+/g,'requisition-v242.js?v=269').replace(/requisition-approval-v243\.js\?v=\d+/g,'requisition-approval-v243.js?v=269').replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=269');
if(!sw.includes("'./registration-balance-v249.js'"))sw=sw.replace("'./manifest.webmanifest'","'./manifest.webmanifest','./registration-balance-v249.js'");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 249 registration balance ledger, requisition debit option, approval controls and Admin tile applied.');
