const fs=require('fs');

// Stage 70: add Welfare/Flexible destinations and simplify confirmed account display.

let html=fs.readFileSync('www/index.html','utf8');

html=html.replace(
  '<option value="CONSTANT">CONSTANT</option>\n          <option value="LOAN">LOAN</option>',
  '<option value="CONSTANT">CONSTANT</option>\n          <option value="WELFARE">WELFARE</option>\n          <option value="FLEXIBLE">FLEXIBLE</option>\n          <option value="LOAN">LOAN</option>'
);

html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=70');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=70');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=70');
fs.writeFileSync('www/index.html',html);

let admin=fs.readFileSync('server/routes/admin.js','utf8');

admin=admin.replace(
  "const allowedDestinations=['REGULAR','TARGET','CONSTANT','LOAN','INTEREST','REGISTRATION','MEMBERSHIP CARD','FLEXIBLE CARD','APPLICATION FORM'];",
  "const allowedDestinations=['REGULAR','TARGET','CONSTANT','WELFARE','FLEXIBLE','LOAN','INTEREST','REGISTRATION','MEMBERSHIP CARD','FLEXIBLE CARD','APPLICATION FORM'];"
);

admin=admin.replace(
  "'CONSTANT':'constant',\n    'LOAN':'loan_principal',",
  "'CONSTANT':'constant',\n    'WELFARE':'welfare',\n    'FLEXIBLE':'flexible',\n    'LOAN':'loan_principal',"
);

fs.writeFileSync('server/routes/admin.js',admin);

let cash=fs.readFileSync('www/cash-credit-v66.js','utf8');

cash=cash.replace(
  "      x.details.textContent=data.account.name+' — '+data.account.username+' — '+account;",
  "      x.details.textContent=data.account.name+' - '+data.account.username;"
);

fs.writeFileSync('www/cash-credit-v66.js',cash);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=70'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v70';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 70 Cash Credit Welfare/Flexible destinations and confirmation display applied.');