const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');

if(!html.includes('id="memberLoanDialogV166"')){
  const marker='<dialog id="adminSettingsDialog"';
  const dialog=`
  <dialog id="memberLoanDialogV166" class="wide-dialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>LOAN</h3><button type="button" class="icon-btn" data-close="memberLoanDialogV166" aria-label="Close">×</button></div>
      <div id="memberLoanGridV166" class="dashboard-grid"></div>
    </div>
  </dialog>

`;
  if(!html.includes(marker)){console.error('Stage 166 member loan dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}

html=html.replace(/app\.js\?v=\d+/g,'app.js?v=166');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=166');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=166');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

const oldCards=`    ['REGISTRATION', registrationDone ? '✓' : naira(b.registration)],
    ['SAVINGS', 'Open savings balances'],
    ['BALANCES', 'Open savings, shares and dividend balances'], ['ACTIVE LOAN', activeLoanText],
    ['LOAN INTEREST', naira(b.loanInterest)]
`;

const newCards=`    ['REGISTRATION', registrationDone ? '✓' : naira(b.registration)],
    ['SAVINGS', 'Open savings balances'],
    ['BALANCES', 'Open savings, shares and dividend balances'],
    ['LOAN', 'Open active loan and loan interest']
`;

if(!app.includes(oldCards)){console.error('Stage 166 regular member loan cards marker missing');process.exit(1);}
app=app.replace(oldCards,newCards);

if(!app.includes('function openMemberLoanV166()')){
  const marker='function renderDashboard() {';
  const code=`
function openMemberLoanV166(){
  const b=state.balances||{};
  const activeLoanText=Number(b.loanPrincipal||0)>0
    ? naira(b.loanPrincipal)+'\\nDUE on '+tmcsFormatDMY(b.loanDueDate)
    : 'None';
  const items=[
    ['ACTIVE LOAN',activeLoanText],
    ['LOAN INTEREST',naira(b.loanInterest)]
  ];
  const grid=document.getElementById('memberLoanGridV166');
  if(!grid) return;
  grid.innerHTML='';
  items.forEach(([title,value])=>{
    const card=document.createElement('article');
    card.className='dashboard-card';
    const h=document.createElement('h4'); h.textContent=title;
    const p=document.createElement('p'); p.textContent=value;
    if(title==='ACTIVE LOAN') p.style.whiteSpace='pre-line';
    card.append(h,p);
    grid.appendChild(card);
  });
  openDialog(document.getElementById('memberLoanDialogV166'));
}

`;
  if(!app.includes(marker)){console.error('Stage 166 renderDashboard marker missing');process.exit(1);}
  app=app.replace(marker,code+marker);
}

if(!app.includes("user.role === 'regular' && title === 'LOAN'")){
  const marker="if (user.role === 'regular' && title === 'BALANCES') { card.classList.add('admin-action-card');";
  const i=app.indexOf(marker);
  if(i<0){console.error('Stage 166 BALANCES action marker missing');process.exit(1);}
  const lineEnd=app.indexOf('\n',i);
  const line=app.slice(i,lineEnd);
  const loanAction="if (user.role === 'regular' && title === 'LOAN') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', openMemberLoanV166); card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') openMemberLoanV166(); }); }";
  app=app.replace(line,line+'\n    '+loanAction);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=166'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v166';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 166 member LOAN action tile applied.');
