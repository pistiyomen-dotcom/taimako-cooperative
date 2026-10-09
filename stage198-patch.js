const fs=require('fs');

// Stage 198: final client-side Flexible username confirmation fix after Stage 196.
let app=fs.readFileSync('www/app.js','utf8');

if(!app.includes('function validAdvanceCashCreditUsernameV198')){
  const marker="let advanceCashCreditConfirmedV193='';";
  const helper=
"let advanceCashCreditConfirmedV193='';\n\n"+
"function validAdvanceCashCreditUsernameV198(value){\n"+
"  const username=String(value||'').trim().toUpperCase();\n"+
"  const digitsOnly=(text)=>text.length>0 && [...text].every(ch=>ch>='0'&&ch<='9');\n"+
"  if(username.startsWith('F')){\n"+
"    return username.length===4 && digitsOnly(username.slice(1));\n"+
"  }\n"+
"  return username.length>=1 && username.length<=5 && digitsOnly(username);\n"+
"}";
  if(!app.includes(marker)){console.error('Stage 198 confirmation state marker missing');process.exit(1);}
  app=app.replace(marker,helper);
}

const oldValidation="if(!(/^(?:\\d{1,5}|F\\d{3})$/.test(username))){if(error) error.textContent='Enter a valid Regular username (up to 5 digits) or Flexible username (F + 3 digits).';return;}";
const newValidation="if(!validAdvanceCashCreditUsernameV198(username)){if(error) error.textContent='Enter a valid Regular username (up to 5 digits) or Flexible username (F + 3 digits).';return;}";
let count=0;
while(app.includes(oldValidation)){app=app.replace(oldValidation,newValidation);count++;}
if(count<1){console.error('Stage 198 validation marker missing');process.exit(1);}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=198'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=198');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=198');
html=html.replace(/bank-transfer-v129\.js\?v=\d+/g,'bank-transfer-v129.js?v=198');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=198');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v198';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 198 final Flexible username confirmation validation applied.');
