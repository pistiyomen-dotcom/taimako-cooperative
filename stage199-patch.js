const fs=require('fs');

// Stage 199: remove obsolete Admin dashboard tiles requested by user.
let app=fs.readFileSync('www/app.js','utf8');

const removeTitles=['SAVINGS PLAN SETUP','MONTH-END COMPLIANCE','COMPLIANCE PAYMENT','COMPLIANCE SETTLEMENT'];
function esc(s){return s.replace(/[.*+?^$()|[\]\\]/g,'\\$&');}

for(const title of removeTitles){
  const e=esc(title);
  app=app.replace(new RegExp("\\n\\s*\\['"+e+"'\\s*,\\s*'[^']*'\\]\\s*,?","g"),'');
  app=app.replace(new RegExp("\\n\\s*if \\(title === '"+e+"'\\) \\{[^\\n]*\\}","g"),'');
}

for(const title of removeTitles){
  app=app.split("    '"+title+"':'manage_savings',\\n").join('');
  app=app.split("'"+title+"',").join('');
  app=app.split(",'"+title+"'").join('');
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=199'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=199');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=199');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=199');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=199');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v199';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 199 obsolete Admin dashboard tiles removed.');
