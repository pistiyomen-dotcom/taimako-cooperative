const fs=require('fs');

let admin=fs.readFileSync('server/routes/admin.js','utf8');
admin=admin.replace(
"    const interestRate = Number(app.interest_rate || (app.loan_product === 'REGULAR' ? 5 : 3));\n    const interest = Number((amount*(interestRate/100)).toFixed(2));",
"    const interestRate = 5;\n    const interest = Number((amount*0.05).toFixed(2));"
);
fs.writeFileSync('server/routes/admin.js',admin);

let account=fs.readFileSync('server/routes/account.js','utf8');
account=account.replace(
"    let interestRate = loanProduct === 'REGULAR' ? 5 : 3;",
"    let interestRate = 5;"
);
fs.writeFileSync('server/routes/account.js',account);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace('<option value="REGULAR">REGULAR - 5%</option><option value="CONSTANT">CONSTANT - 3%</option><option value="TARGET">TARGET - 3% (12 months or less)</option>','<option value="REGULAR">REGULAR - 5%</option><option value="CONSTANT">CONSTANT - 5%</option><option value="TARGET">TARGET - 5%</option>');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=81');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=81');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=81');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=81'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v81';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 81 active loan interest rule applied.');