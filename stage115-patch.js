const fs=require('fs');

const p='server/routes/account.js';
let s=fs.readFileSync(p,'utf8');

const before=(s.match(/b\.target_balance/g)||[]).length;
s=s.replace(/b\.target_balance/g,'b.target');
const after=(s.match(/b\.target_balance/g)||[]).length;

fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 115 target balance compatibility fix applied. Replacements:',before,'Remaining:',after);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=115'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=115');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=115');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=115');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v115';");
fs.writeFileSync('www/sw.js',sw);
