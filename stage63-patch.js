const fs=require('fs');

const refreshScript=`(() => {
  let timer=null;
  function session(){
    try { return JSON.parse(sessionStorage.getItem('tmcs-session') || '{}'); }
    catch(_){ return {}; }
  }
  function money(v){
    return '₦'+Number(v||0).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function updateCards(b){
    const map={
      'REGISTRATION':money(b.registration),
      'REGULAR':money(b.regular),
      'TARGET':money(b.target),
      'CONSTANT':money(b.constant),
      'WELFARE':money(b.welfare),
      'FLEXIBLE':money(b.flexible),
      'TOTAL SAVINGS':money(b.totalSavings),
      'NUMBER OF SHARES':String(b.numberOfShares??0),
      'ACTIVE LOAN':Number(b.loanPrincipal||0)>0?money(b.loanPrincipal):'None',
      'PAYMENT DUE DATE':b.loanDueDate||'—',
      'LOAN INTEREST':money(b.loanInterest)
    };
    document.querySelectorAll('#dashboardContent .dashboard-card').forEach(card=>{
      const h=card.querySelector('h4');
      const p=card.querySelector('p');
      if(!h||!p) return;
      const title=(h.textContent||'').trim().toUpperCase().replace(/\s+-\s+.*$/,'');
      if(Object.prototype.hasOwnProperty.call(map,title)) p.textContent=map[title];
    });
  }
  async function refreshMemberDashboard(){
    const s=session();
    if(!s.token || !s.user || !['regular','flexible'].includes(String(s.user.role||'').toLowerCase())) return;
    const dashboard=document.getElementById('dashboardView');
    if(!dashboard || dashboard.hidden) return;
    try{
      const r=await fetch('/api/account/me',{headers:{Authorization:'Bearer '+s.token},cache:'no-store'});
      if(!r.ok) return;
      const data=await r.json();
      if(data?.balances) updateCards(data.balances);
    }catch(_){}
  }
  function start(){
    if(timer) clearInterval(timer);
    refreshMemberDashboard();
    timer=setInterval(refreshMemberDashboard,5000);
  }
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) refreshMemberDashboard(); });
  window.addEventListener('focus',refreshMemberDashboard);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
  else start();
})();`;

fs.writeFileSync('www/dashboard-refresh.js',refreshScript);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  /<script src="cash-credit\.js\?v=\d+"><\/script>/,
  '<script src="cash-credit.js?v=63"></script>\n  <script src="dashboard-refresh.js?v=63"></script>'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=63');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v63';");
if(!sw.includes("'./dashboard-refresh.js'")){
  sw=sw.replace("'./cash-credit.js'","'./cash-credit.js','./dashboard-refresh.js'");
}
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 63 member dashboard auto-refresh applied.');
