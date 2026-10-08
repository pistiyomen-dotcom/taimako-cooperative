const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="memberBalancesDialogV159"')){
  const marker='<dialog id="adminSettingsDialog"';
  const dialog=`
  <dialog id="memberBalancesDialogV159" class="wide-dialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>BALANCES</h3><button type="button" class="icon-btn" data-close="memberBalancesDialogV159" aria-label="Close">×</button></div>
      <div id="memberBalancesGridV159" class="dashboard-grid"></div>
    </div>
  </dialog>

`;
  if(!html.includes(marker)){console.error('Stage 159 member balances dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=159');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=159');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=159');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

const oldCards=`    ['REGISTRATION', registrationDone ? '✓' : naira(b.registration)], ['REGULAR', naira(b.regular)], ['TARGET', naira(b.target)],
    ['CONSTANT', naira(b.constant)], ['WELFARE', naira(b.welfare)], ['FLEXIBLE', naira(b.flexible)],
    ['TOTAL SAVINGS', naira(accumulatedLoanSavings)], ['NUMBER OF SHARES', String(calculatedShares)],
    [tmcsMonthName(-1)+' DIVIDEND', naira(b.dividend)], ['ACTIVE LOAN', activeLoanText],
    [tmcsMonthName(0)+' SAVINGS', naira(b.totalSavings)], ['LOAN INTEREST', naira(b.loanInterest)]
`;

const newCards=`    ['REGISTRATION', registrationDone ? '✓' : naira(b.registration)], ['REGULAR', naira(b.regular)], ['TARGET', naira(b.target)],
    ['CONSTANT', naira(b.constant)], ['WELFARE', naira(b.welfare)], ['FLEXIBLE', naira(b.flexible)],
    ['ADVANCE SAVING', 'Open advance savings payment form'], ['BALANCES', 'Open savings, shares and dividend balances'], ['ACTIVE LOAN', activeLoanText],
    ['LOAN INTEREST', naira(b.loanInterest)]
`;

if(!app.includes(oldCards)){console.error('Stage 159 regular member dashboard cards marker missing');process.exit(1);}
app=app.replace(oldCards,newCards);

if(!app.includes('function openMemberBalancesV159()')){
  const marker='function renderDashboard() {';
  const code=`
function openMemberBalancesV159(){
  const b=state.balances||{};
  const totalSavings=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0);
  const minimumSharePerMonth=Number(b.minimumSharePerMonth||5000);
  const currentMonthSavings=Number(b.totalSavings||0);
  const currentMonthShares=minimumSharePerMonth>0?Math.floor(currentMonthSavings/minimumSharePerMonth):0;
  const items=[
    ['TOTAL SAVINGS',naira(totalSavings)],
    [tmcsMonthName(0).slice(0,3)+' SAVINGS',naira(currentMonthSavings)],
    [tmcsMonthName(0).slice(0,3)+' SHARES',String(currentMonthShares)],
    [tmcsMonthName(-1).slice(0,4)+' DIVIDEND',naira(b.dividend)]
  ];
  const grid=document.getElementById('memberBalancesGridV159');
  if(!grid) return;
  grid.innerHTML='';
  items.forEach(([title,value])=>{
    const card=document.createElement('article');
    card.className='dashboard-card';
    const h=document.createElement('h4'); h.textContent=title;
    const p=document.createElement('p'); p.textContent=value;
    card.append(h,p);
    grid.appendChild(card);
  });
  openDialog(document.getElementById('memberBalancesDialogV159'));
}

`;
  if(!app.includes(marker)){console.error('Stage 159 renderDashboard marker missing');process.exit(1);}
  app=app.replace(marker,code+marker);
}

const actionMarker="if(title === 'ACTIVE LOAN') p.style.whiteSpace='pre-line';";
if(!app.includes("user.role === 'regular' && title === 'BALANCES'")){
  if(!app.includes(actionMarker)){console.error('Stage 159 member action marker missing');process.exit(1);}
  app=app.replace(actionMarker,actionMarker+"\n    if (user.role === 'regular' && title === 'ADVANCE SAVING') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', openAdvanceSavingV189); card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') openAdvanceSavingV189(); }); }
    if (user.role === 'regular' && title === 'BALANCES') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', openMemberBalancesV159); card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') openMemberBalancesV159(); }); }");
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=159'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v159';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 159 member BALANCES and ADVANCE SAVING action tiles applied.');
