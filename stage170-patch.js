const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const replacements=[
  ["['REGULAR', naira(b.regular)]","['REGULAR', '']"],
  ["['TARGET', naira(b.target)]","['TARGET', '']"],
  ["['CONSTANT', naira(b.constant)]","['CONSTANT', '']"],
  ["['WELFARE', naira(b.welfare)]","['WELFARE', '']"]
];

for(const [oldText,newText] of replacements){
  if(!app.includes(oldText)){
    console.error('Stage 170 savings tile marker missing: '+oldText);
    process.exit(1);
  }
  app=app.replace(oldText,newText);
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=170'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=170');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=170');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=170');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v170';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 170 savings action tiles names only applied.');
