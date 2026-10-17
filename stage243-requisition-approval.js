const fs=require('fs');
function rep(s,a,b,n){if(!s.includes(a))throw Error('Stage 243 missing '+n);return s.replace(a,b)}
let app=fs.readFileSync('www/app.js','utf8');
// Keep member-payment Pending Approvals unchanged; requisitions have their own tile.
{
 const a=app.indexOf('async function loadPendingApprovals() {');
 const b=app.indexOf('\nasync function viewReceipt(id)',a);
 if(a>=0&&b>a){
  let loader=app.slice(a,b);
  loader=loader.replace(/const \[payments,loans,requisitions\]=await Promise\.all\(\[[\s\S]*?\]\);/, "const [payments,loans]=await Promise.all([\n      api('/api/admin/payment-requests?status=pending'),\n      api('/api/admin/loan-applications?status=pending')\n    ]);");
  loader=loader.replace(/\s*const requisitionRequests=requisitions\.requests\|\|\[\];/, '');
  loader=loader.replace(/if \(!paymentRequests\.length && !loanApplications\.length && !requisitionRequests\.length\)/, "if (!paymentRequests.length && !loanApplications.length)");
  loader=loader.replace(/\s*requisitionRequests\.forEach\(request => \{[\s\S]*?\n    \}\);\s*/, '\n');
  app=app.slice(0,a)+loader+app.slice(b);
 }
}
const tile="    ['REQUISITION', 'Submit a cash request for approval'],";
const approval="    ['REQUISITION APPROVAL & SUMMARY', 'Review cash requests and account balances'],";
if(app.includes(tile)&&!app.includes(approval))app=rep(app,tile,tile+'\n'+approval,'tile anchor');
if(app.includes("'REQUISITION':'cash_credit',")&&!app.includes("'REQUISITION APPROVAL & SUMMARY':'cash_credit'"))app=rep(app,"'REQUISITION':'cash_credit',","'REQUISITION':'cash_credit',\n    'REQUISITION APPROVAL & SUMMARY':'cash_credit',",'permission map');
const disp="if (title === 'REQUISITION') { window.openRequisitionV242?.(); }";
if(app.includes(disp)&&!app.includes("title === 'REQUISITION APPROVAL & SUMMARY'"))app=rep(app,disp,disp+"\n  if (title === 'REQUISITION APPROVAL & SUMMARY') { window.openRequisitionApprovalV243?.(); }",'dispatcher');
app=app.replaceAll("serviceWorker.register('./sw.js?v=260'","serviceWorker.register('./sw.js?v=261'");
fs.writeFileSync('www/app.js',app);
let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="requisitionApprovalV243Dialog"')){
const dialog='<dialog id="requisitionApprovalV243Dialog"><section class="dialog-card" style="max-width:900px;width:min(94vw,900px);max-height:88vh;overflow:auto"><div class="dialog-head"><h3>REQUISITION APPROVAL & SUMMARY</h3><button type="button" class="icon-btn" id="requisitionApprovalV243Close">×</button></div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0"><label for="requisitionApprovalV243Filter">Requests</label><select id="requisitionApprovalV243Filter"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All Requests</option></select><button type="button" class="primary" id="requisitionApprovalV243Refresh">REFRESH</button></div><p id="requisitionApprovalV243Message" role="status" aria-live="polite"></p><div id="requisitionApprovalV243List"></div></section></dialog>';
html=html.replace('</body>',dialog+'\n<script src="requisition-approval-v243.js?v=261"></script>\n</body>');}
html=html.replaceAll('app.js?v=260','app.js?v=261').replaceAll('styles.css?v=260','styles.css?v=261').replaceAll('requisition-v242.js?v=260','requisition-v242.js?v=261');
fs.writeFileSync('www/index.html',html);
const client=[
"(()=>{const $=id=>document.getElementById(id);",
"function sess(){try{return JSON.parse(sessionStorage.getItem('tmcs-session')||'{}')}catch(_){return {}}}",
"async function api(path,opts={}){const s=sess(),headers=Object.assign({},opts.headers||{});if(s.token)headers.Authorization='Bearer '+s.token;if(opts.body&&!headers['Content-Type'])headers['Content-Type']='application/json';const r=await fetch(path,Object.assign({},opts,{headers,cache:'no-store'}));let d={};try{d=await r.json()}catch(_){}if(!r.ok)throw Error(d.error||'Request failed ('+r.status+')');return d}",
"function node(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e}",
"function money(v){return '₦'+Number(v||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}",
"function date(v){const d=new Date(v);return isNaN(d.getTime())?'—':d.toLocaleString('en-GB')}",
"async function load(){const list=$('requisitionApprovalV243List'),msg=$('requisitionApprovalV243Message'),filter=$('requisitionApprovalV243Filter').value;list.replaceChildren();msg.textContent='Loading…';try{const data=await api('/api/admin/requisition-requests-v242?status='+encodeURIComponent(filter));const rows=Array.isArray(data.requests)?data.requests:[];msg.textContent=rows.length?rows.length+' request(s) found.':'No requisitions found.';rows.forEach(r=>{const card=node('article','approval-item'),head=node('div','approval-head'),who=node('div');who.append(node('strong','',r.reference||'—'),node('span','',(r.requested_by_name||'')+' • '+(r.requested_by_username||'')));head.append(who,node('b','',money(r.amount)));card.append(head,node('p','',r.description||''));const meta=node('div','approval-meta');meta.append(node('span','','Debit account: '+(r.debit_account||'—')),node('span','','Status: '+(r.status||'—')),node('span','','Submitted: '+date(r.created_at)));if(r.reviewed_by_username)meta.append(node('span','','Reviewed by: '+r.reviewed_by_username));if(r.rejection_reason)meta.append(node('span','','Reason: '+r.rejection_reason));card.append(meta);if(r.status==='pending'){const actions=node('div','approval-actions'),yes=node('button','primary','APPROVE & DEBIT'),no=node('button','danger','REJECT');yes.type=no.type='button';yes.onclick=async()=>{if(!confirm('Approve '+r.reference+' for '+money(r.amount)+' from '+r.debit_account+'? This will debit the selected balance.'))return;yes.disabled=no.disabled=true;try{await api('/api/admin/requisition-requests-v242/'+r.id+'/approve',{method:'POST',body:'{}'});await load()}catch(e){msg.textContent=e.message;yes.disabled=no.disabled=false}};no.onclick=async()=>{if(!confirm('Reject '+r.reference+'? No balance will be debited.'))return;yes.disabled=no.disabled=true;try{await api('/api/admin/requisition-requests-v242/'+r.id+'/reject',{method:'POST',body:'{}'});await load()}catch(e){msg.textContent=e.message;yes.disabled=no.disabled=false}};actions.append(yes,no);card.append(actions)}list.append(card)})}catch(e){msg.textContent='Unable to load requisitions: '+e.message}}",
"function open(){const d=$('requisitionApprovalV243Dialog');if(!d)return;if(d.showModal)d.showModal();else d.setAttribute('open','');load()}window.openRequisitionApprovalV243=open;",
"function init(){const d=$('requisitionApprovalV243Dialog');if(!d)return;$('requisitionApprovalV243Close').onclick=()=>d.close();$('requisitionApprovalV243Refresh').onclick=load;$('requisitionApprovalV243Filter').onchange=load}",
"if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init()})();"
].join('\\n');
fs.writeFileSync('www/requisition-approval-v243.js',client);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/const CACHE = 'taimako-v[0-9]+';/,"const CACHE = 'taimako-v261';").replaceAll('app.js?v=260','app.js?v=261').replaceAll('styles.css?v=260','styles.css?v=261').replaceAll('requisition-v242.js?v=260','requisition-v242.js?v=261');
if(!sw.includes("'./requisition-approval-v243.js'"))sw=sw.replace("'./requisition-v242.js'","'./requisition-v242.js','./requisition-approval-v243.js'");fs.writeFileSync('www/sw.js',sw);
console.log('Stage 243 separate requisition approval tile added.');