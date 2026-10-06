const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const old="  if(setup){\n    items.push(['PLANNED AMOUNT',setup.plannedAmount==null?'Not set':naira(setup.plannedAmount)]);";
const neu="  if(type==='TARGET') items.push(['SHORTSAVED CHARGE',naira(0)]);\n  if(setup){\n    items.push(['PLANNED AMOUNT',setup.plannedAmount==null?'Not set':naira(setup.plannedAmount)]);";

if(!app.includes(old)){
  console.error('Stage 180 TARGET setup detail marker missing');
  process.exit(1);
}
app=app.replace(old,neu);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=180'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=180');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=180');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=180');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v180';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 180 TARGET SHORTSAVED CHARGE tile added.');
