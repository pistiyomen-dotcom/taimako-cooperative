const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');

if(!html.includes('id="balancesDialog"')){
  const marker='<dialog id="adminSettingsDialog"';
  const dialog=`
  <dialog id="balancesDialog" class="wide-dialog">
    <div class="dialog-card">
      <div class="dialog-head"><h3>BALANCES</h3><button type="button" class="icon-btn" data-close="balancesDialog" aria-label="Close">×</button></div>
      <div id="balancesDialogContent" class="dashboard-grid"></div>
    </div>
  </dialog>

`;
  if(!html.includes(marker)){console.error('Stage 152 balances dialog marker missing');process.exit(1);}
  html=html.replace(marker,dialog+marker);
}

html=html.replace(/app\.js\?v=\d+/g,'app.js?v=152');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=152');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=152');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');

const oldCards=`    [tmcsMonthName(0).slice(0,3)+' APPLICATION FORM', naira(b.applicationForm)],
    [tmcsMonthName(0).slice(0,3)+' INTEREST', naira(b.flexibleCard)],
    [tmcsMonthName(0).slice(0,3)+' SHARES', naira(b.membershipCard)],
    ['MANAGEMENT BALANCE', naira(b.managementBalance)],
`;

if(!app.includes(oldCards)){console.error('Stage 152 admin balance cards marker missing');process.exit(1);}

app=app.replace(oldCards,`    ['BALANCES', 'View Application Form, Interest, Shares and Management balances'],
`);

if(!app.includes("if (title === 'BALANCES')")){
  const marker="if (title === 'PUBLIC INFORMATION') { openPublicInformationV146(); }";
  if(!app.includes(marker)){console.error('Stage 152 BALANCES action marker missing');process.exit(1);}
  app=app.replace(marker,marker+"\n  if (title === 'BALANCES') { openBalancesV152(); }");
}

if(!app.includes('function openBalancesV152()')){
  const marker='function renderDashboard() {';
  const code=`
function openBalancesV152(){
  const b=state.balances||{};
  const dialog=document.getElementById('balancesDialog');
  const content=document.getElementById('balancesDialogContent');
  if(!dialog||!content) return;

  const items=[
    [tmcsMonthName(0).slice(0,3)+' APPLICATION FORM',naira(b.applicationForm)],
    [tmcsMonthName(0).slice(0,3)+' INTEREST',naira(b.flexibleCard)],
    [tmcsMonthName(0).slice(0,3)+' SHARES',naira(b.membershipCard)],
    ['MANAGEMENT BALANCE',naira(b.managementBalance)]
  ];

  content.innerHTML='';
  items.forEach(([title,value])=>{
    const card=document.createElement('article');
    card.className='dashboard-card';
    const h=document.createElement('h4');
    h.textContent=title;
    const p=document.createElement('p');
    p.textContent=value;
    card.append(h,p);
    content.appendChild(card);
  });

  openDialog(dialog);
}

`;
  if(!app.includes(marker)){console.error('Stage 152 renderDashboard marker missing');process.exit(1);}
  app=app.replace(marker,code+marker);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=152'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v152';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 152 BALANCES action tile applied.');
