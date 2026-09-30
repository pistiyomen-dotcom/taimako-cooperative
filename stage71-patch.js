const fs=require('fs');

// Stage 71: Flexible start-date format and withdrawal Account Details label.

let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes('function formatFlexibleStartDateDMY')){
  app=app.replace(
    "function roleLabel(role) {",
    "function formatFlexibleStartDateDMY(value) {\n  const s=String(value||'').slice(0,10);\n  const parts=s.split('-');\n  if(parts.length!==3) return value || 'Not set';\n  return parts[2]+'/'+parts[1]+'/'+parts[0];\n}\n\nfunction roleLabel(role) {"
  );
}

app=app.replace(
  "['TOTAL SAVINGS', naira(b.flexible)], ['START DATE', b.flexibleStartDate || 'Not set'],",
  "['TOTAL SAVINGS', naira(b.flexible)], ['START DATE', formatFlexibleStartDateDMY(b.flexibleStartDate)],"
);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=71'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  '<label>Note (optional)<input id="withdrawalNote" /></label>',
  '<label>Account Details<input id="withdrawalNote" /></label>'
);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=71');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=71');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=71');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v71';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 71 Flexible start date and withdrawal Account Details label applied.');