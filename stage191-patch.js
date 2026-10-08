const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes("['ADVANCE SAVING', 'Open advance savings payment form']")){
  const marker="    ['SAVINGS', 'Open savings balances'],\n    ['BALANCES', 'Open savings, shares and dividend balances'],";
  const replacement="    ['SAVINGS', 'Open savings balances'],\n    ['ADVANCE SAVING', 'Open advance savings payment form'],\n    ['BALANCES', 'Open savings, shares and dividend balances'],";
  if(!app.includes(marker)){console.error('Stage 191 exact regular dashboard marker missing');process.exit(1);}
  app=app.replace(marker,replacement);
}

if(!app.includes("title === 'ADVANCE SAVING'")){
  const marker="    if (user.role === 'regular' && title === 'BALANCES') {";
  const i=app.indexOf(marker);
  if(i<0){console.error('Stage 191 BALANCES action marker missing');process.exit(1);}
  const action="    if (user.role === 'regular' && title === 'ADVANCE SAVING') { card.classList.add('admin-action-card'); card.tabIndex=0; card.setAttribute('role','button'); card.addEventListener('click',openAdvanceSavingV189); card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ') openAdvanceSavingV189();}); }\n";
  app=app.slice(0,i)+action+app.slice(i);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=191'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=191');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=191');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=191');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v191';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 191 exact Regular dashboard ADVANCE SAVING tile applied.');
