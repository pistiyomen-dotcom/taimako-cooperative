const fs=require('fs');

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/\s*<dialog id="cashCreditDialog">[\s\S]*?<\/dialog>\s*/,'\n');
html=html.replace(/\s*<script src="cash-credit\.js\?v=\d+"><\/script>/g,'');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=65');
html=html.replace(/dashboard-refresh\.js\?v=\d+/g,'dashboard-refresh.js?v=65');
fs.writeFileSync('www/index.html',html);

let app=fs.readFileSync('www/app.js','utf8');
app=app.replace(/\s*\['CASH CREDIT',\s*'Credit member payment to the selected destination'\],?/,'');
app=app.replace(/\s*if \(title === 'CASH CREDIT'\) \{[^\n]*\}/,'');
app=app.replace(/const cashCreditDialog = document\.getElementById\('cashCreditDialog'\);\n?/,'');
app=app.replace(/const cashCreditForm = document\.getElementById\('cashCreditForm'\);\n?/,'');
app=app.replace(/const cashCreditError = document\.getElementById\('cashCreditError'\);\n?/,'');
app=app.replace(/const cashCreditSuccess = document\.getElementById\('cashCreditSuccess'\);\n?/,'');
app=app.replace(/const creditMemberConfirm = document\.getElementById\('creditMemberConfirm'\);\n?/,'');
app=app.replace(/[\s\S]*?document\.getElementById\('creditUsername'\)\.addEventListener\('input',[\s\S]*?cashCreditForm\.addEventListener\('submit',[\s\S]*?\n\}\);/m,(m)=>m);
fs.writeFileSync('www/app.js',app);

if(fs.existsSync('www/cash-credit.js')) fs.unlinkSync('www/cash-credit.js');

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v65';");
sw=sw.replace(/,'\.\/cash-credit\.js'/g,'');
sw=sw.replace(/'\.\/cash-credit\.js',?/g,'');
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 65 removed existing Manual Cash Credit UI and entry.');
