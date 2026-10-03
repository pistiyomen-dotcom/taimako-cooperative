const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');

const oldField='<label>Phone / Email<input id="contactReply" required maxlength="160" /></label>';
const newField='<label>Phone<input id="contactReply" type="tel" inputmode="tel" autocomplete="tel" required maxlength="30" /></label>';

if(!html.includes(oldField)){
  console.error('Stage 143 Contact Us Phone / Email field marker missing');
  process.exit(1);
}
html=html.replace(oldField,newField);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=143');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=143');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=143');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=143'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v143';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 143 Contact Us phone-only field applied.');
