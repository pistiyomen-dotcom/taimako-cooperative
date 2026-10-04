const fs=require('fs');

let app=fs.readFileSync('www/app.js','utf8');

const old1="[tmcsMonthName(0)+' FLEXIBLE CARD', naira(b.flexibleCard)],";
const new1="[tmcsMonthName(0).slice(0,3)+' INTEREST', naira(b.flexibleCard)],";
const old2="[tmcsMonthName(0)+' MEMBERSHIP CARD', naira(b.membershipCard)],";
const new2="[tmcsMonthName(0).slice(0,3)+' SHARES', naira(b.membershipCard)],";

if(!app.includes(old1) || !app.includes(old2)){
  console.error('Stage 148 monthly admin label markers missing');
  process.exit(1);
}
app=app.replace(old1,new1).replace(old2,new2);

const oldGuard="!title.endsWith(' FLEXIBLE CARD') && !title.endsWith(' MEMBERSHIP CARD')";
const newGuard="!title.endsWith(' INTEREST') && !title.endsWith(' SHARES')";
if(app.includes(oldGuard)) app=app.replace(oldGuard,newGuard);

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=148'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=148');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=148');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=148');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v148';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 148 OCT INTEREST and OCT SHARES labels applied.');
