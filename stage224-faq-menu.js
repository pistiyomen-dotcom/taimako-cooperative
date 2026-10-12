const fs=require('fs');
const path='www/index.html';
let html=fs.readFileSync(path,'utf8');
if(!html.includes('</body>')||!html.includes('</head>'))throw Error('Website page markers missing');
if(html.includes('tmcsFaqDialogV224'))throw Error('FAQ already present');
const qa=[["What is TAIMAKO Cooperative?","TAIMAKO Multipurpose Cooperative Society Ltd is a cooperative movement for achieving financial independence through savings and mutual support."],["How do I become a member?","Open MEMBERSHIP and choose REGISTER. Contact the cooperative office if you need assistance."],["What savings services are available?","The cooperative system includes REGULAR, TARGET, CONSTANT, WELFARE and FLEXIBLE savings services. Availability depends on the account type."],["Can I save in advance for future months?","Eligible Regular members can use ADVANCE SAVING to submit a payment and choose a future start month and number of shares. The schedule applies after administrator approval."],["How do I apply for a loan?","Sign in, open LOAN and select APPLY. Loan eligibility and interest depend on the selected savings type, and an administrator must approve the application."],["How much can I borrow?","The standard entitlement is up to 90% of your total eligible savings. A guarantor may be required when you request more than your own savings."],["When does loan repayment become due?","Approved loans normally have a 30-day duration. Applicable interest and overdue charges depend on the loan account and rules shown in your loan details."],["How do I request a withdrawal?","Sign in and use the withdrawal service available for your account. Your balance is updated after administrator approval."],["Is there a charge on early Flexible withdrawals?","If a Flexible withdrawal is requested before 30 days from the start date, a 20% charge applies. The system shows the charge and asks you to accept or decline before submission."],["How can I make a payment?","Use the available payment option in your account and follow its instructions. Submitted payments that require review are credited after approval."],["How are dividend shares determined?","Monthly shares are based on eligible savings and the cooperative's configured minimum share amount. Dividend calculations and allocations follow the cooperative’s month-end rules."],["Can I use TAIMAKO on a phone or computer?","Yes. TAIMAKO is designed for Android and web browser access."],["What if I forget my PIN or cannot log in?","Contact an authorized cooperative administrator for account assistance or a temporary PIN reset. Never share your PIN with other members."],["Where can I get assistance?","Contact the TAIMAKO office at Wambai Street, Romi, Kaduna, for help with membership and account services."]];
const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rows=qa.map(([q,a])=>'<details class="tmcs-faq-entry"><summary>'+escapeHtml(q)+'</summary><p>'+escapeHtml(a)+'</p></details>').join('');
const dialog='<dialog id="tmcsFaqDialogV224" aria-labelledby="tmcsFaqHeadingV224"><div class="dialog-card tmcs-faq-dialog-card"><div class="dialog-head"><h3 id="tmcsFaqHeadingV224">FREQUENTLY ASKED QUESTIONS</h3><button type="button" class="icon-btn" data-close="tmcsFaqDialogV224" aria-label="Close FAQ">×</button></div><p class="tmcs-faq-subtitle">Answers to common questions about TAIMAKO Cooperative</p><div class="tmcs-faq-entries">'+rows+'</div></div></dialog>';
const css=`<style>
#tmcsFaqDialogV224{max-width:min(94vw,800px);max-height:88vh;padding:0;border:0;border-radius:18px;box-shadow:0 20px 60px #10291b44}
#tmcsFaqDialogV224::backdrop{background:rgba(12,36,24,.65)}
#tmcsFaqDialogV224 .tmcs-faq-dialog-card{box-sizing:border-box;width:min(94vw,800px);max-height:88vh;overflow:auto;padding:clamp(14px,3vw,26px);background:white}
#tmcsFaqDialogV224 h3{color:#12613a}
#tmcsFaqDialogV224 .tmcs-faq-subtitle{color:#776127;margin:0 0 16px}
#tmcsFaqDialogV224 .tmcs-faq-entry{border:1px solid #e0e7d9;border-radius:12px;margin:9px 0;background:#fcfdf9}
#tmcsFaqDialogV224 summary{padding:15px;cursor:pointer;font-weight:700;color:#17643c;line-height:1.4}
#tmcsFaqDialogV224 .tmcs-faq-entry[open] summary{background:#f3f7e9;color:#88621a}
#tmcsFaqDialogV224 .tmcs-faq-entry p{padding:0 15px 15px;line-height:1.6;color:#354e40;margin:12px 0 0}
.tmcs-faq-tile-v224{cursor:pointer}
</style>`;
const js=`<script>(function(){
function openFAQ(){var d=document.getElementById('tmcsFaqDialogV224');if(d&&!d.open)d.showModal();}
function tile(){
 const existing=document.getElementById('tmcsFaqTileV224');
 if(existing&&existing.isConnected)return;
 const candidates=Array.from(document.querySelectorAll('.card, .tile, .service-card, .feature-card, .menu-card'));
 const match=candidates.find(el=>el.textContent.trim().toUpperCase().startsWith('MEMBERSHIP') && el.parentElement && el.parentElement.children.length>1);
 if(!match)return;
 const parent=match.parentElement;
 const copy=match.cloneNode(true);
 copy.id='tmcsFaqTileV224';
 copy.classList.add('tmcs-faq-tile-v224');
 copy.removeAttribute('data-action');
 copy.querySelectorAll('[id],[data-action],button,a').forEach(el=>{
   el.removeAttribute('id');el.removeAttribute('data-action');
   if(el.matches('a'))el.removeAttribute('href');
   if(el.matches('button'))el.type='button';
 });
 const title=Array.from(copy.querySelectorAll('h2,h3,h4,strong,.title')).find(el=>el.textContent.trim().toUpperCase().includes('MEMBERSHIP'));
 if(title){title.textContent='FAQ';}
 else copy.textContent='FAQ';
 copy.querySelectorAll('p,.description,.subtext').forEach(el=>el.textContent='Frequently Asked Questions');
 copy.setAttribute('role','button');copy.tabIndex=0;copy.setAttribute('aria-label','Open Frequently Asked Questions');
 copy.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openFAQ();},true);
 copy.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openFAQ();}});
 parent.appendChild(copy);
}
document.addEventListener('DOMContentLoaded',()=>{
 tile();
 const observer=new MutationObserver(()=>tile());
 observer.observe(document.body,{childList:true,subtree:true});
});
document.addEventListener('click',e=>{const close=e.target.closest('[data-close="tmcsFaqDialogV224"]');if(close){e.preventDefault();document.getElementById('tmcsFaqDialogV224')?.close();}},true);
})();</script>`;
html=html.replace('</head>',css+'</head>').replace('</body>',dialog+js+'</body>');
fs.writeFileSync(path,html);
console.log('FAQ modal and public menu tile installed without account/backend changes.');
