const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');

const old='<div class="dialog-actions"><button type="button" class="secondary" id="setupConfirmV173">CONFIRM</button></div>';
const neu='<button type="button" class="primary" id="setupConfirmV173" style="display:block;width:100%;margin:10px 0 12px;padding:12px 16px;font-weight:700;">CONFIRM</button>';

if(!html.includes(old)){
  console.error('Stage 175 SETUP confirm button marker missing');
  process.exit(1);
}
html=html.replace(old,neu);

html=html.replace(/app\.js\?v=\d+/g,'app.js?v=175');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=175');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=175');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=175'");
fs.writeFileSync('www/app.js',app);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v175';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 175 SETUP CONFIRM button made directly visible.');
