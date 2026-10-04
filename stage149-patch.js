const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const oldLabel="[tmcsMonthName(0)+' APPLICATION FORM', naira(b.applicationForm)],";
const newLabel="[tmcsMonthName(0).slice(0,3)+' APPLICATION FORM', naira(b.applicationForm)],";

if(!app.includes(oldLabel)){
  console.error('Stage 149 Application Form label marker missing');
  process.exit(1);
}
app=app.replace(oldLabel,newLabel);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=149'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=149');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=149');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=149');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v149';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 149 OCT APPLICATION FORM label applied.');
