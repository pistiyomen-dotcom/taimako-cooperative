const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

app=app.replace(
  "return Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0)+Number(b.flexible||0);",
  "return Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0);"
);

app=app.replace(
  "const total=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0)+Number(b.flexible||0);",
  "const total=Number(b.regular||0)+Number(b.target||0)+Number(b.constant||0)+Number(b.welfare||0);"
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=98'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=98');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=98');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=98');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v98';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 98 loan total savings excludes Flexible.');