const fs=require('fs');

/* Backend: expose cooperative-wide Admin fee totals in /api/account/me */
let account=fs.readFileSync('server/routes/account.js','utf8');

if(!account.includes("adminFeeTotalsResult")){
  const marker="  const totalRegistrationFee=cooperativeSettings.total_registration_fee>0 ? cooperativeSettings.total_registration_fee : 0;";
  const add=`
  let adminFeeTotals={applicationForm:0,flexibleCard:0,membershipCard:0};
  if(String(row.role||'').toLowerCase()==='admin'){
    const adminFeeTotalsResult=await pool.query(
      "SELECT COALESCE(SUM(b.application_form),0) AS application_form, COALESCE(SUM(b.flexible_card),0) AS flexible_card, COALESCE(SUM(b.membership_card),0) AS membership_card FROM accounts a JOIN member_balances b ON b.account_id=a.id WHERE a.role='admin' AND a.is_active=TRUE"
    );
    const feeRow=adminFeeTotalsResult.rows[0]||{};
    adminFeeTotals={
      applicationForm:money(feeRow.application_form),
      flexibleCard:money(feeRow.flexible_card),
      membershipCard:money(feeRow.membership_card)
    };
  }
`;
  if(!account.includes(marker)){console.error('Stage 105 settings marker missing');process.exit(1);}
  account=account.replace(marker,marker+add);
}

const balanceTail="loanDueDate: row.loan_due_date, flexibleStartDate: row.flexible_start_date";
if(!account.includes("applicationForm: adminFeeTotals.applicationForm")){
  if(!account.includes(balanceTail)){console.error('Stage 105 balance marker missing');process.exit(1);}
  account=account.replace(
    balanceTail,
    balanceTail+", applicationForm: adminFeeTotals.applicationForm, flexibleCard: adminFeeTotals.flexibleCard, membershipCard: adminFeeTotals.membershipCard"
  );
}
fs.writeFileSync('server/routes/account.js',account);

/* Frontend Admin dashboard */
let app=fs.readFileSync('www/app.js','utf8');
const adminMarker="['CASH CREDIT', 'Post cash directly to Regular or Flexible account'],";
if(!app.includes("['APPLICATION FORM', naira(b.applicationForm)]")){
  if(!app.includes(adminMarker)){console.error('Stage 105 admin card marker missing');process.exit(1);}
  app=app.replace(
    adminMarker,
    adminMarker+"\n    ['APPLICATION FORM', naira(b.applicationForm)],\n    ['FLEXIBLE CARD', naira(b.flexibleCard)],\n    ['MEMBERSHIP CARD', naira(b.membershipCard)],"
  );
}

const oldClick="    if (user.role === 'admin') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', () => adminAction(title)); card.addEventListener('keydown', e => { if (e.key==='Enter' || e.key===' ') adminAction(title); }); }";
const newClick="    if (user.role === 'admin' && !['APPLICATION FORM','FLEXIBLE CARD','MEMBERSHIP CARD'].includes(title)) { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', () => adminAction(title)); card.addEventListener('keydown', e => { if (e.key==='Enter' || e.key===' ') adminAction(title); }); }";
if(app.includes(oldClick)) app=app.replace(oldClick,newClick);

if(!app.includes('window.refreshAdminFeeTotalsV105')){
  const marker='async function refreshAccount() {';
  const hook=`
window.refreshAdminFeeTotalsV105=async function(){
  if(String(state.user?.role||'').toLowerCase()!=='admin') return;
  try{
    await refreshAccount();
    renderApp();
  }catch(_){}
};

`;
  if(!app.includes(marker)){console.error('Stage 105 refresh marker missing');process.exit(1);}
  app=app.replace(marker,hook+marker);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=105'");
fs.writeFileSync('www/app.js',app);

/* Refresh Admin fee tiles after successful ADMIN cash credit */
let cash=fs.readFileSync('www/cash-credit-v66.js','utf8');
if(!cash.includes('refreshAdminFeeTotalsV105')){
  const postStart=cash.indexOf("async function postCash(event)");
  const successPos=cash.indexOf("x.success.style.display='block'",postStart);
  if(postStart<0 || successPos<0){console.error('Stage 105 cash success marker missing');process.exit(1);}
  const lineEnd=cash.indexOf('\n',successPos);
  cash=cash.slice(0,lineEnd+1)+
    "      if(account==='ADMIN' && typeof window.refreshAdminFeeTotalsV105==='function'){ setTimeout(()=>window.refreshAdminFeeTotalsV105(),250); }\n"+
    cash.slice(lineEnd+1);
}
fs.writeFileSync('www/cash-credit-v66.js',cash);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=105');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=105');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=105');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v105';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 105 Admin fee dashboard totals applied.');