const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const oldCards=`    ['REGISTRATION', registrationDone ? '✓' : naira(b.registration)],
    ['SAVINGS', 'Open savings balances'],
    ['BALANCES', 'Open savings, shares and dividend balances'],
    ['LOAN', 'Open active loan and loan interest']
`;

const newCards=`    ['REGISTRATION', registrationDone ? '✓' : naira(b.registration)],
    ['REGULAR', naira(b.regular)],
    ['TARGET', naira(b.target)],
    ['CONSTANT', naira(b.constant)],
    ['WELFARE', naira(b.welfare)],
    ['FLEXIBLE', naira(b.flexible)],
    ['ADVANCE SAVING', 'Open advance savings payment form'],
    ['BALANCES', 'Open savings, shares and dividend balances'],
    ['LOAN', 'Open active loan and loan interest']
`;

if(!app.includes(oldCards)){
  console.error('Stage 167 member SAVINGS tile marker missing');
  process.exit(1);
}
app=app.replace(oldCards,newCards);

if(!app.includes("user.role === 'regular' && title === 'ADVANCE SAVING'")){
  const actionMarker="if (user.role === 'regular' && title === 'BALANCES') { card.classList.add('admin-action-card');";
  const i=app.indexOf(actionMarker);
  if(i<0){console.error('Stage 167 BALANCES action marker missing');process.exit(1);}
  const lineEnd=app.indexOf('\n',i);
  const line=app.slice(i,lineEnd);
  const advanceAction="if (user.role === 'regular' && title === 'ADVANCE SAVING') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click', openAdvanceSavingV189); card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') openAdvanceSavingV189(); }); }";
  app=app.replace(line,advanceAction+'\n    '+line);
}

/* SAVINGS is no longer an action tile */
app=app.replace(/\n\s*if \(user\.role === 'regular' && title === 'SAVINGS'\) \{[^\n]*\}/g,'');

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=167'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=167');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=167');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=167');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v167';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 167 savings tiles restored with ADVANCE SAVING action.');
