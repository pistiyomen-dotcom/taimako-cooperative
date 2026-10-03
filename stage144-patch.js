const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
const oldField='<label>Phone<input id="contactReply" type="tel" inputmode="tel" autocomplete="tel" required maxlength="30" /></label>';
const newField='<label>Phone Number<input id="contactReply" type="tel" inputmode="tel" autocomplete="tel" required maxlength="30" /></label>';

if(!html.includes(oldField)){
  console.error('Stage 144 Contact Us Phone field marker missing');
  process.exit(1);
}
html=html.replace(oldField,newField);
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=144');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=144');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=144');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=144'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v144';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 144 Contact Us Phone Number label applied.');
