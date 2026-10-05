const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const oldMarker="[(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' SHARES',String(Number(b.previousMonthShares||0))]";
const newMarker="[(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' SHARES',String(Number(b.previousMonthShares||0))],\n    [(tmcsMonthName(-1)==='SEPTEMBER'?'SEPT':tmcsMonthName(-1).slice(0,3))+' DIVIDEND PER SHARE','₦0']";

if(!app.includes(oldMarker)){console.error('Stage 157 previous shares tile marker missing');process.exit(1);}
app=app.replace(oldMarker,newMarker);

app=app.replace("serviceWorker.register('./sw.js?v=156'","serviceWorker.register('./sw.js?v=157'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=157');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=157');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=157');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v157';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 157 previous-month Dividend Per Share tile set to ₦0.');
