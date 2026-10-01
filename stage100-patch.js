const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

// Remove the obsolete observer that rewrites TOTAL SAVINGS / NUMBER OF SHARES headings.
const obsStart=app.indexOf('function tmcsCurrentMonthLabels()');
if(obsStart>=0){
  const obsEnd=app.indexOf('\nfunction setCashCreditMode(',obsStart);
  if(obsEnd<0){console.error('Stage 100 observer end marker missing');process.exit(1);}
  app=app.slice(0,obsStart)+app.slice(obsEnd);
}

// Keep the two sensitive member dashboard values stable after any DOM refresh/mutation.
const stability=`
function stabilizeMemberDashboardV100(){
  if(String(state.user?.role||'').toLowerCase()!=='regular') return;
  const b=state.balances||{};
  const total=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0);
  const active=Number(b.loanPrincipal||0)>0
    ? naira(b.loanPrincipal)+'\\nDUE on '+tmcsFormatDMY(b.loanDueDate)
    : 'None';

  document.querySelectorAll('#dashboardContent .dashboard-card').forEach(card=>{
    const h=card.querySelector('h4');
    const p=card.querySelector('p');
    if(!h||!p) return;
    const title=(h.textContent||'').trim().toUpperCase();

    if(title==='TOTAL SAVINGS'){
      const wanted=naira(total);
      if(p.textContent!==wanted) p.textContent=wanted;
    }
    if(title==='ACTIVE LOAN'){
      if(p.textContent!==active) p.textContent=active;
      p.style.whiteSpace='pre-line';
    }
  });
}

let dashboardStabilityQueuedV100=false;
function queueDashboardStabilityV100(){
  if(dashboardStabilityQueuedV100) return;
  dashboardStabilityQueuedV100=true;
  queueMicrotask(()=>{
    dashboardStabilityQueuedV100=false;
    stabilizeMemberDashboardV100();
  });
}

const dashboardStabilityObserverV100=new MutationObserver(queueDashboardStabilityV100);
dashboardStabilityObserverV100.observe(dashboardContent,{childList:true,subtree:true,characterData:true});
`;

const renderMarker='function renderApp() {';
if(!app.includes('function stabilizeMemberDashboardV100()')){
  if(!app.includes(renderMarker)){console.error('Stage 100 render marker missing');process.exit(1);}
  app=app.replace(renderMarker,stability+'\n'+renderMarker);
}

// Run once at the end of every dashboard render.
app=app.replace(
  "  if (user.role === 'regular') {",
  "  if (user.role === 'regular') {"
);
const renderEndMarker="    dashboardContent.appendChild(actions);\n  }\n}";
if(app.includes(renderEndMarker) && !app.includes("queueDashboardStabilityV100();\n}")){
  app=app.replace(renderEndMarker,"    dashboardContent.appendChild(actions);\n  }\n  queueDashboardStabilityV100();\n}");
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=100'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=100');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=100');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=100');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v100';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 100 stabilized member Total Savings and Active Loan due display.');