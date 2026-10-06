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
    ['BALANCES', 'Open savings, shares and dividend balances'],
    ['LOAN', 'Open active loan and loan interest']
`;

if(!app.includes(oldCards)){
  console.error('Stage 167 member SAVINGS tile marker missing');
  process.exit(1);
}
app=app.replace(oldCards,newCards);

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

console.log('TAIMAKO Stage 167 member SAVINGS action removed and savings tiles restored.');
