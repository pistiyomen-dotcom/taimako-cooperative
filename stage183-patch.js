const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const flexOld="['FLEXIBLE', naira(b.flexible)]";
const flexNew="['FLEXIBLE', '']";
if(!app.includes(flexOld)){console.error('Stage 183 FLEXIBLE tile marker missing');process.exit(1);}
app=app.replace(flexOld,flexNew);

if(!app.includes('tmcsSavingsNamesOnlyV183')){
  const marker="const p = document.createElement('p'); p.textContent = value;";
  const replacement="const p = document.createElement('p'); p.textContent = value;\n    const tmcsSavingsNamesOnlyV183 = user.role === 'regular' && ['REGULAR','TARGET','CONSTANT','WELFARE','FLEXIBLE'].includes(title);\n    if(tmcsSavingsNamesOnlyV183) p.style.display='none';";
  if(!app.includes(marker)){console.error('Stage 183 card value renderer marker missing');process.exit(1);}
  app=app.replace(marker,replacement);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=183'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=183');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=183');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=183');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v183';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 183 Regular savings account tiles names-only applied.');