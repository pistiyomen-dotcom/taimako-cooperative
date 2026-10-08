const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
if(!html.includes('id="memberSavingsDialogV164"')){
  const marker='<dialog id="adminSettingsDialog"';
  const dialog=`
  <dialog id="memberSavingsDialogV164" class="wide-dialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>SAVINGS</h3><button type="button" class="icon-btn" data-close="memberSavingsDialogV164" aria-label="Close">×</button></div>
      <div id="memberSavingsGridV164" class="dashboard-grid"></div>
    </div>
  </dialog>

`;
  if(!html.includes(marker)){console.error('Stage 164 member savings dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=164');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=164');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=164');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

const oldCards=`    ['REGISTRATION', registrationDone ? '✓' : naira(b.registration)], ['REGULAR', naira(b.regular)], ['TARGET', naira(b.target)],
    ['CONSTANT', naira(b.constant)], ['WELFARE', naira(b.welfare)], ['FLEXIBLE', naira(b.flexible)],
    ['BALANCES', 'Open savings, shares and dividend balances'], ['ACTIVE LOAN', activeLoanText],
    ['LOAN INTEREST', naira(b.loanInterest)]
`;

const newCards=`    ['REGISTRATION', registrationDone ? '✓' : naira(b.registration)],
    ['SAVINGS', 'Open savings balances'],
    ['ADVANCE SAVING', 'Open advance savings payment form'],
    ['BALANCES', 'Open savings, shares and dividend balances'], ['ACTIVE LOAN', activeLoanText],
    ['LOAN INTEREST', naira(b.loanInterest)]
`;

if(!app.includes(oldCards)){console.error('Stage 164 regular member savings cards marker missing');process.exit(1);}
app=app.replace(oldCards,newCards);

if(!app.includes('function openMemberSavingsV164()')){
  const marker='function renderDashboard() {';
  const code=`
function openMemberSavingsV164(){
  const b=state.balances||{};
  const items=[
    ['REGULAR',naira(b.regular)],
    ['TARGET',naira(b.target)],
    ['CONSTANT',naira(b.constant)],
    ['WELFARE',naira(b.welfare)],
    ['FLEXIBLE',naira(b.flexible)]
  ];
  const grid=document.getElementById('memberSavingsGridV164');
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
  openDialog(document.getElementById('memberSavingsDialogV164'));
}

`;
  if(!app.includes(marker)){console.error('Stage 164 renderDashboard marker missing');process.exit(1);}
  app=app.replace(marker,code+marker);
}

const actionMarker="if (user.role === 'regular' && title === 'BALANCES') { card.classList.add('admin-action-card');";
if(!app.includes("user.role === 'regular' && title === 'SAVINGS'")){
  const i=app.indexOf(actionMarker);
  if(i<0){console.error('Stage 164 member BALANCES action marker missing');process.exit(1);}
  const lineEnd=app.indexOf('\n',i);
  const line=app.slice(i,lineEnd);
  const savingsAction="if (user.role === 'regular' && title === 'SAVINGS') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', openMemberSavingsV164); card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') openMemberSavingsV164(); }); }";
  const advanceAction="if (user.role === 'regular' && title === 'ADVANCE SAVING') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', openAdvanceSavingV189); card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') openAdvanceSavingV189(); }); }";
  app=app.replace(line,savingsAction+'\n    '+advanceAction+'\n    '+line);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=164'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v164';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 164 member SAVINGS and ADVANCE SAVING action tiles applied.');
