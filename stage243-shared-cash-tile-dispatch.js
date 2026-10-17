const fs=require('fs');
const appPath='www/app.js';
let app=fs.readFileSync(appPath,'utf8');
const before=app.length;
app=app.replace(/document\.addEventListener\('click',function\(e\)\{\s*if\(findTileNode\(e\.target,'CASH REQUEST'\)\)[\s\S]*?\n \},true\);\s*/,'\n');
if(app.length===before && app.includes("findTileNode(e.target,'CASH REQUEST')")) {
  throw new Error('Stage 243: competing cash-tile app click listener was not removed.');
}
fs.writeFileSync(appPath,app);
const htmlPath='www/index.html';
let html=fs.readFileSync(htmlPath,'utf8');
html=html.replace(/<script>\s*\/\* TAIMAKO_CASH_TILE_CLICK_FALLBACK_V242 \*\/[\s\S]*?<\/script>\s*/,'\n');
html=html.replace(/<script>\s*\/\* TAIMAKO_CASH_TILE_CLICK_FALLBACK_V243 \*\/[\s\S]*?<\/script>\s*/,'\n');
if(html.includes('TAIMAKO_CASH_TILE_CLICK_FALLBACK_V242')||html.includes('TAIMAKO_CASH_TILE_CLICK_FALLBACK_V243')) {
  throw new Error('Stage 243: competing HTML fallback listener remains.');
}
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=258').replace(/styles\.css\?v=\d+/g,'styles.css?v=258').replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=258').replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=258');
fs.writeFileSync(htmlPath,html);
let sw=fs.readFileSync('www/sw.js','utf8').replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v258';");
fs.writeFileSync('www/sw.js',sw);
console.log('TAIMAKO Stage 243 removed competing cash tile interceptors; shared Admin tile dispatcher remains the click path.');
