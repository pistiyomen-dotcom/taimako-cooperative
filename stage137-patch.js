const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(
  /\n\s*<hr \/>\s*\n\s*<h4>OFFICIAL TRANSFER DETAILS<\/h4>[\s\S]*?<label>Third line<input id="publicPaymentLineThree" type="text" autocomplete="off" \/><\/label>\s*\n?/,
  '\n'
);
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
const blockStart=app.indexOf('async function loadPublicPaymentSettingsV114()');
if(blockStart>=0){
  const swMarker=app.indexOf("serviceWorker.register('./sw.js",blockStart);
  if(swMarker>blockStart){
    app=app.slice(0,blockStart)+app.slice(swMarker);
  }
}
app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=137'");
fs.writeFileSync('www/app.js',app);

html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=137');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=137');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=137');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v137';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 137 Settings restored to reviewable fields only.');
