const fs=require('fs');

// Stage 75: rename Flexible dashboard TOTAL SAVINGS tile to FLEXIBLE.

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(
  "['TOTAL SAVINGS', naira(b.flexible)], ['START DATE', formatFlexibleStartDateDMY(b.flexibleStartDate)],",
  "['FLEXIBLE', naira(b.flexible)], ['START DATE', formatFlexibleStartDateDMY(b.flexibleStartDate)],"
);
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=75');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=75');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=75');
fs.writeFileSync('www/index.html',html);

app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/,"serviceWorker.register('./sw.js?v=75'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v75';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 75 Flexible dashboard label applied.');