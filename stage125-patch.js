const fs=require('fs');

let account=fs.readFileSync('server/routes/account.js','utf8');
const constantBefore=(account.match(/b\.constant_balance/g)||[]).length;
account=account.replace(/b\.constant_balance/g,'b.constant');
fs.writeFileSync('server/routes/account.js',account);

let app=fs.readFileSync('www/app.js','utf8');

/* Correct the literal source text /BANK\\s*TRANSFER/i to /BANK\s*TRANSFER/i. */
app=app.split('/BANK\\\\s*TRANSFER/i').join('/BANK\\s*TRANSFER/i');

/* Remove the fragile Stage 123 click listener entirely; the submit handler itself gives feedback. */
const clickStart=app.indexOf('/* payment-submit-click-feedback-v123 */');
if(clickStart>=0){
  const submitStart=app.indexOf("paymentForm.addEventListener('submit'",clickStart);
  if(submitStart>clickStart) app=app.slice(0,clickStart)+app.slice(submitStart);
}

/* Put visible feedback at the very first line of the real submit handler. */
const submitMarker="paymentForm.addEventListener('submit', async (e) => {\n  e.preventDefault();";
if(app.includes(submitMarker) && !app.includes("paymentSuccess.textContent='Processing bank-transfer submission…';\n  paymentError.textContent='';")){
  app=app.replace(
    submitMarker,
    "paymentForm.addEventListener('submit', async (e) => {\n  e.preventDefault();\n  paymentSuccess.textContent='Processing bank-transfer submission…';"
  );
}

/* Keep browser-native validation disabled for this form. */
if(!app.includes('paymentForm.noValidate=true;')){
  app=app.replace("paymentForm.addEventListener('submit', async (e) => {","paymentForm.noValidate=true;\npaymentForm.addEventListener('submit', async (e) => {");
}

app=app.replace(/serviceWorker\.register\('\.\/sw\.js\?v=\d+'/, "serviceWorker.register('./sw.js?v=125'");
fs.writeFileSync('www/app.js',app);

let html=fs.readFileSync('www/index.html','utf8');
html=html.replace(/app\.js\?v=\d+/g,'app.js?v=125');
html=html.replace(/styles\.css\?v=\d+/g,'styles.css?v=125');
html=html.replace(/cash-credit-v66\.js\?v=\d+/g,'cash-credit-v66.js?v=125');
fs.writeFileSync('www/index.html',html);

let sw=fs.readFileSync('www/sw.js','utf8');
sw=sw.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v125';");
fs.writeFileSync('www/sw.js',sw);

console.log('TAIMAKO Stage 125 exact bank-transfer fixes applied. constant_balance replacements:',constantBefore);
