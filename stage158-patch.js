const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const managementLine="    ['MANAGEMENT BALANCE',naira(b.managementBalance)],\n";
if(!app.includes(managementLine)){console.error('Stage 158 management balance line missing');process.exit(1);}
app=app.replace(managementLine,'');

const dividendLine="    [(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' DIVIDEND PER SHARE','₦0']\n  ];";
const reordered="    [(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' DIVIDEND PER SHARE','₦0'],\n    ['MANAGEMENT BALANCE',naira(b.managementBalance)]\n  ];";
if(!app.includes(dividendLine)){console.error('Stage 158 dividend tile end marker missing');process.exit(1);}
app=app.replace(dividendLine,reordered);

app=app.replace("serviceWorker.register('./sw.js?v=157'","serviceWorker.register('./sw.js?v=158'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=158');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=158');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=158');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v158';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 158 MANAGEMENT BALANCE moved to last.');
